import * as Plot from '@observablehq/plot';
import type { PlotSlot } from '../../../lib/plot-specs';
import type { WidthHistPoint } from '../../../lib/multi-file-analysis';

function makeLabels(fileNames: string[]): string[] {
  return fileNames.map((f) => f.replace(/\.(bed|bed\.gz)$/i, ''));
}

function formatBp(bp: number): string {
  if (bp >= 1e6) return `${(bp / 1e6).toFixed(1)}M`;
  if (bp >= 1e3) return `${(bp / 1e3).toFixed(1)}K`;
  return `${Math.round(bp)}`;
}

export function widthDistributionSlot(
  widthHist: WidthHistPoint[],
): PlotSlot | null {
  if (widthHist.length === 0) return null;

  const fileNames = [...new Set(widthHist.map((d) => d.fileName))];
  const labels = makeLabels(fileNames);
  const labelMap = new Map(fileNames.map((f, i) => [f, labels[i]]));

  const data = widthHist.map((d) => ({
    ...d,
    label: labelMap.get(d.fileName) ?? d.fileName,
  }));

  function renderThumbnail(width: number, height: number): Element {
    return Plot.plot({
      width,
      height,
      marginLeft: 0,
      marginBottom: 0,
      x: { type: 'log', axis: null },
      y: { axis: null },
      marks: [
        Plot.line(data, {
          x: 'binCenter',
          y: 'fraction',
          stroke: 'label',
          strokeWidth: 1.5,
          curve: 'basis',
        }),
      ],
    });
  }

  function render(width: number): Element {
    return Plot.plot({
      width,
      height: 300,
      marginLeft: 60,
      marginBottom: 40,
      x: {
        type: 'log',
        label: 'Region width (bp)',
        tickFormat: (d: number) => formatBp(d),
      },
      y: { label: 'Fraction of regions', grid: true },
      color: { domain: labels, legend: true },
      marks: [
        Plot.areaY(data, {
          x: 'binCenter',
          y: 'fraction',
          fill: 'label',
          fillOpacity: 0.15,
          curve: 'basis',
        }),
        Plot.line(data, {
          x: 'binCenter',
          y: 'fraction',
          stroke: 'label',
          strokeWidth: 2,
          curve: 'basis',
          tip: true,
          channels: {
            'Width bin': (d: typeof data[0]) => `~${formatBp(d.binCenter)} bp`,
            'Regions': 'count',
          },
        }),
      ],
    });
  }

  return {
    id: 'widthDistribution',
    title: 'Region width distribution',
    type: 'observable',
    renderThumbnail,
    render,
  };
}
