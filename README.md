# The Vishanti Ledger

The Vishanti Ledger is a grievance redressal portal with a tamper-evident audit trail. This repository is an npm workspaces monorepo containing the Next.js web app, Fastify API, background worker, shared types, and Prisma database package.

## Requirements

- Node.js 24 LTS and npm 11. The `.nvmrc` file selects the Node 24 line.
- Docker Desktop with Docker Compose v2.
- Git.

## Set up a local copy

1. Clone the repository and open a terminal in its root directory.
2. Create your local environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

   On macOS or Linux, use `cp .env.example .env`.

3. Replace every `replace_with_...` value in `.env` with a unique secret. Generate URL-safe secrets with:

   ```sh
   node -p "require('node:crypto').randomBytes(32).toString('base64url')"
   ```

   Use the same admin password in `POSTGRES_PASSWORD` and `DIRECT_URL`. Use the same app password in `APP_DB_PASSWORD` and `DATABASE_URL`. Give `JWT_SECRET`, `HMAC_SECRET`, and `MINIO_ROOT_PASSWORD` their own values. The base64url output is safe to place in database URLs.

4. Install the locked dependencies and start the local infrastructure:

   ```sh
   npm ci
   docker compose up -d
   ```

   PostgreSQL, Redis, MinIO, and ClamAV are published on localhost only. The Postgres initialization script creates the restricted `app_user` role on a fresh database volume. If you already had a Postgres volume before adding this setup, run the role script once:

   ```sh
   docker compose exec -T postgres psql -U vishanti_admin -d vishanti_ledger -f /docker-entrypoint-initdb.d/01-app-user.sql
   ```

   If you changed `POSTGRES_USER` or `POSTGRES_DB`, replace the values in that command with your configured names. The script reads `APP_DB_PASSWORD` from the container environment and does not print it.

5. Generate Prisma Client and apply the local development migrations:

   ```sh
   npm run prisma:generate --workspace=@vishanti/db
   npm run prisma:migrate --workspace=@vishanti/db
   ```

   The migration command uses the privileged `DIRECT_URL`; the API uses the restricted `DATABASE_URL` runtime role.

## Run the applications

Open separate terminals at the repository root:

```sh
npm run dev:api
npm run dev:worker
npm run dev:web
```

- Web app: <http://localhost:3000>
- API health endpoint: <http://localhost:4000/health>
- MinIO API: <http://localhost:9000>
- MinIO console: <http://localhost:9001>
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- ClamAV: `localhost:3310`

## Phase 2 API endpoints

- `POST /api/auth/register` creates a petitioner account and returns a one-hour JWT.
- `POST /api/auth/login` checks the password and returns a JWT.
- `POST /api/tickets` creates a ticket and its first audit entry in one database transaction. Send an `Idempotency-Key` header. Signed-in submissions need `Authorization: Bearer <token>`; anonymous submissions set `isAnonymous: true` and receive a one-time `receiptSecret` in the response.

The API accepts `WEB_ORIGIN` to set the browser origin allowed by CORS. For local use it defaults to `http://localhost:3000`.

The MinIO console credentials are `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` from `.env`.

## Useful commands

```sh
npm run build
npm run lint
npm run prisma:studio --workspace=@vishanti/db
docker compose ps
docker compose logs -f postgres redis minio clamav
docker compose down
```

`docker compose down` stops the services and keeps their named data volumes. `docker compose down -v` deletes the local database, Redis data, and uploaded objects; use it only when you intend to erase that local data.

## GitHub and secrets

- Commit `package-lock.json` so teammates install the same dependency tree.
- Keep `.env` local. It is ignored by Git; commit `.env.example` only.
- Do not place credentials, database dumps, or local service data in commits.
- The Compose file is for local development. Production deployments should use managed secrets, TLS, private service networking, and a deployment-specific configuration.

