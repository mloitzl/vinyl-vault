import crypto from 'crypto';
import { config } from '../config/env.js';

const SIGNATURE_PREFIX = 'sha256=';

function toBuffer(payload: Buffer | string): Buffer {
  return Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
}

function getWebhookSecret(): string {
  let secret = config.github.appWebhookSecret;
  return secret;
}

export function verifyWebhookSignature(
  payload: Buffer | string,
  signature: string | undefined
): boolean {
  if (!signature || !signature.startsWith(SIGNATURE_PREFIX)) {
    console.warn('[webhook] Invalid signature format or missing');
    return false;
  }

  const secret = getWebhookSecret();
  if (!secret) {
    console.warn('[webhook] No webhook secret configured');
    return false;
  }

  const payloadBuf = toBuffer(payload);
  const computed = `${SIGNATURE_PREFIX}${crypto
    .createHmac('sha256', secret)
    .update(payloadBuf)
    .digest('hex')}`;

  const signatureBuf = Buffer.from(signature);
  const computedBuf = Buffer.from(computed);

  console.log('[webhook] Signature verification:');
  console.log('  Secret length:', secret.length);
  console.log('  Secret (first 20 chars):', secret.substring(0, 20));
  console.log('  Received:', signature.substring(0, 50) + '...');
  console.log('  Computed:', computed.substring(0, 50) + '...');
  console.log('  Payload size:', payloadBuf.length, 'bytes');
  console.log('  Payload (first 100 chars):', payloadBuf.toString('utf8').substring(0, 100));

  if (signatureBuf.length !== computedBuf.length) {
    console.warn(
      '[webhook] Signature length mismatch:',
      signatureBuf.length,
      'vs',
      computedBuf.length
    );
    return false;
  }

  const isValid = crypto.timingSafeEqual(signatureBuf, computedBuf);
  if (!isValid) {
    console.warn('[webhook] Signature verification failed');
  } else {
    console.log('[webhook] ✓ Signature verified successfully');
  }
  return isValid;
}

export async function forwardWebhookToBackend(payload: Buffer, signature: string): Promise<any> {
  const mutation = `
    mutation HandleGitHubInstallationWebhook($input: GitHubInstallationWebhookInput!) {
      handleGitHubInstallationWebhook(input: $input) {
        ok
        message
      }
    }
  `;

  const response = await fetch(config.backend.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        input: {
          payloadBase64: payload.toString('base64'),
          signature,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Backend webhook relay failed: HTTP ${response.status}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(`Backend webhook relay error: ${JSON.stringify(json.errors)}`);
  }

  return json.data?.handleGitHubInstallationWebhook ?? null;
}
