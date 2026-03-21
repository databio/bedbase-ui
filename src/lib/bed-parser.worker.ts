import pako from 'pako';

type BedEntry = [string, number, number, string];

const CHUNK_SIZE = 50_000;

self.onmessage = async (e: MessageEvent<{ file: File }>) => {
  const { file } = e.data;

  try {
    const buffer = await file.arrayBuffer();
    self.postMessage({ type: 'progress', value: 0.3 });

    let text: string;
    if (file.name.endsWith('.gz')) {
      text = pako.ungzip(new Uint8Array(buffer), { to: 'string' });
    } else {
      text = new TextDecoder().decode(buffer);
    }
    self.postMessage({ type: 'progress', value: 0.5 });

    const lines = text.split('\n');
    self.postMessage({ type: 'progress', value: 0.6 });

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
        self.postMessage({ type: 'progress', value: 0.6 + 0.4 * (i / total) });
      }
    }

    self.postMessage({ type: 'progress', value: 1 });
    self.postMessage({ type: 'result', entries });
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'Failed to parse BED file',
    });
  }
};
