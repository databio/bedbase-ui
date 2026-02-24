/**
 * Loader for genome reference data (chrom sizes, TSS, gene model).
 *
 * Files live in public/ref/ as gzipped columnar JSON:
 *   {genome}.json.gz           — chromSizes + TSS  (~160 KB)
 *   {genome}_genemodel.json.gz — genes + exons + UTRs (~2.9 MB)
 */

// --- Types for the columnar JSON layout ---

type ColumnarRegions = {
  chr: string[];
  start: number[];
  end: number[];
};

type ColumnarStrandedRegions = ColumnarRegions & {
  strand: string[];
};

export type RefBase = {
  genome: string;
  chromSizes: Record<string, number>;
  tss: ColumnarRegions;
};

export type RefGeneModel = {
  genome: string;
  genes: ColumnarStrandedRegions;
  exons: ColumnarRegions;
  threeUtr: ColumnarRegions;
  fiveUtr: ColumnarRegions;
};

// --- Columnar → tuple conversion for WASM constructors ---

export function columnsToTuples(
  cols: ColumnarRegions,
): [string, number, number, string][] {
  const n = cols.chr.length;
  const tuples: [string, number, number, string][] = new Array(n);
  for (let i = 0; i < n; i++) {
    tuples[i] = [cols.chr[i], cols.start[i], cols.end[i], ''];
  }
  return tuples;
}

export function columnsToStrandedTuples(
  cols: ColumnarStrandedRegions,
): [string, number, number, string][] {
  const n = cols.chr.length;
  const tuples: [string, number, number, string][] = new Array(n);
  for (let i = 0; i < n; i++) {
    tuples[i] = [cols.chr[i], cols.start[i], cols.end[i], cols.strand[i]];
  }
  return tuples;
}

// --- Fetch ---
// Files are .json.gz. Decompress with pako since not all hosts set
// Content-Encoding: gzip (e.g. Cloudflare Workers serves raw bytes).

async function fetchGzJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);

  const buf = await res.arrayBuffer();
  // If the server already decompressed (Content-Encoding: gzip), the
  // bytes are plain JSON. Try JSON.parse first; fall back to pako inflate.
  const bytes = new Uint8Array(buf);
  // Gzip magic number: 0x1f 0x8b
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const { inflate } = await import('pako');
    const text = new TextDecoder().decode(inflate(bytes));
    return JSON.parse(text) as T;
  }
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as T;
}

// --- Cache ---

const baseCache = new Map<string, RefBase>();
const geneModelCache = new Map<string, RefGeneModel>();

export async function loadRefBase(genome: string): Promise<RefBase> {
  const cached = baseCache.get(genome);
  if (cached) return cached;

  const data = await fetchGzJson<RefBase>(`/ref/${genome}.json.gz`);
  baseCache.set(genome, data);
  return data;
}

export async function loadRefGeneModel(genome: string): Promise<RefGeneModel> {
  const cached = geneModelCache.get(genome);
  if (cached) return cached;

  const data = await fetchGzJson<RefGeneModel>(`/ref/${genome}_genemodel.json.gz`);
  geneModelCache.set(genome, data);
  return data;
}
