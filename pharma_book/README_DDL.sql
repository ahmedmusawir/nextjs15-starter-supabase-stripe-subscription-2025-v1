-- README_DDL.sql
-- Supabase Postgres DDL with pharma_ prefix and RLS policies
-- Assumptions:
--  - Supabase Auth provides auth.uid() (UUID) for the logged-in user
--  - Mapping table pharma_pharmacy_members maps user_id -> pharmacy_id (UUIDs)
--  - Reference tables are world-readable to authenticated users (tune as needed)

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- 1) Reference tables (no tenant ownership)
create table if not exists public.pharma_baseline (
  ndc text primary key,
  drug_name text,
  bg text,
  effective_date date,
  aac numeric(12,4)
);

create table if not exists public.pharma_alt_rates (
  ndc text primary key,
  wac numeric(12,4),
  pkg_size numeric(12,4),
  pkg_size_mult numeric(12,4),
  generic_indicator text
);

create table if not exists public.pharma_pbm_info (
  bin text primary key,
  pbm_name text not null,
  email text
);

-- 2) Tenant tables
create table if not exists public.pharma_pharmacy_profile (
  pharmacy_id uuid primary key default gen_random_uuid(),
  pharmacy_name text not null,
  address text,
  phone text,
  fax text,
  email text,
  ncpdp text unique,
  npi text unique,
  contact_person text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pharma_user_data (
  script text primary key,
  pharmacy_id uuid not null references public.pharma_pharmacy_profile(pharmacy_id) on delete cascade,
  date_dispensed date,
  drug_ndc text,
  drug_name text,
  qty numeric(12,2),
  total_paid numeric(12,2),
  new_paid numeric(12,2),
  bin text,
  pdf_file text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pharma_report_files (
  script text not null references public.pharma_user_data(script) on delete cascade,
  report_type text not null,
  pharmacy_id uuid not null references public.pharma_pharmacy_profile(pharmacy_id) on delete cascade,
  pdf_file text not null,
  created_at timestamptz not null default now(),
  primary key (script, report_type)
);

-- Membership mapping users -> pharmacies
create table if not exists public.pharma_pharmacy_members (
  pharmacy_id uuid not null references public.pharma_pharmacy_profile(pharmacy_id) on delete cascade,
  user_id uuid not null,
  role text default 'member',
  created_at timestamptz not null default now(),
  primary key (pharmacy_id, user_id)
);

-- 3) Indexes
create index if not exists idx_pharma_user_data_date on public.pharma_user_data(date_dispensed);
create index if not exists idx_pharma_user_data_ndc on public.pharma_user_data(drug_ndc);
create index if not exists idx_pharma_user_data_bin on public.pharma_user_data(bin);
create index if not exists idx_report_files_pharmacy on public.pharma_report_files(pharmacy_id);

-- 4) Triggers to update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

create trigger set_updated_at_user_data
before update on public.pharma_user_data
for each row execute function public.set_updated_at();

create trigger set_updated_at_profile
before update on public.pharma_pharmacy_profile
for each row execute function public.set_updated_at();

-- 5) RLS enablement
alter table public.pharma_pharmacy_profile enable row level security;
alter table public.pharma_user_data enable row level security;
alter table public.pharma_report_files enable row level security;
alter table public.pharma_pharmacy_members enable row level security;

-- Reference tables readable by authenticated users
create policy if not exists "auth read baseline"
  on public.pharma_baseline
  for select to authenticated
  using (true);

create policy if not exists "auth read alt_rates"
  on public.pharma_alt_rates
  for select to authenticated
  using (true);

create policy if not exists "auth read pbm"
  on public.pharma_pbm_info
  for select to authenticated
  using (true);

-- Membership visibility: users can see their own memberships
create policy if not exists "member sees self"
  on public.pharma_pharmacy_members
  for select to authenticated
  using (user_id = auth.uid());

-- Insert membership for self (optional; keep off if using admin-only provisioning)
create policy if not exists "member self-insert"
  on public.pharma_pharmacy_members
  for insert to authenticated
  with check (user_id = auth.uid());

-- Helper predicate used inline: auth user belongs to row.pharmacy_id
-- We use EXISTS on pharma_pharmacy_members in each policy

-- Profile policies
create policy if not exists "profile select by membership"
  on public.pharma_pharmacy_profile
  for select to authenticated
  using (
    exists (
      select 1 from public.pharma_pharmacy_members m
      where m.pharmacy_id = pharma_pharmacy_profile.pharmacy_id
        and m.user_id = auth.uid()
    )
  );

create policy if not exists "profile insert by membership"
  on public.pharma_pharmacy_profile
  for insert to authenticated
  with check (
    exists (
      select 1 from public.pharma_pharmacy_members m
      where m.pharmacy_id = pharmacy_id
        and m.user_id = auth.uid()
    )
  );

create policy if not exists "profile update by membership"
  on public.pharma_pharmacy_profile
  for update to authenticated
  using (
    exists (
      select 1 from public.pharma_pharmacy_members m
      where m.pharmacy_id = pharma_pharmacy_profile.pharmacy_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pharma_pharmacy_members m
      where m.pharmacy_id = pharma_pharmacy_profile.pharmacy_id
        and m.user_id = auth.uid()
    )
  );

-- User data policies
create policy if not exists "userdata select by membership"
  on public.pharma_user_data
  for select to authenticated
  using (
    exists (
      select 1 from public.pharma_pharmacy_members m
      where m.pharmacy_id = pharma_user_data.pharmacy_id
        and m.user_id = auth.uid()
    )
  );

create policy if not exists "userdata insert by membership"
  on public.pharma_user_data
  for insert to authenticated
  with check (
    exists (
      select 1 from public.pharma_pharmacy_members m
      where m.pharmacy_id = pharmacy_id
        and m.user_id = auth.uid()
    )
  );

create policy if not exists "userdata update by membership"
  on public.pharma_user_data
  for update to authenticated
  using (
    exists (
      select 1 from public.pharma_pharmacy_members m
      where m.pharmacy_id = pharma_user_data.pharmacy_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pharma_pharmacy_members m
      where m.pharmacy_id = pharma_user_data.pharmacy_id
        and m.user_id = auth.uid()
    )
  );

-- Report files policies
create policy if not exists "reports select by membership"
  on public.pharma_report_files
  for select to authenticated
  using (
    exists (
      select 1 from public.pharma_pharmacy_members m
      where m.pharmacy_id = pharma_report_files.pharmacy_id
        and m.user_id = auth.uid()
    )
  );

create policy if not exists "reports insert by membership"
  on public.pharma_report_files
  for insert to authenticated
  with check (
    exists (
      select 1 from public.pharma_pharmacy_members m
      where m.pharmacy_id = pharmacy_id
        and m.user_id = auth.uid()
    )
  );

-- NOTE: Adjust storage policies separately if using Supabase Storage for PDFs.
