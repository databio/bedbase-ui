import * as Plot from '@observablehq/plot';
import type { PlotSlot } from '../../../lib/plot-specs';

type Cell = { fileA: string; fileB: string; value: number };

function matrixToCells(matrix: number[][], fileNames: string[]): Cell[] {
  const cells: Cell[] = [];
  const n = Math.min(matrix.length, fileNames.length);
  for (let i = 0; i < n; i++) {
    const row = matrix[i];
    if (!row) continue;
    for (let j = 0; j < n; j++) {
      cells.push({ fileA: fileNames[i], fileB: fileNames[j], value: row[j] ?? 0 });
    }
  }
  return cells;
}

function makeLabels(fileNames: string[]): string[] {
  return fileNames.map((f) => f.replace(/\.(bed|bed\.gz)$/i, ''));
}

function renderHeatmap(
  cells: Cell[],
  labels: string[],
  fileNames: string[],
  opts: { width: number; height: number; maxVal: number; scheme: string; label: string; format: (v: number) => string; legend: boolean },
): Element {
  return Plot.plot({
    width: opts.width,
    height: opts.height,
    marginLeft: opts.legend ? 120 : 4,
    marginBottom: opts.legend ? 120 : 4,
    x: opts.legend ? { domain: labels, label: null, tickRotate: -45 } : { domain: labels, axis: null },
    y: opts.legend ? { domain: labels, label: null } : { domain: labels, axis: null },
    color: { domain: [0, opts.maxVal], scheme: opts.scheme, label: opts.legend ? opts.label : undefined, legend: opts.legend },
    marks: [
      Plot.cell(cells, {
        x: (d: Cell) => labels[fileNames.indexOf(d.fileA)],
        y: (d: Cell) => labels[fileNames.indexOf(d.fileB)],
        fill: 'value',
        inset: 0.5,
      }),
      ...(opts.legend ? [
        Plot.text(cells, {
          x: (d: Cell) => labels[fileNames.indexOf(d.fileA)],
          y: (d: Cell) => labels[fileNames.indexOf(d.fileB)],
          text: (d: Cell) => opts.format(d.value),
          fill: (d: Cell) => (d.value > opts.maxVal * 0.5 ? 'white' : 'black'),
          fontSize: 11,
        }),
      ] : []),
    ],
  });
}

export function similarityHeatmapSlot(
  jaccardMatrix: number[][],
  overlapMatrix: number[][],
  fileNames: string[],
): PlotSlot {
  const labels = makeLabels(fileNames);
  const jCells = matrixToCells(jaccardMatrix, fileNames);
  const oCells = matrixToCells(overlapMatrix, fileNames);

  const n = fileNames.length;
  function fullSize(width: number) {
    const cellSize = Math.min(60, Math.floor((width - 120) / n));
    return cellSize * n + 120;
  }

  function renderThumbnail(width: number, height: number): Element {
    const size = Math.min(width, height);
    return renderHeatmap(jCells, labels, fileNames, {
      width: size, height: size, maxVal: 1, scheme: 'blues', label: '', format: () => '', legend: false,
    });
  }

  function renderJaccard(width: number): Element {
    return renderHeatmap(jCells, labels, fileNames, {
      width, height: fullSize(width), maxVal: 1, scheme: 'blues',
      label: 'Jaccard similarity', format: (v) => v.toFixed(3), legend: true,
    });
  }

  function renderOverlap(width: number): Element {
    return renderHeatmap(oCells, labels, fileNames, {
      width, height: fullSize(width), maxVal: 100, scheme: 'greens',
      label: 'Region overlap %', format: (v) => `${v.toFixed(1)}%`, legend: true,
    });
  }

  return {
    id: 'similarityHeatmap',
    title: 'Pairwise similarity',
    type: 'observable',
    renderThumbnail,
    render: renderJaccard,
    variants: [
      { label: 'Jaccard', render: renderJaccard },
      { label: 'Overlap %', render: renderOverlap },
    ],
  };
}
