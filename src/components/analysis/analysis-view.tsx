import { useMemo, useState } from 'react';
import { Loader2, FileText, AlertCircle, Search, Copy, CheckCheck, X, ChevronLeft } from 'lucide-react';
import { useFile } from '../../contexts/file-context';
import { useTab } from '../../contexts/tab-context';
import { fromRegionSet, fromApiResponse, type BedAnalysis } from '../../lib/bed-analysis';
import type { PlotSlot } from '../../lib/plot-specs';
import { regionDistributionSlot } from './plots/region-distribution';
import { useBedMetadata } from '../../queries/use-bed-metadata';
import { AnalysisEmpty } from './analysis-empty';
import { ChromosomeStats } from './chromosome-stats';
import { PlotGallery } from './plot-gallery';
import { SimilarFiles } from './similar-files';
import { BedsetMemberships } from './bedset-memberships';
import { ActionBar } from './action-bar';
import { ComparisonStrip } from './comparison-strip';

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
          onClick={() => { setBedFile(null); openTab('analysis'); }}
          title="Clear file"
          className="p-1 rounded hover:bg-base-300 transition-colors cursor-pointer ml-auto"
        >
          <X size={16} className="text-base-content/40" />
        </button>
      </div>

      <StatsGrid analysis={analysis} />
    </div>
  );
}

// --- Key-value table helper ---

function KvTable({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide">
        {title}
      </h3>
      <div className="overflow-x-auto border border-base-300 rounded-lg bg-white">
        <table className="table table-sm text-xs w-full">
          <tbody>
            {rows.map(({ label, value }) => (
              <tr key={label}>
                <td className="font-medium text-base-content/60 w-44">{label}</td>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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

// --- Database header ---

function DatabaseHeader({ analysis }: { analysis: BedAnalysis }) {
  const { summary, metadata } = analysis;

  // Stats table rows
  const statsRows: { label: string; value: string }[] = [
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
  const annoRows: { label: string; value: string }[] = [];
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
  if (metadata?.globalSampleId) annoRows.push({ label: 'Global sample ID', value: metadata.globalSampleId });
  if (metadata?.globalExperimentId) annoRows.push({ label: 'Global experiment ID', value: metadata.globalExperimentId });
  if (metadata?.originalFileName) annoRows.push({ label: 'Original file name', value: metadata.originalFileName });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-semibold text-base-content">
              {analysis.fileName || 'BED file'}
            </p>
            {analysis.id && <CopyableId id={analysis.id} />}
          </div>
          {metadata?.description && (
            <p className="text-sm text-base-content/50 mt-1 leading-relaxed">{metadata.description}</p>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
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

      <ComparisonStrip />

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
  const { bedFile, regionSet, parsing, parseError, parseTime } = useFile();

  const analysis = useMemo<BedAnalysis | null>(() => {
    if (!regionSet || !bedFile) return null;
    return fromRegionSet(regionSet, bedFile, parseTime);
  }, [regionSet, bedFile, parseTime]);

  if (!bedFile) return <AnalysisEmpty />;

  if (parsing) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
        <Loader2 size={28} className="text-success animate-spin" />
        <p className="text-sm text-base-content/50">Parsing BED file...</p>
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
  if (param) return <DatabaseAnalysis bedId={param} />;
  return <AnalysisEmpty />;
}
