import { useMemo, useState } from 'react';
import { Loader2, FileText, AlertCircle, Search, Copy, CheckCheck, X, ChevronLeft, Dna, ScatterChart } from 'lucide-react';
import { useFile } from '../../contexts/file-context';
import { useTab } from '../../contexts/tab-context';
import { fromApiResponse, type BedAnalysis } from '../../lib/bed-analysis';
import type { PlotSlot } from '../../lib/plot-specs';
import { regionDistributionSlot } from './plots/region-distribution';
import { useBedMetadata } from '../../queries/use-bed-metadata';
import { useGenomeStats } from '../../queries/use-genome-stats';
import { useAnalyzeGenome } from '../../queries/use-analyze-genome';
import { AnalysisEmpty } from './analysis-empty';
import { ChromosomeStats } from './chromosome-stats';
import { PlotGallery } from './plot-gallery';
import { SimilarFiles } from './similar-files';
import { BedsetMemberships } from './bedset-memberships';
import { ActionBar } from './action-bar';
import { ComparisonStrip } from './comparison-strip';
import { GenomeCompatModal } from './genome-compat-modal';
import { KvTable, type KvRow } from '../shared/kv-table';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// --- Shared stats grid (used by both headers) ---

function StatsGrid({ analysis }: { analysis: BedAnalysis }) {
  const { summary } = analysis;

  const items: { label: string; value: string }[] = [
    { label: 'Regions', value: summary.regions.toLocaleString() },
    { label: 'Mean width', value: `${Math.round(summary.meanRegionWidth).toLocaleString()} bp` },
  ];
  if (summary.nucleotides > 0) {
    items.push({ label: 'Nucleotides', value: summary.nucleotides.toLocaleString() });
  }
  if (summary.gcContent != null) {
    items.push({ label: 'GC content', value: `${(summary.gcContent * 100).toFixed(1)}%` });
  }
  if (summary.medianTssDist != null) {
    items.push({ label: 'Median TSS dist', value: `${Math.round(summary.medianTssDist).toLocaleString()} bp` });
  }
  if (summary.dataFormat) items.push({ label: 'Format', value: summary.dataFormat });
  if (summary.bedCompliance) items.push({ label: 'Compliance', value: summary.bedCompliance });

  return (
    <div className="grid grid-cols-1 @xl:grid-cols-3 @4xl:grid-cols-5 gap-2">
      {items.map((item) => (
        <div key={item.label} className="bg-base-200/50 rounded-lg px-3 py-2">
          <p className="text-xs text-base-content/40">{item.label}</p>
          <p className="text-sm font-medium text-base-content">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

// --- Upload header ---

function LocalHeader({ analysis }: { analysis: BedAnalysis }) {
  const { setBedFile } = useFile();
  const { openTab } = useTab();
  const [showGenomeModal, setShowGenomeModal] = useState(false);

  const bedFileData = useMemo(() => {
    if (analysis.chromosomeStats.length === 0) return undefined;
    const data: Record<string, number> = {};
    for (const row of analysis.chromosomeStats) {
      data[row.chromosome] = row.end;
    }
    return data;
  }, [analysis.chromosomeStats]);

  const { data: genomeStats, isLoading: genomeLoading } = useAnalyzeGenome(bedFileData);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
          <FileText size={18} className="text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-base-content truncate">{analysis.fileName}</p>
          <p className="text-xs text-base-content/40">
            {analysis.fileSize != null && formatBytes(analysis.fileSize)}
            {analysis.parseTime != null && ` · parsed in ${analysis.parseTime.toFixed(0)} ms`}
          </p>
        </div>
        <button
          onClick={() => openTab('umap', '')}
          title="View on UMAP"
          className="p-1 rounded hover:bg-base-300 transition-colors cursor-pointer ml-auto"
        >
          <ScatterChart size={16} className="text-base-content/40" />
        </button>
        <button
          onClick={() => { setBedFile(null); openTab('analysis'); }}
          title="Clear file"
          className="p-1 rounded hover:bg-base-300 transition-colors cursor-pointer"
        >
          <X size={16} className="text-base-content/40" />
        </button>
      </div>

      <StatsGrid analysis={analysis} />

      <div className="mt-6">
        {genomeStats ? (
          <GenomeSection
            genomeStats={genomeStats}
            showModal={showGenomeModal}
            onShowModal={setShowGenomeModal}
          />
        ) : genomeLoading ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide">
              Reference Genome
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-base-content/50 px-4 py-3">
              <Loader2 size={13} className="animate-spin" />
              Analyzing...
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function externalIdUrl(id: string, kind: 'sample' | 'experiment'): string | undefined {
  if (id.includes('geo:')) {
    return `https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${id.replace('geo:', '')}`;
  }
  if (id.includes('encode:')) {
    const accession = id.replace('encode:', '');
    return kind === 'sample'
      ? `https://www.encodeproject.org/files/${accession}`
      : `https://www.encodeproject.org/experiments/${accession}`;
  }
  return undefined;
}

// --- Inline copy ID ---

function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs font-mono text-base-content/30 hover:text-base-content/50 transition-colors cursor-pointer"
      title="Copy ID"
    >
      <span className="truncate">{id}</span>
      {copied ? <CheckCheck size={12} className="text-success shrink-0" /> : <Copy size={12} className="shrink-0" />}
    </button>
  );
}

// --- Reference genome section card ---

function GenomeSection({
  genomeAlias,
  genomeDigest,
  genomeStats,
  showModal,
  onShowModal,
}: {
  genomeAlias?: string;
  genomeDigest?: string;
  genomeStats?: import('../../bedbase-types').components['schemas']['RefGenValidReturnModel'];
  showModal: boolean;
  onShowModal: (v: boolean) => void;
}) {
  const sorted = genomeStats?.compared_genome
    ? [...genomeStats.compared_genome].sort(
        (a, b) =>
          a.tier_ranking - b.tier_ranking ||
          b.xs - a.xs ||
          (b.oobr ?? 0) - (a.oobr ?? 0) ||
          (b.sequence_fit ?? 0) - (a.sequence_fit ?? 0),
      )
    : [];
  const topMatch = sorted[0];

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide">
        Reference Genome
      </h3>
      <button
        onClick={sorted.length > 0 ? () => onShowModal(true) : undefined}
        className={`border rounded-lg px-4 py-3 w-full text-left flex flex-wrap @lg:flex-nowrap items-center gap-x-6 gap-y-1 transition-colors ${
          topMatch
            ? topMatch.tier_ranking === 1
              ? 'bg-success/10 border-success/30 hover:bg-success/15'
              : topMatch.tier_ranking === 2
                ? 'bg-warning/10 border-warning/30 hover:bg-warning/15'
                : topMatch.tier_ranking === 3
                  ? 'bg-warning/20 border-warning/40 hover:bg-warning/25'
                  : 'bg-error/10 border-error/30 hover:bg-error/15'
            : 'bg-white border-base-300'
        } ${sorted.length > 0 ? 'cursor-pointer' : ''}`}
      >
        <div className="flex items-center gap-2 shrink-0">
          <Dna size={16} className="text-primary" />
          <span className="text-sm font-semibold text-base-content">
            {genomeAlias || (topMatch ? <><span className="font-normal">Best match:</span> {topMatch.compared_genome}</> : 'Unknown')}
          </span>
        </div>
        {topMatch && (
          <>
            {genomeAlias && (
              <div className="hidden @lg:block text-xs text-base-content/50">
                Best match: <span className="font-medium text-base-content">{topMatch.compared_genome}</span>
              </div>
            )}
            <div className={`text-xs font-medium ${topMatch.tier_ranking === 1 ? 'text-success' : topMatch.tier_ranking === 2 ? 'text-warning' : 'text-error'}`}>
              Tier {topMatch.tier_ranking}
            </div>
            <div className="hidden @lg:flex items-center gap-4">
              {topMatch.xs != null && (
                <div className="text-xs text-base-content/50">
                  XS {(topMatch.xs * 100).toFixed(1)}%
                </div>
              )}
              {topMatch.oobr != null && (
                <div className="text-xs text-base-content/50">
                  OOBR {(topMatch.oobr * 100).toFixed(1)}%
                </div>
              )}
              {topMatch.sequence_fit != null && (
                <div className="text-xs text-base-content/50">
                  SF {(topMatch.sequence_fit * 100).toFixed(1)}%
                </div>
              )}
            </div>
          </>
        )}
        {sorted.length > 1 && (
          <span className="text-xs text-primary font-medium ml-auto shrink-0">
            +{sorted.length - 1} more
          </span>
        )}
      </button>
      {genomeStats && (
        <GenomeCompatModal
          open={showModal}
          onClose={() => onShowModal(false)}
          genomeStats={genomeStats}
        />
      )}
    </div>
  );
}

// --- Database header ---

function DatabaseHeader({ analysis }: { analysis: BedAnalysis }) {
  const { summary, metadata } = analysis;
  const [showGenomeModal, setShowGenomeModal] = useState(false);
  const { data: genomeStats } = useGenomeStats(analysis.id);

  // Stats table rows
  const statsRows: KvRow[] = [
    { label: 'Regions', value: summary.regions.toLocaleString() },
    { label: 'Mean width', value: `${Math.round(summary.meanRegionWidth).toLocaleString()} bp` },
  ];
  if (summary.nucleotides > 0) {
    statsRows.push({ label: 'Nucleotides', value: summary.nucleotides.toLocaleString() });
  }
  if (summary.gcContent != null) {
    statsRows.push({ label: 'GC content', value: `${(summary.gcContent * 100).toFixed(1)}%` });
  }
  if (summary.medianTssDist != null) {
    statsRows.push({ label: 'Median TSS dist', value: `${Math.round(summary.medianTssDist).toLocaleString()} bp` });
  }
  if (summary.dataFormat) statsRows.push({ label: 'Format', value: summary.dataFormat });
  if (summary.bedCompliance) statsRows.push({ label: 'Compliance', value: summary.bedCompliance });
  if (analysis.licenseId) statsRows.push({ label: 'License', value: analysis.licenseId });

  // Annotation table rows
  const annoRows: KvRow[] = [];
  if (metadata?.species) annoRows.push({ label: 'Species name', value: metadata.species });
  if (metadata?.speciesId) annoRows.push({ label: 'Species ID', value: metadata.speciesId });
  if (metadata?.cellLine) annoRows.push({ label: 'Cell line', value: metadata.cellLine });
  if (metadata?.cellType) annoRows.push({ label: 'Cell type', value: metadata.cellType });
  if (metadata?.tissue) annoRows.push({ label: 'Tissue', value: metadata.tissue });
  if (metadata?.assay) annoRows.push({ label: 'Assay', value: metadata.assay });
  if (metadata?.antibody) annoRows.push({ label: 'Antibody', value: metadata.antibody });
  if (metadata?.target) annoRows.push({ label: 'Target', value: metadata.target });
  if (metadata?.treatment) annoRows.push({ label: 'Treatment', value: metadata.treatment });
  if (metadata?.librarySource) annoRows.push({ label: 'Library source', value: metadata.librarySource });
  if (metadata?.globalSampleId) annoRows.push({ label: 'Global sample ID', value: metadata.globalSampleId, href: externalIdUrl(metadata.globalSampleId, 'sample') });
  if (metadata?.globalExperimentId) annoRows.push({ label: 'Global experiment ID', value: metadata.globalExperimentId, href: externalIdUrl(metadata.globalExperimentId, 'experiment') });
  if (metadata?.originalFileName) annoRows.push({ label: 'Original file name', value: metadata.originalFileName });

  return (
    <div className="space-y-5">
      <div className="flex flex-col @lg:flex-row @lg:items-start @lg:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-lg font-semibold text-base-content">
              {analysis.fileName || 'BED file'}
            </p>
            {analysis.id && <CopyableId id={analysis.id} />}
          </div>
          <p className="text-sm text-base-content/50 mt-1 leading-relaxed">
            {metadata?.description || <span className="text-base-content/30 italic">No description available</span>}
          </p>
        </div>
        <div className="shrink-0 flex flex-col @lg:items-end gap-1.5">
          <ActionBar analysis={analysis} />
          {(analysis.submissionDate || analysis.lastUpdateDate) && (
            <p className="text-[11px] text-base-content/30">
              {analysis.submissionDate && `Created: ${new Date(analysis.submissionDate).toLocaleDateString()}`}
              {analysis.submissionDate && analysis.lastUpdateDate && ' · '}
              {analysis.lastUpdateDate && `Updated: ${new Date(analysis.lastUpdateDate).toLocaleDateString()}`}
            </p>
          )}
        </div>
      </div>

      {/* <ComparisonStrip /> */}

      {/* Reference genome section card */}
      {(analysis.genomeAlias || genomeStats) && (
        <GenomeSection
          genomeAlias={analysis.genomeAlias}
          genomeDigest={analysis.genomeDigest}
          genomeStats={genomeStats ?? undefined}
          showModal={showGenomeModal}
          onShowModal={setShowGenomeModal}
        />
      )}

      <div className="grid grid-cols-1 @xl:grid-cols-2 gap-3">
        {annoRows.length > 0 && <KvTable title="Annotation" rows={annoRows} />}
        <KvTable title="Statistics" rows={statsRows} />
      </div>
    </div>
  );
}

// --- Header router ---

function AnalysisHeader({ analysis }: { analysis: BedAnalysis }) {
  if (analysis.source === 'local') return <LocalHeader analysis={analysis} />;
  return <DatabaseHeader analysis={analysis} />;
}

// --- Build plot slots from analysis data ---

function buildPlotSlots(analysis: BedAnalysis): PlotSlot[] {
  const slots: PlotSlot[] = [];

  // WASM-computed plots
  if (analysis.plots.regionDistribution) {
    const slot = regionDistributionSlot(analysis.plots.regionDistribution);
    if (slot) slots.push(slot);
  }

  // Server image plots
  if (analysis.serverPlots) {
    slots.push(...analysis.serverPlots);
  }

  return slots;
}

// --- Upload analysis view ---

function LocalAnalysis() {
  const { bedFile, parsing, parseError, parseProgress, analysis, analyzing, analysisProgress } = useFile();

  if (!bedFile) return <AnalysisEmpty />;

  if (parsing || analyzing || (!analysis && !parseError)) {
    const progress = parsing ? parseProgress * 0.5 : 0.5 + analysisProgress * 0.5;
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 gap-4 px-4">
        <div className="w-full max-w-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-base-content/50">
            <span>{parsing ? 'Parsing BED file...' : 'Analyzing regions...'}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-base-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-[width] duration-150 ease-out"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (parseError) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 gap-2">
        <p className="text-sm font-medium text-error">Failed to parse file</p>
        <p className="text-xs text-base-content/50 max-w-md text-center">{parseError}</p>
      </div>
    );
  }

  if (!analysis) return <AnalysisEmpty />;

  return <AnalysisPanels analysis={analysis} />;
}

// --- Database analysis view ---

function DatabaseAnalysis({ bedId }: { bedId: string }) {
  const { openTab } = useTab();
  const { data, isLoading, error, refetch } = useBedMetadata(bedId);

  const analysis = useMemo<BedAnalysis | null>(() => {
    if (!data) return null;
    return fromApiResponse(data);
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
        <Loader2 size={28} className="text-primary animate-spin" />
        <p className="text-sm text-base-content/50">Loading BED file metadata...</p>
      </div>
    );
  }

  if (error) {
    const is404 = (error as { response?: { status?: number } })?.response?.status === 404;
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
        <AlertCircle size={28} className={is404 ? 'text-base-content/30' : 'text-error'} />
        <p className="text-sm font-medium text-base-content">
          {is404 ? 'BED file not found' : 'Failed to load metadata'}
        </p>
        <p className="text-xs text-base-content/50 max-w-md text-center">
          {is404
            ? `No BED file with ID "${bedId}" exists in the database.`
            : String((error as Error).message || 'An unexpected error occurred.')}
        </p>
        <div className="flex gap-2 mt-1">
          {!is404 && (
            <button onClick={() => refetch()} className="btn btn-sm btn-outline">
              Retry
            </button>
          )}
          <button onClick={() => openTab('search')} className="btn btn-sm btn-ghost gap-1.5">
            <Search size={14} />
            Back to search
          </button>
        </div>
      </div>
    );
  }

  if (!analysis) return <AnalysisEmpty />;

  return <AnalysisPanels analysis={analysis} />;
}

// --- Shared panel layout ---

function AnalysisPanels({ analysis }: { analysis: BedAnalysis }) {
  const { openTab } = useTab();
  const plotSlots = useMemo(() => buildPlotSlots(analysis), [analysis]);
  const isDatabase = analysis.source === 'database';

  return (
    <div className="flex flex-col h-full overflow-auto p-4 @md:p-6">
      <button
        onClick={() => openTab('analysis')}
        className="inline-flex items-center gap-0.5 text-xs text-base-content/40 hover:text-base-content/60 transition-colors cursor-pointer w-fit mb-4"
      >
        <ChevronLeft size={14} />
        Analysis
      </button>
      <div className="space-y-6">
      <AnalysisHeader analysis={analysis} />

      {plotSlots.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide">
            Plots
          </h3>
          <PlotGallery plots={plotSlots} />
        </div>
      )}

      {analysis.chromosomeStats.length > 0 && (
        <ChromosomeStats rows={analysis.chromosomeStats} fileName={analysis.fileName ?? 'regions'} />
      )}

      {isDatabase && analysis.id && <SimilarFiles bedId={analysis.id} />}


      {analysis.bedsets && analysis.bedsets.length > 0 && (
        <BedsetMemberships bedsets={analysis.bedsets} />
      )}
      </div>
    </div>
  );
}

// --- Main entry point ---

export function AnalysisView({ param }: { param?: string }) {
  if (param === 'file') return <LocalAnalysis />;
  if (param?.startsWith('bed/')) return <DatabaseAnalysis bedId={param.slice(4)} />;
  return <AnalysisEmpty />;
}
