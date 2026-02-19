import type { components } from '../bedbase-types';

type BinValues = components['schemas']['BinValues'];

const SCHEMA = 'https://vega-github.io/schema/vega-lite/v6.json';

export function barSpec(
  data: Record<string, number>,
  opts?: { title?: string; color?: string },
): Record<string, unknown> {
  const entries = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ key, value }));

  return {
    $schema: SCHEMA,
    data: { values: entries },
    mark: { type: 'bar', color: opts?.color ?? 'teal', cornerRadiusEnd: 2 },
    encoding: {
      x: { field: 'value', type: 'quantitative', title: 'Count' },
      y: { field: 'key', type: 'nominal', title: null, sort: '-x' },
    },
    title: opts?.title,
  };
}

export function histogramSpec(
  data: BinValues,
  opts?: { title?: string; color?: string },
): Record<string, unknown> {
  // Use numeric x so the mean rule renders as a thin line, not a band
  const numericBins = data.bins.map(Number);
  const allNumeric = numericBins.every((n) => !isNaN(n));

  if (allNumeric) {
    const values = numericBins.map((bin, i) => ({
      bin,
      count: data.counts[i] ?? 0,
    }));

    const layers: Record<string, unknown>[] = [
      {
        mark: { type: 'bar', color: opts?.color ?? 'teal', cornerRadiusEnd: 2 },
        encoding: {
          x: { field: 'bin', type: 'quantitative', title: 'Value', axis: { labelAngle: -45 } },
          y: { field: 'count', type: 'quantitative', title: 'Count' },
        },
      },
    ];

    if (data.mean != null) {
      layers.push({
        data: { values: [{}] },
        mark: { type: 'rule', color: 'red', strokeWidth: 2, strokeDash: [4, 4] },
        encoding: {
          x: { datum: data.mean, type: 'quantitative' },
        },
      });
    }

    return {
      $schema: SCHEMA,
      data: { values },
      layer: layers,
      title: opts?.title,
    };
  }

  // Fallback for string bins — no rule overlay (can't position correctly)
  const values = data.bins.map((bin, i) => ({
    bin: String(bin),
    count: data.counts[i] ?? 0,
  }));

  return {
    $schema: SCHEMA,
    data: { values },
    mark: { type: 'bar', color: opts?.color ?? 'teal', cornerRadiusEnd: 2 },
    encoding: {
      x: { field: 'bin', type: 'ordinal', title: 'Bin', axis: { labelAngle: -45 } },
      y: { field: 'count', type: 'quantitative', title: 'Count' },
    },
    title: opts?.title,
  };
}

export function pieSpec(
  data: Record<string, number>,
  opts?: { title?: string },
): Record<string, unknown> {
  const entries = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ key, value }));

  return {
    $schema: SCHEMA,
    data: { values: entries },
    mark: { type: 'arc' },
    encoding: {
      theta: { field: 'value', type: 'quantitative' },
      color: { field: 'key', type: 'nominal', title: null },
    },
    title: opts?.title,
  };
}

export function timeBarSpec(
  data: Record<string, number>,
  opts?: { title?: string; color?: string },
): Record<string, unknown> {
  const entries = Object.entries(data)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({ key, value }));

  return {
    $schema: SCHEMA,
    data: { values: entries },
    mark: { type: 'bar', color: opts?.color ?? 'teal', cornerRadiusEnd: 2 },
    encoding: {
      x: { field: 'key', type: 'ordinal', title: 'Year', sort: null },
      y: { field: 'value', type: 'quantitative', title: 'Count' },
    },
    title: opts?.title,
  };
}
