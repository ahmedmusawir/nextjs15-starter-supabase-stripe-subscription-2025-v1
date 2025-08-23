"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { Calendar, Filter as FilterIcon, Upload, XCircle } from "lucide-react";

export interface FiltersPanelProps {
  fromDate: string;
  toDate: string;
  owedFilter: string;
  pbm: string;
  activeCount: number;
  onFromDate: (v: string) => void;
  onToDate: (v: string) => void;
  onOwedFilter: (v: string) => void;
  onPbm: (v: string) => void;
  onClear: () => void;
  isMobile?: boolean; // if true, wrap Apply with DialogClose
}

export default function FiltersPanel({
  fromDate,
  toDate,
  owedFilter,
  pbm,
  activeCount,
  onFromDate,
  onToDate,
  onOwedFilter,
  onPbm,
  onClear,
  isMobile = false,
}: FiltersPanelProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const onUploadClick = () => fileInputRef.current?.click();
  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Placeholder: no-op for now
    // You can wire actual upload logic later.
    e.target.value = ""; // reset selection
  };

  return (
    <div className="space-y-4">
      {/* Active filters chip */}
      <div className="flex items-center gap-2">
        <FilterIcon className="h-4 w-4 text-orange-600" />
        <span className="text-sm text-orange-700">
          {activeCount} {activeCount === 1 ? "filter" : "filters"} active
        </span>
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
              onChange={(e) => onFromDate(e.target.value)}
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
              onChange={(e) => onToDate(e.target.value)}
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
          onChange={(e) => onOwedFilter(e.target.value)}
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
          onChange={(e) => onPbm(e.target.value)}
          className="w-full rounded-md border border-orange-500 bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <option>All</option>
          <option>Express Scripts</option>
          <option>OptumRx</option>
          <option>Federal</option>
          <option>MedImpact</option>
        </select>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <Button variant="outline" className="flex-1 border-2" onClick={onClear}>
          <XCircle className="mr-2 h-4 w-4" /> Clear Filters
        </Button>
        {isMobile ? (
          <DialogClose asChild>
            <Button className="flex-1 border-2 border-orange-600 text-orange-700 hover:bg-orange-50" variant="outline">Apply</Button>
          </DialogClose>
        ) : (
          <Button className="flex-1 border-2 border-orange-600 text-orange-700 hover:bg-orange-50" variant="outline">Apply</Button>
        )}
      </div>
    </div>
  );
}
