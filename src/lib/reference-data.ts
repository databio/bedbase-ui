/**
 * Loader for genome reference data (chrom sizes, TSS, gene model).
 *
 * Chrom sizes are fetched from the refgenie seqcol API.
 * TSS data lives in public/ref/{genome}.json.gz.
 * Gene models live in public/ref/{genome}_genemodel.json.gz.
 */

import { SEQCOL_API, GENOME_SEQCOL_DIGESTS, PRIMARY_CHROM_RE } from './const';

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

// --- Seqcol chrom sizes ---

type SeqcolEntry = { name: string; length: number };

const chromSizesCache = new Map<string, Record<string, number>>();

/**
 * Resolve a genome name to a seqcol digest.
 * Uses hardcoded digests for common genomes, falls back to the
 * refgenie /v4/genomes endpoint for unknown ones.
 */
async function resolveDigest(genome: string): Promise<string | null> {
  const known = GENOME_SEQCOL_DIGESTS[genome];
  if (known) return known;

  // Fall back to the genome list API
  const res = await fetch(`${SEQCOL_API}/v4/genomes?limit=1000`);
  if (!res.ok) return null;

  const data = await res.json();
  const genomeLower = genome.toLowerCase();
  let digest: string | null = null;
  let fallbackDigest: string | null = null;

  for (const entry of data.items ?? []) {
    for (const alias of entry.aliases ?? []) {
      const aliasLower = (alias as string).toLowerCase();
      if (aliasLower === `${genomeLower}-refgenie`) {
        digest = entry.digest;
        break;
      }
      if (!fallbackDigest && aliasLower.startsWith(genomeLower)) {
        fallbackDigest = entry.digest;
      }
    }
    if (digest) break;
  }
  return digest ?? fallbackDigest;
}

/**
 * Fetch chromosome sizes from the seqcol API, filtered to primary
 * assembly chromosomes (chr1-22, chrX, chrY, chrM).
 */
export async function loadChromSizes(
  genome: string,
): Promise<Record<string, number>> {
  const cached = chromSizesCache.get(genome);
  if (cached) return cached;

  const digest = await resolveDigest(genome);
  if (!digest) throw new Error(`No seqcol digest found for genome '${genome}'`);

  const url = `${SEQCOL_API}/seqcol/collection/${digest}?collated=true&attribute=name_length_pairs`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch chrom sizes: ${res.status}`);

  const entries: SeqcolEntry[] = await res.json();
  const sizes: Record<string, number> = {};
  for (const { name, length } of entries) {
    if (PRIMARY_CHROM_RE.test(name)) {
      sizes[name] = length;
    }
  }

  chromSizesCache.set(genome, sizes);
  return sizes;
}

// --- Cache ---

const baseCache = new Map<string, RefBase>();
const geneModelCache = new Map<string, RefGeneModel>();

/**
 * Load reference base data (chrom sizes + TSS) for a genome.
 * Chrom sizes come from the seqcol API; TSS from static files.
 * Falls back to static-file chrom sizes if the API is unreachable.
 */
export async function loadRefBase(genome: string): Promise<RefBase> {
  const cached = baseCache.get(genome);
  if (cached) return cached;

  // Fetch static TSS data and seqcol chrom sizes in parallel
  const [staticData, seqcolSizes] = await Promise.all([
    fetchGzJson<RefBase>(`/ref/${genome}.json.gz`),
    loadChromSizes(genome).catch(() => {
      // seqcol API unreachable — use static file chromSizes
      return null;
    }),
  ]);

  const chromSizes = seqcolSizes ?? staticData.chromSizes;
  const result: RefBase = { genome, chromSizes, tss: staticData.tss };
  baseCache.set(genome, result);
  return result;
}

export async function loadRefGeneModel(genome: string): Promise<RefGeneModel> {
  const cached = geneModelCache.get(genome);
  if (cached) return cached;

  const data = await fetchGzJson<RefGeneModel>(`/ref/${genome}_genemodel.json.gz`);
  geneModelCache.set(genome, data);
  return data;
}
