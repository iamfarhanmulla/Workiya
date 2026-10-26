# Deploy Workiya to Vercel (Hobby) for testing and pilot demos

Two Vercel projects are created from the same GitHub repository:

| Project | Root Directory | Serves | Example address |
|---|---|---|---|
| `workiya-api` | `backend` | the Express API as one serverless function (`backend/api/index.js`, region `sin1` = Singapore, next to Neon) | `https://workiya-api.vercel.app` |
| `workiya` | `frontend` | the Next.js app; `/api/...` is forwarded to `workiya-api` (`frontend/next.config.mjs`) | `https://workiya.vercel.app` |

Users only ever open the frontend address. Because the API is reached through the same site,
the `httpOnly`, `SameSite=Strict` login cookies keep working without changes.

The Hobby plan is for personal, non-commercial use: fine for your own testing and demos. Move
to a paid plan before real customers use Workiya.

## 1. Account
1. https://vercel.com → **Sign Up** → **Hobby** → **Continue with GitHub**.
2. Allow access to the `Workiya` repository.

## 2. Backend project (`workiya-api`)
1. **Add New → Project** → import `Workiya`.
2. **Root Directory:** `backend`. Framework preset: **Other**. Leave build settings empty.
3. **Environment Variables** (Production and Preview):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** connection string (host contains `-pooler`) |
   | `JWT_PRIVATE_KEY` | from `node scripts/print-vercel-jwt-env.js` (run in `backend/`) |
   | `JWT_PUBLIC_KEY` | from the same command |
   | `NODE_ENV` | `production` |
   | `TRUST_PROXY_HOPS` | `1` |
   | `PASSWORD_REHASH_ON_LOGIN` | `true` |
   | `FRONTEND_URL` | the frontend address from step 3 (set it after step 3, then redeploy) |

4. **Deploy**. Check `https://<api-address>/api/v1/health` returns `{"success":true,...}`.

Never add `DATABASE_URL_DIRECT`, `DATABASE_URL_TEST` or any `MSSQL_*` value to Vercel.

## 3. Frontend project (`workiya`)
1. **Add New → Project** → import `Workiya` again.
2. **Root Directory:** `frontend`. Framework preset: **Next.js**.
3. **Environment Variables:** `API_ORIGIN` = the backend address from step 2 (no trailing
   slash). Do **not** set `NEXT_PUBLIC_API_URL` (empty means "same site").
4. **Deploy**.

## 4. Connect the two
1. Backend project → **Settings → Environment Variables** → set `FRONTEND_URL` to the
   frontend address → **Deployments → Redeploy**.
2. Open the frontend address and sign in.

## 5. Pilot demo
Create a separate demo company and demo admin user in the app, so the pilot customer never
sees your own test data. Share only the frontend address and that login.

## Day to day
- Every push to `development` redeploys both projects (set the production branch to
  `development` under **Settings → Git** if Vercel picked another branch).
- Other branches get their own preview addresses.
- Database migrations are **not** run by Vercel. Run them yourself from `backend/` before
  pushing code that needs them: `node scripts/run-pg-migration.js up --yes`.
- Logs: Vercel project → **Logs**. The API logs JSON (pino); secrets are redacted.
