import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const jwkPublic = crypto.createPublicKey(publicKey).export({ format: 'jwk' });
jwkPublic.kid = 'dc-auth-key-1';
jwkPublic.use = 'sig';
jwkPublic.alg = 'RS256';

const jwkPrivate = crypto.createPrivateKey(privateKey).export({ format: 'jwk' });
jwkPrivate.kid = 'dc-auth-key-1';
jwkPrivate.use = 'sig';
jwkPrivate.alg = 'RS256';

const outDir = path.resolve('E:/Dev/DesktopCommanderMCP/cloudflare-auth-worker/src');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(
  path.join(outDir, 'keys.js'),
  `export const PUBLIC_JWK = ${JSON.stringify(jwkPublic, null, 2)};\n\nexport const PRIVATE_JWK = ${JSON.stringify(jwkPrivate, null, 2)};\n`
);

console.log('Keys generated successfully in cloudflare-auth-worker/src/keys.js');
