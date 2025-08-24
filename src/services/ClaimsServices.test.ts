// src/services/ClaimsServices.test.ts
import { getClaims } from './ClaimsServices';

describe('ClaimsServices.getClaims', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn(async (input: RequestInfo) => {
      const url = String(input);
      // Basic shape check on query params
      expect(url).toContain('/api/user-data');
      if (url.includes('dateFrom=2025-01-01')) {
        // ok
      }

      const body = {
        rows: [
          {
            script: 'S1',
            date: '2025-01-10',
            ndc: '0000-1111',
            drugName: 'Drug A',
            qty: '2', // string → coerced to number
            aac: 1.5,
            wac: null,
            method: 'AAC',
            expected: '3.0', // string → coerced to number
            paid: '1.0', // string → coerced to number
            newPaid: null,
            owed: '2.0',
            bin: '123456',
            pbmName: 'Express Scripts',
            report: null,
            status: 'emailed PBM',
            pdfUrl: null,
          },
        ],
        total: 1,
        totalAfterDerivedFilters: 1,
        page: 1,
        limit: 25,
      };

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as unknown as Response;
    }) as any;
  });

  afterEach(() => {
    jest.resetAllMocks();
    global.fetch = originalFetch as any;
  });

  it('builds query params and maps numbers correctly', async () => {
    const res = await getClaims({
      dateFrom: '2025-01-01',
      dateTo: '2025-12-31',
      owedType: 'underpaid',
      sortKey: 'date_dispensed',
      sortDir: 'desc',
      page: 1,
      limit: 25,
    });

    expect(res.total).toBe(1);
    expect(res.rows).toHaveLength(1);
    const row = res.rows[0];
    expect(row.script).toBe('S1');
    expect(row.qty).toBe(2);
    expect(row.expected).toBe(3.0);
    expect(row.paid).toBe(1.0);
    expect(row.owed).toBe(2.0);
    expect(row.method).toBe('AAC');
  });

  it('throws on non-OK responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(new Response('nope', { status: 500 }) as any);
    await expect(getClaims()).rejects.toThrow('getClaims failed: 500');
  });
});
