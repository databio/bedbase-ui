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

/** Ray-casting point-in-polygon test for lasso selection */
export function isPointInPolygon(
  point: { x: number; y: number },
  polygon: { x: number; y: number }[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
