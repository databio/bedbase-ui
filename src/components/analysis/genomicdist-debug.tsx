import { useState, useEffect, useMemo } from 'react';
import type { RefGenomicDistResult, BedAnalysis } from '../../lib/bed-analysis';
import { computeRefGenomicdist } from '../../lib/bed-analysis';
import type { PlotSlot } from '../../lib/plot-specs';
import { tssDistanceSlot, partitionsSlot, expectedPartitionsSlot } from './plots/genomicdist-plots';
import { useFile } from '../../contexts/file-context';
import { useAnalyzeGenome } from '../../queries/use-analyze-genome';

/**
 * Hook that detects the genome, fetches ref data, computes ref-dependent
 * genomicdist results, and returns PlotSlot[] to merge into the main gallery.
 */
export function useRefGenomicDistPlots(analysis: BedAnalysis): {
  plots: PlotSlot[];
  loading: boolean;
} {
  const { regionSet } = useFile();

  // --- Genome detection (same cached hook as LocalHeader) ---
  const bedFileData = useMemo(() => {
    if (analysis.chromosomeStats.length === 0) return undefined;
    const d: Record<string, number> = {};
    for (const row of analysis.chromosomeStats) d[row.chromosome] = row.end;
    return d;
  }, [analysis.chromosomeStats]);

  const { data: genomeStats } = useAnalyzeGenome(bedFileData);

  const detectedGenome = useMemo(() => {
    if (!genomeStats?.compared_genome) return null;
    const sorted = [...genomeStats.compared_genome].sort(
      (a, b) => a.tier_ranking - b.tier_ranking || b.xs - a.xs,
    );
    const top = sorted[0]?.compared_genome;
    if (top?.includes('hg38') || top?.includes('GRCh38')) return 'hg38';
    if (top?.includes('hg19') || top?.includes('GRCh37')) return 'hg19';
    return null;
  }, [genomeStats]);

  // --- Ref-dependent computation ---
  const [refResult, setRefResult] = useState<RefGenomicDistResult | null>(null);
  const [refLoading, setRefLoading] = useState(false);

  useEffect(() => {
    if (!regionSet || !detectedGenome) return;
    let cancelled = false;

    setRefLoading(true);

    computeRefGenomicdist(regionSet, detectedGenome)
      .then((result) => {
        if (!cancelled) setRefResult(result);
      })
      .catch(() => {
        // Silently fail — plots just won't appear
      })
      .finally(() => {
        if (!cancelled) setRefLoading(false);
      });

    return () => { cancelled = true; };
  }, [regionSet, detectedGenome]);

  // --- Build plot slots from ref results ---
  const plots = useMemo<PlotSlot[]>(() => {
    if (!refResult) return [];
    const slots: PlotSlot[] = [];

    const tss = tssDistanceSlot(refResult.featureDistances);
    if (tss) slots.push(tss);

    if (refResult.partitions) {
      const p = partitionsSlot(refResult.partitions.partitions);
      if (p) slots.push(p);
    }

    if (refResult.expectedPartitions) {
      const ep = expectedPartitionsSlot(refResult.expectedPartitions);
      if (ep) slots.push(ep);
    }

    return slots;
  }, [refResult]);

  return { plots, loading: refLoading };
}
