import * as Plot from '@observablehq/plot';
import { zipSync, strToU8 } from 'fflate';
import type { PlotSlot } from '../../lib/plot-specs';
import type { BedAnalysis } from '../../lib/bed-analysis';
import { regionDistributionSlot } from '../analysis/plots/region-distribution';
import { widthsHistogramSlot, neighborDistanceSlot } from '../analysis/plots/genomicdist-plots';
import { chromosomeBarSlot } from '../analysis/plots/chromosome-bar';
import { UMAP_URL } from '../../lib/umap-utils';
import { tableau20 } from '../../lib/tableau20';

const serializer = new XMLSerializer();
const REPORT_WIDTH = 700;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Build plot slots from analysis data ---

function buildPlotSlots(analysis: BedAnalysis): PlotSlot[] {
  const slots: PlotSlot[] = [];

  if (analysis.chromosomeStats.length > 0) {
    const s = chromosomeBarSlot(analysis.chromosomeStats);
    if (s) slots.push(s);
  }
  if (analysis.genomicdist) {
    const w = widthsHistogramSlot(analysis.genomicdist.widths);
    if (w) slots.push(w);
    if (analysis.genomicdist.neighborDistances) {
      const n = neighborDistanceSlot(analysis.genomicdist.neighborDistances);
      if (n) slots.push(n);
    }
  }
  if (analysis.plots.regionDistribution) {
    const r = regionDistributionSlot(analysis.plots.regionDistribution);
    if (r) slots.push(r);
  }

  return slots;
}

// --- Render a plot slot to an SVG string ---

function renderPlotToSvg(slot: PlotSlot): string | null {
  if (slot.type !== 'observable') return null;
  const el = slot.render(REPORT_WIDTH);
  // Observable Plot returns either an SVG or a figure containing an SVG
  const svg = el instanceof SVGSVGElement ? el : el.querySelector('svg');
  if (!svg) return null;
  if (!svg.getAttribute('xmlns')) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  return serializer.serializeToString(svg);
}

// --- HTML builders ---

function buildSummaryHtml(analysis: BedAnalysis): string {
  const { summary, genomicdist } = analysis;
  const rows: [string, string][] = [
    ['Regions', summary.regions.toLocaleString()],
    ['Mean width', `${Math.round(summary.meanRegionWidth).toLocaleString()} bp`],
    ['Nucleotides', summary.nucleotides.toLocaleString()],
  ];
  if (summary.dataFormat) rows.push(['Format', escapeHtml(summary.dataFormat)]);
  if (summary.bedCompliance) rows.push(['Compliance', escapeHtml(summary.bedCompliance)]);
  if (genomicdist) {
    rows.push(['Reduced regions', genomicdist.reducedCount.toLocaleString()]);
    rows.push(['Promoter overlaps', genomicdist.promotersCount.toLocaleString()]);
  }

  return `
    <table style="border-collapse:collapse;width:100%;margin-bottom:24px;">
      ${rows.map(([label, value]) => `
        <tr>
          <td style="padding:4px 12px 4px 0;font-size:13px;color:#666;white-space:nowrap;">${label}</td>
          <td style="padding:4px 0;font-size:13px;font-weight:600;">${value}</td>
        </tr>
      `).join('')}
    </table>
  `;
}

function buildGenomeBarHtml(match: GenomeMatch): string {
  const tierColors: Record<number, { bg: string; border: string; text: string }> = {
    1: { bg: '#dcfce7', border: '#86efac', text: '#16a34a' },
    2: { bg: '#fef9c3', border: '#fde047', text: '#ca8a04' },
    3: { bg: '#fef3c7', border: '#fbbf24', text: '#b45309' },
  };
  const fallback = { bg: '#fee2e2', border: '#fca5a5', text: '#dc2626' };
  const colors = tierColors[match.tier] ?? fallback;

  const stats = [
    match.xs != null ? `XS ${(match.xs * 100).toFixed(1)}%` : '',
    match.oobr != null ? `OOBR ${(match.oobr * 100).toFixed(1)}%` : '',
    match.sequenceFit != null ? `SF ${(match.sequenceFit * 100).toFixed(1)}%` : '',
  ].filter(Boolean).join(' &nbsp;&middot;&nbsp; ');

  return `
    <div style="margin-bottom:24px;">
      <h2 style="font-size:14px;font-weight:600;margin:0 0 8px 0;">Reference Genome</h2>
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:10px 16px;border-radius:8px;background:${colors.bg};border:1px solid ${colors.border};">
        <span style="font-size:13px;font-weight:600;">Best match: ${escapeHtml(match.name)}</span>
        <span style="font-size:12px;font-weight:600;color:${colors.text};">Tier ${match.tier}</span>
        ${stats ? `<span style="font-size:12px;color:#666;">${stats}</span>` : ''}
      </div>
    </div>
  `;
}

function buildChromStatsHtml(analysis: BedAnalysis): string {
  if (analysis.chromosomeStats.length === 0) return '';
  const headers = ['Chromosome', 'Regions', 'Start', 'End', 'Min', 'Max', 'Mean', 'Median'];
  const headerRow = headers.map((h) => `<th style="padding:4px 8px;text-align:${h === 'Chromosome' ? 'left' : 'right'};font-size:11px;font-weight:600;border-bottom:2px solid #ddd;">${h}</th>`).join('');
  const bodyRows = analysis.chromosomeStats.map((s) => `
    <tr>
      <td style="padding:3px 8px;font-size:11px;font-weight:500;border-bottom:1px solid #eee;">${escapeHtml(s.chromosome)}</td>
      <td style="padding:3px 8px;font-size:11px;text-align:right;border-bottom:1px solid #eee;">${s.count.toLocaleString()}</td>
      <td style="padding:3px 8px;font-size:11px;text-align:right;border-bottom:1px solid #eee;">${s.start.toLocaleString()}</td>
      <td style="padding:3px 8px;font-size:11px;text-align:right;border-bottom:1px solid #eee;">${s.end.toLocaleString()}</td>
      <td style="padding:3px 8px;font-size:11px;text-align:right;border-bottom:1px solid #eee;">${s.min.toLocaleString()}</td>
      <td style="padding:3px 8px;font-size:11px;text-align:right;border-bottom:1px solid #eee;">${s.max.toLocaleString()}</td>
      <td style="padding:3px 8px;font-size:11px;text-align:right;border-bottom:1px solid #eee;">${s.mean.toFixed(2)}</td>
      <td style="padding:3px 8px;font-size:11px;text-align:right;border-bottom:1px solid #eee;">${s.median.toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <h2 style="font-size:14px;font-weight:600;margin:24px 0 8px 0;">Chromosome Statistics</h2>
    <table style="border-collapse:collapse;width:100%;">
      <thead><tr>${headerRow}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
}

// --- UMAP scatter ---

type BgPoint = { x: number; y: number; assay: string; color: string };

const TOP_N = 18;
const OTHER_CATEGORY = 18;
const UPLOADED_CATEGORY = 19;

let cachedBgData: { points: BgPoint[]; legend: { name: string; color: string }[] } | null = null;

async function loadBackgroundData(): Promise<{ points: BgPoint[]; legend: { name: string; color: string }[] }> {
  if (cachedBgData) return cachedBgData;
  const json = await fetch(UMAP_URL).then((r) => r.json());
  const raw: { x?: number; y?: number; assay?: string }[] = Array.isArray(json) ? json : json.nodes ?? [];

  // Rank assays by frequency (same logic as mosaic-coordinator-context)
  const counts = new Map<string, number>();
  for (const p of raw) {
    const a = p.assay ?? 'Unknown';
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const assayToCategory = new Map<string, number>();
  for (let i = 0; i < ranked.length; i++) {
    assayToCategory.set(ranked[i], i < TOP_N ? i : OTHER_CATEGORY);
  }

  const points: BgPoint[] = [];
  for (const p of raw) {
    if (p.x == null || p.y == null) continue;
    const cat = assayToCategory.get(p.assay ?? 'Unknown') ?? OTHER_CATEGORY;
    points.push({ x: p.x, y: p.y, assay: p.assay ?? 'Unknown', color: tableau20[cat] });
  }

  // Build legend for top categories + Other
  const legend: { name: string; color: string }[] = [];
  for (let i = 0; i < Math.min(TOP_N, ranked.length); i++) {
    legend.push({ name: ranked[i], color: tableau20[i] });
  }
  if (ranked.length > TOP_N) {
    legend.push({ name: 'Other', color: tableau20[OTHER_CATEGORY] });
  }
  legend.push({ name: 'Uploaded file', color: '#000' });

  cachedBgData = { points, legend };
  return cachedBgData;
}

async function renderUmapSvg(umapCoordinates: number[]): Promise<string | null> {
  try {
    const { points, legend } = await loadBackgroundData();
    const marks: Plot.Markish[] = [
      Plot.dot(points, { x: 'x', y: 'y', fill: 'color', r: 1.5, opacity: 0.4 }),
      Plot.dot([{ x: umapCoordinates[0], y: umapCoordinates[1] }], {
        x: 'x', y: 'y', stroke: '#000', strokeWidth: 3, r: 8, fill: 'none',
        symbol: 'times',
      }),
    ];
    const plot = Plot.plot({
      width: REPORT_WIDTH,
      height: 500,
      x: { axis: null },
      y: { axis: null },
      marks,
      style: { background: 'transparent' },
    });
    if (!plot.getAttribute('xmlns')) plot.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Build legend HTML (returned separately, not part of SVG)
    const legendHtml = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px 12px;margin-top:8px;">
      ${legend.map(({ name, color }) => `
        <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#666;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${color};"></span>
          ${escapeHtml(name)}
        </span>
      `).join('')}
    </div>`;

    return serializer.serializeToString(plot) + legendHtml;
  } catch {
    return null;
  }
}

// --- Public API ---

export type ReportConfig = {
  summary: boolean;
  plots: boolean;
  refPlots: boolean;
  umap: boolean;
  chromosomeStats: boolean;
};

export const defaultReportConfig: ReportConfig = {
  summary: true,
  plots: true,
  refPlots: true,
  umap: true,
  chromosomeStats: true,
};

export type GenomeMatch = {
  name: string;
  tier: number;
  xs?: number;
  oobr?: number;
  sequenceFit?: number;
};

export type ReportOptions = {
  analysis: BedAnalysis;
  genome?: string | null;
  genomeMatch?: GenomeMatch | null;
  umapCoordinates?: number[] | null;
  refPlots?: PlotSlot[];
  config?: ReportConfig;
};

/**
 * Generate the full report and open it in a new browser tab.
 * All plots are rendered programmatically — no DOM container needed.
 */
export function openReport(opts: ReportOptions) {
  const { analysis, genome, genomeMatch, umapCoordinates, refPlots, config: cfg } = opts;
  const c = cfg ?? defaultReportConfig;

  // Open window immediately (synchronous with click) to avoid popup blocker
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write('<html><body style="font-family:system-ui;padding:24px;color:#888;">Loading report...</body></html>');

  // Build plot slots
  const baseSlots = c.plots ? buildPlotSlots(analysis) : [];
  const refSlots = c.refPlots ? (refPlots ?? []) : [];
  const slots = [...baseSlots, ...refSlots];

  // Render each to SVG
  const plotSections = slots
    .map((slot) => {
      const svgStr = renderPlotToSvg(slot);
      if (!svgStr) return '';
      return `
        <div style="page-break-inside:avoid;margin-bottom:24px;">
          <h2 style="font-size:14px;font-weight:600;margin:0 0 8px 0;">${escapeHtml(slot.title)}</h2>
          <div style="max-width:100%;overflow:hidden;">${svgStr}</div>
        </div>
      `;
    })
    .join('');

  // UMAP scatter (hg38 only) — fetch background data, then finish writing the page
  const writeReport = (umapSection: string) => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(analysis.fileName || 'BED File')} — Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1a1a1a; }
    svg { max-width: 100%; height: auto; }
    @media print {
      body { padding: 0; }
      div { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1 style="font-size:20px;font-weight:700;margin:0 0 4px 0;">${escapeHtml(analysis.fileName || 'BED File Report')}</h1>
  <p style="font-size:12px;color:#888;margin:0 0 24px 0;">Generated ${new Date().toLocaleDateString()} &middot; ${analysis.summary.regions.toLocaleString()} regions</p>

  ${c.summary ? `<h2 style="font-size:14px;font-weight:600;margin:0 0 8px 0;">Summary</h2>${buildSummaryHtml(analysis)}` : ''}

  ${genomeMatch ? buildGenomeBarHtml(genomeMatch) : ''}

  ${plotSections}

  ${umapSection}

  ${c.chromosomeStats ? buildChromStatsHtml(analysis) : ''}
</body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  if (c.umap && umapCoordinates && umapCoordinates.length >= 2) {
    renderUmapSvg(umapCoordinates).then((umapSvg) => {
      const section = umapSvg
        ? `<div style="page-break-inside:avoid;margin-bottom:24px;">
            <h2 style="font-size:14px;font-weight:600;margin:0 0 8px 0;">UMAP Embedding</h2>
            <p style="font-size:12px;color:#666;margin:0 0 8px 0;">
              Position of this file in the hg38 UMAP embedding space.
            </p>
            <div style="max-width:100%;overflow:hidden;">${umapSvg}</div>
          </div>`
        : '';
      writeReport(section);
    });
  } else {
    writeReport('');
  }
}

/**
 * Download all plot SVGs and CSV data as a single zip file.
 */
export async function downloadReportAssets(opts: ReportOptions) {
  const { analysis, umapCoordinates, refPlots, config: cfg } = opts;
  const c = cfg ?? defaultReportConfig;
  const files: Record<string, Uint8Array> = {};

  // Render plot SVGs
  const baseSlots = c.plots ? buildPlotSlots(analysis) : [];
  const refSlots = c.refPlots ? (refPlots ?? []) : [];
  for (const slot of [...baseSlots, ...refSlots]) {
    const svgStr = renderPlotToSvg(slot);
    if (svgStr) {
      files[`${sanitize(slot.title)}.svg`] = strToU8(svgStr);
    }
  }

  // UMAP scatter SVG
  if (c.umap && umapCoordinates && umapCoordinates.length >= 2) {
    const umapSvg = await renderUmapSvg(umapCoordinates);
    if (umapSvg) {
      files['umap-embedding.svg'] = strToU8(umapSvg);
    }
  }

  // Summary CSV
  if (c.summary) {
    const summaryHeaders = ['Metric', 'Value'];
    const summaryRows: string[][] = [
      ['Regions', String(analysis.summary.regions)],
      ['Mean width (bp)', String(Math.round(analysis.summary.meanRegionWidth))],
      ['Nucleotides', String(analysis.summary.nucleotides)],
    ];
    if (analysis.summary.dataFormat) summaryRows.push(['Format', analysis.summary.dataFormat]);
    if (analysis.summary.bedCompliance) summaryRows.push(['Compliance', analysis.summary.bedCompliance]);
    if (analysis.genomicdist) {
      summaryRows.push(['Reduced regions', String(analysis.genomicdist.reducedCount)]);
      summaryRows.push(['Promoter overlaps', String(analysis.genomicdist.promotersCount)]);
    }
    files['summary.csv'] = strToU8([summaryHeaders, ...summaryRows].map((r) => r.map(csvEscape).join(',')).join('\n'));
  }

  // Chromosome stats CSV
  if (c.chromosomeStats && analysis.chromosomeStats.length > 0) {
    const chrHeaders = ['Chromosome', 'Regions', 'Start', 'End', 'Min length', 'Max length', 'Mean length', 'Median length'];
    const chrRows = analysis.chromosomeStats.map((s) => [
      s.chromosome, String(s.count), String(s.start), String(s.end),
      String(s.min), String(s.max), s.mean.toFixed(2), s.median.toFixed(2),
    ]);
    files['chromosome-stats.csv'] = strToU8([chrHeaders, ...chrRows].map((r) => r.map(csvEscape).join(',')).join('\n'));
  }

  // Create zip and download
  const zipped = zipSync(files);
  const name = sanitize(analysis.fileName ?? 'bed-report');
  const blob = new Blob([zipped], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-report.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(v: string): string {
  // Prefix formula-triggering characters to prevent CSV injection in spreadsheets
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

function sanitize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

