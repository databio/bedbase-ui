import { useMemo } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { useFile } from '../../contexts/file-context';
import { fromRegionSet, type BedAnalysis } from '../../lib/bed-analysis';
import type { PlotSlot } from '../../lib/plot-specs';
import { regionDistributionSlot } from './plots/region-distribution';
import { AnalysisEmpty } from './analysis-empty';
import { ChromosomeStats } from './chromosome-stats';
import { PlotGallery } from './plot-gallery';

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
    { label: 'Nucleotides', value: summary.nucleotides.toLocaleString() },
  ];
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

function UploadHeader({ analysis }: { analysis: BedAnalysis }) {
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
      </div>

      <StatsGrid analysis={analysis} />
    </div>
  );
}

// --- Database header (stub for Phase 4) ---

function DatabaseHeader({ analysis }: { analysis: BedAnalysis }) {
  const { summary, metadata } = analysis;

  const badges: string[] = [];
  if (metadata?.species) badges.push(metadata.species);
  if (summary.dataFormat) badges.push(summary.dataFormat);
  if (summary.bedCompliance) badges.push(summary.bedCompliance);

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-baseline gap-2">
          <p className="text-sm font-medium text-base-content">
            {metadata?.description ? analysis.fileName : analysis.fileName ?? 'BED file'}
          </p>
          {analysis.id && (
            <span className="text-xs font-mono text-base-content/30 truncate">{analysis.id}</span>
          )}
        </div>
        {metadata?.description && (
          <p className="text-xs text-base-content/50 mt-1 leading-relaxed">{metadata.description}</p>
        )}
      </div>

      <StatsGrid analysis={analysis} />

      {badges.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {badges.map((b) => (
            <span key={b} className="badge badge-sm badge-outline text-base-content/60">{b}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Header router ---

function AnalysisHeader({ analysis }: { analysis: BedAnalysis }) {
  if (analysis.source === 'upload') return <UploadHeader analysis={analysis} />;
  return <DatabaseHeader analysis={analysis} />;
}

// --- Build plot slots from analysis data ---

function buildPlotSlots(analysis: BedAnalysis): PlotSlot[] {
  const slots: PlotSlot[] = [];
  const { plots } = analysis;

  if (plots.regionDistribution) {
    const slot = regionDistributionSlot(plots.regionDistribution);
    if (slot) slots.push(slot);
  }

  // Future: import and call each plot's slot builder
  // if (plots.gcContent) { const s = gcContentSlot(plots.gcContent); if (s) slots.push(s); }

  return slots;
}

// --- Upload analysis view ---

function UploadAnalysis() {
  const { uploadedFile, regionSet, parsing, parseError, parseTime } = useFile();

  const analysis = useMemo<BedAnalysis | null>(() => {
    if (!regionSet || !uploadedFile) return null;
    return fromRegionSet(regionSet, uploadedFile, parseTime);
  }, [regionSet, uploadedFile, parseTime]);

  if (!uploadedFile) return <AnalysisEmpty />;

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

// --- Shared panel layout ---

function AnalysisPanels({ analysis }: { analysis: BedAnalysis }) {
  const plotSlots = useMemo(() => buildPlotSlots(analysis), [analysis]);

  return (
    <div className="flex-1 overflow-auto p-4 @md:p-6 space-y-4">
      <AnalysisHeader analysis={analysis} />
      <PlotGallery plots={plotSlots} />
      {analysis.chromosomeStats.length > 0 && (
        <ChromosomeStats rows={analysis.chromosomeStats} fileName={analysis.fileName ?? 'regions'} />
      )}
    </div>
  );
}

// --- Main entry point ---

export function AnalysisView({ param }: { param?: string }) {
  if (param === 'upload') return <UploadAnalysis />;

  // Future: if param is a bed file ID, fetch from API
  return <AnalysisEmpty />;
}
