import * as vg from '@uwdata/vgplot';
import { add, sub, mul, mod } from '@uwdata/mosaic-sql';

export const UMAP_URL = 'https://huggingface.co/databio/bedbase-umap/resolve/main/hg38_umap_3_13.json';

export type UmapPoint = {
  identifier: string;
  text: string;
  x: number;
  y: number;
  category: number;
  fields: {
    Description: string;
    Assay: string;
    'Cell Line': string;
  };
};

export type LegendItem = {
  category: number;
  name: string;
};

/** Shared SELECT params for UMAP queries */
export function umapSelectParams(colorGrouping: string) {
  return {
    x: vg.column('x'),
    y: vg.column('y'),
    cell_line_category: vg.column('cell_line_category'),
    assay_category: vg.column('assay_category'),
    category: vg.column(colorGrouping),
    text: vg.column('name'),
    identifier: vg.column('id'),
    fields: vg.sql`{'Description': description, 'Assay': assay, 'Cell Line': cell_line}`,
  };
}

/** SQL point-in-polygon predicate for DuckDB — ray-casting algorithm expressed as SQL expressions */
export function pointInPolygonPredicate(x: any, y: any, polygon: { x: number; y: number }[]) {
  const parts: any[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const { x: x1, y: y1 } = polygon[i];
    const { x: x2, y: y2 } = polygon[j];
    const pred1 = y1 < y2
      ? vg.and(vg.lte(vg.literal(y1), y), vg.lt(y, vg.literal(y2)))
      : vg.and(vg.lte(vg.literal(y2), y), vg.lt(y, vg.literal(y1)));
    const pred2 = (y1 < y2 ? vg.lt : vg.gt)(
      sub(mul(vg.literal(x2 - x1), y), mul(vg.literal(y2 - y1), x)),
      vg.literal((x2 - x1) * y1 - (y2 - y1) * x1),
    );
    parts.push(vg.cast(vg.and(pred1, pred2), 'INT'));
  }
  const sum = parts.reduce((a, b) => add(a, b));
  return vg.eq(mod(sum, vg.literal(2)), vg.literal(1));
}

/** Compute bounding rectangle from a set of points */
export function boundingRect(points: { x: number; y: number }[]) {
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (const p of points) {
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
  }
  return { xMin, yMin, xMax, yMax };
}

/**
 * Async tooltip throttle: delays 300ms on first hover after idle,
 * immediate if tooltip was recently visible. Ported from embedding-atlas.
 */
export function throttleTooltip<T, U>(
  func: (input: T) => Promise<U>,
  isVisible: () => boolean,
): (input: T) => void {
  let running = false;
  let next: T | undefined = undefined;
  let lastVisible: number | undefined = undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined = undefined;

  const delayMS = 300;
  const recentThresholdMS = 300;

  const run = async (input: T) => {
    running = true;
    try {
      await func(input);
    } catch (e) {
      console.error(e);
    }
    running = false;
    if (next !== undefined) {
      const v = next;
      next = undefined;
      perform(v);
    }
  };

  const perform = (input: T) => {
    if (running) {
      next = input;
      return;
    }
    const now = Date.now();
    if (isVisible()) {
      lastVisible = now;
    }
    let shouldDelay = true;
    if (lastVisible == undefined || now - lastVisible < recentThresholdMS) {
      shouldDelay = false;
    }
    if (shouldDelay) {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => run(input), delayMS);
    } else {
      run(input);
    }
  };

  return perform;
}
