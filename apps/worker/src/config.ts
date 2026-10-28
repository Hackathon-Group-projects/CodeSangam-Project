import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load repository root .env
const envPaths = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(__dirname, '../../../.env'),
  resolve(__dirname, '../../../../.env')
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
      break;
    } catch {
      // Ignore if loadEnvFile is not available
    }
  }
}

export const config = {
  databaseUrl: process.env.DATABASE_URL || 'postgresql://app_user:app_pass@localhost:5432/vishanti_ledger?schema=public',
  directUrl: process.env.DIRECT_URL || 'postgresql://vishanti_admin:admin_pass@localhost:5432/vishanti_ledger?schema=public',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
    accessKey: process.env.MINIO_ROOT_USER || 'minioadmin',
    secretKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
    bucket: process.env.MINIO_BUCKET_NAME || 'vishanti-attachments'
  },
  clamav: {
    host: process.env.CLAMAV_HOST || '127.0.0.1',
    port: parseInt(process.env.CLAMAV_PORT || '3310', 10)
  },
  hmacSecret: process.env.HMAC_SECRET || 'development-hmac-secret-min-32-bytes-long'
};
