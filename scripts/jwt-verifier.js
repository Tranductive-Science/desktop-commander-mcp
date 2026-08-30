import { createRemoteJWKSet, jwtVerify } from 'jose';

const ISSUER = process.env.DESKTOP_COMMANDER_OAUTH_ISSUER || 'https://desktopcommander-auth.seyferthfriso.workers.dev';
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));

export async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: ISSUER,
  });

  return {
    token,
    clientId: String(payload.client_id || payload.sub || 'chatgpt'),
    scopes: (typeof payload.scope === 'string' ? payload.scope.split(/[ ,]+/) : ['mcp']).filter(Boolean),
    expiresAt: payload.exp ? payload.exp * 1000 : undefined,
    extra: payload
  };
}
