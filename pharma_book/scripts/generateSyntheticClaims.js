#!/usr/bin/env node
"use strict";
/**
 * Generate synthetic, joined CSVs that match Supabase pharma_ tables.
 * Writes to ./seeds by default.
 *
 * Run:
 *   node scripts/generateSyntheticClaims.js
 */
const fs = require('fs');
const path = require('path');

const SEEDS = path.resolve(process.cwd(), 'seeds');
fs.mkdirSync(SEEDS, { recursive: true });

const rnd = (min, max) => Math.random() * (max - min) + min;
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const FIXED_FEE = 10.64;

const NDC_BASELINE = [
  ['0001-0001-01', 'Drug A', 'B', '2025-07-01', 0.12],
  ['0001-0002-01', 'Drug B', 'G', '2025-07-01', 0.08],
  ['0001-0003-01', 'Drug C', 'G', '2025-07-01', 0.21],
  ['0001-0004-01', 'Drug D', 'B', '2025-07-01', 0.05],
  ['0001-0005-01', 'Drug E', 'G', '2025-07-01', 0.33],
  ['0001-0006-01', 'Drug F', 'B', '2025-07-01', 0.15],
  ['0001-0007-01', 'Drug G', 'G', '2025-07-01', 0.27],
];
const NDC_WAC_ONLY = [
  ['0001-9001-01', 120.0, 100.0, 1.0, 'N'],
  ['0001-9002-01', 80.0, 30.0, 1.0, 'Y'],
  ['0001-9003-01', 50.0, 60.0, 2.0, 'Y'],
];
const PBM_LIST = [
  ['610011', 'Express Scripts', 'NetworkCompliance@express-scripts.com'],
  ['610014', 'Caremark', 'somebox@caremark.com'],
  ['610515', 'Optum', 'networkops@optum.com'],
];
const FEDERAL_BINS = ['610000', '999999'];

const todayIso = new Date().toISOString().slice(0, 10);
const pharmacyId = (process.env.PHARMACY_ID && /^[0-9a-f-]{36}$/i.test(process.env.PHARMACY_ID))
  ? process.env.PHARMACY_ID
  : '00000000-0000-0000-0000-000000000001';

function writeCsv(fp, rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/\"/g, '""')}"` : s;
  };
  const out = rows.map(r => r.map(esc).join(',')).join('\n') + '\n';
  fs.writeFileSync(fp, out);
  console.log(`wrote ${rows.length - 1} rows -> ${fp}`);
}

// Reference CSVs
writeCsv(path.join(SEEDS, 'pharma_baseline.csv'), [
  ['ndc', 'drug_name', 'bg', 'effective_date', 'aac'],
  ...NDC_BASELINE.map(([ndc, name, bg, eff, aac]) => [ndc, name, bg, eff, aac.toFixed(4)]),
]);

writeCsv(path.join(SEEDS, 'pharma_alt_rates.csv'), [
  ['ndc', 'wac', 'pkg_size', 'pkg_size_mult', 'generic_indicator'],
  ...NDC_WAC_ONLY.map(([ndc, wac, pkg, mult, gi]) => [
    ndc, wac.toFixed(4), pkg.toFixed(4), mult.toFixed(4), gi,
  ]),
]);

writeCsv(path.join(SEEDS, 'pharma_pbm_info.csv'), [
  ['bin', 'pbm_name', 'email'],
  ...PBM_LIST,
]);

writeCsv(path.join(SEEDS, 'pharma_pharmacy_profile.csv'), [
  ['pharmacy_id','pharmacy_name','address','phone','fax','email','ncpdp','npi','contact_person','created_at','updated_at'],
  [pharmacyId,'Demo Pharmacy','1 Demo Way','555-1111','555-2222','demo@pharmacy.test','0000000','0000000000','Demo User',todayIso,todayIso],
]);

// User data (~200 rows)
const allNdc = [...NDC_BASELINE.map(r => r[0]), ...NDC_WAC_ONLY.map(r => r[0])];
const bins = [...PBM_LIST.map(r => r[0]), ...FEDERAL_BINS];
const start = new Date('2025-07-01T00:00:00Z'); const end = new Date('2025-08-31T00:00:00Z');
const daysSpan = (end - start) / (24 * 3600 * 1000);

const udRows = [['script','pharmacy_id','date_dispensed','drug_ndc','drug_name','qty','total_paid','new_paid','bin','pdf_file','status','created_at','updated_at']];

for (let i = 0; i < 200; i++) {
  const ndc = choice(allNdc);
  const bl = NDC_BASELINE.find(r => r[0] === ndc);
  const drugName = bl ? bl[1] : `Drug ${ndc.slice(-2)}`;
  const qty = choice([1,2,3,10,30,60,90,100]);
  const d = new Date(start.getTime() + Math.floor(Math.random() * daysSpan) * 86400000);
  const dateIso = d.toISOString().slice(0,10);
  const bin = choice(bins);

  let unit;
  if (bl) {
    unit = bl[4];
  } else {
    const w = NDC_WAC_ONLY.find(r => r[0] === ndc);
    const denom = Math.max(w[2] * w[3], 1.0);
    unit = (w[4] === 'N') ? (0.96 * w[1]) / denom : (w[1] / denom);
  }
  const expected = qty * unit + FIXED_FEE;
  const totalPaid = Math.random() < 0.7 ? (expected - Math.abs(rnd(0.5, 12.0))) : (expected + Math.abs(rnd(0.1, 6.0)));

  const script = `${dateIso.replace(/-/g,'')}-${String(i).padStart(4,'0')}`;
  udRows.push([script, pharmacyId, dateIso, ndc, drugName, qty.toFixed(2), totalPaid.toFixed(2), '', bin, '', '', todayIso, todayIso]);
}
writeCsv(path.join(SEEDS, 'pharma_user_data.csv'), udRows);

console.log('Seeds generated in ./seeds');
