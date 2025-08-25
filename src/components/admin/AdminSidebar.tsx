"use client";

import React from "react";
import FiltersPanel from "@/components/admin/FiltersPanel";
import { useUserDataStore } from "@/stores/useUserDataStore";

const AdminSidebar = () => {
  // Zustand store (single source of truth)
  const { filters, loading, setFilters, applyFilters, setPage, fetchUserData, clearFilters: clearStoreFilters } = useUserDataStore();

  // Small UI busy flag to show spinner briefly on Apply/Clear (client-only)
  const [uiBusy, setUiBusy] = React.useState(false);

  const activeCount = React.useMemo(() => {
    let c = 0;
    if (filters.dateFrom) c++;
    if (filters.dateTo) c++;
    if (filters.owedType && filters.owedType !== "all") c++;
    if (filters.pbm && filters.pbm !== "All") c++;
    return c;
  }, [filters]);

  const handleApply = (form: { dateFrom?: string; dateTo?: string; owedType: 'all' | 'underpaid' | 'overpaid'; pbm?: string }) => {
    setUiBusy(true);
    setFilters(form);
    applyFilters();
    setPage(1);
    setTimeout(() => setUiBusy(false), 200);
  };

  const handleClear = () => {
    setUiBusy(true);
    clearStoreFilters();
    applyFilters();
    setPage(1);
    setTimeout(() => setUiBusy(false), 200);
  };

  return (
    <div className="h-full overflow-y-auto bg-muted/20 p-4">
      <h3 className="mb-3 text-base font-semibold text-orange-700">Filters</h3>
      <FiltersPanel
        initialFromDate={filters.dateFrom || ""}
        initialToDate={filters.dateTo || ""}
        initialOwedFilter={filters.owedType === "underpaid" ? "Underpaid" : filters.owedType === "overpaid" ? "Overpaid" : "All"}
        initialPbm={filters.pbm || "All"}
        activeCount={activeCount}
        onApply={handleApply}
        onClear={handleClear}
        onRefresh={() => fetchUserData()}
        loading={loading || uiBusy}
      />
    </div>
  );
};

export default AdminSidebar;
