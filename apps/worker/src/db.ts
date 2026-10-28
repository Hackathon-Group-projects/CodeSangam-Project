import { PrismaClient } from '@vishanti/db';
import { config } from './config';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.directUrl || config.databaseUrl
    }
  }
});
