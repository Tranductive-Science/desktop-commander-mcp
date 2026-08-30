import type { IncomingMessage, ServerResponse } from 'node:http';
import { runWithMcpLogSink, type McpLogSink, type McpLogLevel } from '../utils/mcp-log-context.js';

export interface McpServerLike {
    connect(transport: any): Promise<void>;
    close(): Promise<void>;
    sendLoggingMessage(message: { level: McpLogLevel; logger: string; data: unknown }): Promise<void>;
}

export interface McpTransportLike {
    handleRequest(req: IncomingMessage & { auth?: unknown }, res: ServerResponse, parsedBody?: unknown): Promise<void>;
    close(): Promise<void>;
}

export interface CreateTransportOptions {
    onSessionInitialized(sessionId: string): void | Promise<void>;
    onSessionClosed(sessionId: string): void | Promise<void>;
}

export interface McpHttpRouterOptions {
    createServer(): McpServerLike;
    createTransport(options: CreateTransportOptions): McpTransportLike;
    isInitializeRequest(body: unknown): boolean;
}

interface SessionEntry { transport: McpTransportLike; server: McpServerLike; }

function sendJson(res: ServerResponse, status: number, value: unknown): void {
    if (res.headersSent) return;
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(value));
}

function requestSessionId(req: IncomingMessage): string | undefined {
    const value = req.headers['mcp-session-id'];
    return Array.isArray(value) ? value[0] : value;
}

function logSinkFor(server: McpServerLike): McpLogSink {
    return (level, message, data) => {
        void server.sendLoggingMessage({
            level,
            logger: 'desktop-commander',
            data: data ? { message, ...(typeof data === 'object' && data !== null ? data as object : { data }) } : message,
        }).catch(error => {
            process.stderr.write(`[DesktopCommander HTTP logger] ${String(error)}\n`);
        });
    };
}

export function createMcpHttpRouter(options: McpHttpRouterOptions) {
    const sessions = new Map<string, SessionEntry>();

    async function handlePost(req: IncomingMessage & { auth?: unknown }, res: ServerResponse, body: unknown): Promise<void> {
        const sessionId = requestSessionId(req);
        if (sessionId) {
            const entry = sessions.get(sessionId);
            if (!entry) {
                sendJson(res, 404, { jsonrpc: '2.0', error: { code: -32000, message: 'Not Found: No session found for that ID' }, id: sessionId });
                return;
            }
            await runWithMcpLogSink(logSinkFor(entry.server), () => entry.transport.handleRequest(req, res, body));
            return;
        }

        if (!options.isInitializeRequest(body)) {
            sendJson(res, 400, { jsonrpc: '2.0', error: { code: -32000, message: 'Invalid request: Missing session ID' }, id: null });
            return;
        }

        const server = options.createServer();
        let transport!: McpTransportLike;
        transport = options.createTransport({
            onSessionInitialized: async newSessionId => {
                sessions.set(newSessionId, { transport, server });
            },
            onSessionClosed: async closedSessionId => {
                const entry = sessions.get(closedSessionId);
                sessions.delete(closedSessionId);
                if (entry) await entry.server.close();
            },
        });

        await server.connect(transport);
        await runWithMcpLogSink(logSinkFor(server), () => transport.handleRequest(req, res, body));
    }

    async function handleSessionRequest(req: IncomingMessage & { auth?: unknown }, res: ServerResponse): Promise<void> {
        const sessionId = requestSessionId(req);
        if (!sessionId) {
            sendJson(res, 400, { jsonrpc: '2.0', error: { code: -32000, message: 'Invalid request: Missing session ID' }, id: null });
            return;
        }
        const entry = sessions.get(sessionId);
        if (!entry) {
            sendJson(res, 404, { jsonrpc: '2.0', error: { code: -32000, message: 'Not Found: No session found for that ID' }, id: sessionId });
            return;
        }
        await runWithMcpLogSink(logSinkFor(entry.server), () => entry.transport.handleRequest(req, res));
    }

    async function cleanup(): Promise<void> {
        const entries = [...sessions.values()];
        sessions.clear();
        await Promise.allSettled(entries.flatMap(entry => [entry.transport.close(), entry.server.close()]));
    }

    return { handlePost, handleSessionRequest, cleanup, sessionCount: () => sessions.size };
}
