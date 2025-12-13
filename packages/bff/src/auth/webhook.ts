import crypto from 'crypto';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const SIGNATURE_PREFIX = 'sha256=';

function toBuffer(payload: Buffer | string): Buffer {
  return Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
}

function getWebhookSecret(): string {
  const secret = config.github.appWebhookSecret;
  return secret;
}

export function verifyWebhookSignature(
  payload: Buffer | string,
  signature: string | undefined
): boolean {
  if (!signature || !signature.startsWith(SIGNATURE_PREFIX)) {
    logger.warn('Webhook invalid signature format or missing');
    return false;
  }

  const secret = getWebhookSecret();
  if (!secret) {
    logger.warn('No webhook secret configured');
    return false;
  }

  const payloadBuf = toBuffer(payload);
  const computed = `${SIGNATURE_PREFIX}${crypto
    .createHmac('sha256', secret)
    .update(payloadBuf)
    .digest('hex')}`;

  const signatureBuf = Buffer.from(signature);
  const computedBuf = Buffer.from(computed);

  logger.debug(
    {
      secretLength: secret.length,
      payloadSize: payloadBuf.length,
      signatureReceived: signature.substring(0, 50),
      signatureComputed: computed.substring(0, 50),
    },
    'Webhook signature verification'
  );

  if (signatureBuf.length !== computedBuf.length) {
    logger.warn(
      { receivedLength: signatureBuf.length, computedLength: computedBuf.length },
      'Webhook signature length mismatch'
    );
    return false;
  }

  const isValid = crypto.timingSafeEqual(signatureBuf, computedBuf);
  if (!isValid) {
    logger.warn('Webhook signature verification failed');
  } else {
    logger.debug('Webhook signature verified successfully');
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
