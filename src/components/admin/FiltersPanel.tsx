"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { Calendar, Filter as FilterIcon, Upload, XCircle, RefreshCw, Loader2 } from "lucide-react";

export interface FiltersPanelProps {
  initialFromDate?: string;
  initialToDate?: string;
  initialOwedFilter?: "All" | "Underpaid" | "Overpaid";
  initialPbm?: string; // "All" or specific PBM
  activeCount?: number;
  onApply: (form: { dateFrom?: string; dateTo?: string; owedType: 'all' | 'underpaid' | 'overpaid'; pbm?: string }) => void;
  onClear: () => void;
  onRefresh?: () => void;
  isMobile?: boolean; // if true, wrap Apply with DialogClose
  loading?: boolean; // show spinners/disable while store is loading
}

export default function FiltersPanel({
  initialFromDate,
  initialToDate,
  initialOwedFilter = "All",
  initialPbm = "All",
  activeCount = 0,
  onApply,
  onClear,
  onRefresh,
  isMobile = false,
  loading = false,
}: FiltersPanelProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const onUploadClick = () => fileInputRef.current?.click();
  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Placeholder: no-op for now
    // You can wire actual upload logic later.
    e.target.value = ""; // reset selection
  };

  // Local, inert form state
  const [fromDate, setFromDate] = React.useState<string>(initialFromDate || "");
  const [toDate, setToDate] = React.useState<string>(initialToDate || "");
  const [owedFilter, setOwedFilter] = React.useState<string>(initialOwedFilter);
  const [pbm, setPbm] = React.useState<string>(initialPbm);

  // Map local state to store filter payload
  const buildPayload = React.useCallback(() => {
    const owedType = owedFilter.toLowerCase() as 'all' | 'underpaid' | 'overpaid';
    return {
      dateFrom: fromDate || undefined,
      dateTo: toDate || undefined,
      owedType,
      pbm: pbm === 'All' ? undefined : pbm,
    } as const;
  }, [fromDate, toDate, owedFilter, pbm]);

  return (
    <div className="space-y-4">
      {/* Active filters chip */}
      <div className="flex items-center gap-2">
        <FilterIcon className="h-4 w-4 text-orange-600" />
        <span className="text-sm text-orange-700">{activeCount} {activeCount === 1 ? "filter" : "filters"} active</span>
      </div>

      {/* Upload Data */}
      <div>
        <input ref={fileInputRef} type="file" className="hidden" onChange={onFileSelected} />
        <Button className="w-full bg-orange-600 text-white hover:bg-orange-700" onClick={onUploadClick}>
          <Upload className="mr-2 h-4 w-4" /> Upload Data
        </Button>
      </div>

      {/* Date range (stacked) */}
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-orange-700">From (Date)</label>
          <div className="relative">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-md border border-orange-500 bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-orange-500"
            />
            <Calendar className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-orange-700">To (Date)</label>
          <div className="relative">
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-md border border-orange-500 bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-orange-500"
            />
            <Calendar className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Filter select */}
      <div>
        <label className="mb-1 block text-sm font-medium text-orange-700">Filter</label>
        <select
          value={owedFilter}
          onChange={(e) => setOwedFilter(e.target.value)}
          className="w-full rounded-md border border-orange-500 bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <option>All</option>
          <option>Underpaid</option>
          <option>Overpaid</option>
        </select>
      </div>

      {/* PBM dropdown */}
      <div className="mb-2">
        <label className="mb-1 block text-sm font-medium text-orange-700">PBM</label>
        <select
          value={pbm}
          onChange={(e) => setPbm(e.target.value)}
          className="w-full rounded-md border border-orange-500 bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <option>All</option>
          <option>AssistRx</option>
          <option>Benecard</option>
          <option>Capital RX</option>
          <option>Caremark</option>
          <option>Drexi</option>
          <option>DST</option>
          <option>Employer Health Options</option>
          <option>Express Scripts</option>
          <option>Federal</option>
          <option>MedImpact</option>
          <option>OptumRx</option>
          <option>Sav-Rx</option>
          <option>Script Care</option>
          <option>ScriptClaim</option>
          <option>ScriptCycle</option>
          <option>ScriptGuideRx</option>
          <option>ScriptSave</option>
          <option>Scriptcare</option>
          <option>Select Health</option>
          <option>SenRx</option>
          <option>SmithRx Commercial</option>
        </select>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <Button
          variant="outline"
          className="flex-1 border-2"
          disabled={loading}
          onClick={() => {
            // Reset local state to defaults then inform parent to clear store filters
            setFromDate("");
            setToDate("");
            setOwedFilter("All");
            setPbm("All");
            onClear();
          }}
        >
          <XCircle className="mr-2 h-4 w-4" /> Clear Filters
        </Button>
        {isMobile ? (
          <DialogClose asChild>
            <Button
              className="flex-1 border-2 border-orange-600 text-orange-700 hover:bg-orange-50"
              variant="outline"
              disabled={loading}
              onClick={() => onApply(buildPayload())}
            >
              {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying...</>) : 'Apply'}
            </Button>
          </DialogClose>
        ) : (
          <Button
            className="flex-1 border-2 border-orange-600 text-orange-700 hover:bg-orange-50"
            variant="outline"
            disabled={loading}
            onClick={() => onApply(buildPayload())}
          >
            {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying...</>) : 'Apply'}
          </Button>
        )}
      </div>

      {/* Get Fresh Data Button */}
      {onRefresh && (
        <div className="pt-3">
          <Button
            className="w-full bg-gray-800 text-white hover:bg-gray-900"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Refreshing...</>
            ) : (
              <><RefreshCw className="mr-2 h-4 w-4" /> Get Fresh Data</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
