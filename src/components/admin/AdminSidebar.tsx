"use client";

import React from "react";
import FiltersPanel from "@/components/admin/FiltersPanel";
import { useUserDataStore } from "@/stores/useUserDataStore";

// Simple debounce hook
function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay = 200) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = React.useCallback(
    (...args: any[]) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay]
  );
  React.useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);
  return cb as T;
}

const AdminSidebar = () => {
  // Wire directly to Zustand store (single source of truth)
  const { filters, setFilters, applyFilters, setPage, fetchUserData } = useUserDataStore();

  const runApply = React.useCallback(() => {
    applyFilters();
    setPage(1);
  }, [applyFilters, setPage]);

  const runApplyDebounced = useDebouncedCallback(runApply, 200);

  const fromDate = filters.dateFrom || "";
  const toDate = filters.dateTo || "";
  const owedFilter = filters.owedType === "underpaid" ? "Underpaid" : filters.owedType === "overpaid" ? "Overpaid" : "All";
  const pbm = filters.pbm || "All";

  const activeCount = [
    filters.dateFrom ? 1 : 0,
    filters.dateTo ? 1 : 0,
    filters.owedType && filters.owedType !== "all" ? 1 : 0,
    filters.pbm && filters.pbm !== "All" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearFilters = () => {
    setFilters({ dateFrom: undefined, dateTo: undefined, owedType: "all", pbm: undefined });
    runApply();
  };

  const onFromDate = (v: string) => {
    setFilters({ dateFrom: v || undefined });
    runApplyDebounced();
  };
  const onToDate = (v: string) => {
    setFilters({ dateTo: v || undefined });
    runApplyDebounced();
  };
  const onOwedFilter = (v: string) => {
    const val = v.toLowerCase();
    setFilters({ owedType: val === "underpaid" ? "underpaid" : val === "overpaid" ? "overpaid" : "all" });
    runApply();
  };
  const onPbm = (v: string) => {
    setFilters({ pbm: v === "All" ? undefined : v });
    runApply();
  };

  return (
    <div className="h-full overflow-y-auto bg-muted/20 p-4">
      <h3 className="mb-3 text-base font-semibold text-orange-700">Filters</h3>
      <FiltersPanel
        fromDate={fromDate}
        toDate={toDate}
        owedFilter={owedFilter}
        pbm={pbm}
        activeCount={activeCount}
        onFromDate={onFromDate}
        onToDate={onToDate}
        onOwedFilter={onOwedFilter}
        onPbm={onPbm}
        onClear={clearFilters}
        onApply={runApply}
        onRefresh={() => fetchUserData()}
      />
    </div>
  );
};

export default AdminSidebar;
