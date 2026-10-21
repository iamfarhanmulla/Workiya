# Workiya

npm workspaces monorepo: `frontend/` (Next.js 16, React 19) and `backend/` (Node 22, Express 5, SQL Server).

## Development

### Install

Requires Node 22 and npm 10. From the repo root run `npm ci`.

### Run locally

1. Backend (API on port 5001): copy `backend/.env.example` to `backend/.env`, set
   `PORT=5001` and the `MSSQL_*` values, then generate local JWT keys once:
   ```bash
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
npm test --workspace frontend           # Jest + React Testing Library
npm run test:coverage --workspace backend
```

Backend tests need no `.env` or database: `backend/test/setupEnv.js` creates
throwaway JWT keys. Backend coverage thresholds (80% global, 95% for auth and
security code) are enforced in `backend/jest.config.js`.

### Database migrations

Versioned SQL files live in `backend/db/migrations/` (`YYYYMMDDHHMMSS_<id>_<desc>.sql`, with
`-- ==== UP ====` and `-- ==== DOWN ====` sections). The development database is shared with
another system, so review each file before applying it. Run the runner from `backend/`:

```bash
cd backend
node scripts/run-sql-migration.js db/migrations/<file>.sql up          # dry run: lists batches
node scripts/run-sql-migration.js db/migrations/<file>.sql up --yes    # applies + records it
```

Call `node` directly. In PowerShell, `npm run db:sql -- ... --yes` silently drops `--yes`
(PowerShell removes the bare `--`), so the runner only does a dry run. Applied files are
recorded in `SchemaMigrations`. In SSMS, pressing F5 on a whole migration runs only UP
(newer files carry a guard); then insert the file name into `SchemaMigrations` yourself.

See `docs/database/erd.html` (open in a browser) or `docs/database/ERD.md` for the schema.

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
| test-backend | Jest with coverage thresholds; coverage uploaded as an artifact |
| test-frontend | Jest with coverage; coverage uploaded as an artifact |
| build-frontend | `next build` |
| secret-scan | gitleaks on the current files (not history) |
