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

function estimateMargins(labels: string[]): { left: number; bottom: number } {
  const longest = Math.max(...labels.map((l) => l.length));
  const left = Math.max(40, longest * 7 + 16);
  // Bottom labels are rotated -45°, so projected height ≈ length * sin(45°)
  const bottom = Math.max(40, longest * 5 + 16);
  return { left, bottom };
}

function renderHeatmap(
  cells: Cell[],
  labels: string[],
  fileNames: string[],
  opts: { width: number; height: number; maxVal: number; scheme: string; label: string; format: (v: number) => string; legend: boolean },
): Element {
  const margins = opts.legend ? estimateMargins(labels) : { left: 4, bottom: 4 };
  return Plot.plot({
    width: opts.width,
    height: opts.height,
    marginLeft: margins.left,
    marginBottom: margins.bottom,
    x: opts.legend ? { domain: labels, label: null, tickRotate: -45 } : { domain: labels, axis: null },
    y: opts.legend ? { domain: labels, label: null } : { domain: labels, axis: null },
    color: { domain: [0, opts.maxVal], scheme: opts.scheme as Plot.ColorScheme, label: opts.legend ? opts.label : undefined, legend: opts.legend },
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
  const margins = estimateMargins(labels);
  function fullSize(width: number) {
    const cellSize = Math.min(60, Math.floor((width - margins.left) / n));
    return cellSize * n + margins.bottom;
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
    description: 'Pairwise comparison of genomic coverage between files, measured in base pairs. Jaccard similarity is the ratio of shared bases to total bases covered by either file (0 = no shared bases, 1 = identical coverage). It is symmetric — comparing A to B gives the same value as B to A. Overlap % is asymmetric: it shows what fraction of each file\'s bases are covered by the other, so A→B and B→A can differ when files have different total coverage. Use Jaccard to assess overall concordance; use Overlap % to identify when one file is a subset of another.',
    type: 'observable',
    renderThumbnail,
    render: renderJaccard,
    variants: [
      { label: 'Jaccard', render: renderJaccard },
      { label: 'Overlap %', render: renderOverlap },
    ],
  };
}
