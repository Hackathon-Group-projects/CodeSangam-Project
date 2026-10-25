import './load-env';

function requiredSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.startsWith('replace_with_') || Buffer.byteLength(value) < 32) {
    throw new Error(`${name} must be set to a unique secret of at least 32 characters`);
  }
  return value;
}

const port = Number(process.env.PORT || 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port');
}

export const config = {
  port,
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:3000',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: requiredSecret('JWT_SECRET'),
  hmacSecret: requiredSecret('HMAC_SECRET'),
  idempotencyLockSeconds: 300,
  idempotencyResultSeconds: 24 * 60 * 60
};
