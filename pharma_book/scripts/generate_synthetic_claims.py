#!/usr/bin/env python3
"""
Generate synthetic seed data compatible with the Supabase schema in README_DDL.sql.

Outputs CSVs under ../seeds/:
  - pharma_baseline.csv
  - pharma_alt_rates.csv
  - pharma_pbm_info.csv
  - pharma_pharmacy_profile.csv
  - pharma_user_data.csv (200 rows across known/unknown AAC and PBM/Federal)

Rules:
- Some NDCs intentionally absent from baseline to trigger WAC fallback.
- Some BINs intentionally not present in pbm_info to simulate Federal rows.
- Quantities, dates, and pay amounts randomized but reasonable.

Run: python scripts/generate_synthetic_claims.py
"""
from __future__ import annotations
import csv
import os
import random
from datetime import date, timedelta
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEEDS = os.path.join(ROOT, 'seeds')
os.makedirs(SEEDS, exist_ok=True)

random.seed(42)

# --- Seed data templates ---
# 10 NDCs where 7 are in baseline and 3 only in alt_rates (to force WAC)
NDC_BASELINE = [
    ("0001-0001-01", "Drug A", "B", date(2025, 7, 1), 0.12),
    ("0001-0002-01", "Drug B", "G", date(2025, 7, 1), 0.08),
    ("0001-0003-01", "Drug C", "G", date(2025, 7, 1), 0.21),
    ("0001-0004-01", "Drug D", "B", date(2025, 7, 1), 0.05),
    ("0001-0005-01", "Drug E", "G", date(2025, 7, 1), 0.33),
    ("0001-0006-01", "Drug F", "B", date(2025, 7, 1), 0.15),
    ("0001-0007-01", "Drug G", "G", date(2025, 7, 1), 0.27),
]

NDC_WAC_ONLY = [
    ("0001-9001-01", 120.0, 100.0, 1.0, 'N'),  # brand → 0.96 * WAC / pkg
    ("0001-9002-01", 80.0,  30.0,  1.0, 'Y'),  # generic → WAC / pkg
    ("0001-9003-01", 50.0,  60.0,  2.0, 'Y'),
]

# PBMs (bins) + a few unmapped federal-like bins
PBM_LIST = [
    ("610011", "Express Scripts", "NetworkCompliance@express-scripts.com"),
    ("610014", "Caremark", "somebox@caremark.com"),
    ("610515", "Optum", "networkops@optum.com"),
]
FEDERAL_BINS = ["610000", "999999"]  # will not be in pbm_info

FIXED_FEE = 10.64

# --- Write reference CSVs ---
bl_path = os.path.join(SEEDS, 'pharma_baseline.csv')
with open(bl_path, 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(["ndc","drug_name","bg","effective_date","aac"])
    for ndc, name, bg, eff, aac in NDC_BASELINE:
        w.writerow([ndc, name, bg, eff.isoformat(), f"{aac:.4f}"])

ar_path = os.path.join(SEEDS, 'pharma_alt_rates.csv')
with open(ar_path, 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(["ndc","wac","pkg_size","pkg_size_mult","generic_indicator"])
    for ndc, wac, pkg, mult, gi in NDC_WAC_ONLY:
        w.writerow([ndc, f"{wac:.4f}", f"{pkg:.4f}", f"{mult:.4f}", gi])

pbm_path = os.path.join(SEEDS, 'pharma_pbm_info.csv')
with open(pbm_path, 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(["bin","pbm_name","email"])
    for b, n, e in PBM_LIST:
        w.writerow([b, n, e])

# Minimal pharmacy profile (single tenant)
pharmacy_id = uuid.uuid4()
prof_path = os.path.join(SEEDS, 'pharma_pharmacy_profile.csv')
with open(prof_path, 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(["pharmacy_id","pharmacy_name","address","phone","fax","email","ncpdp","npi","contact_person","created_at","updated_at"])
    w.writerow([str(pharmacy_id),"Demo Pharmacy","1 Demo Way","555-1111","555-2222","demo@pharmacy.test","0000000","0000000000","Demo User",date.today().isoformat(),date.today().isoformat()])

# --- Generate ~200 claim rows ---
all_ndcs = [x[0] for x in NDC_BASELINE] + [x[0] for x in NDC_WAC_ONLY]
all_bins = [b for b,_,_ in PBM_LIST] + FEDERAL_BINS
start = date(2025, 7, 1)
end = date(2025, 8, 31)

ud_path = os.path.join(SEEDS, 'pharma_user_data.csv')
with open(ud_path, 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(["script","pharmacy_id","date_dispensed","drug_ndc","drug_name","qty","total_paid","new_paid","bin","pdf_file","status","created_at","updated_at"])
    for i in range(200):
        ndc = random.choice(all_ndcs)
        # derive name from baseline if available
        name = next((n for n in NDC_BASELINE if n[0]==ndc), None)
        drug_name = name[1] if name else f"Drug {ndc[-2:]}"
        qty = random.choice([1, 2, 3, 10, 30, 60, 90, 100])
        d = start + timedelta(days=random.randint(0, (end-start).days))
        b = random.choice(all_bins)
        # expected via AAC or WAC logic to shape total_paid around underpaid
        if name:
            unit = name[4]
        else:
            wac_row = next(x for x in NDC_WAC_ONLY if x[0]==ndc)
            wac, pkg, mult, gi = wac_row[1], wac_row[2], wac_row[3], wac_row[4]
            denom = max(pkg*mult, 1.0)
            unit = (0.96*wac)/denom if gi=='N' else (wac)/denom
        expected = qty*unit + FIXED_FEE
        # make ~70% underpaid
        if random.random() < 0.7:
            total_paid = expected - abs(random.uniform(0.5, 12.0))
        else:
            total_paid = expected + abs(random.uniform(0.1, 6.0))
        new_paid = ''  # leave blank in seed
        script = f"{d.strftime('%Y%m%d')}-{i:04d}"
        status = ''
        w.writerow([
            script,
            str(pharmacy_id),
            d.isoformat(),
            ndc,
            drug_name,
            f"{qty:.2f}",
            f"{total_paid:.2f}",
            new_paid,
            b,
            '',
            status,
            date.today().isoformat(),
            date.today().isoformat()
        ])

print("Seeds written to:", SEEDS)
print("- ", os.listdir(SEEDS))
