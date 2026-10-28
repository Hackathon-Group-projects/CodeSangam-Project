import './load-env';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { registerAuthRoutes } from './auth/routes';
import { registerTicketRoutes } from './routes/tickets';
import { registerTicketActionRoutes } from './routes/ticket-actions';
import { ApiError } from './errors';
import { prisma } from './db';
import { redis } from './redis';
import { config } from './config';
import { startNotificationHub, stopNotificationHub } from './services/notifications';

const fastify = Fastify({
  logger: {
    serializers: {
      req(request) {
        return { method: request.method, url: request.url, host: request.headers.host };
      }
    }
  }
});

async function main(): Promise<void> {
  await fastify.register(cors, {
    origin: config.webOrigin,
    credentials: true
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false
  });

  // Remove IP headers supplied by browsers and reverse proxies before handling the request.
  fastify.addHook('onRequest', async (request) => {
    for (const header of [
      'forwarded',
      'x-forwarded-for',
      'x-forwarded-client-ip',
      'x-original-forwarded-for',
      'x-real-ip',
      'x-client-ip',
      'x-cluster-client-ip',
      'cf-connecting-ip',
      'x-envoy-external-address',
      'true-client-ip'
    ]) {
      delete request.headers[header];
    }
  });

  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({ success: false, message: error.message });
    }

    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ success: false, message: error.message });
    }

    request.log.error({ err: error }, 'Request failed');
    return reply.code(500).send({ success: false, message: 'The server could not complete the request' });
  });

  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'Vishanti Core API',
    timestamp: new Date().toISOString()
  }));

  fastify.get('/', async () => ({ message: 'The Vishanti Ledger API is active.' }));

  await registerAuthRoutes(fastify);
  await registerTicketRoutes(fastify);
  await registerTicketActionRoutes(fastify);

  fastify.addHook('onClose', async () => {
    await stopNotificationHub();
    redis.disconnect();
    await prisma.$disconnect();
  });

  await prisma.$connect();
  await redis.connect();
  await redis.ping();
  await startNotificationHub(fastify.server);
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  fastify.log.info(`Vishanti API running on http://localhost:${config.port}`);
}

main().catch(async (error: unknown) => {
  fastify.log.error({ err: error }, 'API startup failed');
  await stopNotificationHub().catch(() => undefined);
  redis.disconnect();
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
