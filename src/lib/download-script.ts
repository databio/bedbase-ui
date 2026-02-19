import { API_BASE } from './file-model-utils';
import type { CartItem } from '../contexts/cart-context';

export function generateDownloadScript(items: CartItem[]): string {
  const lines = [
    '#!/bin/bash',
    '# BEDbase download script',
    `# Generated: ${new Date().toISOString()}`,
    `# Files: ${items.length}`,
    '',
  ];

  for (const item of items) {
    const url = `${API_BASE}/objects/bed.${item.id}.bed_file/access/http`;
    const filename = item.name.endsWith('.bed.gz') ? item.name : `${item.name}.bed.gz`;
    lines.push(`curl -L -o "${filename}" "${url}"`);
  }

  lines.push('');
  return lines.join('\n');
}

export function downloadAsFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
