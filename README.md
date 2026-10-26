# Workiya

npm workspaces monorepo: `frontend/` (Next.js 16, React 19) and `backend/` (Node 22, Express 5, PostgreSQL).

## Development

### Install

Requires Node 22 and npm 10. From the repo root run `npm ci`.

### Run locally

1. Backend (API on port 5001): copy `backend/.env.example` to `backend/.env`, set
   `PORT=5001` and the `DATABASE_URL*` values (see Database below), apply the migrations
   and generate local JWT keys once:
   ```bash
   cd backend && node scripts/run-pg-migration.js up --yes && cd ..
   npm run keys:generate --workspace backend
   npm run dev:backend
   ```
2. Frontend (http://localhost:3000): copy `frontend/.env.example` to
   `frontend/.env.local` and set `NEXT_PUBLIC_API_URL=http://localhost:5001`, then:
   ```bash
   npm run dev:frontend
   ```

Never commit `.env`, `.env.local` or `backend/keys/`.

### Lint and test

```bash
npm run lint --workspace backend        # ESLint, Airbnb rules (double quotes)
npm run lint --workspace frontend
npm test --workspace backend            # Jest + Supertest, DB is mocked
npm run test:integration --workspace backend   # real PostgreSQL (DATABASE_URL_TEST)
npm test --workspace frontend           # Jest + React Testing Library
npm run test:coverage --workspace backend
```

Backend unit tests need no `.env` or database: `backend/test/setupEnv.js` creates
throwaway JWT keys. Backend coverage thresholds (80% global, 95% for auth and
security code) are enforced in `backend/jest.config.js`.

Integration tests (`backend/test/integration/**`) need `DATABASE_URL_TEST`, a database
separate from the main one (they refuse to run against `DATABASE_URL`). Each run creates its
own schema `it_<timestamp>_<pid>`, applies every migration into it and drops it afterwards.

### Database (PostgreSQL)

The API uses PostgreSQL 18 with PostGIS (hosted on Neon). Connection URLs come from
`backend/.env` (Azure Key Vault in production):

| Variable | Used by |
|---|---|
| `DATABASE_URL` | the API (Neon pooled URL) |
| `DATABASE_URL_DIRECT` | migrations, the seed script and the one-time data copy (direct URL) |
| `DATABASE_URL_TEST` | `npm run test:integration` only; must be a separate database |

TLS with certificate verification is always on; `sslmode=disable` is honoured only for a
local or CI database. Tables are plural snake_case (`users`, `audit_logs`, ...), times are
`timestamptz` in UTC, and `accounts`, `account_assignments`, `activities` and `submissions`
keep every old version in a `<table>_history` table (trigger `record_history()`).
`audit_logs` is append-only: triggers reject UPDATE, DELETE and TRUNCATE.

#### Migrations

Versioned SQL files live in `backend/db/postgres/` (`YYYYMMDDHHMMSS_<id>_<desc>.sql`, with
`-- ==== UP ====` and `-- ==== DOWN ====` sections, plain SQL). Each file runs in its own
transaction and is recorded in `schema_migrations`. Run the runner from `backend/`; without
`--yes` it is a dry run:

```bash
cd backend
node scripts/run-pg-migration.js status                  # applied and pending files
node scripts/run-pg-migration.js up                      # dry run: lists pending files
node scripts/run-pg-migration.js up --yes                # applies every pending file
node scripts/run-pg-migration.js down <file> --yes       # reverts the latest applied file
node scripts/run-pg-migration.js status --url-env DATABASE_URL_TEST   # another database
```

Call `node` directly. In PowerShell, `npm run db:migrate -- up --yes` silently drops the
`--yes` (PowerShell removes the bare `--`), so the runner only does a dry run. Migrations never
schema-qualify their own objects, so they can be applied into any schema (the integration
tests use this). The old SQL Server migrations are kept, unchanged, in
`backend/db/sqlserver-archive/` for history only.

#### Fresh database: first super admin

```bash
cd backend
SEED_ADMIN_EMAIL=<email> SEED_ADMIN_PASSWORD=<password> node scripts/seed-super-admin.js --yes
```

#### One-time copy from SQL Server

`backend/scripts/copy-sqlserver-to-postgres.js` copies Workiya's data from the old SQL
Server database (read with `SELECT` only; `MSSQL_*` in `backend/.env`) into a migrated
PostgreSQL database:

```bash
cd backend
node scripts/copy-sqlserver-to-postgres.js --target-env DATABASE_URL_DIRECT          # dry run
node scripts/copy-sqlserver-to-postgres.js --target-env DATABASE_URL_DIRECT --yes    # copy
```

- Copies, in foreign-key order: `genders`, `roles`, `companies`, `users`,
  `company_terminology`, `custom_field_definitions`, `activity_types`, `accounts`,
  `account_assignments`, `activities`, `submissions`, `audit_logs` and the four `*_history`
  tables. Ids are kept and identity sequences moved past them. Refresh tokens are not copied
  (everyone signs in again); `Doctors`, `Tasks`, `TaskFeedback` and the `Legacy*Id` columns
  are not moved.
- Everything is written in ONE transaction, then verified per table (row count plus id and key
  columns of every row); any mismatch rolls the whole copy back and exits 1.
- Rows that break the new same-company rules (for example an activity assigned to a user of
  another company) are not copied, together with their dependent rows (submissions of a
  skipped activity) and their history versions. Both the dry run and the copy list each
  skipped row with its table, id and reason.
- It refuses a target that already holds rows; `--reset` empties the target tables first
  (inside the same transaction). `--schema <name>` targets one schema, e.g. a throwaway one.
- Values, passwords, password hashes and connection strings are never printed.

See `docs/database/ERD.md` for the schema. `docs/database/postgres-migration-plan.md` records
the decisions behind the move from SQL Server.

### Branch workflow

- `development` is the integration branch. Branch from it:
  `feature/<id>/<desc>`, `bugfix/<id>/<desc>` or `db/<id>/<desc>`.
- Commit messages: `[type][work-item-id] description`.
- Open a pull request into `development`. Never push directly to `development` or `main`.

### CI (GitHub Actions)

`.github/workflows/ci.yml` runs on pushes to `development`, `main`, `feature/**`,
`bugfix/**`, `db/**` and on pull requests into `development` and `main`:

| Job | Checks |
|---|---|
| lint | ESLint for backend and frontend (0 errors required) |
| test-backend | Jest with coverage thresholds (coverage uploaded as an artifact), then the integration tests against a PostGIS service container (`postgis/postgis:18-3.6`) |
| test-frontend | Jest with coverage; coverage uploaded as an artifact |
| build-frontend | `next build` |
| secret-scan | gitleaks on the current files (not history) |
