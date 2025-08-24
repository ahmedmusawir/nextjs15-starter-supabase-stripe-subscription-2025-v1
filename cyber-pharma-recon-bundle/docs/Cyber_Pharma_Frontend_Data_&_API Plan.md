# Cyber Pharma Frontend Data & API Plan

This document captures the concrete blueprint for the Next.js frontend, API handlers, and services, based on the bundled docs, schema, and seeds.

Sources reviewed:
- `cyber-pharma-recon-bundle/docs/MigrationGuide.md`
- `cyber-pharma-recon-bundle/docs/NextRepoImportChecklist.md`
- `cyber-pharma-recon-bundle/docs/ProfileLocking.md`
- `cyber-pharma-recon-bundle/README_DDL.sql`
- Seeds: `seeds/pharma_baseline.csv`, `seeds/pharma_alt_rates.csv`, `seeds/pharma_pbm_info.csv`

---

## 1) Core Tables and Roles

- __`public.pharma_pharmacy_profile`__
  - Tenant anchor row, `pharmacy_id` (UUID). Identity fields: `pharmacy_name`, `npi`, `ncpdp`, etc.
  - UI: Profile pages. Respect locking (see Profile Locking).

- __`public.pharma_pharmacy_members`__
  - Membership `(pharmacy_id, user_id, role)`.
  - RLS gate for all tenant data; resolve current tenant via membership.

- __`public.pharma_user_data`__
  - Main claims/transactions. Columns: `script` (PK), `pharmacy_id`, `date_dispensed`, `drug_ndc`, `drug_name`, `qty`, `total_paid`, `new_paid`, `bin`, `status`, `pdf_file`.
  - UI: Admin table (sortable/filterable/paginated). Links to PDFs.

- __`public.pharma_report_files`__
  - `script` + `report_type` + `pharmacy_id` → `pdf_file` mapping.
  - UI: Report column/details and downloads.

- __Reference tables (read-only to authenticated)__
  - `public.pharma_baseline`: AAC + metadata by `ndc` (`aac`, `drug_name`, `bg`, `effective_date`).
  - `public.pharma_alt_rates`: WAC/packaging by `ndc` (`wac`, `pkg_size`, `pkg_size_mult`, `generic_indicator`).
  - `public.pharma_pbm_info`: PBM metadata by `bin` (`pbm_name`, `email`).

---

## 2) Frontend Data Structures

- __Admin Table Row__
```ts
export type AdminRow = {
  script: string;
  date: string;         // ISO (pharma_user_data.date_dispensed)
  ndc: string;          // pharma_user_data.drug_ndc
  drugName: string;     // pharma_user_data.drug_name or baseline fallback
  qty: number;          // pharma_user_data.qty
  aac?: number;         // baseline.aac
  wac?: number;         // alt_rates.wac
  method: "AAC" | "WAC" | "Other"; // derived
  expected?: number;    // (aac||wac) * qty
  paid: number;         // pharma_user_data.total_paid
  newPaid?: number;     // pharma_user_data.new_paid
  owed?: number;        // expected - paid
  bin?: string;         // pharma_user_data.bin
  pbmName?: string;     // pbm_info.pbm_name
  report?: string;      // label/type
  status?: string;      // pharma_user_data.status
  pdfUrl?: string;      // report_files/pdf_file
};
```

- __Profile Data__
```ts
export type PharmacyProfile = {
  pharmacy_id: string;
  pharmacy_name: string;
  address?: string;
  phone?: string;
  fax?: string;
  email?: string;
  ncpdp?: string;
  npi?: string;
  contact_person?: string;
  created_at: string;
  updated_at: string;
  lockedFields: { npi: boolean; ncpdp: boolean; pharmacy_name: boolean };
};
```

- __KPI Summary__
```ts
export type KpiSummary = {
  commercialUnderpaid: number;
  commercialScripts: number;
  updatedDifference: number;
  owed: number;
};
```

Notes:
- `method`: prefer `AAC` if baseline exists; else `WAC` if alt_rates exists; else `Other`.
- `expected = qty * (aac || wac)` when available.
- `owed = expected - total_paid` (negative implies underpaid).

---

## 3) Filters Mapping

- __Date Range__ → `pharma_user_data.date_dispensed BETWEEN $from AND $to`
- __Script__ → `script ILIKE '%term%'`
- __NDC__ → `drug_ndc ILIKE '%term%'`
- __Drug Name__ → `drug_name ILIKE '%term%'` (optionally baseline fallback)
- __PBM / BIN__ → `bin = $bin`
- __Status__ → `status = $status`
- __Owed Filters__ → compare `(expected - total_paid)` after join/derivation
- __Quantity Range__ → `qty BETWEEN $min AND $max`
- __Pricing Method__ → AAC present vs WAC-only predicates
- __Report Type__ → filter via `pharma_report_files.report_type`

Tip: compute `expected/owed/method` in the API (or a SQL view/RPC) so you can filter/sort on them reliably.

---

## 4) API Endpoints (Next.js route handlers)

- __Profile__
  - `GET /api/profile` → returns `PharmacyProfile` for tenant (via membership).
  - `PUT /api/profile` → updates editable fields; enforce locking server-side.

- __Claims (Admin Table)__
  - `GET /api/user-data?dateFrom&dateTo&script&ndc&drug&bin&status&owedType&qtyMin&qtyMax&method&sortKey&sortDir&page&limit`
  - Left join: baseline (AAC), alt_rates (WAC), pbm_info (name).
  - Compute `expected`, `owed`, and `method` server-side; return `{ rows, total, page, limit }`.

- __KPIs__
  - `GET /api/kpis?dateFrom&dateTo` → aggregate sums/counts for dashboard chips.

- __Reports__
  - `GET /api/reports?script=...` → list all report files for a script.
  - Optional: `GET /api/report-url?script=...&type=...` → presigned URL from storage.

- __Lookups__
  - `GET /api/lookups/pbm?bin=...`
  - `GET /api/lookups/ndc?ndc=...`

All handlers must use `await createClient()` so RLS applies.

---

## 5) Services (`src/services/`)

- __`ProfileDataServices.ts`__
  - `getProfile()` → GET `/api/profile`
  - `updateProfile(payload)` → PUT `/api/profile`

- __`ClaimsServices.ts`__
  - `getClaims(params)` → GET `/api/user-data` → `{ rows, total, page, limit }`

- __`KPIService.ts`__
  - `getKpis(params)` → GET `/api/kpis`

- __`ReportsServices.ts`__
  - `getReportsByScript(script)` → GET `/api/reports?script=...`
  - `getReportUrl(script, type)` → GET `/api/report-url?...`

- __`LookupsService.ts`__
  - `getPbmInfo(bin)` → GET `/api/lookups/pbm?bin=...`
  - `getNdcPricing(ndc)` → GET `/api/lookups/ndc?ndc=...`

Each service centralizes mapping, error handling, and minimal normalization.

---

## 6) Components Wiring

- __Profile (`src/components/profile/ProfileContent.tsx`)__
  - On mount: `getProfile()` to populate forms.
  - On save: `updateProfile()` and reflect locked fields (disable `npi/ncpdp/pharmacy_name` if set).

- __Admin Table (`src/app/(admin)/admin/AdminPortalContent.tsx`)__
  - Calls `getClaims({ filters, sort, page, limit })`.
  - Client-side sorting OK for small data; switch to server-side as data grows.
  - Use `total` for pagination; use `pdfUrl` or `getReportUrl()` for downloads.

- __Filters Panel__
  - Maintain local filter state; on apply, reload via `getClaims()` with query params.

---

## 7) Derivation Rules

- `expected = qty * (aac || wac)`
- `owed = expected - total_paid`
- `method = 'AAC' | 'WAC' | 'Other'` by presence of AAC/WAC
- `drugName` fallback to baseline if user_data value is missing
- `pbmName` from `pharma_pbm_info` via `bin`

---

## 8) Performance & Scaling

- Start with client-side sorting; move to server-side `ORDER BY` and pagination when dataset grows.
- Consider a SQL view/RPC that pre-joins baseline/alt_rates/pbm and computes `expected/owed/method`. Index if needed.

---

## 9) Security & RLS

- All tenant tables have RLS enabled in `README_DDL.sql`.
- API routes must use anon key + session cookies: `await createClient()`.
- Store PDFs in a bucket (e.g., `pharma-reports`) and mirror membership policies; serve via presigned URLs.
- Enforce profile field locking in API; mirror disabled UI state.

---

## 10) Phased Rollout

- __Phase 1__: Implement `/api/profile`, `/api/user-data` with core filters; services; wire components.
- __Phase 2__: Add `/api/kpis`, `/api/reports`, lookups; server-side sorting/pagination.
- __Phase 3__: Optional SQL view/RPC for derived fields; storage presigning; advanced filters.

---

## 11) Suggestions

- Adopt a derived-claims SQL view or RPC for consistent logic and better performance.
- Add audit fields later (`created_by`, `updated_by`).
- UX enhancements: quick underpaid filter, contact PBM via email, bulk actions.
