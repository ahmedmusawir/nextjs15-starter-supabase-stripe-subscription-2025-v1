"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { useUserDataStore } from "@/stores/useUserDataStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Props = {
  activeTab: "commercial" | "updated" | "federal" | "summary";
};

export default function ReportActions({ activeTab }: Props) {
  const {
    filters,
    filteredRows,
    hasSavedPdfForContext,
    setLastSavedPdfForContext,
    getLastSavedPdfForContext,
  } = useUserDataStore();
  const [saving, setSaving] = React.useState(false);
  const [emailing, setEmailing] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const owedType = filters.owedType ?? "all";
  const pbm = filters.pbm ?? "All";
  const dateFrom = filters.dateFrom || "2025-07-01";
  const dateTo = filters.dateTo || "2025-08-29";

  const savedPaths = getLastSavedPdfForContext(
    activeTab,
    pbm,
    dateFrom,
    dateTo
  );
  const hasSavedForContext = hasSavedPdfForContext(
    activeTab,
    pbm,
    dateFrom,
    dateTo
  );

  const canShowSave = owedType === "underpaid" && pbm !== "All"; // Federal allowed
  // Strict guardrails: only show Download/Preview/Email when we have saved PDF(s) for this exact context
  const canShowDownload = canShowSave && hasSavedForContext;
  const canShowPreview = pbm !== "All" && pbm !== "Federal" && hasSavedForContext;
  const canShowEmail = pbm !== "All" && pbm !== "Federal" && hasSavedForContext;
  const showEmailLabel = owedType === "underpaid" && pbm !== "All" && pbm !== "Federal";

  function labelForTab(tab: Props["activeTab"]) {
    switch (tab) {
      case "commercial":
        return "Commercial Dollars";
      case "updated":
        return "Updated Commercial Payments";
      case "federal":
        return "Federal Dollars";
      case "summary":
        return "Summary";
      default:
        return "Report";
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/reports/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab: activeTab,
          dateFrom,
          dateTo,
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
        if (data?.pdfPath) {
          setLastSavedPdfForContext(activeTab, pbm, dateFrom, dateTo, [data.pdfPath]);
        }
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
        // Direct download mode: no stored path
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
          dateFrom,
          dateTo,
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
          dateFrom,
          dateTo,
          pbmName: pbm,
          pdfPaths: savedPaths && savedPaths.length > 0 ? savedPaths : undefined,
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
          <span className="text-sm font-semibold text-orange-700">
            PBM Email: {pbm}
          </span>
        )}
        {hasSavedForContext && savedPaths?.length ? (
          <span className="ml-2 inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
            {savedPaths.length} PDF{savedPaths.length > 1 ? "s" : ""} saved
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {canShowSave && canShowDownload && (
          <Button
            size="sm"
            variant="outline"
            className="border-2 border-black"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? "Downloading..." : "Download PDF"}
          </Button>
        )}
        {canShowSave && (
          <Button
            size="sm"
            variant="outline"
            className="border-2 border-orange-600"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save PDF"}
          </Button>
        )}
        {canShowPreview && (
          <Button
            size="sm"
            variant="outline"
            className="border-2 border-black"
            onClick={() => setPreviewOpen(true)}
          >
            Preview Email
          </Button>
        )}
        {canShowEmail && (
          <Button
            size="sm"
            variant="default"
            className="bg-orange-600 hover:bg-orange-700 text-white"
            onClick={handleEmail}
            disabled={emailing}
          >
            {emailing ? "Preparing..." : "Send Email"}
          </Button>
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              This is a non-sending preview. Use "Send Email" to download the .eml.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div><span className="font-semibold">To:</span> {pbm} (email on file)</div>
            <div>
              <span className="font-semibold">Subject:</span> {`${pbm} ${labelForTab(activeTab)} Report ${dateFrom} to ${dateTo}`}
            </div>
            <div>
              <span className="font-semibold">Body:</span>
              <pre className="mt-1 whitespace-pre-wrap rounded bg-muted p-2">{`Hello ${pbm},\n\nPlease find attached the ${labelForTab(activeTab)} report for ${dateFrom} to ${dateTo}.\n\nThank you,\nCyber Pharma`}</pre>
            </div>
            <div>
              <span className="font-semibold">Attachments:</span>
              <ul className="mt-1 list-disc pl-5">
                {savedPaths?.map((p) => (
                  <li key={p}>{p.split("/").pop() || p}</li>
                ))}
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
