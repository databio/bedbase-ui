// --- Example data used across the app ---
// Update these when you want to change the featured examples.

/** A known BED file ID to use as a showcase example. */
export const EXAMPLE_BED_ID = 'dcc005e8761ad5599545cc538f6a2a4d';

/** Example text search queries shown on the search empty state. */
export const EXAMPLE_QUERIES = ['K562 CTCF', 'ENCODE DNase-seq', 'H3K27ac ChIP-seq'];

/** Example BEDset search queries shown on the hub when in BEDset mode. */
export const EXAMPLE_BEDSET_QUERIES = ['ENCODE', 'K562'];

// --- Refgenie seqcol API ---

/** Base URL for the refgenie / seqcol API. */
export const SEQCOL_API = 'https://api.refgenie.org';

/**
 * Known seqcol digests for common genomes.
 * Avoids a round-trip to /v4/genomes for the most common cases.
 */
export const GENOME_SEQCOL_DIGESTS: Record<string, string> = {
  hg38: 'EiFob05aCWgVU_B_Ae0cypnQut3cxUP1',
  hg19: 'ThZcNYiLuWWL86NdJ8dvvJG15K9mW3Fo',
};

/** Matches primary assembly chromosomes (chr1-22, chrX, chrY, chrM). */
export const PRIMARY_CHROM_RE = /^chr([1-9]|1[0-9]|2[0-2]|X|Y|M)$/;
