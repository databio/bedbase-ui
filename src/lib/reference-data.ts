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
// Files are .json.gz but the server sets Content-Encoding: gzip,
// so the browser decompresses transparently. Just parse as JSON.

async function fetchGzJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json() as Promise<T>;
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
