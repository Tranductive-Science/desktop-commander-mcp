import type { IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export interface HttpAuthInfo {
    token: string;
    clientId: string;
    scopes: string[];
    expiresAt?: number;
    extra?: Record<string, unknown>;
}

export interface AccessTokenVerifier {
    verifyAccessToken(token: string): Promise<HttpAuthInfo>;
}

export type HttpAuthMode = 'none' | 'bearer' | 'oauth';

export interface HttpAuthConfig {
    mode: HttpAuthMode;
    staticToken?: string;
    oauthIssuer?: string;
    verifier?: AccessTokenVerifier;
    requiredScopes: string[];
}

function parseScopes(value: string | undefined): string[] {
    return (value || 'mcp').split(/[ ,]+/).map(s => s.trim()).filter(Boolean);
}

export async function loadHttpAuthConfig(): Promise<HttpAuthConfig> {
    const rawMode = (process.env.DESKTOP_COMMANDER_HTTP_AUTH || 'none').toLowerCase();
    if (!['none', 'bearer', 'oauth'].includes(rawMode)) {
        throw new Error(`Unsupported DESKTOP_COMMANDER_HTTP_AUTH mode: ${rawMode}`);
    }
    const mode = rawMode as HttpAuthMode;
    const requiredScopes = parseScopes(process.env.DESKTOP_COMMANDER_OAUTH_REQUIRED_SCOPES);

    if (mode === 'bearer') {
        const staticToken = process.env.DESKTOP_COMMANDER_HTTP_BEARER_TOKEN;
        if (!staticToken) throw new Error('DESKTOP_COMMANDER_HTTP_BEARER_TOKEN is required for bearer auth');
        return { mode, staticToken, requiredScopes };
    }

    if (mode === 'oauth') {
        const oauthIssuer = process.env.DESKTOP_COMMANDER_OAUTH_ISSUER;
        const moduleSpecifier = process.env.DESKTOP_COMMANDER_OAUTH_VERIFIER_MODULE;
        if (!oauthIssuer) throw new Error('DESKTOP_COMMANDER_OAUTH_ISSUER is required for oauth auth');
        if (!moduleSpecifier) throw new Error('DESKTOP_COMMANDER_OAUTH_VERIFIER_MODULE is required for oauth auth');

        const resolvedSpecifier = moduleSpecifier.startsWith('.') || path.isAbsolute(moduleSpecifier)
            ? pathToFileURL(path.resolve(moduleSpecifier)).href
            : moduleSpecifier;
        const loaded = await import(resolvedSpecifier);
        const candidate = loaded.default ?? loaded;
        const verifier: AccessTokenVerifier = typeof candidate.verifyAccessToken === 'function'
            ? candidate as AccessTokenVerifier
            : typeof loaded.verifyAccessToken === 'function'
                ? { verifyAccessToken: loaded.verifyAccessToken }
                : (() => { throw new Error('OAuth verifier module must export verifyAccessToken(token)'); })();
        return { mode, oauthIssuer, verifier, requiredScopes };
    }

    return { mode, requiredScopes };
}

function sendJson(res: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}): void {
    if (res.headersSent) return;
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(JSON.stringify(value));
}

function bearerToken(req: IncomingMessage): string | undefined {
    const value = req.headers.authorization;
    if (!value) return undefined;
    const [scheme, token] = value.trim().split(/\s+/, 2);
    return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

function constantTimeTokenEqual(a: string, b: string): boolean {
    const aa = Buffer.from(a);
    const bb = Buffer.from(b);
    return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function challenge(resourceMetadataUrl?: string, error = 'invalid_token', description = 'Invalid or missing bearer token', scopes: string[] = []): string {
    let value = `Bearer error="${error}", error_description="${description}"`;
    if (scopes.length) value += `, scope="${scopes.join(' ')}"`;
    if (resourceMetadataUrl) value += `, resource_metadata="${resourceMetadataUrl}"`;
    return value;
}

export async function authorizeHttpRequest(
    req: IncomingMessage & { auth?: HttpAuthInfo },
    res: ServerResponse,
    config: HttpAuthConfig,
    resourceMetadataUrl?: string,
): Promise<boolean> {
    if (config.mode === 'none') return true;

    const token = bearerToken(req);
    if (!token) {
        sendJson(res, 401, { jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null }, {
            'www-authenticate': challenge(config.mode === 'oauth' ? resourceMetadataUrl : undefined, 'invalid_token', 'Missing Authorization header', config.requiredScopes),
        });
        return false;
    }

    let authInfo: HttpAuthInfo;
    try {
        if (config.mode === 'bearer') {
            if (!config.staticToken || !constantTimeTokenEqual(token, config.staticToken)) throw new Error('unknown token');
            authInfo = { token, clientId: 'desktop-commander-static', scopes: config.requiredScopes };
        } else {
            authInfo = await config.verifier!.verifyAccessToken(token);
        }
    } catch {
        sendJson(res, 401, { jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null }, {
            'www-authenticate': challenge(resourceMetadataUrl, 'invalid_token', 'Invalid bearer token', config.requiredScopes),
        });
        return false;
    }

    const missingScope = config.requiredScopes.find(scope => !authInfo.scopes.includes(scope));
    if (missingScope) {
        sendJson(res, 403, { jsonrpc: '2.0', error: { code: -32003, message: 'Insufficient scope' }, id: null }, {
            'www-authenticate': challenge(resourceMetadataUrl, 'insufficient_scope', 'Insufficient scope', config.requiredScopes),
        });
        return false;
    }
    if (config.mode === 'oauth') {
        if (typeof authInfo.expiresAt !== 'number' || Number.isNaN(authInfo.expiresAt)) {
            sendJson(res, 401, { jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null }, {
                'www-authenticate': challenge(resourceMetadataUrl, 'invalid_token', 'Token has no expiration time', config.requiredScopes),
            });
            return false;
        }
        if (authInfo.expiresAt < Date.now() / 1000) {
            sendJson(res, 401, { jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null }, {
                'www-authenticate': challenge(resourceMetadataUrl, 'invalid_token', 'Token has expired', config.requiredScopes),
            });
            return false;
        }
    }

    req.auth = authInfo;
    return true;
}

export function protectedResourceMetadata(config: HttpAuthConfig, resourceUrl: string): object | undefined {
    if (config.mode !== 'oauth' || !config.oauthIssuer) return undefined;
    return {
        resource: resourceUrl,
        authorization_servers: [config.oauthIssuer],
        scopes_supported: config.requiredScopes,
        resource_name: 'Desktop Commander',
    };
}
