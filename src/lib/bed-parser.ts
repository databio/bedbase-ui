import pako from 'pako';

export type BedEntry = [string, number, number, string];

export type ProgressCallback = (fraction: number) => void;

const CHUNK_SIZE = 50_000; // lines per batch before yielding

function readFileWithProgress(
  file: File,
  onProgress?: ProgressCallback,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let lastReport = 0;

    reader.onprogress = (e) => {
      if (!onProgress || !e.lengthComputable) return;
      const now = performance.now();
      if (now - lastReport < 50) return;
      lastReport = now;
      onProgress(0.3 * (e.loaded / e.total));
    };

    reader.onload = () => {
      onProgress?.(0.3);
      resolve(reader.result as ArrayBuffer);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function parseBedFile(
  file: File,
  onProgress?: ProgressCallback,
): Promise<BedEntry[]> {
  const buffer = await readFileWithProgress(file, onProgress);

  // Decode / decompress: 30% → 50%
  let text: string;
  if (file.name.endsWith('.gz')) {
    text = pako.ungzip(new Uint8Array(buffer), { to: 'string' });
  } else {
    text = new TextDecoder().decode(buffer);
  }
  onProgress?.(0.5);
  await yieldToMain();

  // Split lines: 50% → 60%
  const lines = text.split('\n');
  onProgress?.(0.6);
  await yieldToMain();

  // Parse entries in chunks: 60% → 100%
  const entries: BedEntry[] = [];
  const total = lines.length;

  for (let i = 0; i < total; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const cols = trimmed.split('\t');
    if (cols.length >= 3) {
      const chr = cols[0];
      const start = parseInt(cols[1], 10);
      const end = parseInt(cols[2], 10);
      const rest = cols.slice(3).join('\t');
      if (!isNaN(start) && !isNaN(end)) {
        entries.push([chr, start, end, rest]);
      }
    }

    if (i > 0 && i % CHUNK_SIZE === 0) {
      onProgress?.(0.6 + 0.4 * (i / total));
      await yieldToMain();
    }
  }

  onProgress?.(1);
  return entries;
}
