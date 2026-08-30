import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createServer } from '../server.js';
import { configManager } from '../config-manager.js';
import { featureFlagManager } from '../utils/feature-flags.js';
import { ensureChromeAvailable } from '../tools/pdf/markdown.js';
import { logger } from '../utils/logger.js';
import { createMcpHttpRouter } from './mcp-router.js';
import { loadHttpAuthConfig, authorizeHttpRequest, protectedResourceMetadata, type HttpAuthInfo } from './auth.js';
import { resolvePublicBaseUrl, resolvePublicMcpUrl } from './public-url.js';
import { createReadinessState, completeReadinessTask, readinessPayload } from './readiness.js';
import { renderDashboardHtml } from './dashboard.js';

const MAX_BODY_BYTES = 4 * 1024 * 1024;

function writeJson(res: ServerResponse, status: number, value: unknown): void {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(value));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Request body too large'), { statusCode: 413 });
        chunks.push(buffer);
    }
    if (chunks.length === 0) return undefined;
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function publicResourceMetadataUrl(req: IncomingMessage): string {
    return `${resolvePublicBaseUrl(req)}/.well-known/oauth-protected-resource/mcp`;
}

export async function runHttpServer(): Promise<void> {
    // HTTP is a remote/server surface; reuse the existing onboarding-disable mechanism
    // so a remote MCP initialize cannot open local first-run UI on the host machine.
    (global as any).disableOnboarding = true;

    const host = process.env.DESKTOP_COMMANDER_HTTP_HOST || '127.0.0.1';
    const port = Number(process.env.DESKTOP_COMMANDER_HTTP_PORT || '9180');
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid DESKTOP_COMMANDER_HTTP_PORT: ${port}`);

    const readiness = createReadinessState(['configuration', 'feature-flags']);
    const authConfig = await loadHttpAuthConfig();
    const router = createMcpHttpRouter({
        createServer: () => createServer(),
        isInitializeRequest,
        createTransport: ({ onSessionInitialized, onSessionClosed }) => new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            enableJsonResponse: true,
            onsessioninitialized: onSessionInitialized,
            onsessionclosed: onSessionClosed,
        }),
    });

    const nodeServer = http.createServer(async (req: IncomingMessage & { auth?: HttpAuthInfo }, res) => {
        try {
            const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

            if (req.method === 'GET' && url.pathname === '/healthz') {
                writeJson(res, 200, { ok: true });
                return;
            }
            if (req.method === 'GET' && url.pathname === '/readyz') {
                writeJson(res, readiness.ready ? 200 : 503, readinessPayload(readiness));
                return;
            }
            if (req.method === 'GET' && url.pathname === '/.well-known/oauth-protected-resource/mcp') {
                const metadata = protectedResourceMetadata(authConfig, resolvePublicMcpUrl(req));
                if (!metadata) { writeJson(res, 404, { error: 'OAuth resource metadata is not enabled' }); return; }
                writeJson(res, 200, metadata);
                return;
            }
            if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/dashboard' || (url.pathname === '/mcp' && String(req.headers.accept || '').includes('text/html')))) {
                const html = renderDashboardHtml({
                    port,
                    publicUrl: resolvePublicBaseUrl(req),
                    authIssuer: authConfig.oauthIssuer || 'https://desktopcommander-auth.seyferthfriso.workers.dev',
                    authMode: authConfig.mode,
                    uptimeSeconds: Math.floor(process.uptime()),
                    version: '0.2.47',
                });
                res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
                res.end(html);
                return;
            }

            if (url.pathname !== '/mcp') {
                writeJson(res, 404, { error: 'Not Found' });
                return;
            }

            if (!await authorizeHttpRequest(req, res, authConfig, publicResourceMetadataUrl(req))) return;

            const accept = String(req.headers.accept || '');
            if (!accept.includes('text/event-stream')) {
                req.headers.accept = accept ? `${accept}, text/event-stream` : 'application/json, text/event-stream';
            }

            if (req.method === 'POST') {
                const body = await readJsonBody(req);
                await router.handlePost(req, res, body);
                return;
            }
            if (req.method === 'GET' || req.method === 'DELETE') {
                await router.handleSessionRequest(req, res);
                return;
            }
            writeJson(res, 405, { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
        } catch (error) {
            const status = typeof (error as { statusCode?: unknown }).statusCode === 'number' ? (error as { statusCode: number }).statusCode : 500;
            if (!res.headersSent) writeJson(res, status, { jsonrpc: '2.0', error: { code: status === 500 ? -32603 : -32000, message: status === 500 ? 'Internal server error' : String((error as Error).message) }, id: null });
            logger.error(`HTTP MCP request failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    const shutdown = async () => {
        await router.cleanup();
        await new Promise<void>(resolve => nodeServer.close(() => resolve()));
    };
    process.once('SIGINT', () => { void shutdown().finally(() => process.exit(0)); });
    process.once('SIGTERM', () => { void shutdown().finally(() => process.exit(0)); });

    nodeServer.listen(port, host);
    await new Promise<void>((resolve, reject) => {
        nodeServer.once('listening', resolve);
        nodeServer.once('error', reject);
    });

    try { await configManager.loadConfig(); } finally { completeReadinessTask(readiness); }
    try { await featureFlagManager.initialize(); } finally { completeReadinessTask(readiness); }

    ensureChromeAvailable();
    process.stderr.write(`[Desktop Commander] Streamable HTTP listening on http://${host}:${port}/mcp (auth=${authConfig.mode})\n`);
}
