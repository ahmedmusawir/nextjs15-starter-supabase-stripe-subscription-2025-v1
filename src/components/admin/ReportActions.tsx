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
  const [pbmEmail, setPbmEmail] = React.useState<string | null>(null);
  const [pbmEmailLoading, setPbmEmailLoading] = React.useState(false);

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

  // Fetch PBM email when PBM changes (for non-Federal and non-All)
  React.useEffect(() => {
    let abort = false;
    async function loadEmail() {
      if (!showEmailLabel) {
        setPbmEmail(null);
        return;
      }
      try {
        setPbmEmailLoading(true);
        setPbmEmail(null);
        const res = await fetch(`/api/pbm-email?pbmName=${encodeURIComponent(pbm)}`, { cache: "no-store" });
        if (!res.ok) throw new Error("email lookup failed");
        const data = await res.json();
        if (!abort) setPbmEmail(data?.email || null);
      } catch (e) {
        if (!abort) setPbmEmail(null);
      } finally {
        if (!abort) setPbmEmailLoading(false);
      }
    }
    loadEmail();
    return () => { abort = true; };
  }, [pbm, showEmailLabel]);

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
            {" "}
            {pbmEmailLoading ? (
              <span className="text-gray-500">(loading...)</span>
            ) : pbmEmail ? (
              <span className="text-gray-900">{pbmEmail}</span>
            ) : (
              <span className="text-gray-500">(no email on file)</span>
            )}
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
        <DialogContent overlayClassName="bg-black/40" className="bg-white max-w-2xl">
          <DialogHeader className="border-b border-gray-200 pb-4">
            <DialogTitle className="text-xl text-gray-900 flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">📧</span>
              </div>
              Email Preview
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              This is a non-sending preview. Use "Send Email" to download the .eml file.
            </DialogDescription>
          </DialogHeader>
          
          {/* Email Header */}
          <div className="space-y-4 py-4">
            <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">
              <div className="grid grid-cols-[80px_1fr] gap-2 text-sm">
                <span className="font-semibold text-gray-700">To:</span>
                <div>
                  <div className="font-medium text-gray-900">{pbm}</div>
                  <div className="text-gray-600 text-xs">
                    {pbmEmail ? pbmEmail : "email on file"}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-green-500">
              <div className="grid grid-cols-[80px_1fr] gap-2 text-sm">
                <span className="font-semibold text-gray-700">Subject:</span>
                <span className="font-medium text-gray-900">{`${pbm} ${labelForTab(activeTab)} Report ${dateFrom} to ${dateTo}`}</span>
              </div>
            </div>
          </div>

          {/* Email Body */}
          <div className="border-t border-gray-200 pt-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="prose prose-sm max-w-none">
                <div className="text-gray-900 leading-relaxed whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded border">
{`Hello ${pbm},

Please find attached the ${labelForTab(activeTab)} report for ${dateFrom} to ${dateTo}.

Thank you,
Cyber Pharma`}
                </div>
              </div>
            </div>
          </div>

          {/* Attachments */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-semibold text-gray-700">📎 Attachments:</span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                {savedPaths?.length || 0} file{(savedPaths?.length || 0) !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-2">
              {savedPaths?.map((p) => (
                <div key={p} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border">
                  <div className="w-8 h-8 bg-red-500 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">PDF</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">
                      {p.split("/").pop() || p}
                    </div>
                    <div className="text-xs text-gray-500">PDF Document</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
