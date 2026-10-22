import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

const fastify = Fastify({
  logger: true,
});

async function main() {
  await fastify.register(cors, {
    origin: '*',
    credentials: true,
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok', service: 'Vishanti Core API', timestamp: new Date().toISOString() };
  });

  // Root endpoint
  fastify.get('/', async () => {
    return { message: 'The Vishanti Ledger API is active.' };
  });

  const port = Number(process.env.PORT) || 4000;
  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Vishanti API running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
