import { applyClientSideFilters, calculateKPIs, Row } from '../useUserDataStore';

// Helper to build rows quickly
const r = (partial: Partial<Row>): Row => ({
  script: partial.script || 'S1',
  date: partial.date ?? '2024-01-10',
  ndc: partial.ndc || '0000',
  drugName: partial.drugName || 'Drug',
  qty: partial.qty ?? 1,
  aac: partial.aac,
  wac: partial.wac,
  method: partial.method || 'AAC',
  expected: partial.expected,
  paid: partial.paid ?? 0,
  newPaid: partial.newPaid ?? null,
  owed: partial.owed,
  bin: partial.bin ?? null,
  pbmName: partial.pbmName ?? 'OptumRx',
  report: partial.report ?? null,
  status: partial.status ?? null,
  pdfUrl: partial.pdfUrl ?? null,
});

describe('applyClientSideFilters', () => {
  const baseRows: Row[] = [
    r({ script: 'A', date: '2024-01-05', owed: 10, pbmName: 'OptumRx' }),
    r({ script: 'B', date: '2024-01-20', owed: -5, pbmName: 'Federal' }),
    r({ script: 'C', date: '2024-02-01', owed: 0, pbmName: 'Caremark' }),
  ];

  it('filters by date range', () => {
    const filtered = applyClientSideFilters(baseRows, { dateFrom: '2024-01-10', dateTo: '2024-01-31' });
    expect(filtered.map(x => x.script)).toEqual(['B']);
  });

  it('filters by owedType underpaid', () => {
    const filtered = applyClientSideFilters(baseRows, { owedType: 'underpaid' });
    expect(filtered.map(x => x.script)).toEqual(['A']);
  });

  it('filters by owedType overpaid', () => {
    const filtered = applyClientSideFilters(baseRows, { owedType: 'overpaid' });
    expect(filtered.map(x => x.script)).toEqual(['B']);
  });

  it('filters by PBM name', () => {
    const filtered = applyClientSideFilters(baseRows, { pbm: 'Caremark' });
    expect(filtered.map(x => x.script)).toEqual(['C']);
  });
});

describe('calculateKPIs', () => {
  it('calculates commercial KPIs excluding Federal', () => {
    const rows: Row[] = [
      r({ script: 'A', pbmName: 'OptumRx', owed: 10, paid: 90, newPaid: null }),
      r({ script: 'B', pbmName: 'Caremark', owed: 20, paid: 80, newPaid: 100 }),
      r({ script: 'C', pbmName: 'Federal', owed: 999, paid: 50, newPaid: 60 }),
    ];
    const k = calculateKPIs(rows);
    // Only A and B count as commercial
    expect(k.scriptsCommercial).toBe(2);
    // Underpaid abs (A + B owed > 0)
    expect(k.underpaidCommercialAbs).toBe(30);
    // updatedDifferenceTotal = sum(newPaid - paid) for rows with newPaid among commercial only (B only)
    expect(k.updatedDifferenceTotal).toBe(20);
    // owedTotal = underpaidCommercialAbs - updatedDifferenceTotal
    expect(k.owedTotal).toBe(10);
  });
});
