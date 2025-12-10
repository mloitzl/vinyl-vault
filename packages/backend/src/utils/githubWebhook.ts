import crypto from 'crypto';
import { config } from '../config/index.js';

const SIGNATURE_PREFIX = 'sha256=';

function toBuffer(payload: Buffer | string): Buffer {
  return Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
}

function getWebhookSecret(): string {
  return config.github.appWebhookSecret;
}

export function verifyWebhookSignature(
  payload: Buffer | string,
  signature: string | undefined
): boolean {
  if (!signature || !signature.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const secret = getWebhookSecret();
  if (!secret) return false;

  const payloadBuf = toBuffer(payload);
  const computed = `${SIGNATURE_PREFIX}${crypto
    .createHmac('sha256', secret)
    .update(payloadBuf)
    .digest('hex')}`;

  const signatureBuf = Buffer.from(signature);
  const computedBuf = Buffer.from(computed);

  if (signatureBuf.length !== computedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuf, computedBuf);
}
