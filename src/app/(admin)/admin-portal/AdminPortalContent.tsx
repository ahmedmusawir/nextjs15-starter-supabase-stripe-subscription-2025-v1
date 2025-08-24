"use client";
import React from "react";
import Head from "next/head";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { X, Filter, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import Page from "@/components/common/Page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import FiltersPanel from "@/components/admin/FiltersPanel";
import Spinner from "@/components/common/Spinner";
import ClaimsServices, { AdminRow as ApiRow, GetKpisResponse } from "@/services/ClaimsServices";

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
  const [fromDate, setFromDate] = React.useState<string>("");
  const [toDate, setToDate] = React.useState<string>("");
  const [owedFilter, setOwedFilter] = React.useState<string>("All");
  const [pbm, setPbm] = React.useState<string>("All");

  const activeCount = React.useMemo(() => {
    let c = 0;
    if (fromDate) c++;
    if (toDate) c++;
    if (owedFilter !== "All") c++;
    if (pbm !== "All") c++;
    return c;
  }, [fromDate, toDate, owedFilter, pbm]);

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
    setOwedFilter("All");
    setPbm("All");
  };

  // --- Step 3: static data for main area ---
  // KPI helpers
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

  // Row type and data
  type Row = {
    date: string;
    script: string;
    qty: number;
    rate: number;
    method: string;
    expected: number;
    paid: number;
    owed: number;
    pbmName?: string | null;
    newPaid?: number | null;
    report: string;
    status: string;
  };
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [kpiLoading, setKpiLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [kpis, setKpis] = React.useState<GetKpisResponse | null>(null);
  const [page, setPage] = React.useState<number>(1);
  const [total, setTotal] = React.useState<number>(0);
  const limit = 100;

  const owedTypeParam = React.useMemo(() => {
    if (owedFilter.toLowerCase() === "underpaid") return "underpaid" as const;
    if (owedFilter.toLowerCase() === "overpaid") return "overpaid" as const;
    return undefined;
  }, [owedFilter]);

  const loadClaims = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await ClaimsServices.getClaims({
        dateFrom: fromDate || undefined,
        dateTo: toDate || undefined,
        // pbm UI currently shows names; API expects bin. Skip until wired.
        owedType: owedTypeParam,
        sortKey: "date_dispensed",
        sortDir: "desc",
        page,
        limit,
      });
      const mapped: Row[] = res.rows.map((r: ApiRow) => ({
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
      setRows(mapped);
      setTotal(res.total || 0);
    } catch (e: any) {
      setError(e?.message || "Failed to load claims");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, owedTypeParam, page]);

  const loadKpis = React.useCallback(async () => {
    try {
      setKpiLoading(true);
      const data = await ClaimsServices.getKpis({
        dateFrom: fromDate || undefined,
        dateTo: toDate || undefined,
        owedType: owedTypeParam,
      });
      setKpis(data);
    } catch (e) {
      console.error('KPIs load failed', e);
      setError((e as any)?.message || 'Failed to load KPIs');
    } finally {
      setKpiLoading(false);
    }
  }, [fromDate, toDate, owedTypeParam]);

  // Load claims when filters or page changes
  React.useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  // Load KPIs only when filters change (not page)
  React.useEffect(() => {
    loadKpis();
  }, [loadKpis]);

  // KPIs now come from server
  const kpiData = React.useMemo(() => ({
    underpaid: kpis?.underpaidCommercialAbs ?? 0,
    scripts: kpis?.scriptsCommercialDerived ?? kpis?.scriptsCommercial ?? 0,
    updatedDiff: kpis?.updatedDifferenceTotal ?? 0,
    owedTotal: (kpis?.underpaidCommercialAbs ?? 0) - (kpis?.updatedDifferenceTotal ?? 0), // Python: owed = underpaid_amt - updated_diff_total
  }), [kpis]);

  // Sorting state & helpers (table-level)
  const [sort, setSort] = React.useState<{ key: keyof Row; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });

  const numericKeys: Array<keyof Row> = ["qty", "rate", "expected", "paid", "owed"];
  const compare = (a: Row, b: Row, key: keyof Row) => {
    if (key === "date") {
      return a.date.localeCompare(b.date);
    }
    if (numericKeys.includes(key)) {
      return (a[key] as number) - (b[key] as number);
    }
    return String(a[key]).localeCompare(String(b[key]));
  };

  const sortedRows = React.useMemo(() => {
    const rowsCopy = [...rows];
    rowsCopy.sort((a, b) => {
      const base = compare(a, b, sort.key);
      return sort.dir === "asc" ? base : -base;
    });
    return rowsCopy;
  }, [rows, sort]);

  const toggleSort = (key: keyof Row) => {
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
    return rows
      .filter((r) => typeof r.newPaid === "number")
      .map((r) => ({
        date: r.date,
        script: r.script,
        paid: r.paid,
        newPaid: r.newPaid as number,
        diff: (r.newPaid as number) - r.paid,
      }));
  }, [rows]);

  const federalRows = React.useMemo(() => rows.filter((r) => (r.pbmName || "Federal") === "Federal"), [rows]); // Python fills missing PBM as 'Federal'

  const sortedFederalRows = React.useMemo(() => {
    const copy = [...federalRows];
    copy.sort((a, b) => {
      const base = compare(a as Row, b as Row, sort.key);
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
    for (const r of rows) {
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
  }, [rows]);

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
                  isMobile
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

        {/* KPI strip (sticky) with prominent pills */}
        <div className="sticky top-14 z-30 mt-3 bg-background/95 px-4 pb-2 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            {kpiLoading ? (
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
          <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(total / limit)}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || loading}>Prev</Button>
            <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / limit) || loading}>Next</Button>
          </div>
          <span className="text-xs text-muted-foreground">Limit {limit} | Total {total}</span>
        </div>

        {/* Tabs + Table */}
        <div className="px-4 pt-4">
          <Tabs defaultValue="commercial">
            <div className="overflow-x-auto">
              <TabsList className="min-w-max">
                <TabsTrigger value="commercial">Commercial Dollars</TabsTrigger>
                <TabsTrigger value="updated">Updated Commercial Payments</TabsTrigger>
                <TabsTrigger value="federal">Federal Dollars</TabsTrigger>
                <TabsTrigger value="summary">Summary</TabsTrigger>
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
                      {sortedRows.map((r: Row, i: number) => (
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
                          {sortedFederalRows.map((r: Row, i: number) => (
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
