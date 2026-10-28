const { randomUUID } = require('node:crypto');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

const apiDir = path.resolve(__dirname, '..');
const repoDir = path.resolve(apiDir, '../..');
const schemaPath = path.join(repoDir, 'packages', 'db', 'prisma', 'schema.prisma');
const prismaCli = path.join(repoDir, 'node_modules', 'prisma', 'build', 'index.js');
const vitestCli = path.join(repoDir, 'node_modules', 'vitest', 'vitest.mjs');

function databaseUrl(base, databaseName) {
  const url = new URL(base);
  url.pathname = '/' + databaseName;
  return url.toString();
}

function runNode(cliPath, args, options) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    ...options,
    stdio: 'inherit'
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('Command failed with exit code ' + result.status);
  }
}

async function main() {
  process.loadEnvFile(path.join(repoDir, '.env'));

  const sourceAdminUrl = process.env.DIRECT_URL;
  const sourceAppUrl = process.env.DATABASE_URL;
  if (!sourceAdminUrl || !sourceAppUrl) {
    throw new Error('DIRECT_URL and DATABASE_URL must be set in the root .env file');
  }
  if (new URL(sourceAppUrl).username !== 'app_user') {
    throw new Error('The integration test requires DATABASE_URL to use the restricted app_user role');
  }
  if (!existsSync(prismaCli) || !existsSync(vitestCli)) {
    throw new Error('Prisma and Vitest must be installed before running the API tests');
  }

  const testDatabase = 'vishanti_test_' + randomUUID().replaceAll('-', '');
  const maintenanceUrl = new URL(sourceAdminUrl);
  maintenanceUrl.pathname = '/postgres';
  const admin = new PrismaClient({ datasources: { db: { url: maintenanceUrl.toString() } } });
  let databaseCreated = false;
  let exitCode = 0;

  try {
    await admin.$connect();
    await admin.$executeRawUnsafe('CREATE DATABASE "' + testDatabase + '"');
    databaseCreated = true;

    const testEnv = {
      ...process.env,
      DATABASE_URL: databaseUrl(sourceAppUrl, testDatabase),
      DIRECT_URL: databaseUrl(sourceAdminUrl, testDatabase),
      VISHANTI_TEST_DATABASE: '1',
      NODE_ENV: 'test'
    };

    runNode(prismaCli, ['migrate', 'deploy', '--schema', schemaPath], {
      cwd: repoDir,
      env: testEnv
    });
    runNode(vitestCli, ['run', 'src'], {
      cwd: apiDir,
      env: testEnv
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    exitCode = 1;
  } finally {
    if (databaseCreated) {
      try {
        await admin.$executeRawUnsafe('DROP DATABASE "' + testDatabase + '" WITH (FORCE)');
      } catch (error) {
        console.error('Could not remove the temporary test database:', error);
        exitCode = 1;
      }
    }
    await admin.$disconnect();
  }

  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
