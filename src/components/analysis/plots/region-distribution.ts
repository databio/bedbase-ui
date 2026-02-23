import * as Plot from '@observablehq/plot';
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

function estimateMargin(labels: string[]): number {
  const longest = Math.max(...labels.map((l) => l.length));
  return Math.max(40, longest * 7 + 16);
}

export function regionDistributionSlot(data: DistributionPoint[]): PlotSlot | null {
  if (data.length === 0) return null;
  const chrOrder = getChromosomeSort(data);

  function renderThumbnail(width: number, height: number): Element {
    return Plot.plot({
      width,
      height,
      marginLeft: 0,
      marginBottom: 0,
      x: { domain: [0, 300], axis: null },
      y: { axis: null },
      fy: { domain: chrOrder, axis: null, padding: 0 },
      marks: [
        Plot.ruleX(data, { x: 'rid', y1: 0, y2: 'n', fy: 'chr', stroke: 'teal', strokeWidth: 1.5 }),
      ],
    });
  }

  function render(width: number): Element {
    const marginLeft = estimateMargin(chrOrder);
    const marginTop = 10;
    const marginBottom = 30;
    const height = chrOrder.length * 25 + 40;

    const svg = Plot.plot({
      width,
      height,
      marginLeft,
      marginTop,
      marginBottom,
      x: {
        domain: [0, 300],
        label: 'Genomic position',
        labelArrow: 'none',
        labelAnchor: 'center',
        ticks: [0, 300],
        tickFormat: (d) => (d === 0 ? 'start' : 'end'),
      },
      y: { axis: null },
      fy: { domain: chrOrder, label: 'Chromosome', padding: 0 },
      marks: [
        Plot.rect(data, {
          x1: (d: DistributionPoint) => d.rid - 0.5,
          x2: (d: DistributionPoint) => d.rid + 0.5,
          y1: 0,
          y2: 'n',
          fy: 'chr',
          fill: 'teal',
          ry2: 0.5,
        }),
        Plot.tip(data, Plot.pointer({
          x: 'rid',
          y: 'n',
          fy: 'chr',
          channels: { Regions: 'n', Chromosome: 'chr' },
          format: { x: false, y: false, fy: false },
        })),
      ],
    });

    // Insert axis lines before the tip layer so they don't obscure tooltips
    const ns = 'http://www.w3.org/2000/svg';
    const tipEl = svg.querySelector('[aria-label="tip"]');

    const xLine = document.createElementNS(ns, 'line');
    xLine.setAttribute('x1', String(marginLeft));
    xLine.setAttribute('y1', String(height - marginBottom));
    xLine.setAttribute('x2', String(width));
    xLine.setAttribute('y2', String(height - marginBottom));
    xLine.setAttribute('stroke', 'black');
    xLine.setAttribute('stroke-width', '1');

    const yLine = document.createElementNS(ns, 'line');
    yLine.setAttribute('x1', String(marginLeft));
    yLine.setAttribute('y1', String(marginTop));
    yLine.setAttribute('x2', String(marginLeft));
    yLine.setAttribute('y2', String(height - marginBottom));
    yLine.setAttribute('stroke', 'black');
    yLine.setAttribute('stroke-width', '1');

    if (tipEl) {
      svg.insertBefore(xLine, tipEl);
      svg.insertBefore(yLine, tipEl);
    } else {
      svg.appendChild(xLine);
      svg.appendChild(yLine);
    }

    return svg;
  }

  return {
    id: 'regionDistribution',
    title: 'Region distribution',
    description: 'Positional distribution of regions across each chromosome. Each chromosome is divided into 300 equal-width bins and regions are counted per bin based on overlap. Taller bars indicate genomic hotspots with higher region density. Useful for spotting positional biases — e.g. regions concentrated near centromeres or telomeres, or chromosomes with unexpectedly sparse or dense coverage.',
    type: 'observable',
    renderThumbnail,
    render,
  };
}
