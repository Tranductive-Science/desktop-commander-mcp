import { AsyncLocalStorage } from 'node:async_hooks';

export interface DesktopCommanderClientInfo {
    name?: string;
    version?: string;
}

export interface DesktopCommanderServerState {
    currentClient: DesktopCommanderClientInfo;
    currentCallIsRemote: boolean;
    currentRemoteClient: DesktopCommanderClientInfo | null;
}

const serverContext = new AsyncLocalStorage<DesktopCommanderServerState>();
let defaultServerState: DesktopCommanderServerState | undefined;

export function setDefaultServerState(state: DesktopCommanderServerState): void {
    defaultServerState = state;
}

export function runInServerContext<T>(state: DesktopCommanderServerState, fn: () => T): T {
    return serverContext.run(state, fn);
}

export function getCurrentClient(): DesktopCommanderClientInfo {
    return serverContext.getStore()?.currentClient
        ?? defaultServerState?.currentClient
        ?? { name: 'uninitialized', version: 'uninitialized' };
}

export function getCurrentCallIsRemote(): boolean {
    return serverContext.getStore()?.currentCallIsRemote
        ?? defaultServerState?.currentCallIsRemote
        ?? false;
}

export function getCurrentRemoteClient(): DesktopCommanderClientInfo | null {
    return serverContext.getStore()?.currentRemoteClient
        ?? defaultServerState?.currentRemoteClient
        ?? null;
}
