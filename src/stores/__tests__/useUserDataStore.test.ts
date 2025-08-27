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

describe('useUserDataStore PDF state management', () => {
  let store: any;

  beforeEach(() => {
    // Import the store fresh for each test to avoid state pollution
    jest.resetModules();
    const { useUserDataStore } = require('../useUserDataStore');
    store = useUserDataStore.getState();
  });

  describe('setLastSavedPdfForContext', () => {
    it('should store PDF paths for a specific context', () => {
      const paths = ['pharmacy/report_commercial/test.pdf'];
      
      store.setLastSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31', paths);
      
      const retrieved = store.getLastSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31');
      expect(retrieved).toEqual(paths);
    });

    it('should handle multiple PDF paths', () => {
      const paths = [
        'pharmacy/report_commercial/test1.pdf',
        'pharmacy/report_commercial/test2.pdf'
      ];
      
      store.setLastSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31', paths);
      
      const retrieved = store.getLastSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31');
      expect(retrieved).toEqual(paths);
    });

    it('should handle empty array', () => {
      store.setLastSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31', []);
      
      const retrieved = store.getLastSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31');
      expect(retrieved).toEqual([]);
    });

    it('should create unique keys for different contexts', () => {
      store.setLastSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31', ['path1.pdf']);
      store.setLastSavedPdfForContext('federal', 'OptumRx', '2025-01-01', '2025-01-31', ['path2.pdf']);
      store.setLastSavedPdfForContext('commercial', 'Caremark', '2025-01-01', '2025-01-31', ['path3.pdf']);
      
      expect(store.getLastSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31')).toEqual(['path1.pdf']);
      expect(store.getLastSavedPdfForContext('federal', 'OptumRx', '2025-01-01', '2025-01-31')).toEqual(['path2.pdf']);
      expect(store.getLastSavedPdfForContext('commercial', 'Caremark', '2025-01-01', '2025-01-31')).toEqual(['path3.pdf']);
    });
  });

  describe('getLastSavedPdfForContext', () => {
    it('should return empty array for non-existent context', () => {
      const retrieved = store.getLastSavedPdfForContext('commercial', 'NonExistent', '2025-01-01', '2025-01-31');
      expect(retrieved).toEqual([]);
    });

    it('should return stored paths for existing context', () => {
      const paths = ['test.pdf'];
      store.setLastSavedPdfForContext('summary', 'OptumRx', '2025-02-01', '2025-02-28', paths);
      
      const retrieved = store.getLastSavedPdfForContext('summary', 'OptumRx', '2025-02-01', '2025-02-28');
      expect(retrieved).toEqual(paths);
    });
  });

  describe('hasSavedPdfForContext', () => {
    it('should return false for non-existent context', () => {
      const hasPdf = store.hasSavedPdfForContext('commercial', 'NonExistent', '2025-01-01', '2025-01-31');
      expect(hasPdf).toBe(false);
    });

    it('should return false for empty array', () => {
      store.setLastSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31', []);
      
      const hasPdf = store.hasSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31');
      expect(hasPdf).toBe(false);
    });

    it('should return true when PDFs exist', () => {
      store.setLastSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31', ['test.pdf']);
      
      const hasPdf = store.hasSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31');
      expect(hasPdf).toBe(true);
    });

    it('should return true for multiple PDFs', () => {
      store.setLastSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31', ['test1.pdf', 'test2.pdf']);
      
      const hasPdf = store.hasSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31');
      expect(hasPdf).toBe(true);
    });
  });

  describe('context key generation', () => {
    it('should generate consistent keys for same parameters', () => {
      const paths1 = ['test1.pdf'];
      const paths2 = ['test2.pdf'];
      
      store.setLastSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31', paths1);
      store.setLastSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31', paths2);
      
      // Second call should overwrite first
      const retrieved = store.getLastSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31');
      expect(retrieved).toEqual(paths2);
    });

    it('should differentiate between different date ranges', () => {
      store.setLastSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31', ['jan.pdf']);
      store.setLastSavedPdfForContext('commercial', 'OptumRx', '2025-02-01', '2025-02-28', ['feb.pdf']);
      
      expect(store.getLastSavedPdfForContext('commercial', 'OptumRx', '2025-01-01', '2025-01-31')).toEqual(['jan.pdf']);
      expect(store.getLastSavedPdfForContext('commercial', 'OptumRx', '2025-02-01', '2025-02-28')).toEqual(['feb.pdf']);
    });
  });
});
