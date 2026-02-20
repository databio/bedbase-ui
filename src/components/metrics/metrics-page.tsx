import { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { useStats } from '../../queries/use-stats';
import { useDetailedStats } from '../../queries/use-detailed-stats';
import { useDetailedUsage } from '../../queries/use-detailed-usage';
import { barSpec, histogramSpec, pieSpec, timeBarSpec } from '../../lib/metrics-specs';
import { VegaChart } from './vega-chart';
import type { components } from '../../bedbase-types';

type BinValues = components['schemas']['BinValues'];
type Section = 'files' | 'usage' | 'geo';
type ChartKind = 'bar' | 'pie' | 'histogram' | 'timebar';

type ChartInfo = {
  title: string;
  kind: ChartKind;
  data: Record<string, number> | BinValues;
};

const sections: { id: Section; label: string }[] = [
  { id: 'files', label: 'File Statistics' },
  { id: 'usage', label: 'Usage Statistics' },
  { id: 'geo', label: 'GEO Statistics' },
];

function buildSpec(kind: ChartKind, data: Record<string, number> | BinValues, title: string): Record<string, unknown> {
  switch (kind) {
    case 'bar': return barSpec(data as Record<string, number>, { title });
    case 'pie': return pieSpec(data as Record<string, number>, { title });
    case 'histogram': return histogramSpec(data as BinValues, { title });
    case 'timebar': return timeBarSpec(data as Record<string, number>, { title });
  }
}

const canToggle = (kind: ChartKind): boolean => kind === 'bar' || kind === 'pie';

function ChartCard({ chart, onClick }: { chart: ChartInfo; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="border border-base-300 rounded-lg p-4 text-left hover:border-base-content/20 transition-colors cursor-pointer"
    >
      <h4 className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2">{chart.title}</h4>
      <VegaChart spec={buildSpec(chart.kind, chart.data, chart.title)} />
    </button>
  );
}

function ChartModal({ chart, onClose }: { chart: ChartInfo; onClose: () => void }) {
  const toggle = canToggle(chart.kind);
  const [kind, setKind] = useState(chart.kind);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-base-100 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
          <h3 className="text-sm font-semibold text-base-content">{chart.title}</h3>
          <div className="flex items-center gap-2">
            {toggle && (
              <select
                className="select select-xs border border-base-300"
                value={kind}
                onChange={(e) => setKind(e.target.value as ChartKind)}
              >
                <option value="bar">Bar chart</option>
                <option value="pie">Pie chart</option>
              </select>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-base-200 transition-colors cursor-pointer">
              <X size={16} className="text-base-content/50" />
            </button>
          </div>
        </div>
        <div className="p-4">
          <VegaChart spec={buildSpec(kind, chart.data, chart.title)} />
        </div>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="border border-base-300 rounded-lg p-4 animate-pulse">
          <div className="h-3 w-32 bg-base-300/80 rounded mb-4" />
          <div className="h-48 bg-base-200 rounded" />
        </div>
      ))}
    </div>
  );
}

function hasData(obj: Record<string, number>): boolean {
  return Object.keys(obj).length > 0;
}

function ChartGrid({ charts }: { charts: ChartInfo[] }) {
  const [expanded, setExpanded] = useState<ChartInfo | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {charts.map((chart) => (
          <ChartCard key={chart.title} chart={chart} onClick={() => setExpanded(chart)} />
        ))}
      </div>
      {expanded && <ChartModal chart={expanded} onClose={() => setExpanded(null)} />}
    </>
  );
}

export function MetricsPage() {
  const [activeSection, setActiveSection] = useState<Section>('files');
  const { data: summary } = useStats();
  const { data: fileStats, isLoading: fileLoading, error: fileError, refetch: fileRefetch } = useDetailedStats();
  const { data: usage, isLoading: usageLoading, error: usageError, refetch: usageRefetch } = useDetailedUsage();

  const isLoading = activeSection === 'files' || activeSection === 'geo' ? fileLoading : usageLoading;
  const error = activeSection === 'files' || activeSection === 'geo' ? fileError : usageError;
  const refetch = activeSection === 'files' || activeSection === 'geo' ? fileRefetch : usageRefetch;

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      <div className="p-4 @md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-xl font-bold text-base-content">BEDbase Metrics</h2>
          {summary && (
            <div className="flex items-center gap-2">
              <span className="badge badge-sm badge-primary">{summary.bedfiles_number?.toLocaleString()} beds</span>
              <span className="badge badge-sm badge-secondary">{summary.bedsets_number?.toLocaleString()} bedsets</span>
              <span className="badge badge-sm badge-accent">{summary.genomes_number?.toLocaleString()} genomes</span>
            </div>
          )}
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`btn btn-sm ${activeSection === s.id ? 'btn-primary' : 'btn-ghost'}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <SkeletonGrid />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle size={24} className="text-error" />
            <p className="text-sm text-error">Failed to load metrics.</p>
            <button onClick={() => refetch()} className="btn btn-sm btn-ghost gap-1">
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : (
          <>
            {activeSection === 'files' && fileStats && <FileCharts data={fileStats} />}
            {activeSection === 'usage' && usage && <UsageCharts data={usage} />}
            {activeSection === 'geo' && fileStats && <GeoCharts data={fileStats} />}
          </>
        )}
      </div>
    </div>
  );
}

function FileCharts({ data }: { data: NonNullable<ReturnType<typeof useDetailedStats>['data']> }) {
  const charts: ChartInfo[] = [];
  if (hasData(data.file_genome)) charts.push({ title: 'Files by genome', kind: 'bar', data: data.file_genome });
  if (hasData(data.file_assay)) charts.push({ title: 'Files by assay', kind: 'bar', data: data.file_assay });
  if (hasData(data.file_organism)) charts.push({ title: 'Files by organism', kind: 'bar', data: data.file_organism });
  if (hasData(data.bed_compliance)) charts.push({ title: 'BED compliance', kind: 'bar', data: data.bed_compliance });
  if (hasData(data.geo_status)) charts.push({ title: 'GEO status', kind: 'bar', data: data.geo_status });
  if (hasData(data.data_format)) charts.push({ title: 'Data format', kind: 'pie', data: data.data_format });
  if (hasData(data.bed_comments)) charts.push({ title: 'BED comments', kind: 'pie', data: data.bed_comments });
  if (data.file_size) charts.push({ title: 'File size distribution', kind: 'histogram', data: data.file_size });
  if (data.number_of_regions) charts.push({ title: 'Region count distribution', kind: 'histogram', data: data.number_of_regions });
  if (data.mean_region_width) charts.push({ title: 'Mean region width distribution', kind: 'histogram', data: data.mean_region_width });
  return <ChartGrid charts={charts} />;
}

function UsageCharts({ data }: { data: NonNullable<ReturnType<typeof useDetailedUsage>['data']> }) {
  const charts: ChartInfo[] = [];
  if (hasData(data.bed_metadata)) charts.push({ title: 'Most viewed BED files', kind: 'bar', data: data.bed_metadata });
  if (hasData(data.bed_search_terms)) charts.push({ title: 'Top BED search terms', kind: 'bar', data: data.bed_search_terms });
  if (hasData(data.bedset_metadata)) charts.push({ title: 'Most viewed BEDsets', kind: 'bar', data: data.bedset_metadata });
  if (hasData(data.bedset_search_terms)) charts.push({ title: 'Top BEDset search terms', kind: 'bar', data: data.bedset_search_terms });
  if (hasData(data.bed_downloads)) charts.push({ title: 'Most downloaded BED files', kind: 'bar', data: data.bed_downloads });
  return <ChartGrid charts={charts} />;
}

function GeoCharts({ data }: { data: NonNullable<ReturnType<typeof useDetailedStats>['data']> }) {
  const geo = data.geo;
  const charts: ChartInfo[] = [];
  if (hasData(geo.number_of_files)) charts.push({ title: 'GEO files by year', kind: 'timebar', data: geo.number_of_files });
  if (hasData(geo.cumulative_number_of_files)) charts.push({ title: 'Cumulative GEO files', kind: 'timebar', data: geo.cumulative_number_of_files });
  if (geo.file_sizes) charts.push({ title: 'GEO file size distribution', kind: 'histogram', data: geo.file_sizes });
  return <ChartGrid charts={charts} />;
}
