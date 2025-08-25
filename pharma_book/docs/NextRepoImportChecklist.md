# Next.js Repo – Cyber Pharma Recon/Migration Import Checklist

Use this to wire the bundle into your Next.js monorepo/app.

## 1) Unpack the bundle
- Copy `cyber-pharma-recon-bundle.zip` into your Next.js repo root and unzip.
- You should now have:
  - `docs/` (`ProfileLocking.md`, `MigrationGuide.md`, `README_DDL.sql`)
  - `scripts/` (`generateSyntheticClaims.js`, `migrateSqliteToSupabase.js`)
  - `seeds/`, `exports/`, and `app.db`

## 2) Install deps
```bash
# choose your package manager
npm i -D @types/node
npm i better-sqlite3 @supabase/supabase-js
# or: yarn add ... / pnpm add ...
```

## 3) Add env vars to .env.local
```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role>
PHARMACY_ID=<uuid-or-leave-blank>
SQLITE_PATH=./app.db
MODE=csv # or supabase
OUT_DIR=./exports
```

## 4) Add package scripts
```json
{
  "scripts": {
    "pharma:seeds": "node scripts/generateSyntheticClaims.js",
    "pharma:export": "MODE=csv node scripts/migrateSqliteToSupabase.js",
    "pharma:upload": "MODE=supabase node scripts/migrateSqliteToSupabase.js"
  }
}
```
(Windows: use cross-env or set envs in PowerShell.)

## 5) Create Supabase schema
- Open Dashboard → SQL Editor → run `docs/README_DDL.sql`.
- Verify tables with `pharma_` prefix exist.

## 6) Validate with seeds (optional)
```bash
npm run pharma:seeds
# import seeds CSVs via Dashboard or switch MODE=supabase and run pharma:upload
```

## 7) Full import from SQLite
- Keep `app.db` at repo root or set `SQLITE_PATH`.
```bash
npm run pharma:export   # CSVs to exports/
# or
npm run pharma:upload   # Direct upsert into Supabase
```

## 8) RLS membership test
- Insert your user into `pharma_pharmacy_members` and confirm queries return only your tenant rows. See `docs/MigrationGuide.md`.

## 9) Optional Next.js wiring
- Create a server action or route that uses `@supabase/supabase-js` with the anon key for client queries (RLS enforced).
- Add a storage bucket (e.g., `pharma-reports`) and mirror membership policies for PDFs.

That’s it. This aligns with the Python originals but is fully Node.js for a unified stack.
