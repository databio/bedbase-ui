import type { components } from '../bedbase-types';
import type { PlotSlot } from './plot-specs';

type FileModel = components['schemas']['FileModel'];

export const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://api.bedbase.org/v1';

export function fileModelToUrl(fm: FileModel | undefined | null): string | undefined {
  if (!fm?.access_methods) return undefined;
  const http = fm.access_methods.find((m) => m.type === 'http');
  return http?.access_url?.url ?? undefined;
}

export function fileModelToPlotSlot(fm: FileModel | undefined, id: string, title: string): PlotSlot | null {
  if (!fm) return null;
  const thumbPath = (fm as Record<string, unknown>).path_thumbnail as string | undefined;
  if (!thumbPath) return null;
  const url = `${API_BASE}/files/${thumbPath}`;
  return { id, title, type: 'image', thumbnail: url, full: url };
}
