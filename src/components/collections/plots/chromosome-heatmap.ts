import * as Plot from '@observablehq/plot';
import type { PlotSlot } from '../../../lib/plot-specs';
import type { ChrRegionCount } from '../../../lib/multi-file-analysis';

const STANDARD_CHR_ORDER = [
  'chr1', 'chr2', 'chr3', 'chr4', 'chr5', 'chr6', 'chr7', 'chr8', 'chr9', 'chr10',
  'chr11', 'chr12', 'chr13', 'chr14', 'chr15', 'chr16', 'chr17', 'chr18', 'chr19',
  'chr20', 'chr21', 'chr22', 'chrX', 'chrY', 'chrM',
];

function sortChromosomes(chrs: string[]): string[] {
  const standardSet = new Set(STANDARD_CHR_ORDER);
  const known = chrs
    .filter((c) => standardSet.has(c))
    .sort((a, b) => STANDARD_CHR_ORDER.indexOf(a) - STANDARD_CHR_ORDER.indexOf(b));
  const unknown = chrs
    .filter((c) => !standardSet.has(c))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  return [...known, ...unknown];
}

function makeLabels(fileNames: string[]): string[] {
  return fileNames.map((f) => f.replace(/\.(bed|bed\.gz)$/i, ''));
}

export function chromosomeHeatmapSlot(
  chrCounts: ChrRegionCount[],
  fileNames: string[],
): PlotSlot | null {
  if (chrCounts.length === 0) return null;

  const labels = makeLabels(fileNames);
  const labelMap = new Map(fileNames.map((f, i) => [f, labels[i]]));
  const chrOrder = sortChromosomes([...new Set(chrCounts.map((d) => d.chr))]);

  // Pre-compute data with labels
  const data = chrCounts.map((d) => ({
    ...d,
    label: labelMap.get(d.fileName) ?? d.fileName,
  }));

  function renderThumbnail(width: number, height: number): Element {
    return Plot.plot({
      width,
      height,
      margin: 4,
      x: { domain: chrOrder, axis: null },
      y: { domain: labels, axis: null },
      color: { scheme: 'ylgnbu', type: 'linear' },
      marks: [
        Plot.cell(data, {
          x: 'chr',
          y: 'label',
          fill: 'fraction',
          inset: 0.5,
        }),
      ],
    });
  }

  function renderFraction(width: number): Element {
    const height = labels.length * 24 + 100;
    return Plot.plot({
      width,
      height,
      marginLeft: 120,
      marginBottom: 80,
      x: { domain: chrOrder, label: null, tickRotate: -45 },
      y: { domain: labels, label: null },
      color: { scheme: 'ylgnbu', type: 'linear', label: 'Fraction of regions', legend: true },
      marks: [
        Plot.cell(data, {
          x: 'chr',
          y: 'label',
          fill: 'fraction',
          inset: 0.5,
          tip: true,
          channels: {
            Regions: 'count',
            '% of file': (d: typeof data[0]) => `${(d.fraction * 100).toFixed(1)}%`,
          },
        }),
      ],
    });
  }

  function renderCount(width: number): Element {
    const height = labels.length * 24 + 100;
    return Plot.plot({
      width,
      height,
      marginLeft: 120,
      marginBottom: 80,
      x: { domain: chrOrder, label: null, tickRotate: -45 },
      y: { domain: labels, label: null },
      color: { scheme: 'ylgnbu', type: 'linear', label: 'Region count', legend: true },
      marks: [
        Plot.cell(data, {
          x: 'chr',
          y: 'label',
          fill: 'count',
          inset: 0.5,
          tip: true,
          channels: {
            Regions: 'count',
            '% of file': (d: typeof data[0]) => `${(d.fraction * 100).toFixed(1)}%`,
          },
        }),
      ],
    });
  }

  return {
    id: 'chromosomeHeatmap',
    title: 'Regions by chromosome',
    description: 'Heatmap of region counts per chromosome for each file. "Normalized" shows the fraction of each file\'s total regions on each chromosome, enabling comparison across files with different sizes. "Raw counts" shows absolute region counts.',
    type: 'observable',
    renderThumbnail,
    render: renderFraction,
    variants: [
      { label: 'Normalized', render: renderFraction },
      { label: 'Raw counts', render: renderCount },
    ],
  };
}
