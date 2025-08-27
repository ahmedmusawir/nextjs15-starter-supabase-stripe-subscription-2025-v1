import { create } from 'zustand';

interface Filters {
  dateFrom?: string;
  dateTo?: string;
  owedType?: 'all' | 'underpaid' | 'overpaid';
  pbm?: string;
}

interface KPIData {
  underpaidCommercialAbs: number;
  scriptsCommercial: number;
  updatedDifferenceTotal: number;
  owedTotal: number;
}

export type Row = {
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

type UserDataStore = {
  allRows: Row[];
  filteredRows: Row[];
  filters: Filters;
  page: number;
  rowsPerPage: number;
  loading: boolean;
  error: string | null;
  kpis: KPIData;
  // Map context key -> array of saved PDF storage paths
  lastSavedPdfByContext: Record<string, string[]>;
  setLastSavedPdfForContext: (
    tab: 'commercial' | 'updated' | 'federal' | 'summary',
    pbm: string,
    dateFrom: string,
    dateTo: string,
    paths: string[]
  ) => void;
  getLastSavedPdfForContext: (
    tab: 'commercial' | 'updated' | 'federal' | 'summary',
    pbm: string,
    dateFrom: string,
    dateTo: string,
  ) => string[];
  hasSavedPdfForContext: (
    tab: 'commercial' | 'updated' | 'federal' | 'summary',
    pbm: string,
    dateFrom: string,
    dateTo: string,
  ) => boolean;
  
  setFilters: (filters: Partial<Filters>) => void;
  applyFilters: () => void;
  setPage: (page: number) => void;
  fetchUserData: () => Promise<void>;
  clearFilters: () => void;
};

export const applyClientSideFilters = (allRows: Row[], filters: Filters): Row[] => {
  let filtered = [...allRows];
  
  // Date range filtering
  if (filters.dateFrom) {
    filtered = filtered.filter(row => {
      if (!row.date) return false;
      return row.date >= filters.dateFrom!;
    });
  }
  
  if (filters.dateTo) {
    filtered = filtered.filter(row => {
      if (!row.date) return false;
      return row.date <= filters.dateTo!;
    });
  }
  
  // Owed type filtering
  if (filters.owedType && filters.owedType !== 'all') {
    filtered = filtered.filter(row => {
      const owed = row.owed ?? 0;
      if (filters.owedType === 'underpaid') {
        return owed > 0; // Positive owed means underpaid
      } else if (filters.owedType === 'overpaid') {
        return owed < 0; // Negative owed means overpaid
      }
      return true;
    });
  }
  
  // PBM filtering
  if (filters.pbm && filters.pbm !== 'All') {
    filtered = filtered.filter(row => row.pbmName === filters.pbm);
  }
  
  return filtered;
};

export const calculateKPIs = (rows: Row[]): KPIData => {
  // Filter to commercial scripts only (non-Federal)
  const commercialRows = rows.filter(r => r.pbmName !== 'Federal');
  
  // Scripts count
  const scriptsCommercial = commercialRows.length;
  
  // Underpaid commercial (positive owed amounts)
  const underpaidCommercialAbs = commercialRows
    .filter(r => (r.owed ?? 0) > 0)
    .reduce((sum, r) => sum + (r.owed ?? 0), 0);
  
  // Updated difference total (newPaid - paid for rows with newPaid)
  const updatedDifferenceTotal = commercialRows
    .filter(r => r.newPaid != null)
    .reduce((sum, r) => sum + ((r.newPaid ?? 0) - r.paid), 0);
  
  // Owed total calculation
  const owedTotal = underpaidCommercialAbs - updatedDifferenceTotal;
  
  return {
    underpaidCommercialAbs,
    scriptsCommercial,
    updatedDifferenceTotal,
    owedTotal
  };
};

export const useUserDataStore = create<UserDataStore>((set, get) => ({
  allRows: [],
  filteredRows: [],
  filters: {},
  page: 1,
  rowsPerPage: 50,
  loading: false,
  error: null,
  kpis: {
    underpaidCommercialAbs: 0,
    scriptsCommercial: 0,
    updatedDifferenceTotal: 0,
    owedTotal: 0
  },
  lastSavedPdfByContext: {},
  setLastSavedPdfForContext: (tab, pbm, dateFrom, dateTo, paths) => {
    const key = `${tab}|${pbm}|${dateFrom}|${dateTo}`;
    const current = { ...get().lastSavedPdfByContext };
    current[key] = Array.isArray(paths) ? paths : [];
    set({ lastSavedPdfByContext: current });
  },
  getLastSavedPdfForContext: (tab, pbm, dateFrom, dateTo) => {
    const key = `${tab}|${pbm}|${dateFrom}|${dateTo}`;
    return get().lastSavedPdfByContext[key] || [];
  },
  hasSavedPdfForContext: (tab, pbm, dateFrom, dateTo) => {
    const key = `${tab}|${pbm}|${dateFrom}|${dateTo}`;
    const arr = get().lastSavedPdfByContext[key] || [];
    return arr.length > 0;
  },
  
  setFilters: (newFilters) => {
    const currentFilters = get().filters;
    const updatedFilters = { ...currentFilters, ...newFilters };
    set({ filters: updatedFilters });
  },
  
  applyFilters: () => {
    const { allRows, filters } = get();
    console.info('[useUserDataStore] applyFilters()', { filters });
    const filteredRows = applyClientSideFilters(allRows, filters);
    const kpis = calculateKPIs(filteredRows);
    set({ filteredRows, kpis, page: 1 }); // Reset to page 1 when filters change
  },
  
  setPage: (page) => {
    set({ page });
  },
  
  fetchUserData: async () => {
    set({ loading: true, error: null });
    
    try {
      // Fetch all data without any filters - get everything
      const response = await fetch('/api/user-data?limit=10000&skipFilters=true', { 
        cache: 'no-store' 
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }
      
      const data = await response.json();
      const rows: Row[] = (data.rows || []).map((r: any) => ({
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
      
      set({ allRows: rows, loading: false });
      
      // Apply current filters to new data and calculate KPIs
      get().applyFilters();
      
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch data',
        loading: false 
      });
    }
  },
  
  clearFilters: () => {
    set({ 
      filters: {},
      page: 1 
    });
    get().applyFilters();
  },
}));
