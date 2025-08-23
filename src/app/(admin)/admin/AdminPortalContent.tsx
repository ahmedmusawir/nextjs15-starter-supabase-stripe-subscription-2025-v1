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
  const kpis = [
    { label: "Commercial Underpaid", value: "$12,669.15", pill: "bg-red-50 text-red-700 ring-1 ring-red-200" },
    { label: "Commercial Scripts", value: "1723", pill: "bg-blue-50 text-blue-700 ring-1 ring-blue-200" },
    { label: "Updated Difference", value: "$41.86", pill: "bg-green-50 text-green-700 ring-1 ring-green-200" },
    { label: "Owed", value: "$12,627.29", pill: "bg-red-50 text-red-700 ring-1 ring-red-200" },
  ];

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
    report: string;
    status: string;
  };

  const fakeRows: Row[] = [
    { date: "2025-07-12", script: "8118401-00", qty: 1, rate: 2.61, method: "AAC", expected: 13.25, paid: 9.76, owed: -3.49, report: "report_commercialdollars", status: "emailed PBM" },
    { date: "2025-07-19", script: "796792-02", qty: 30, rate: 0.01, method: "AAC", expected: 13.25, paid: 9.76, owed: -3.49, report: "report_commercialdollars", status: "emailed PBM" },
    { date: "2025-07-05", script: "809689-02", qty: 60, rate: 0.01, method: "AAC", expected: 11.58, paid: 6.00, owed: -5.58, report: "report_commercialdollars", status: "emailed PBM" },
    { date: "2025-07-11", script: "815774-01", qty: 90, rate: 0.01, method: "AAC", expected: 11.58, paid: 5.83, owed: -5.75, report: "report_commercialdollars", status: "emailed PBM" },
    { date: "2025-07-09", script: "820703-00", qty: 30, rate: 0.01, method: "AAC", expected: 13.57, paid: 12.88, owed: -0.69, report: "report_commercialdollars", status: "emailed PBM" },
    { date: "2025-07-25", script: "793143-03", qty: 30, rate: 0.01, method: "AAC", expected: 13.57, paid: 4.00, owed: -9.57, report: "report_commercialdollars", status: "emailed PBM" },
    { date: "2025-07-21", script: "806436-02", qty: 60, rate: 0.01, method: "AAC", expected: 11.59, paid: 3.10, owed: -8.49, report: "report_commercialdollars", status: "emailed PBM" },
    { date: "2025-07-24", script: "790462-04", qty: 10, rate: 0.01, method: "AAC", expected: 10.77, paid: 8.00, owed: -2.77, report: "report_commercialdollars", status: "emailed PBM" },
  ];

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
    const rows = [...fakeRows];
    rows.sort((a, b) => {
      const base = compare(a, b, sort.key);
      return sort.dir === "asc" ? base : -base;
    });
    return rows;
  }, [fakeRows, sort]);

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
            {kpis.map((k) => (
              <span
                key={k.label}
                className={`inline-flex items-center rounded-full px-3 py-1 text-sm md:text-base font-semibold ${k.pill}`}
              >
                <span className="opacity-80 mr-1">{k.label}:</span> {k.value}
              </span>
            ))}
          </div>
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
                </div>
              </div>
            </TabsContent>

            {/* Other tabs are placeholders for now */}
            <TabsContent value="updated">
              <div className="mt-3 rounded border p-4 text-sm text-muted-foreground">Updated Commercial Payments (static placeholder)</div>
            </TabsContent>
            <TabsContent value="federal">
              <div className="mt-3 rounded border p-4 text-sm text-muted-foreground">Federal Dollars (static placeholder)</div>
            </TabsContent>
            <TabsContent value="summary">
              <div className="mt-3 rounded border p-4 text-sm text-muted-foreground">Summary (static placeholder)</div>
            </TabsContent>
          </Tabs>
          </div>
        </div>
      </Page>
    </>
  );
}
