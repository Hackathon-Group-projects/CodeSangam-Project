import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load the repository's local .env when running from the API workspace.
const envFiles = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')];
const envFile = envFiles.find((path) => existsSync(path));

if (envFile) {
  process.loadEnvFile(envFile);
}
