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
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  part?: number; // for splits > 1000
}): string {
  const base = `report_${params.folder}_${params.pbmSlug}_${params.from}_${params.to}`;
  return params.part && params.part > 1 ? `${base}_part${params.part}.pdf` : `${base}.pdf`;
}
