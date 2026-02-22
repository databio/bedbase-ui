import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, RefreshCw, ExternalLink, Code } from 'lucide-react';
import { API_BASE } from '../../lib/file-model-utils';
import { useStats } from '../../queries/use-stats';
import { useDetailedStats } from '../../queries/use-detailed-stats';
import { useDetailedUsage } from '../../queries/use-detailed-usage';
import { barSpec, histogramSpec, waffleSpec, timeBarSpec } from '../../lib/metrics-specs';
import { PlotGallery } from '../analysis/plot-gallery';
import type { PlotSlot } from '../../lib/plot-specs';
import type { components } from '../../bedbase-types';

type BinValues = components['schemas']['BinValues'];
type Section = 'files' | 'usage' | 'geo';
type ChartKind = 'bar' | 'pie' | 'histogram' | 'timebar';

type ChartInfo = {
  title: string;
  kind: ChartKind;
  data: Record<string, number> | BinValues;
};

const sections: { id: Section; label: string; description: string }[] = [
  { id: 'files', label: 'File Statistics', description: 'Breakdown of BED files by genome, assay, organism, and format.' },
  { id: 'usage', label: 'Usage', description: 'Most viewed files, popular search terms, and download activity.' },
  { id: 'geo', label: 'GEO', description: 'BED files sourced from NCBI Gene Expression Omnibus, by year and size.' },
];

const sectionEndpoints: Record<Section, { label: string; path: string }[]> = {
  files: [
    { label: 'Summary stats', path: '/stats' },
    { label: 'File stats', path: '/detailed-stats?concise=true' },
  ],
  usage: [
    { label: 'Usage stats', path: '/detailed-usage' },
  ],
  geo: [
    { label: 'File stats', path: '/detailed-stats?concise=true' },
  ],
};

// --- Shared components ---

function EndpointsDropdown({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const endpoints = sectionEndpoints[section];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-2 text-sm font-medium gap-1 inline-flex items-center text-base-content/40 hover:text-base-content/70 transition-colors cursor-pointer"
      >
        <Code size={13} />
        API
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-base-100 border border-base-300 rounded-lg shadow-lg py-1 min-w-80">
          {endpoints.map((ep) => (
            <a
              key={ep.label}
              href={`${API_BASE}${ep.path}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs hover:bg-base-200 transition-colors"
            >
              <span className="text-base-content/70 whitespace-nowrap">{ep.label}</span>
              <span className="font-mono text-base-content/40 flex items-center gap-1 truncate">
                {ep.path} <ExternalLink size={10} />
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function chartToSlot(chart: ChartInfo): PlotSlot {
  const spec = (() => {
    switch (chart.kind) {
      case 'bar': return barSpec(chart.data as Record<string, number>);
      case 'pie': return waffleSpec(chart.data as Record<string, number>);
      case 'histogram': return histogramSpec(chart.data as BinValues);
      case 'timebar': return timeBarSpec(chart.data as Record<string, number>);
    }
  })();

  return {
    id: chart.title,
    title: chart.title,
    type: 'observable',
    renderThumbnail: spec.thumbnail,
    render: spec.full,
    ...(spec.variants ? { variants: spec.variants } : {}),
    ...(spec.defaultVariant != null ? { defaultVariant: spec.defaultVariant } : {}),
  };
}

function ChartGroup({ label, charts }: { label: string; charts: ChartInfo[] }) {
  if (charts.length === 0) return null;
  const slots = charts.map(chartToSlot);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">{label}</h3>
      <PlotGallery plots={slots} />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 @3xl:grid-cols-4 gap-2">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="border border-base-300 rounded-lg overflow-hidden">
          <div className="aspect-square p-4">
            <div className="w-full h-full bg-base-300/30 rounded animate-pulse" />
          </div>
          <div className="px-3 py-2 border-t border-base-300 bg-base-200/50 flex justify-center">
            <div className="h-3 w-24 bg-base-300 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function hasData(obj: Record<string, number>): boolean {
  return Object.keys(obj).length > 0;
}

// --- Page ---

const SECTION_IDS = new Set<string>(sections.map((s) => s.id));

function parseSection(value: string | null): Section {
  return value && SECTION_IDS.has(value) ? (value as Section) : 'files';
}

export function MetricsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = parseSection(searchParams.get('section'));
  const setActiveSection = useCallback(
    (section: Section) => setSearchParams(section === 'files' ? {} : { section }, { replace: true }),
    [setSearchParams],
  );
  const { data: summary } = useStats();
  const { data: fileStats, isLoading: fileLoading, error: fileError, refetch: fileRefetch } = useDetailedStats();
  const { data: usage, isLoading: usageLoading, error: usageError, refetch: usageRefetch } = useDetailedUsage();

  const isLoading = activeSection === 'files' || activeSection === 'geo' ? fileLoading : usageLoading;
  const error = activeSection === 'files' || activeSection === 'geo' ? fileError : usageError;
  const refetch = activeSection === 'files' || activeSection === 'geo' ? fileRefetch : usageRefetch;
  const activeMeta = sections.find((s) => s.id === activeSection)!;

  return (
    <div className="@container flex-1 overflow-auto flex flex-col">
      <div className="p-4 @md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-bold text-base-content">Metrics</h2>
          {summary && (
            <span className="text-xs text-base-content/50">
              {summary.bedfiles_number.toLocaleString()} beds · {summary.bedsets_number.toLocaleString()} bedsets · {summary.genomes_number.toLocaleString()} genomes
            </span>
          )}
        </div>

        {/* Section tabs + API */}
        <div className="space-y-1">
          <div className="flex items-center border-b border-base-300">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`px-3 py-2 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
                  activeSection === s.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-base-content/40 hover:text-base-content/70'
                }`}
              >
                {s.label}
              </button>
            ))}
            <div className="ml-auto -mb-px">
              <EndpointsDropdown section={activeSection} />
            </div>
          </div>
          <p className="text-sm text-base-content/40 pt-1">{activeMeta.description}</p>
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

// --- Section chart builders ---

function FileCharts({ data }: { data: NonNullable<ReturnType<typeof useDetailedStats>['data']> }) {
  const breakdowns: ChartInfo[] = [];
  if (hasData(data.file_genome)) breakdowns.push({ title: 'Files by genome', kind: 'bar', data: data.file_genome });
  if (hasData(data.file_assay)) breakdowns.push({ title: 'Files by assay', kind: 'bar', data: data.file_assay });
  if (hasData(data.file_organism)) breakdowns.push({ title: 'Files by organism', kind: 'bar', data: data.file_organism });
  if (hasData(data.bed_compliance)) breakdowns.push({ title: 'BED compliance', kind: 'bar', data: data.bed_compliance });
  if (hasData(data.geo_status)) breakdowns.push({ title: 'GEO status', kind: 'bar', data: data.geo_status });
  if (hasData(data.data_format)) breakdowns.push({ title: 'Data format', kind: 'pie', data: data.data_format });
  if (hasData(data.bed_comments)) breakdowns.push({ title: 'BED comments', kind: 'pie', data: data.bed_comments });

  const distributions: ChartInfo[] = [];
  if (data.file_size) distributions.push({ title: 'File size distribution', kind: 'histogram', data: data.file_size });
  if (data.number_of_regions) distributions.push({ title: 'Region count distribution', kind: 'histogram', data: data.number_of_regions });
  if (data.mean_region_width) distributions.push({ title: 'Mean region width distribution', kind: 'histogram', data: data.mean_region_width });

  return (
    <div className="space-y-8">
      <ChartGroup label="Breakdowns" charts={breakdowns} />
      <ChartGroup label="Distributions" charts={distributions} />
    </div>
  );
}

function UsageCharts({ data }: { data: NonNullable<ReturnType<typeof useDetailedUsage>['data']> }) {
  const charts: ChartInfo[] = [];
  if (hasData(data.bed_metadata)) charts.push({ title: 'Most viewed BED files', kind: 'bar', data: data.bed_metadata });
  if (hasData(data.bed_search_terms)) charts.push({ title: 'Top BED search terms', kind: 'bar', data: data.bed_search_terms });
  if (hasData(data.bedset_metadata)) charts.push({ title: 'Most viewed BEDsets', kind: 'bar', data: data.bedset_metadata });
  if (hasData(data.bedset_search_terms)) charts.push({ title: 'Top BEDset search terms', kind: 'bar', data: data.bedset_search_terms });
  if (hasData(data.bed_downloads)) charts.push({ title: 'Most downloaded BED files', kind: 'bar', data: data.bed_downloads });
  return <ChartGroup label="Activity" charts={charts} />;
}

function GeoCharts({ data }: { data: NonNullable<ReturnType<typeof useDetailedStats>['data']> }) {
  const geo = data.geo;
  const timelines: ChartInfo[] = [];
  if (hasData(geo.number_of_files)) timelines.push({ title: 'GEO files by year', kind: 'timebar', data: geo.number_of_files });
  if (hasData(geo.cumulative_number_of_files)) timelines.push({ title: 'Cumulative GEO files', kind: 'timebar', data: geo.cumulative_number_of_files });

  const distributions: ChartInfo[] = [];
  if (geo.file_sizes) distributions.push({ title: 'GEO file size distribution', kind: 'histogram', data: geo.file_sizes });

  return (
    <div className="space-y-8">
      <ChartGroup label="Timelines" charts={timelines} />
      <ChartGroup label="Distributions" charts={distributions} />
    </div>
  );
}
