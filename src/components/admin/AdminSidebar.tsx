"use client";

import React from "react";
import FiltersPanel from "@/components/admin/FiltersPanel";

const AdminSidebar = () => {
  // Local sidebar filter state (desktop). TODO: Lift to context to sync with content area.
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [owedFilter, setOwedFilter] = React.useState("All");
  const [pbm, setPbm] = React.useState("All");

  const activeCount = [
    fromDate ? 1 : 0,
    toDate ? 1 : 0,
    owedFilter !== "All" ? 1 : 0,
    pbm !== "All" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
    setOwedFilter("All");
    setPbm("All");
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
        onFromDate={setFromDate}
        onToDate={setToDate}
        onOwedFilter={setOwedFilter}
        onPbm={setPbm}
        onClear={clearFilters}
        onApply={() => {}}
      />
    </div>
  );
};

export default AdminSidebar;
