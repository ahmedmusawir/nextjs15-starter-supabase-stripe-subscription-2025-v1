// src/services/ClaimsServices.ts

export type GetClaimsParams = {
  dateFrom?: string;
  dateTo?: string;
  script?: string;
  ndc?: string;
  drug?: string;
  bin?: string;
  status?: string;
  owedType?: 'underpaid' | 'overpaid' | 'all';
  method?: 'AAC' | 'WAC';
  pbm?: string;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

export type AdminRow = {
  script: string;
  date: string | null;
  ndc: string;
  drugName: string;
  qty: number;
  aac?: number;
  wac?: number;
  method: 'AAC' | 'WAC' | 'Other';
  expected?: number;
  paid: number;
  newPaid?: number | null;
  owed?: number;
  bin?: string | null;
  pbmName?: string | null;
  report?: string | null;
  status?: string | null;
  pdfUrl?: string | null;
};

export type GetClaimsResponse = {
  rows: AdminRow[];
  total: number;
  totalAfterDerivedFilters?: number;
  page: number;
  limit: number;
};

export type GetKpisParams = Omit<GetClaimsParams, 'page' | 'limit' | 'sortKey' | 'sortDir'>;
export type GetKpisResponse = {
  scriptsAll: number;
  scriptsCommercial: number;
  scriptsAllDerived: number;
  scriptsCommercialDerived: number;
  underpaidAllAbs: number;
  underpaidCommercialAbs: number;
  owedNetAll: number;
  owedNetCommercial: number;
  updatedDifferenceTotal: number;
};

const buildQuery = (params: GetClaimsParams): string => {
  const q = new URLSearchParams();
  if (params.dateFrom) q.set('dateFrom', params.dateFrom);
  if (params.dateTo) q.set('dateTo', params.dateTo);
  if (params.script) q.set('script', params.script);
  if (params.ndc) q.set('ndc', params.ndc);
  if (params.drug) q.set('drug', params.drug);
  if (params.bin) q.set('bin', params.bin);
  if (params.status) q.set('status', params.status);
  if (params.owedType && params.owedType !== 'all') q.set('owedType', params.owedType);
  if (params.method) q.set('method', params.method);
  if (params.pbm) q.set('pbm', params.pbm);
  if (params.sortKey) q.set('sortKey', params.sortKey);
  if (params.sortDir) q.set('sortDir', params.sortDir);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const s = q.toString();
  return s ? `?${s}` : '';
};

export async function getClaims(params: GetClaimsParams = {}): Promise<GetClaimsResponse> {
  const query = buildQuery(params);
  const res = await fetch(`/api/user-data${query}`, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`getClaims failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  // Trust the API shape but ensure numbers
  const rows: AdminRow[] = (data.rows || []).map((r: any) => ({
    script: r.script,
    date: r.date ?? null,
    ndc: r.ndc ?? '',
    drugName: r.drugName ?? '',
    qty: Number(r.qty ?? 0),
    aac: typeof r.aac === 'number' ? r.aac : (r.aac != null ? Number(r.aac) : undefined),
    wac: typeof r.wac === 'number' ? r.wac : (r.wac != null ? Number(r.wac) : undefined),
    method: r.method || 'Other',
    expected: r.expected != null ? Number(r.expected) : undefined,
    paid: Number(r.paid ?? 0),
    newPaid: r.newPaid != null ? Number(r.newPaid) : null,
    owed: r.owed != null ? Number(r.owed) : undefined,
    bin: r.bin ?? null,
    pbmName: r.pbmName ?? null,
    report: r.report ?? null,
    status: r.status ?? null,
    pdfUrl: r.pdfUrl ?? null,
  }));
  return {
    rows,
    total: Number(data.total ?? 0),
    totalAfterDerivedFilters: data.totalAfterDerivedFilters != null ? Number(data.totalAfterDerivedFilters) : undefined,
    page: Number(data.page ?? 1),
    limit: Number(data.limit ?? 25),
  };
}

export async function getKpis(params: GetKpisParams = {}): Promise<GetKpisResponse> {
  const q = new URLSearchParams();
  if (params.dateFrom) q.set('dateFrom', params.dateFrom);
  if (params.dateTo) q.set('dateTo', params.dateTo);
  if (params.script) q.set('script', params.script);
  if (params.ndc) q.set('ndc', params.ndc);
  if (params.drug) q.set('drug', params.drug);
  if (params.bin) q.set('bin', params.bin);
  if (params.status) q.set('status', params.status);
  if (params.owedType && params.owedType !== 'all') q.set('owedType', params.owedType);
  if (params.method) q.set('method', params.method);
  if (params.pbm) q.set('pbm', params.pbm);
  const s = q.toString();
  const query = s ? `?${s}` : '';
  const res = await fetch(`/api/kpis${query}`, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`getKpis failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return {
    scriptsAll: Number(data.scriptsAll ?? 0),
    scriptsCommercial: Number(data.scriptsCommercial ?? 0),
    scriptsAllDerived: Number(data.scriptsAllDerived ?? 0),
    scriptsCommercialDerived: Number(data.scriptsCommercialDerived ?? 0),
    underpaidAllAbs: typeof data.underpaidAllAbs === 'number' ? data.underpaidAllAbs : Number(data.underpaidAllAbs ?? 0),
    underpaidCommercialAbs: typeof data.underpaidCommercialAbs === 'number' ? data.underpaidCommercialAbs : Number(data.underpaidCommercialAbs ?? 0),
    owedNetAll: typeof data.owedNetAll === 'number' ? data.owedNetAll : Number(data.owedNetAll ?? 0),
    owedNetCommercial: typeof data.owedNetCommercial === 'number' ? data.owedNetCommercial : Number(data.owedNetCommercial ?? 0),
    updatedDifferenceTotal: typeof data.updatedDifferenceTotal === 'number' ? data.updatedDifferenceTotal : Number(data.updatedDifferenceTotal ?? 0),
  };
}

export const ClaimsServices = {
  getClaims,
  getKpis,
};

export default ClaimsServices;
