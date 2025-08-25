# Cyber Pharma – Migration Guide (SQLite to Supabase)

This guide explains how to provision the Supabase schema, import data, and verify Row Level Security.

## Prerequisites
- A Supabase project (URL + Service Role key)
- Executed SQL: `README_DDL.sql` in the Supabase SQL Editor
- Local repo with this folder structure: `docs/`, `scripts/`, `seeds/`, `exports/`
- Optional: Supabase Python client (`pip install supabase`)

## 1) Create Schema
1. Open Supabase Dashboard → SQL Editor.
2. Paste contents of `README_DDL.sql` and run.
3. Confirm tables exist under `public.*` with the `pharma_` prefix.

## 2) Choose Import Path
You have two options:

- Option A: CSV Import via Dashboard (no code)
  1. Go to Table Editor → select each table → Import.
  2. Import order:
     - `pharma_baseline` (from `seeds/` or `exports/`)
     - `pharma_alt_rates`
     - `pharma_pbm_info`
     - `pharma_pharmacy_profile` (from `seeds/` or `exports/`)
     - `pharma_user_data`
     - `pharma_report_files`

- Option B: Scripted Import (Python)
  1. Ensure env vars are set:
     ```bash
     export MODE=supabase
     export SUPABASE_URL=https://<your>.supabase.co
     export SUPABASE_SERVICE_ROLE=<service_role_key>
     export PHARMACY_ID=<uuid | optional>
     ```
  2. Run:
     ```bash
     python scripts/migrate_sqlite_to_supabase.py
     ```
     - The script reads from `app.db` and upserts in correct order.
     - If `PHARMACY_ID` isn’t provided, it generates one and prints it.

## 3) About Tenant Identity & RLS
- Tenanted tables: `pharma_pharmacy_profile`, `pharma_user_data`, `pharma_report_files`, `pharma_pharmacy_members`.
- Membership table: `pharma_pharmacy_members(pharmacy_id, user_id)`.
- Policies use `auth.uid()` and `EXISTS` on membership to allow access.
- For testing, insert a membership row for your user:
  ```sql
  insert into public.pharma_pharmacy_members (pharmacy_id, user_id, role)
  values ('<pharmacy_id>', auth.uid(), 'owner');
  ```
  (When running in SQL Editor you won’t have `auth.uid()`. Use your user’s UUID from the Auth Users tab.)

## 4) Seed Data vs Real Data
- `seeds/`: small synthetic dataset (200 claims) designed to exercise AAC/WAC and Federal cases.
- `exports/`: full export from your local `app.db` created by the migration script in CSV mode.
- You can import `seeds/` first to test, then replace with `exports/`.

## 5) Verification Checklist
- Query examples:
  ```sql
  -- Counts
  select count(*) from public.pharma_user_data;
  select count(*) from public.pharma_baseline;

  -- Simple join check
  select u.script, u.bin, p.pbm_name
  from public.pharma_user_data u
  left join public.pharma_pbm_info p on p.bin = u.bin
  limit 20;
  ```
- Try selecting `pharma_user_data` as an authenticated user to confirm RLS allows only rows for your membership.

## 6) Next.js App Notes
- Use Supabase JS client on the server for data access governed by RLS.
- Tenant resolution: upon login, read memberships to determine `pharmacy_id`.
- Store PDFs in Supabase Storage (create a bucket like `pharma-reports`) and apply storage policies mirroring `pharma_pharmacy_members`.

## 7) Known Mappings
- `script` → PK in `pharma_user_data`.
- FKs: `pharma_user_data.pharmacy_id` → `pharma_pharmacy_profile.pharmacy_id`; `pharma_report_files.script` → `pharma_user_data.script`.
- Reference tables have no strict FKs to allow missing AAC/WAC/PBM lookups.

## 8) Troubleshooting
- If CSV import fails on numeric columns, set column types to TEXT temporarily and cast later.
- If RLS blocks you, confirm a row exists in `pharma_pharmacy_members` for your `user_id` and `pharmacy_id`.
- When using Service Role key from a server, RLS is bypassed. Use anon key in the browser to test RLS.
