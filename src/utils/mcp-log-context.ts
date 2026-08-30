import { AsyncLocalStorage } from 'node:async_hooks';

export type McpLogLevel = 'emergency' | 'alert' | 'critical' | 'error' | 'warning' | 'notice' | 'info' | 'debug';
export type McpLogSink = (level: McpLogLevel, message: string, data?: unknown) => void;

const logSinkContext = new AsyncLocalStorage<McpLogSink>();

export function runWithMcpLogSink<T>(sink: McpLogSink, fn: () => T): T {
    return logSinkContext.run(sink, fn);
}

export function getMcpLogSink(): McpLogSink | undefined {
    return logSinkContext.getStore();
}
