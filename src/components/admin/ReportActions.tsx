"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { useUserDataStore } from "@/stores/useUserDataStore";

type Props = {
  activeTab: "commercial" | "updated" | "federal" | "summary";
};

export default function ReportActions({ activeTab }: Props) {
  const { filters, filteredRows } = useUserDataStore();
  const [saving, setSaving] = React.useState(false);
  const [emailing, setEmailing] = React.useState(false);
  const [lastSavedPdfPath, setLastSavedPdfPath] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);

  const owedType = filters.owedType ?? "all";
  const pbm = filters.pbm ?? "All";

  const canShowSave = owedType === "underpaid" && pbm !== "All"; // Federal allowed
  const canShowEmail = pbm !== "All" && pbm !== "Federal"; // independent of owedType
  const showEmailLabel = owedType === "underpaid" && pbm !== "All" && pbm !== "Federal";

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/reports/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab: activeTab,
          dateFrom: filters.dateFrom || "2025-07-01",
          dateTo: filters.dateTo || "2025-08-29",
          owedType,
          pbmName: pbm,
          rows: filteredRows,
        }),
      });
      // Server may either return JSON (uploaded) or a PDF Blob (direct download mode)
      const ct = res.headers.get("Content-Type") || "";
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Save failed: ${res.status}`);
      }
      if (ct.includes("application/json")) {
        const data = await res.json();
        console.info("[ReportActions] Save success", data);
        setLastSavedPdfPath(data?.pdfPath || null);
        alert("Report saved successfully.");
      } else if (ct.includes("application/pdf")) {
        // Trigger a download if we received the file directly
        const blob = await res.blob();
        const disp = res.headers.get("Content-Disposition") || "";
        const match = /filename=\"?([^";]+)\"?/i.exec(disp || "");
        const filename = match?.[1] || "report.pdf";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setLastSavedPdfPath(null);
      } else {
        alert("Save completed.");
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const res = await fetch("/api/reports/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab: activeTab,
          dateFrom: filters.dateFrom || "2025-07-01",
          dateTo: filters.dateTo || "2025-08-29",
          pbmName: pbm,
          rows: filteredRows,
          noAuthDownload: true,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Download failed: ${res.status}`);
      }
      const ct = res.headers.get("Content-Type") || "";
      if (!ct.includes("application/pdf")) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Unexpected response; expected PDF");
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition") || "";
      const match = /filename=\"?([^";]+)\"?/i.exec(disp || "");
      const filename = match?.[1] || "report.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleEmail = async () => {
    try {
      setEmailing(true);
      const res = await fetch("/api/reports/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab: activeTab,
          dateFrom: filters.dateFrom || "2025-07-01",
          dateTo: filters.dateTo || "2025-08-29",
          pbmName: pbm,
          pdfPaths: lastSavedPdfPath ? [lastSavedPdfPath] : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Email failed: ${res.status}`);
      }
      // Download the EML so the user's desktop email app can open it
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition") || "";
      const match = /filename="?([^";]+)"?/i.exec(disp || "");
      const filename = match?.[1] || "email_draft.eml";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Email failed");
    } finally {
      setEmailing(false);
    }
  };

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <div className="min-w-0">
        {showEmailLabel && (
          <span className="text-sm font-semibold text-orange-700">PBM Email: {pbm}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {canShowSave && (
          <Button size="sm" variant="secondary" onClick={handleDownload} disabled={downloading}>
            {downloading ? "Downloading..." : "Download PDF"}
          </Button>
        )}
        {canShowSave && (
          <Button size="sm" variant="outline" className="border-2 border-orange-600" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save PDF"}
          </Button>
        )}
        {canShowEmail && (
          <Button size="sm" variant="default" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={handleEmail} disabled={emailing}>
            {emailing ? "Preparing..." : "Send Email"}
          </Button>
        )}
      </div>
    </div>
  );
}
