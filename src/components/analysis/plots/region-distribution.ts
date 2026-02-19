import type { DistributionPoint } from '../../../lib/bed-analysis';
import type { PlotSlot } from '../../../lib/plot-specs';

const STANDARD_CHR_ORDER = [
  'chr1', 'chr2', 'chr3', 'chr4', 'chr5', 'chr6', 'chr7', 'chr8', 'chr9', 'chr10',
  'chr11', 'chr12', 'chr13', 'chr14', 'chr15', 'chr16', 'chr17', 'chr18', 'chr19',
  'chr20', 'chr21', 'chr22', 'chrX', 'chrY', 'chrM',
];

function getChromosomeSort(data: DistributionPoint[]): string[] {
  const uniqueChrs = [...new Set(data.map((d) => d.chr))];
  const standardSet = new Set(STANDARD_CHR_ORDER);

  const known = uniqueChrs
    .filter((c) => standardSet.has(c))
    .sort((a, b) => STANDARD_CHR_ORDER.indexOf(a) - STANDARD_CHR_ORDER.indexOf(b));

  const unknown = uniqueChrs
    .filter((c) => !standardSet.has(c))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  return [...known, ...unknown];
}

export function regionDistributionSpec(
  data: DistributionPoint[],
  width: number,
  opts?: { compact?: boolean },
): Record<string, unknown> {
  const compact = opts?.compact ?? false;
  const transformed = data.map((d) => ({
    chr: d.chr,
    withinGroupID: d.rid,
    N: d.n,
    start: d.start,
    end: d.end,
  }));

  return {
    $schema: 'https://vega-github.io/schema/vega-lite/v6.json',
    config: {
      axis: { grid: false },
      facet: { spacing: -1 },
      view: { strokeWidth: 0, cursor: 'inherit' },
    },
    data: { values: transformed },
    width,
    height: compact ? 12 : 25,
    encoding: {
      row: {
        title: compact ? null : 'Chromosome',
        field: 'chr',
        header: compact
          ? { labels: false }
          : {
              labelAlign: 'left' as const,
              labelAngle: 0,
              labelOrient: 'left' as const,
              labelPadding: 5,
              labelBaseline: 'top' as const,
              labelFontSize: 9,
            },
        sort: getChromosomeSort(data),
        type: 'ordinal' as const,
      },
      x: {
        axis: compact
          ? null
          : {
              labelExpr: "datum.value == 0 ? 'start' : datum.value == 300 ? 'end' : ''",
              values: [0, 300],
            },
        field: 'withinGroupID',
        scale: { domain: [0, 300] },
        title: compact ? null : 'Genome',
        type: 'quantitative' as const,
      },
      y: {
        axis: { labels: false, ticks: false },
        field: 'N',
        title: '',
        type: 'quantitative' as const,
      },
    },
    mark: {
      type: 'bar' as const,
      cornerRadiusEnd: 0.5,
      width: compact ? 1.5 : 2.5,
      color: 'rgba(0, 128, 128, 1)',
    },
  };
}

export function regionDistributionSlot(data: DistributionPoint[]): PlotSlot | null {
  if (data.length === 0) return null;
  return {
    id: 'regionDistribution',
    title: 'Region distribution',
    type: 'vega',
    spec: regionDistributionSpec(data, 200, { compact: true }),
    buildFullSpec: (width: number) => regionDistributionSpec(data, width),
  };
}
