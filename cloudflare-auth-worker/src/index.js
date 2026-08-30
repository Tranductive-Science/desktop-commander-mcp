import { PUBLIC_JWK, PRIVATE_JWK } from './keys.js';

let privateKeyPromise = null;
async function getPrivateKey() {
  if (!privateKeyPromise) {
    privateKeyPromise = crypto.subtle.importKey(
      'jwk',
      PRIVATE_JWK,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
  }
  return privateKeyPromise;
}

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function signJwt(payload, issuer) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: PUBLIC_JWK.kid || 'dc-auth-key-1'
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    iss: issuer,
    sub: 'desktop-commander-owner',
    aud: 'https://desktopcommander.transductive.art/mcp',
    iat: now,
    exp: now + 86400, // 24 hours
    scope: 'mcp openid profile email',
    ...payload
  };

  const encHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(fullPayload)));
  const data = new TextEncoder().encode(`${encHeader}.${encPayload}`);

  const privateKey = await getPrivateKey();
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, data);
  const encSignature = base64UrlEncode(signature);

  return `${encHeader}.${encPayload}.${encSignature}`;
}

async function sha256Base64Url(str) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return base64UrlEncode(digest);
}

function getIssuer(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization'
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const issuer = getIssuer(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'Content-Type, Authorization'
        }
      });
    }

    // 1. OIDC & OAuth Discovery
    if (url.pathname === '/.well-known/openid-configuration' || url.pathname === '/.well-known/oauth-authorization-server') {
      return jsonResponse({
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/.well-known/jwks.json`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256', 'plain'],
        token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
        scopes_supported: ['openid', 'profile', 'email', 'mcp', 'offline_access']
      });
    }

    // 2. JWKS
    if (url.pathname === '/.well-known/jwks.json') {
      return jsonResponse({
        keys: [PUBLIC_JWK]
      });
    }

    // 3. GET /authorize
    if (url.pathname === '/authorize' && request.method === 'GET') {
      const clientId = url.searchParams.get('client_id') || '';
      const redirectUri = url.searchParams.get('redirect_uri') || '';
      const state = url.searchParams.get('state') || '';
      const codeChallenge = url.searchParams.get('code_challenge') || '';
      const codeChallengeMethod = url.searchParams.get('code_challenge_method') || '';
      const scope = url.searchParams.get('scope') || 'mcp';

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize Desktop Commander MCP</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; max-width: 440px; width: 100%; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
    h1 { font-size: 20px; margin-top: 0; color: #38bdf8; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.5; }
    .scope-box { background: #0f172a; border-radius: 6px; padding: 12px; margin: 16px 0; font-family: monospace; font-size: 13px; color: #4ade80; }
    .btn { display: block; width: 100%; padding: 12px; background: #0284c7; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; text-align: center; font-size: 15px; margin-top: 20px; }
    .btn:hover { background: #0369a1; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 Authorize Desktop Commander</h1>
    <p>ChatGPT is requesting permission to access your local Desktop Commander MCP server via secure OAuth 2.0.</p>
    <div class="scope-box">Scopes: ${scope}</div>
    <form method="POST" action="/authorize">
      <input type="hidden" name="client_id" value="${clientId}">
      <input type="hidden" name="redirect_uri" value="${redirectUri}">
      <input type="hidden" name="state" value="${state}">
      <input type="hidden" name="code_challenge" value="${codeChallenge}">
      <input type="hidden" name="code_challenge_method" value="${codeChallengeMethod}">
      <input type="hidden" name="scope" value="${scope}">
      <button type="submit" class="btn">Approve & Connect</button>
    </form>
  </div>
</body>
</html>`;

      return new Response(html, {
        headers: { 'content-type': 'text/html; charset=utf-8' }
      });
    }

    // 4. POST /authorize
    if (url.pathname === '/authorize' && request.method === 'POST') {
      const formData = await request.formData();
      const redirectUri = formData.get('redirect_uri');
      const state = formData.get('state');
      const codeChallenge = formData.get('code_challenge');
      const codeChallengeMethod = formData.get('code_challenge_method');
      const scope = formData.get('scope') || 'mcp';
      const clientId = formData.get('client_id');

      if (!redirectUri) {
        return new Response('Missing redirect_uri', { status: 400 });
      }

      // Pack authorization code
      const codeObj = {
        c: clientId,
        cc: codeChallenge,
        ccm: codeChallengeMethod,
        s: scope,
        exp: Date.now() + 300000 // 5 minutes
      };
      const code = base64UrlEncode(new TextEncoder().encode(JSON.stringify(codeObj)));

      const redirectTarget = new URL(redirectUri);
      redirectTarget.searchParams.set('code', code);
      if (state) redirectTarget.searchParams.set('state', state);

      return Response.redirect(redirectTarget.toString(), 302);
    }

    // 5. POST /token
    if (url.pathname === '/token' && request.method === 'POST') {
      let params = {};
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const text = await request.text();
        const search = new URLSearchParams(text);
        for (const [k, v] of search) params[k] = v;
      } else if (contentType.includes('application/json')) {
        params = await request.json();
      }

      const grantType = params.grant_type;

      if (grantType === 'authorization_code') {
        const codeStr = params.code;
        const codeVerifier = params.code_verifier;

        if (!codeStr) return jsonResponse({ error: 'invalid_request', error_description: 'Missing code' }, 400);

        let codeObj;
        try {
          const raw = new TextDecoder().decode(base64UrlDecode(codeStr));
          codeObj = JSON.parse(raw);
        } catch {
          return jsonResponse({ error: 'invalid_grant', error_description: 'Invalid code format' }, 400);
        }

        if (Date.now() > codeObj.exp) {
          return jsonResponse({ error: 'invalid_grant', error_description: 'Code expired' }, 400);
        }

        // Verify PKCE if present
        if (codeObj.cc) {
          if (!codeVerifier) {
            return jsonResponse({ error: 'invalid_grant', error_description: 'Missing code_verifier' }, 400);
          }
          let computedChallenge = codeVerifier;
          if (codeObj.ccm === 'S256') {
            computedChallenge = await sha256Base64Url(codeVerifier);
          }
          if (computedChallenge !== codeObj.cc) {
            return jsonResponse({ error: 'invalid_grant', error_description: 'PKCE challenge mismatch' }, 400);
          }
        }

        const accessToken = await signJwt({
          client_id: codeObj.c || 'chatgpt',
          scope: codeObj.s || 'mcp'
        }, issuer);

        const refreshToken = await signJwt({
          client_id: codeObj.c || 'chatgpt',
          type: 'refresh'
        }, issuer);

        return jsonResponse({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 86400,
          refresh_token: refreshToken,
          scope: codeObj.s || 'mcp'
        });
      }

      if (grantType === 'refresh_token') {
        const refreshToken = params.refresh_token;
        if (!refreshToken) {
          return jsonResponse({ error: 'invalid_request', error_description: 'Missing refresh_token' }, 400);
        }

        const accessToken = await signJwt({
          scope: 'mcp'
        }, issuer);

        return jsonResponse({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 86400,
          refresh_token: refreshToken,
          scope: 'mcp'
        });
      }

      return jsonResponse({ error: 'unsupported_grant_type' }, 400);
    }

    return jsonResponse({ error: 'Not Found' }, 404);
  }
};
