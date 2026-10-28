import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Prisma ko uska local folder dete hain, taaki woh database ka ready client bana sake.
mkdirSync(resolve(dirname(fileURLToPath(import.meta.url)), '../node_modules/prisma'), { recursive: true });
