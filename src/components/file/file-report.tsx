import { useCallback, useRef, useMemo } from 'react';
import { useFile } from '../../contexts/file-context';
import { useAnalyzeGenome } from '../../queries/use-analyze-genome';
import { useRefGenomicDistPlots } from '../analysis/genomicdist-debug';
import { openReport, downloadReportAssets, type ReportConfig, type GenomeMatch } from './report-export';
import type { BedAnalysis } from '../../lib/bed-analysis';

// Minimal stub so the hook can be called unconditionally
const emptyAnalysis: BedAnalysis = {
  source: 'local',
  summary: { regions: 0, meanRegionWidth: 0, nucleotides: 0, dataFormat: null, bedCompliance: null },
  chromosomeStats: [],
  plots: {},
};

/**
 * Hook that provides report generation actions.
 * Reads latest values at call time to avoid stale closures.
 */
export function useFileReport() {
  const fileCtx = useFile();
  const { plots: refPlots } = useRefGenomicDistPlots(fileCtx.analysis ?? emptyAnalysis);

  // Genome stats for the report bar
  const bedFileData = useMemo(() => {
    const analysis = fileCtx.analysis;
    if (!analysis || analysis.chromosomeStats.length === 0) return undefined;
    const d: Record<string, number> = {};
    for (const row of analysis.chromosomeStats) d[row.chromosome] = row.end;
    return d;
  }, [fileCtx.analysis]);

  const { data: genomeStats } = useAnalyzeGenome(bedFileData);

  const genomeMatch = useMemo<GenomeMatch | null>(() => {
    if (!genomeStats?.compared_genome) return null;
    const sorted = [...genomeStats.compared_genome].sort(
      (a, b) => a.tier_ranking - b.tier_ranking || b.xs - a.xs,
    );
    const top = sorted[0];
    if (!top) return null;
    return {
      name: top.compared_genome ?? 'Unknown',
      tier: top.tier_ranking,
      xs: top.xs,
      oobr: top.oobr ?? undefined,
      sequenceFit: top.sequence_fit ?? undefined,
    };
  }, [genomeStats]);

  const ref = useRef(fileCtx);
  ref.current = fileCtx;
  const refPlotsRef = useRef(refPlots);
  refPlotsRef.current = refPlots;
  const genomeMatchRef = useRef(genomeMatch);
  genomeMatchRef.current = genomeMatch;

  const handleOpenReport = useCallback((config?: ReportConfig) => {
    const { analysis, genome, umapCoordinates } = ref.current;
    if (!analysis) return;
    openReport({ analysis, genome, genomeMatch: genomeMatchRef.current, umapCoordinates, refPlots: refPlotsRef.current, config });
  }, []);

  const handleDownload = useCallback(async (config?: ReportConfig) => {
    const { analysis, genome, umapCoordinates } = ref.current;
    if (!analysis) return;
    await downloadReportAssets({ analysis, genome, genomeMatch: genomeMatchRef.current, umapCoordinates, refPlots: refPlotsRef.current, config });
  }, []);

  return { handleOpenReport, handleDownload, ready: !!fileCtx.analysis };
}
