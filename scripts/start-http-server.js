import fs from 'node:fs';

process.env.USERPROFILE = process.env.USERPROFILE || 'C:\\Users\\Admin';
process.env.HOME = process.env.HOME || 'C:\\Users\\Admin';
process.env.DESKTOP_COMMANDER_HTTP_HOST = process.env.DESKTOP_COMMANDER_HTTP_HOST || '127.0.0.1';
process.env.DESKTOP_COMMANDER_HTTP_PORT = process.env.DESKTOP_COMMANDER_HTTP_PORT || '9180';
process.env.DESKTOP_COMMANDER_HTTP_AUTH = process.env.DESKTOP_COMMANDER_HTTP_AUTH || 'oauth';
process.env.DESKTOP_COMMANDER_OAUTH_ISSUER = process.env.DESKTOP_COMMANDER_OAUTH_ISSUER || 'https://desktopcommander-auth.seyferthfriso.workers.dev';
process.env.DESKTOP_COMMANDER_OAUTH_VERIFIER_MODULE = process.env.DESKTOP_COMMANDER_OAUTH_VERIFIER_MODULE || './scripts/jwt-verifier.js';
process.env.DESKTOP_COMMANDER_PUBLIC_BASE_URL = process.env.DESKTOP_COMMANDER_PUBLIC_BASE_URL || 'https://desktopcommander.transductive.art';
process.env.DESKTOP_COMMANDER_DISABLE_TELEMETRY = '1';

process.on('uncaughtException', (err) => {
    try {
        fs.appendFileSync('E:/Dev/DesktopCommanderMCP/logs/http-service.error.log', `[${new Date().toISOString()}] Uncaught Exception: ${err?.stack || err}\n`);
    } catch {}
});

process.on('unhandledRejection', (reason) => {
    try {
        fs.appendFileSync('E:/Dev/DesktopCommanderMCP/logs/http-service.error.log', `[${new Date().toISOString()}] Unhandled Rejection: ${reason?.stack || reason}\n`);
    } catch {}
});

async function main() {
    const { runHttpServer } = await import('../dist/http/index.js');
    await runHttpServer();
    setInterval(() => {}, 60000);
}

main().catch(err => {
    try {
        fs.appendFileSync('E:/Dev/DesktopCommanderMCP/logs/http-service.error.log', `[${new Date().toISOString()}] Fatal main error: ${err?.stack || err}\n`);
    } catch {}
    process.exit(1);
});
