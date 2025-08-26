"use client";
import React from "react";
import Head from "next/head";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { X, Filter, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Loader2 } from "lucide-react";
import Page from "@/components/common/Page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import FiltersPanel from "@/components/admin/FiltersPanel";
import Spinner from "@/components/common/Spinner";
// Removed ClaimsServices - using Zustand store only
import { useUserDataStore } from "@/stores/useUserDataStore";
import ReportActions from "@/components/admin/ReportActions";

function DrawerHeader({ title, onClose }: { title: string; onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <h3 className="text-base font-semibold">{title}</h3>
      <DialogClose asChild>
        <Button size="icon" variant="ghost" aria-label="Close" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </DialogClose>
    </div>
  );
}

export default function AdminPortalContent() {
  const email = "frank@example.com";
  
  // Zustand store for user data and filtering
  const {
    filteredRows,
    filters,
    page,
    rowsPerPage,
    loading,
    error,
    kpis,
    setFilters,
    applyFilters,
    setPage,
    fetchUserData,
    clearFilters: clearStoreFilters
  } = useUserDataStore();

  // Small UI busy flag to show spinners on Apply/Clear/Refresh in mobile panel
  const [uiBusyMobile, setUiBusyMobile] = React.useState(false);

  // Handler functions
  const clearFilters = () => {
    clearStoreFilters();
  };

  const handleApplyFilters = () => {
    applyFilters();
  };

  const handleRefreshData = () => {
    fetchUserData();
  };

  const activeCount = React.useMemo(() => {
    let c = 0;
    if (filters.dateFrom) c++;
    if (filters.dateTo) c++;
    if (filters.owedType && filters.owedType !== "all") c++;
    if (filters.pbm && filters.pbm !== "All") c++;
    return c;
  }, [filters]);

  // Load data ONLY once on initial mount
  React.useEffect(() => {
    // Only fetch if we don't have data already
    if (filteredRows.length === 0) {
      fetchUserData();
    }
  }, []);

  // KPI helpers
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

  // KPIs now come from Zustand store
  const kpiData = React.useMemo(() => ({
    underpaid: kpis.underpaidCommercialAbs,
    scripts: kpis.scriptsCommercial,
    updatedDiff: kpis.updatedDifferenceTotal,
    owedTotal: kpis.owedTotal,
  }), [kpis]);

  // Convert store rows to display format
  const displayRows = React.useMemo(() => {
    return filteredRows.map(r => ({
      date: r.date || "",
      script: r.script,
      qty: r.qty ?? 0,
      rate: (typeof r.aac === "number" ? r.aac : undefined) ?? (typeof r.wac === "number" ? r.wac : 0) ?? 0,
      method: r.method,
      expected: r.expected ?? 0,
      paid: r.paid ?? 0,
      owed: r.owed ?? 0,
      pbmName: r.pbmName ?? null,
      newPaid: r.newPaid ?? null,
      report: r.report || "",
      status: r.status || "",
    }));
  }, [filteredRows]);

  // Pagination for display rows
  const paginatedRows = React.useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return displayRows.slice(start, end);
  }, [displayRows, page, rowsPerPage]);

  // Pagination totals (base on full filteredRows used by the table)
  const totalPages = Math.ceil(displayRows.length / rowsPerPage);
  const totalRecords = displayRows.length;

  // Track which tab is currently active to adjust the visible Total label only
  const [activeTab, setActiveTab] = React.useState<string>("commercial");
  // transient busy indicator for tab triggers so user sees instant feedback
  const [tabBusy, setTabBusy] = React.useState<string | null>(null);
  const displayedTotal = React.useMemo(() => {
    if (activeTab === "commercial") return kpis.scriptsCommercial;
    return totalRecords;
  }, [activeTab, kpis.scriptsCommercial, totalRecords]);

  // Sorting state & helpers (table-level)
  type DisplayRow = typeof displayRows[0];
  const [sort, setSort] = React.useState<{ key: keyof DisplayRow; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });

  const numericKeys: Array<keyof DisplayRow> = ["qty", "rate", "expected", "paid", "owed"];
  const compare = (a: DisplayRow, b: DisplayRow, key: keyof DisplayRow) => {
    if (key === "date") {
      return a.date.localeCompare(b.date);
    }
    if (numericKeys.includes(key)) {
      return (a[key] as number) - (b[key] as number);
    }
    return String(a[key]).localeCompare(String(b[key]));
  };

  const sortedRows = React.useMemo(() => {
    const rowsCopy = [...paginatedRows];
    rowsCopy.sort((a, b) => {
      const base = compare(a, b, sort.key);
      return sort.dir === "asc" ? base : -base;
    });
    return rowsCopy;
  }, [paginatedRows, sort]);

  const toggleSort = (key: keyof DisplayRow) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  const SortIcon = ({ active, dir }: { active: boolean; dir: "asc" | "desc" }) => {
    if (!active) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-50" />;
    return dir === "asc" ? <ArrowUp className="ml-1 h-3.5 w-3.5" /> : <ArrowDown className="ml-1 h-3.5 w-3.5" />;
  };


  // No column-hiding; table is the hero and shows all columns.

  // Horizontal scroll + drag-to-scroll for table container
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const dragState = React.useRef<{ startX: number; scrollLeft: number }>({ startX: 0, scrollLeft: 0 });

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollerRef.current) return;
    setDragging(true);
    dragState.current = {
      startX: e.pageX - scrollerRef.current.offsetLeft,
      scrollLeft: scrollerRef.current.scrollLeft,
    };
  };

  const onMouseLeave = () => setDragging(false);
  const onMouseUp = () => setDragging(false);
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging || !scrollerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollerRef.current.offsetLeft;
    const walk = (x - dragState.current.startX) * 1; // speed multiplier
    scrollerRef.current.scrollLeft = dragState.current.scrollLeft - walk;
  };

  // Derived datasets for other tabs
  const updatedRows = React.useMemo(() => {
    return displayRows
      .filter((r) => typeof r.newPaid === "number")
      .map((r) => ({
        date: r.date,
        script: r.script,
        paid: r.paid,
        newPaid: r.newPaid as number,
        diff: (r.newPaid as number) - r.paid,
      }));
  }, [displayRows]);

  const federalRows = React.useMemo(() => displayRows.filter((r) => (r.pbmName || "Federal") === "Federal"), [displayRows]); // Python fills missing PBM as 'Federal'

  const sortedFederalRows = React.useMemo(() => {
    const copy = [...federalRows];
    copy.sort((a, b) => {
      const base = compare(a, b, sort.key);
      return sort.dir === "asc" ? base : -base;
    });
    return copy;
  }, [federalRows, sort]);

  const updatedSorted = React.useMemo(() => {
    const copy = [...updatedRows];
    const sortKey = sort.key as string; // Type assertion to avoid Row key constraints
    if (sortKey === "date") {
      copy.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    } else if (sortKey === "script") {
      copy.sort((a, b) => (a.script || "").localeCompare(b.script || ""));
    } else if (sortKey === "paid") {
      copy.sort((a, b) => a.paid - b.paid);
    } else if (sortKey === "newPaid") {
      copy.sort((a, b) => a.newPaid - b.newPaid);
    } else if (sortKey === "diff") {
      copy.sort((a, b) => a.diff - b.diff);
    } else {
      // Default sort by date desc
      copy.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    }
    return sort.dir === "asc" ? copy : copy.reverse();
  }, [updatedRows, sort]);

  type SummaryRow = { pbmName: string; commercialDollars: number; federalDollars: number };
  const summaryData = React.useMemo<SummaryRow[]>(() => {
    // Python: Groups by pbm_name and sums ALL differences (positive + negative)
    const map = new Map<string, { commercial: number; federal: number }>();
    for (const r of displayRows) {
      const name = (r.pbmName || "Federal").toString();
      const isFederal = name === "Federal";
      // Python uses difference = total_paid - expected_paid, we use owed = -(total_paid - expected_paid)
      const differenceVal = typeof r.owed === "number" ? -r.owed : 0; // Convert back to Python's difference
      const cur = map.get(name) || { commercial: 0, federal: 0 };
      if (isFederal) cur.federal += differenceVal;
      else cur.commercial += differenceVal;
      map.set(name, cur);
    }
    const list: SummaryRow[] = Array.from(map.entries()).map(([pbmName, v]) => ({
      pbmName,
      commercialDollars: v.commercial,
      federalDollars: v.federal,
    }));
    return list;
  }, [displayRows]);

  return (
    <>
      <Head>
        <title>Admin – Owedbook</title>
        <meta name="description" content="Cyber Pharma Admin – Owedbook" />
      </Head>

      <Page className="min-h-screen bg-background overflow-x-hidden" FULL>

        {/* Main content container */}
        <div className="pb-24">
        {/* Mobile Filters trigger above title; opens centered modal */}
        <div className="px-4 pt-3 md:hidden">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                aria-label="Open Filters"
                className="border-2 border-orange-600 text-orange-700 hover:bg-orange-50 px-3 h-9 rounded-md gap-2"
              >
                <Filter className="h-4 w-4" />
                <span className="text-sm font-medium">Filters</span>
              </Button>
            </DialogTrigger>
            <DialogContent
              overlayClassName="inset-0 bg-white"
              className="p-0 sm:max-w-md"
              hideClose
            >
              <DialogTitle className="sr-only">Filters</DialogTitle>
              <DrawerHeader title="Filters" />
              <div className="p-4">
                <FiltersPanel
                  initialFromDate={filters.dateFrom || ""}
                  initialToDate={filters.dateTo || ""}
                  initialOwedFilter={filters.owedType === "underpaid" ? "Underpaid" : filters.owedType === "overpaid" ? "Overpaid" : "All"}
                  initialPbm={filters.pbm || "All"}
                  activeCount={activeCount}
                  onApply={(form) => {
                    setUiBusyMobile(true);
                    setFilters(form);
                    applyFilters();
                    setPage(1);
                    setTimeout(() => setUiBusyMobile(false), 200);
                  }}
                  onClear={() => {
                    setUiBusyMobile(true);
                    clearStoreFilters();
                    applyFilters();
                    setPage(1);
                    setTimeout(() => setUiBusyMobile(false), 200);
                  }}
                  onRefresh={() => {
                    setUiBusyMobile(true);
                    handleRefreshData();
                    // Keep spinner until store loading flips back false
                    const id = setInterval(() => {
                      if (!loading) {
                        clearInterval(id);
                        setUiBusyMobile(false);
                      }
                    }, 100);
                  }}
                  isMobile
                  loading={loading || uiBusyMobile}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Title + subtitle */}
        <div className="px-4 pt-2">
          <h1 className="text-2xl md:text-3xl font-semibold text-orange-700">OwedBook</h1>
          <p className="text-base font-semibold text-muted-foreground">
            Ledger-level clarity on what's still owed
          </p>
        </div>

        {/* Actions (full width row; left label + right buttons) */}
        <div className="px-4 pt-2">
          <ReportActions activeTab={activeTab as any} />
        </div>

        {/* KPI strip (sticky) with prominent pills */}
        <div className="sticky top-14 z-30 mt-3 bg-background/95 px-4 pb-2 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            {loading ? (
              <Spinner />
            ) : (
              <>
                <span className="inline-flex items-center rounded-full px-3 py-1 text-sm md:text-base font-semibold bg-red-50 text-red-700 ring-1 ring-red-200">
                  <span className="opacity-80 mr-1">Commercial Underpaid:</span> {formatCurrency(kpiData.underpaid)}
                </span>
                <span className="inline-flex items-center rounded-full px-3 py-1 text-sm md:text-base font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                  <span className="opacity-80 mr-1">Commercial Scripts:</span> {kpiData.scripts}
                </span>
                <span className="inline-flex items-center rounded-full px-3 py-1 text-sm md:text-base font-semibold bg-green-50 text-green-700 ring-1 ring-green-200">
                  <span className="opacity-80 mr-1">Updated Difference:</span> {formatCurrency(kpiData.updatedDiff)}
                </span>
                <span className="inline-flex items-center rounded-full px-3 py-1 text-sm md:text-base font-semibold bg-red-50 text-red-700 ring-1 ring-red-200">
                  <span className="opacity-80 mr-1">Owed:</span> {formatCurrency(kpiData.owedTotal)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Pagination controls */}
        <div className="px-4 pt-3 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1 || loading}>Prev</Button>
            <Button size="sm" variant="outline" onClick={() => setPage(page + 1)} disabled={page >= totalPages || loading}>Next</Button>
          </div>
          <span className="text-xs text-muted-foreground">Limit {rowsPerPage} | Total {displayedTotal}</span>
        </div>

        {/* Tabs + Table */}
        <div className="px-4 pt-4">
          {/* Track active tab to adjust the "Total" label for Commercial */}
          <Tabs
            defaultValue="commercial"
            onValueChange={(v) => {
              setActiveTab(v);
              setTabBusy(v);
              // brief visual feedback even if content mounts fast
              window.setTimeout(() => setTabBusy((cur) => (cur === v ? null : cur)), 300);
            }}
          >
            <div className="overflow-x-auto">
              <TabsList className="min-w-max">
                <TabsTrigger value="commercial">
                  <span className="inline-flex items-center gap-1">
                    {(loading || tabBusy === "commercial") && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70" />
                    )}
                    <span>Commercial Dollars</span>
                  </span>
                </TabsTrigger>
                <TabsTrigger value="updated">
                  <span className="inline-flex items-center gap-1">
                    {(loading || tabBusy === "updated") && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70" />
                    )}
                    <span>Updated Commercial Payments</span>
                  </span>
                </TabsTrigger>
                <TabsTrigger value="federal">
                  <span className="inline-flex items-center gap-1">
                    {(loading || tabBusy === "federal") && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70" />
                    )}
                    <span>Federal Dollars</span>
                  </span>
                </TabsTrigger>
                <TabsTrigger value="summary">
                  <span className="inline-flex items-center gap-1">
                    {(loading || tabBusy === "summary") && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70" />
                    )}
                    <span>Summary</span>
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="commercial">
              <div
                ref={scrollerRef}
                className={`mt-3 w-full max-w-full overflow-x-auto overflow-y-hidden rounded border-2 border-orange-600 pb-1 ${dragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
                onMouseDown={onMouseDown}
                onMouseLeave={onMouseLeave}
                onMouseUp={onMouseUp}
                onMouseMove={onMouseMove}
              >
                {/* Wrap table to enforce horizontal min width and bottom scrollbar */}
                <div className="min-w-[960px] whitespace-nowrap">
                  {loading ? (
                    <div className="py-6">
                      <Spinner />
                    </div>
                  ) : error ? (
                    <div className="m-3 rounded border border-red-300 bg-red-50 p-3 text-red-700 text-sm">
                      {error}
                    </div>
                  ) : sortedRows.length === 0 ? (
                    <div className="m-3 rounded border p-4 text-sm text-muted-foreground">No data for current filters.</div>
                  ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap text-sm md:text-base font-semibold">
                          <button
                            type="button"
                            className="inline-flex items-center hover:text-orange-700"
                            onClick={() => toggleSort("date")}
                          >
                            Date
                            <SortIcon active={sort.key === "date"} dir={sort.dir} />
                          </button>
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-sm md:text-base font-semibold">
                          <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("script")}>
                            Script
                            <SortIcon active={sort.key === "script"} dir={sort.dir} />
                          </button>
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-sm md:text-base font-semibold text-right">
                          <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("qty")}> 
                            Qty
                            <SortIcon active={sort.key === "qty"} dir={sort.dir} />
                          </button>
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-sm md:text-base font-semibold text-right">
                          <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("rate")}> 
                            Medicaid Rate
                            <SortIcon active={sort.key === "rate"} dir={sort.dir} />
                          </button>
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-sm md:text-base font-semibold">
                          <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("method")}>
                            Method
                            <SortIcon active={sort.key === "method"} dir={sort.dir} />
                          </button>
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-sm md:text-base font-semibold text-right">
                          <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("expected")}> 
                            Expected
                            <SortIcon active={sort.key === "expected"} dir={sort.dir} />
                          </button>
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-sm md:text-base font-semibold text-right">
                          <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("paid")}> 
                            Original Paid
                            <SortIcon active={sort.key === "paid"} dir={sort.dir} />
                          </button>
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-sm md:text-base font-semibold text-right">
                          <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("owed")}> 
                            Owed
                            <SortIcon active={sort.key === "owed"} dir={sort.dir} />
                          </button>
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-sm md:text-base font-semibold">
                          <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("report")}>
                            Report
                            <SortIcon active={sort.key === "report"} dir={sort.dir} />
                          </button>
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-sm md:text-base font-semibold">
                          <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("status")}>
                            Status
                            <SortIcon active={sort.key === "status"} dir={sort.dir} />
                          </button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedRows.map((r: DisplayRow, i: number) => (
                        <TableRow key={i} className="text-base">
                          <TableCell className="whitespace-nowrap px-2 py-2 text-sm md:text-base">{r.date}</TableCell>
                          <TableCell className="whitespace-nowrap px-2 py-2 text-sm md:text-base">{r.script}</TableCell>
                          <TableCell className="px-2 py-2 text-right text-sm md:text-base">{r.qty}</TableCell>
                          <TableCell className="px-2 py-2 text-right text-sm md:text-base">{r.rate.toFixed(2)}</TableCell>
                          <TableCell className="px-2 py-2 text-sm md:text-base">{r.method}</TableCell>
                          <TableCell className="px-2 py-2 text-right text-sm md:text-base">{r.expected.toFixed(2)}</TableCell>
                          <TableCell className="px-2 py-2 text-right text-sm md:text-base">{r.paid.toFixed(2)}</TableCell>
                          <TableCell className={`px-2 py-2 text-right text-sm md:text-base ${r.owed < 0 ? "text-red-600" : "text-green-700"}`}>{r.owed.toFixed(2)}</TableCell>
                          <TableCell className="px-2 py-2 text-sm md:text-base">{r.report}</TableCell>
                          <TableCell className="px-2 py-2 text-sm md:text-base">{r.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Updated Commercial Payments */}
            <TabsContent value="updated">
              <div className="mt-3 rounded border-2 border-orange-600 p-3">
                {loading ? (
                  <Spinner />
                ) : error ? (
                  <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700 text-sm">{error}</div>
                ) : updatedSorted.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No updated payments for current filters.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[720px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-sm md:text-base font-semibold">
                              <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("date")}>
                                Date
                                <SortIcon active={sort.key === "date"} dir={sort.dir} />
                              </button>
                            </TableHead>
                            <TableHead className="text-sm md:text-base font-semibold">
                              <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("script")}>
                                Script
                                <SortIcon active={sort.key === "script"} dir={sort.dir} />
                              </button>
                            </TableHead>
                            <TableHead className="text-sm md:text-base font-semibold text-right">
                              <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("paid")}>
                                Original Paid
                                <SortIcon active={sort.key === "paid"} dir={sort.dir} />
                              </button>
                            </TableHead>
                            <TableHead className="text-sm md:text-base font-semibold text-right">
                              <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("newPaid" as any)}>
                                New Paid
                                <SortIcon active={(sort.key as string) === "newPaid"} dir={sort.dir} />
                              </button>
                            </TableHead>
                            <TableHead className="text-sm md:text-base font-semibold text-right">
                              <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("diff" as any)}>
                                Updated Difference
                                <SortIcon active={(sort.key as string) === "diff"} dir={sort.dir} />
                              </button>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {updatedSorted.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                              <TableCell className="whitespace-nowrap">{r.script}</TableCell>
                              <TableCell className="text-right">{formatCurrency(r.paid)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(r.newPaid)}</TableCell>
                              <TableCell className={`text-right ${r.diff < 0 ? "text-red-600" : "text-green-700"}`}>{formatCurrency(r.diff)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Federal Dollars */}
            <TabsContent value="federal">
              <div className="mt-3">
                <div
                  className={`w-full max-w-full overflow-x-auto overflow-y-hidden rounded border-2 border-orange-600 pb-1`}
                >
                  <div className="min-w-[960px] whitespace-nowrap">
                    {loading ? (
                      <div className="py-6"><Spinner /></div>
                    ) : error ? (
                      <div className="m-3 rounded border border-red-300 bg-red-50 p-3 text-red-700 text-sm">{error}</div>
                    ) : sortedFederalRows.length === 0 ? (
                      <div className="m-3 rounded border p-4 text-sm text-muted-foreground">No federal data for current filters.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="whitespace-nowrap text-sm md:text-base font-semibold">
                              <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("date")}>
                                Date
                                <SortIcon active={sort.key === "date"} dir={sort.dir} />
                              </button>
                            </TableHead>
                            <TableHead className="whitespace-nowrap text-sm md:text-base font-semibold">
                              <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("script")}>
                                Script
                                <SortIcon active={sort.key === "script"} dir={sort.dir} />
                              </button>
                            </TableHead>
                            <TableHead className="whitespace-nowrap text-sm md:text-base font-semibold text-right">
                              <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("qty")}>
                                Qty
                                <SortIcon active={sort.key === "qty"} dir={sort.dir} />
                              </button>
                            </TableHead>
                            <TableHead className="whitespace-nowrap text-sm md:text-base font-semibold text-right">
                              <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("rate")}>
                                AAC
                                <SortIcon active={sort.key === "rate"} dir={sort.dir} />
                              </button>
                            </TableHead>
                            <TableHead className="whitespace-nowrap text-sm md:text-base font-semibold text-right">
                              <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("expected")}>
                                Expected
                                <SortIcon active={sort.key === "expected"} dir={sort.dir} />
                              </button>
                            </TableHead>
                            <TableHead className="whitespace-nowrap text-sm md:text-base font-semibold text-right">
                              <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("paid")}>
                                Original Paid
                                <SortIcon active={sort.key === "paid"} dir={sort.dir} />
                              </button>
                            </TableHead>
                            <TableHead className="whitespace-nowrap text-sm md:text-base font-semibold text-right">
                              <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("owed")}>
                                Diff
                                <SortIcon active={sort.key === "owed"} dir={sort.dir} />
                              </button>
                            </TableHead>
                            <TableHead className="whitespace-nowrap text-sm md:text-base font-semibold">
                              <button type="button" className="inline-flex items-center hover:text-orange-700" onClick={() => toggleSort("report")}>
                                Report
                                <SortIcon active={sort.key === "report"} dir={sort.dir} />
                              </button>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedFederalRows.map((r: DisplayRow, i: number) => (
                            <TableRow key={i} className="text-base">
                              <TableCell className="whitespace-nowrap px-2 py-2 text-sm md:text-base">{r.date}</TableCell>
                              <TableCell className="whitespace-nowrap px-2 py-2 text-sm md:text-base">{r.script}</TableCell>
                              <TableCell className="px-2 py-2 text-right text-sm md:text-base">{r.qty}</TableCell>
                              <TableCell className="px-2 py-2 text-right text-sm md:text-base">{r.rate.toFixed(2)}</TableCell>
                              <TableCell className="px-2 py-2 text-right text-sm md:text-base">{r.expected.toFixed(2)}</TableCell>
                              <TableCell className="px-2 py-2 text-right text-sm md:text-base">{r.paid.toFixed(2)}</TableCell>
                              <TableCell className={`px-2 py-2 text-right text-sm md:text-base ${(r.paid - r.expected) < 0 ? "text-red-600" : "text-green-700"}`}>{(r.paid - r.expected).toFixed(2)}</TableCell>
                              <TableCell className="px-2 py-2 text-sm md:text-base">{r.report}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Summary */}
            <TabsContent value="summary">
              <div className="mt-3 rounded border-2 border-orange-600 p-3">
                {loading ? (
                  <Spinner />
                ) : error ? (
                  <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700 text-sm">{error}</div>
                ) : summaryData.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No data for current filters.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[640px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-sm md:text-base font-semibold">PBM Name</TableHead>
                            <TableHead className="text-sm md:text-base font-semibold text-right">Commercial Dollars</TableHead>
                            <TableHead className="text-sm md:text-base font-semibold text-right">Federal Dollars</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summaryData.map((s, i) => (
                            <TableRow key={i}>
                              <TableCell>{s.pbmName}</TableCell>
                              <TableCell className="text-right">{formatCurrency(s.commercialDollars)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(s.federalDollars)}</TableCell>
                            </TableRow>
                          ))}
                          {/* Total Row */}
                          {(() => {
                            const totals = summaryData.reduce(
                              (acc, s) => ({
                                c: acc.c + s.commercialDollars,
                                f: acc.f + s.federalDollars,
                              }),
                              { c: 0, f: 0 }
                            );
                            return (
                              <TableRow>
                                <TableCell className="font-semibold">Total</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(totals.c)}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(totals.f)}</TableCell>
                              </TableRow>
                            );
                          })()}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
          </div>
        </div>
      </Page>
    </>
  );
}
