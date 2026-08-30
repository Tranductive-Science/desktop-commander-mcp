import type { IncomingMessage } from 'node:http';

function firstForwardedValue(value: string | string[] | undefined): string | undefined {
    const headerValue = Array.isArray(value) ? value[0] : value;
    if (!headerValue) return undefined;
    const first = headerValue.split(',')[0]?.trim();
    return first && first.length > 0 ? first : undefined;
}

export function resolvePublicBaseUrl(req: IncomingMessage): string {
    const configured = process.env.DESKTOP_COMMANDER_PUBLIC_BASE_URL?.trim();
    if (configured) return configured.replace(/\/+$/, '');

    const proto = firstForwardedValue(req.headers['x-forwarded-proto'])
        || ((req.socket as typeof req.socket & { encrypted?: boolean }).encrypted ? 'https' : 'http');
    const host = firstForwardedValue(req.headers['x-forwarded-host'])
        || firstForwardedValue(req.headers.host)
        || 'localhost';
    return `${proto}://${host}`;
}

export function resolvePublicMcpUrl(req: IncomingMessage): string {
    return `${resolvePublicBaseUrl(req)}/mcp`;
}
