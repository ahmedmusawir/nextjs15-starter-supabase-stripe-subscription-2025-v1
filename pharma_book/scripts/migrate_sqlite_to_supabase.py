#!/usr/bin/env python3
"""
SQLite -> Supabase migration utility for Cyber Pharma.

Features
- Reads from local SQLite `app.db`.
- For each known table, exports to CSV under ../exports/ OR uploads to Supabase directly.
- Adds `pharmacy_id` (UUID) to tenant tables with a provided constant.
- Skips unused columns from `alt_rates` beyond {ndc,wac,pkg_size,pkg_size_mult,generic_indicator}.

Usage
  MODE=csv python scripts/migrate_sqlite_to_supabase.py
  MODE=supabase SUPABASE_URL=... SUPABASE_SERVICE_ROLE=... PHARMACY_ID=... python scripts/migrate_sqlite_to_supabase.py

Config via env vars
  MODE: 'csv' (default) or 'supabase'
  SQLITE_PATH: path to app.db (default: ../app.db)
  OUT_DIR: export directory when MODE=csv (default: ../exports)
  SUPABASE_URL, SUPABASE_SERVICE_ROLE: required when MODE=supabase
  PHARMACY_ID: UUID to stamp on tenant tables (if not set, a new UUID is generated and printed)

Notes
- When MODE=supabase, this uses the Supabase Python client. Ensure package 'supabase' v2+ is installed.
- Import order respects reference tables first, then tenant tables.
- You should have already executed README_DDL.sql in your Supabase project.
"""
from __future__ import annotations
import csv
import os
import sqlite3
import uuid
from datetime import datetime
from typing import List, Dict, Any

MODE = os.getenv('MODE', 'csv').lower()
SQLITE_PATH = os.getenv('SQLITE_PATH', os.path.join(os.path.dirname(os.path.dirname(__file__)), 'app.db'))
OUT_DIR = os.getenv('OUT_DIR', os.path.join(os.path.dirname(os.path.dirname(__file__)), 'exports'))
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE = os.getenv('SUPABASE_SERVICE_ROLE')
PHARMACY_ID = os.getenv('PHARMACY_ID')

TENANT_TABLES = {
    'user_data': 'pharma_user_data',
    'report_files': 'pharma_report_files',
    'pharmacy_profile': 'pharma_pharmacy_profile',
}
REF_TABLES = {
    'baseline': 'pharma_baseline',
    'alt_rates': 'pharma_alt_rates',
    'pbm_info': 'pharma_pbm_info',
}

EXPORT_COLUMNS = {
    'pharma_baseline': ['ndc','drug_name','bg','effective_date','aac'],
    'pharma_alt_rates': ['ndc','wac','pkg_size','pkg_size_mult','generic_indicator'],
    'pharma_pbm_info': ['bin','pbm_name','email'],
    'pharma_pharmacy_profile': ['pharmacy_id','pharmacy_name','address','phone','fax','email','ncpdp','npi','contact_person','created_at','updated_at'],
    'pharma_user_data': ['script','pharmacy_id','date_dispensed','drug_ndc','drug_name','qty','total_paid','new_paid','bin','pdf_file','status','created_at','updated_at'],
    'pharma_report_files': ['script','report_type','pharmacy_id','pdf_file','created_at'],
}

NOW = datetime.utcnow().isoformat()


def get_conn(path: str):
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_dir(p: str):
    os.makedirs(p, exist_ok=True)


def coerce_decimal(v):
    if v is None:
        return None
    try:
        return float(v)
    except Exception:
        return None


def export_csv(table: str, rows: List[Dict[str, Any]]):
    ensure_dir(OUT_DIR)
    path = os.path.join(OUT_DIR, f"{table}.csv")
    cols = EXPORT_COLUMNS[table]
    with open(path, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, '') for c in cols})
    print(f"wrote {len(rows)} rows -> {path}")


def upsert_supabase(table: str, rows: List[Dict[str, Any]]):
    from supabase import create_client, Client  # type: ignore
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
    # chunk insert to avoid payload limits
    BATCH = 1000
    for i in range(0, len(rows), BATCH):
        chunk = rows[i:i+BATCH]
        resp = supabase.table(table).upsert(chunk, on_conflict="script" if table=='pharma_user_data' else None).execute()
        if getattr(resp, 'error', None):
            raise RuntimeError(resp.error)
    print(f"upserted {len(rows)} rows -> {table}")


def fetch_all(cur, sql: str, params=()):
    cur.execute(sql, params)
    return [dict(r) for r in cur.fetchall()]


def main():
    pharmacy_id = uuid.UUID(PHARMACY_ID) if PHARMACY_ID else uuid.uuid4()
    if not PHARMACY_ID:
        print(f"PHARMACY_ID not provided. Using generated: {pharmacy_id}")

    conn = get_conn(SQLITE_PATH)
    cur = conn.cursor()

    # Reference tables
    out_rows = {}
    out_rows['pharma_baseline'] = [
        {
            'ndc': r.get('ndc') or r.get('drug_ndc') or r.get('NDC') or r.get('Ndc'),
            'drug_name': r.get('drug name') or r.get('drug_name') or r.get('DrugName'),
            'bg': r.get('bg') or r.get('BG'),
            'effective_date': r.get('effective date') or r.get('effective_date'),
            'aac': r.get('aac')
        }
        for r in fetch_all(cur, 'select * from baseline')
    ]

    out_rows['pharma_alt_rates'] = [
        {
            'ndc': r.get('ndc'),
            'wac': coerce_decimal(r.get('wac')),
            'pkg_size': coerce_decimal(r.get('pkg_size')),
            'pkg_size_mult': coerce_decimal(r.get('pkg_size_mult')),
            'generic_indicator': r.get('generic_indicator') or r.get('generic') or r.get('generic_flag')
        }
        for r in fetch_all(cur, 'select * from alt_rates')
    ]

    out_rows['pharma_pbm_info'] = [
        {'bin': r.get('bin'), 'pbm_name': r.get('pbm_name'), 'email': r.get('email')}
        for r in fetch_all(cur, 'select * from pbm_info')
    ]

    # Tenant tables
    # pharmacy_profile (single row expected)
    prof = fetch_all(cur, 'select * from pharmacy_profile limit 1')
    if prof:
        p = prof[0]
        out_rows['pharma_pharmacy_profile'] = [{
            'pharmacy_id': str(pharmacy_id),
            'pharmacy_name': p.get('pharmacy_name'),
            'address': p.get('address'),
            'phone': p.get('phone'),
            'fax': p.get('fax'),
            'email': p.get('email'),
            'ncpdp': p.get('ncpdp'),
            'npi': p.get('npi'),
            'contact_person': p.get('contact_person'),
            'created_at': NOW,
            'updated_at': NOW,
        }]
    else:
        out_rows['pharma_pharmacy_profile'] = [{
            'pharmacy_id': str(pharmacy_id),
            'pharmacy_name': 'Unknown Pharmacy',
            'address': '', 'phone': '', 'fax': '', 'email': '',
            'ncpdp': '', 'npi': '', 'contact_person': '',
            'created_at': NOW, 'updated_at': NOW
        }]

    # user_data
    out_rows['pharma_user_data'] = []
    for r in fetch_all(cur, 'select * from user_data'):
        out_rows['pharma_user_data'].append({
            'script': r.get('script'),
            'pharmacy_id': str(pharmacy_id),
            'date_dispensed': r.get('date_dispensed'),
            'drug_ndc': r.get('drug_ndc') or r.get('ndc'),
            'drug_name': r.get('drug_name'),
            'qty': r.get('qty'),
            'total_paid': r.get('total_paid'),
            'new_paid': r.get('new_paid'),
            'bin': r.get('bin'),
            'pdf_file': r.get('pdf_file'),
            'status': r.get('status'),
            'created_at': NOW,
            'updated_at': NOW,
        })

    # report_files
    out_rows['pharma_report_files'] = []
    for r in fetch_all(cur, 'select * from report_files'):
        out_rows['pharma_report_files'].append({
            'script': r.get('script'),
            'report_type': r.get('report_type'),
            'pharmacy_id': str(pharmacy_id),
            'pdf_file': r.get('pdf_file'),
            'created_at': NOW,
        })

    # Export or upload
    if MODE == 'csv':
        for table, rows in out_rows.items():
            export_csv(table, rows)
        print("CSV exports complete →", OUT_DIR)
    elif MODE == 'supabase':
        missing = [k for k in ('SUPABASE_URL','SUPABASE_SERVICE_ROLE') if not globals().get(k)]
        if missing:
            raise SystemExit(f"Missing env vars: {missing}")
        # Load order: references then tenant tables
        for t in ('pharma_baseline','pharma_alt_rates','pharma_pbm_info','pharma_pharmacy_profile','pharma_user_data','pharma_report_files'):
            upsert_supabase(t, out_rows[t])
        print("Supabase upload complete.")
    else:
        raise SystemExit("MODE must be 'csv' or 'supabase'")

if __name__ == '__main__':
    main()
