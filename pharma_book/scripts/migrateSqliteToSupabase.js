#!/usr/bin/env node
"use strict";
/**
 * SQLite -> Supabase migration for Cyber Pharma (Node.js).
 * MODE:
 *   - csv       : export CSVs to OUT_DIR (default ./exports)
 *   - supabase  : upsert rows into Supabase using service role key
 *
 * Env:
 *   MODE=csv|supabase
 *   SQLITE_PATH=./app.db
 *   OUT_DIR=./exports
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   PHARMACY_ID=<uuid>  (optional; generated fallback)
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');

const MODE = (process.env.MODE || 'csv').toLowerCase();
const SQLITE_PATH = process.env.SQLITE_PATH || './app.db';
const OUT_DIR = process.env.OUT_DIR || './exports';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const NOW = new Date().toISOString();
const PHARMACY_ID = (process.env.PHARMACY_ID && /^[0-9a-f-]{36}$/i.test(process.env.PHARMACY_ID))
  ? process.env.PHARMACY_ID
  : cryptoUuid();

function cryptoUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

function writeCsv(fp, header, rows) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/\"/g, '""')}"` : s;
  };
  const out = [header, ...rows].map(r => r.map(esc).join(',')).join('\n') + '\n';
  fs.writeFileSync(fp, out);
  console.log(`wrote ${rows.length} rows -> ${fp}`);
}

function num(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const db = new Database(SQLITE_PATH, { fileMustExist: true });
  console.log(`Using PHARMACY_ID=${PHARMACY_ID}`);

  // Reference tables
  const baseline = db.prepare('select * from baseline').all().map(r => ({
    ndc: r.ndc || r.drug_ndc || r.NDC || r.Ndc,
    drug_name: r['drug name'] ?? r.drug_name ?? r.DrugName ?? '',
    bg: r.bg ?? r.BG ?? '',
    effective_date: r['effective date'] ?? r.effective_date ?? null,
    aac: r.aac ?? null
  }));

  const altRates = db.prepare('select * from alt_rates').all().map(r => ({
    ndc: r.ndc,
    wac: num(r.wac),
    pkg_size: num(r.pkg_size),
    pkg_size_mult: num(r.pkg_size_mult),
    generic_indicator: r.generic_indicator ?? r.generic ?? r.generic_flag ?? null
  }));

  const pbmInfo = db.prepare('select * from pbm_info').all().map(r => ({
    bin: r.bin, pbm_name: r.pbm_name, email: r.email
  }));

  // Tenant tables
  const profRow = db.prepare('select * from pharmacy_profile limit 1').get();
  const profile = [{
    pharmacy_id: PHARMACY_ID,
    pharmacy_name: profRow?.pharmacy_name || 'Unknown Pharmacy',
    address: profRow?.address || '',
    phone: profRow?.phone || '',
    fax: profRow?.fax || '',
    email: profRow?.email || '',
    ncpdp: profRow?.ncpdp || '',
    npi: profRow?.npi || '',
    contact_person: profRow?.contact_person || '',
    created_at: NOW,
    updated_at: NOW
  }];

  const userData = db.prepare('select * from user_data').all().map(r => ({
    script: r.script,
    pharmacy_id: PHARMACY_ID,
    date_dispensed: r.date_dispensed,
    drug_ndc: r.drug_ndc || r.ndc || null,
    drug_name: r.drug_name || null,
    qty: r.qty,
    total_paid: r.total_paid,
    new_paid: r.new_paid,
    bin: r.bin,
    pdf_file: r.pdf_file,
    status: r.status,
    created_at: NOW,
    updated_at: NOW
  }));

  const reportFiles = db.prepare('select * from report_files').all().map(r => ({
    script: r.script,
    report_type: r.report_type,
    pharmacy_id: PHARMACY_ID,
    pdf_file: r.pdf_file,
    created_at: NOW
  }));

  if (MODE === 'csv') {
    writeCsv(path.join(OUT_DIR, 'pharma_baseline.csv'),
      ['ndc','drug_name','bg','effective_date','aac'],
      baseline.map(r => [r.ndc, r.drug_name, r.bg, r.effective_date, r.aac]));

    writeCsv(path.join(OUT_DIR, 'pharma_alt_rates.csv'),
      ['ndc','wac','pkg_size','pkg_size_mult','generic_indicator'],
      altRates.map(r => [r.ndc, r.wac, r.pkg_size, r.pkg_size_mult, r.generic_indicator]));

    writeCsv(path.join(OUT_DIR, 'pharma_pbm_info.csv'),
      ['bin','pbm_name','email'],
      pbmInfo.map(r => [r.bin, r.pbm_name, r.email]));

    writeCsv(path.join(OUT_DIR, 'pharma_pharmacy_profile.csv'),
      ['pharmacy_id','pharmacy_name','address','phone','fax','email','ncpdp','npi','contact_person','created_at','updated_at'],
      profile.map(r => [r.pharmacy_id,r.pharmacy_name,r.address,r.phone,r.fax,r.email,r.ncpdp,r.npi,r.contact_person,r.created_at,r.updated_at]));

    writeCsv(path.join(OUT_DIR, 'pharma_user_data.csv'),
      ['script','pharmacy_id','date_dispensed','drug_ndc','drug_name','qty','total_paid','new_paid','bin','pdf_file','status','created_at','updated_at'],
      userData.map(r => [r.script,r.pharmacy_id,r.date_dispensed,r.drug_ndc,r.drug_name,r.qty,r.total_paid,r.new_paid,r.bin,r.pdf_file,r.status,r.created_at,r.updated_at]));

    writeCsv(path.join(OUT_DIR, 'pharma_report_files.csv'),
      ['script','report_type','pharmacy_id','pdf_file','created_at'],
      reportFiles.map(r => [r.script,r.report_type,r.pharmacy_id,r.pdf_file,r.created_at]));

    console.log('CSV exports complete ->', OUT_DIR);
  } else if (MODE === 'supabase') {
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      throw new Error('SUPABASE credentials missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const upsert = async (table, rows, onConflict) => {
      for (let i = 0; i < rows.length; i += 1000) {
        const chunk = rows.slice(i, i + 1000);
        const { error } = await supabase.from(table).upsert(chunk, { onConflict });
        if (error) throw error;
      }
      console.log(`upserted ${rows.length} -> ${table}`);
    };

    await upsert('pharma_baseline', baseline, 'ndc');
    await upsert('pharma_alt_rates', altRates, 'ndc');
    await upsert('pharma_pbm_info', pbmInfo, 'bin');
    await upsert('pharma_pharmacy_profile', profile, 'pharmacy_id');
    await upsert('pharma_user_data', userData, 'script');
    await upsert('pharma_report_files', reportFiles, 'script,report_type');

    console.log('Supabase upload complete.');
  } else {
    throw new Error("MODE must be 'csv' or 'supabase'");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
