export function slugify(input: string): string {
  return (input || "")
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^a-zA-Z0-9]+/g, "_") // non-alnum -> underscore
    .replace(/_{2,}/g, "_") // collapse underscores
    .replace(/^_+|_+$/g, "") // trim underscores
    .toLowerCase();
}

export function buildReportFilename(params: {
  folder: string; // e.g., report_commercialdollars
  pbmSlug: string;
  from: string; // YYYY-MM-DD or 'na'
  to: string; // YYYY-MM-DD or 'na'
  part?: number; // for splits > 1000
}): string {
  console.debug(`[buildReportFilename] Input params:`, params);
  
  // Extract the report type from folder (remove "report_" prefix)
  const reportType = params.folder.replace(/^report_/, "");
  
  // Build date range part - only skip if both are 'na' (missing dates)
  const dateRange = (params.from === 'na' && params.to === 'na') 
    ? '' 
    : `_${params.from}_${params.to}`;
  
  console.debug(`[buildReportFilename] Date range logic: from=${params.from}, to=${params.to}, dateRange="${dateRange}"`);
  
  // Capitalize first letter of PBM name for cleaner look
  const pbmName = params.pbmSlug.charAt(0).toUpperCase() + params.pbmSlug.slice(1);
  
  const base = `report_${reportType}_${pbmName}${dateRange}`;
  const filename = params.part && params.part > 1 ? `${base}_part${params.part}.pdf` : `${base}.pdf`;
  
  console.debug(`[buildReportFilename] Final filename: ${filename}`);
  return filename;
}
