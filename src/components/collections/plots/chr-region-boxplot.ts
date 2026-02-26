import * as Plot from '@observablehq/plot';
import type { PlotSlot } from '../../../lib/plot-specs';
import type { ChrRegionCount } from '../../../lib/multi-file-analysis';

const STANDARD_CHR_ORDER = [
  'chr1', 'chr2', 'chr3', 'chr4', 'chr5', 'chr6', 'chr7', 'chr8', 'chr9', 'chr10',
  'chr11', 'chr12', 'chr13', 'chr14', 'chr15', 'chr16', 'chr17', 'chr18', 'chr19',
  'chr20', 'chr21', 'chr22', 'chrX', 'chrY', 'chrM',
];

function toCanonical(c: string): string {
  const standardSet = new Set(STANDARD_CHR_ORDER);
  if (standardSet.has(c)) return c;
  const prefixed = 'chr' + c;
  return standardSet.has(prefixed) ? prefixed : c;
}

function sortChromosomes(chrs: string[]): string[] {
  const standardSet = new Set(STANDARD_CHR_ORDER);
  const known = chrs
    .filter((c) => standardSet.has(toCanonical(c)))
    .sort((a, b) => STANDARD_CHR_ORDER.indexOf(toCanonical(a)) - STANDARD_CHR_ORDER.indexOf(toCanonical(b)));
  const unknown = chrs
    .filter((c) => !standardSet.has(toCanonical(c)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  return [...known, ...unknown];
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}

type BoxRow = {
  chr: string;
  lower_whisker: number;
  lower_hinge: number;
  median: number;
  upper_hinge: number;
  upper_whisker: number;
};

function buildBoxRows(
  chrCounts: ChrRegionCount[],
  fileNames: string[],
  getValue: (d: ChrRegionCount) => number,
): BoxRow[] {
  const allChrs = sortChromosomes([...new Set(chrCounts.map((d) => d.chr))]);

  // Build a map: chr → file → value (default 0 for missing files)
  const byChr = new Map<string, Map<string, number>>();
  for (const chr of allChrs) {
    const m = new Map<string, number>();
    for (const fn of fileNames) m.set(fn, 0);
    byChr.set(chr, m);
  }
  for (const d of chrCounts) {
    byChr.get(d.chr)?.set(d.fileName, getValue(d));
  }

  const rows: BoxRow[] = [];
  for (const chr of allChrs) {
    const values = [...byChr.get(chr)!.values()].sort((a, b) => a - b);
    if (values.length === 0) continue;

    const q1 = quantile(values, 0.25);
    const med = quantile(values, 0.5);
    const q3 = quantile(values, 0.75);
    const iqr = q3 - q1;
    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;

    // Whiskers = most extreme data points within 1.5*IQR of the hinges.
    // When Q1/Q3 are interpolated between two points and the outer point is an
    // outlier, the whisker lands on the inner point which can be inside the
    // interpolated hinge. Clamp so whiskers never sit inside the box.
    const rawLower = values.find((v) => v >= lowerFence) ?? values[0];
    const rawUpper = [...values].reverse().find((v) => v <= upperFence) ?? values[values.length - 1];
    rows.push({
      chr,
      lower_whisker: Math.min(rawLower, q1),
      lower_hinge: q1,
      median: med,
      upper_hinge: q3,
      upper_whisker: Math.max(rawUpper, q3),
    });
  }
  return rows;
}

/**
 * Build a lookup that maps bare chromosome names (e.g. "1") to the canonical
 * names used in chromSizes (e.g. "chr1"). Returns identity for names that
 * already match.
 */
function buildChrAlias(chromSizes: Record<string, number>): Map<string, string> {
  const alias = new Map<string, string>();
  for (const canonical of Object.keys(chromSizes)) {
    alias.set(canonical, canonical);
    if (canonical.startsWith('chr')) {
      alias.set(canonical.slice(3), canonical);
    }
  }
  return alias;
}

export function chrRegionBoxplotSlot(
  chrCounts: ChrRegionCount[],
  fileNames: string[],
  chromSizes?: Record<string, number>,
): PlotSlot | null {
  if (chrCounts.length === 0 || fileNames.length < 2) return null;

  // Normalize chromosome names to reference and filter out non-reference contigs
  const chrAlias = chromSizes ? buildChrAlias(chromSizes) : null;
  const filtered = chrAlias
    ? chrCounts
        .map((d) => {
          const canonical = chrAlias.get(d.chr);
          return canonical ? { ...d, chr: canonical } : null;
        })
        .filter((d): d is ChrRegionCount => d !== null)
    : chrCounts;

  const countRows = buildBoxRows(filtered, fileNames, (d) => d.count);
  const fractionRows = buildBoxRows(filtered, fileNames, (d) => d.fraction);
  if (countRows.length === 0) return null;

  const chrOrder = countRows.map((r) => r.chr);
  const longestLabel = Math.max(...chrOrder.map((c) => c.length));
  const dynamicMarginLeft = Math.max(40, longestLabel * 7 + 16);

  function renderThumbnail(width: number, height: number): Element {
    return Plot.plot({
      width,
      height,
      marginLeft: 0,
      marginBottom: 0,
      y: { domain: chrOrder, axis: null },
      x: { axis: null },
      marks: [
        Plot.ruleY(countRows, {
          y: 'chr',
          x1: 'lower_whisker',
          x2: 'upper_whisker',
          stroke: '#999',
          strokeWidth: 0.5,
        }),
        Plot.rect(countRows, {
          y: 'chr',
          x1: 'lower_hinge',
          x2: 'upper_hinge',
          fill: 'teal',
          fillOpacity: 0.6,
          ry: 1,
        }),
        Plot.tickX(countRows, {
          y: 'chr',
          x: 'median',
          stroke: 'black',
          strokeWidth: 1.5,
        }),
      ],
    });
  }

  function renderCount(width: number): Element {
    const height = chrOrder.length * 18 + 60;
    return Plot.plot({
      width,
      height,
      marginLeft: dynamicMarginLeft,
      marginBottom: 40,
      y: { domain: chrOrder, label: 'Chromosome', tickSize: 0 },
      x: { label: 'Region count', labelArrow: 'none', grid: true },
      marks: [
        Plot.ruleY(countRows, {
          y: 'chr',
          x1: 'lower_whisker',
          x2: 'upper_whisker',
          stroke: '#999',
        }),
        Plot.rect(countRows, {
          y: 'chr',
          x1: 'lower_hinge',
          x2: 'upper_hinge',
          fill: 'teal',
          fillOpacity: 0.6,
          ry: 1,
        }),
        Plot.tickX(countRows, {
          y: 'chr',
          x: 'median',
          stroke: 'black',
          strokeWidth: 2,
        }),
        Plot.tip(countRows, Plot.pointerY({
          y: 'chr',
          x: 'median',
          channels: {
            'Lower whisker': 'lower_whisker',
            'Q1': 'lower_hinge',
            'Median': 'median',
            'Q3': 'upper_hinge',
            'Upper whisker': 'upper_whisker',
          },
          format: { x: false, y: false },
        })),
      ],
    });
  }

  function renderFraction(width: number): Element {
    const height = chrOrder.length * 18 + 60;
    return Plot.plot({
      width,
      height,
      marginLeft: dynamicMarginLeft,
      marginBottom: 40,
      y: { domain: chrOrder, label: 'Chromosome', tickSize: 0 },
      x: {
        label: 'Fraction of file regions',
        labelArrow: 'none',
        grid: true,
        tickFormat: (d: number) => `${(d * 100).toFixed(0)}%`,
      },
      marks: [
        Plot.ruleY(fractionRows, {
          y: 'chr',
          x1: 'lower_whisker',
          x2: 'upper_whisker',
          stroke: '#999',
        }),
        Plot.rect(fractionRows, {
          y: 'chr',
          x1: 'lower_hinge',
          x2: 'upper_hinge',
          fill: 'teal',
          fillOpacity: 0.6,
          ry: 1,
        }),
        Plot.tickX(fractionRows, {
          y: 'chr',
          x: 'median',
          stroke: 'black',
          strokeWidth: 2,
        }),
        Plot.tip(fractionRows, Plot.pointerY({
          y: 'chr',
          x: 'median',
          channels: {
            'Lower whisker': (d: BoxRow) => `${(d.lower_whisker * 100).toFixed(1)}%`,
            'Q1': (d: BoxRow) => `${(d.lower_hinge * 100).toFixed(1)}%`,
            'Median': (d: BoxRow) => `${(d.median * 100).toFixed(1)}%`,
            'Q3': (d: BoxRow) => `${(d.upper_hinge * 100).toFixed(1)}%`,
            'Upper whisker': (d: BoxRow) => `${(d.upper_whisker * 100).toFixed(1)}%`,
          },
          format: { x: false, y: false },
        })),
      ],
    });
  }

  return {
    id: 'chrRegionBoxplot',
    title: 'Regions per chromosome',
    description:
      'Box-and-whisker summary of region counts per chromosome across all compared files. Each row shows the distribution of one chromosome\'s count (or fraction) across files. Tight boxes indicate replicates agree on per-chromosome distribution; wide boxes or outlier whiskers suggest variability — possibly from mapping artifacts, copy number differences, or batch effects. "By count" shows absolute region counts; "Normalized" shows the distribution of what fraction of each file\'s regions fall on that chromosome.',
    type: 'observable',
    renderThumbnail,
    render: renderCount,
    variants: [
      { label: 'By count', render: renderCount },
      { label: 'Normalized', render: renderFraction },
    ],
  };
}
