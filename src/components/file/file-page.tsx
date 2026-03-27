import { useRef, useState } from 'react';
import { Search, FlaskConical, ScatterChart, FolderOpen, X, FileText, Upload, GitCompareArrows, Plus, FileBarChart, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTab, type TabId } from '../../contexts/tab-context';
import { useFile } from '../../contexts/file-context';
import { useUploadedFiles } from '../../contexts/uploaded-files-context';
import { useFileSet } from '../../contexts/fileset-context';
import { tabMeta, tabColorClasses } from '../../lib/tab-meta';
import { RelatedBedsetsModal } from './related-bedsets-modal';
import { useFileReport } from './file-report';
import { defaultReportConfig, type ReportConfig } from './report-export';

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function fileKey(f: File): string {
  return `${f.name}|${f.size}|${f.lastModified}`;
}

// --- File list row ---

function FileRow({ file, isActive, onActivate, onRemove }: {
  file: File;
  isActive: boolean;
  onActivate: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      onClick={onActivate}
      className={`group/row flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
        isActive
          ? 'bg-primary/10'
          : 'hover:bg-base-200/50'
      }`}
    >
      <FileText size={12} className={isActive ? 'text-primary shrink-0' : 'text-base-content/30 shrink-0'} />
      <span className={`text-xs truncate flex-1 ${isActive ? 'font-medium text-base-content' : 'text-base-content/60'}`}>{file.name}</span>
      <span className="text-[11px] text-base-content/30 shrink-0">{formatBytes(file.size)}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="opacity-0 group-hover/row:opacity-100 transition-opacity cursor-pointer shrink-0"
      >
        <X size={10} className="text-base-content/30 hover:text-base-content/60" />
      </button>
    </div>
  );
}

// --- Action cards ---

const actions: { id: TabId; param?: string; label: string; description: string; icon: typeof Search }[] = [
  {
    id: 'search',
    param: 'file',
    label: 'Find similar files',
    description: 'Search BEDbase for files with similar genomic regions.',
    icon: Search,
  },
  {
    id: 'analysis',
    param: 'file',
    label: 'Analyze in detail',
    description: 'Statistics, distributions, and genomic annotations.',
    icon: FlaskConical,
  },
  {
    id: 'umap',
    label: 'View in embedding space',
    description: 'See where this file falls on the UMAP.',
    icon: ScatterChart,
  },
  {
    id: 'collections',
    label: 'Browse related sets',
    description: 'Find BEDsets this file may belong to.',
    icon: FolderOpen,
  },
];

function ActionCard({ action, onClickOverride }: { action: (typeof actions)[number]; onClickOverride?: () => void }) {
  const { openTab, openSplit, activeTabs } = useTab();
  const colors = tabColorClasses[tabMeta[action.id].color];
  const Icon = action.icon;

  function handleClick() {
    if (onClickOverride) {
      onClickOverride();
      return;
    }
    const isSplit = activeTabs.length > 1;
    if (isSplit) {
      const fileIsRight = activeTabs[1]?.id === 'file';
      openSplit(action.id, fileIsRight ? 'right' : 'left', action.param);
    } else {
      openTab(action.id, action.param);
    }
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-start gap-3 p-3 rounded-lg border border-base-300 hover:border-base-content/20 hover:bg-base-200/30 transition-colors cursor-pointer text-left"
    >
      <Icon size={18} className={`${colors.text} mt-0.5 shrink-0`} />
      <div>
        <h3 className="text-sm font-semibold text-base-content">{action.label}</h3>
        <p className="text-base-content/50 text-xs mt-0.5">{action.description}</p>
      </div>
    </button>
  );
}

// --- Fetch BED from URL ---

async function fetchBedFromUrl(input: string): Promise<File> {
  const trimmed = input.trim();
  // 32-char hex string → BEDbase ID shortcut
  const isBedbaseId = /^[0-9a-f]{32}$/i.test(trimmed);
  const url = isBedbaseId
    ? `https://api.bedbase.org/v1/files/files/${trimmed[0]}/${trimmed[1]}/${trimmed}.bed.gz`
    : trimmed;

  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    throw new Error('URL must start with http:// or https://');
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();
  const fileName = url.split('/').pop()?.split('?')[0] || 'remote.bed';
  return new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
}

// --- Inline add files panel (drop zone + URL input) ---

function AddFilesInline({ onFiles }: { onFiles: (files: File[]) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [url, setUrl] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  async function handleUrlSubmit() {
    if (!url.trim()) return;
    setUrlLoading(true);
    setUrlError(null);
    try {
      const file = await fetchBedFromUrl(url);
      onFiles([file]);
      setUrl('');
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Failed to fetch URL');
    } finally {
      setUrlLoading(false);
    }
  }

  return (
    <div className="mt-2">
      {/* Drop zone (top) */}
      <button
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length > 0) onFiles(files);
        }}
        className={`flex flex-col items-center justify-center w-full h-20 rounded-t-md border-[1.5px] border-dashed border-b-0 transition-colors cursor-pointer gap-1 ${
          isDragOver ? 'border-secondary bg-secondary/10' : 'border-secondary/30 bg-secondary/5 hover:bg-secondary/10 hover:border-secondary/50'
        }`}
      >
        <Upload size={14} className="text-secondary" />
        <span className="text-xs font-medium text-base-content/60">Drop files or click to browse</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".bed,.gz"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
      />

      {/* URL input (bottom, attached) */}
      <div className="flex items-center gap-1.5 border-[1.5px] border-solid border-secondary/30 rounded-b-md px-2.5 py-1.5">
        <input
          type="text"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setUrlError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit(); }}
          placeholder="or paste a URL..."
          disabled={urlLoading}
          className="flex-1 bg-transparent outline-none text-xs text-base-content placeholder:text-base-content/30"
        />
        {url.trim() && (
          <button
            onClick={handleUrlSubmit}
            disabled={urlLoading || !url.trim()}
            className="text-secondary hover:text-secondary/80 disabled:opacity-40 cursor-pointer"
          >
            {urlLoading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          </button>
        )}
      </div>
      {urlError && <p className="text-xs text-error mt-1 px-1">{urlError}</p>}
    </div>
  );
}

// --- Empty state ---

function FileEmpty() {
  const { setBedFile } = useFile();
  const { addFiles, setActiveIndex } = useUploadedFiles();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [url, setUrl] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  function handleFiles(files: File[]) {
    for (const f of files) {
      if (f.size > 250 * 1024 * 1024) {
        toast.warning(`${f.name} is large (${formatBytes(f.size)}). Parsing may be slow in the browser.`);
      }
    }
    addFiles(files);
    const first = files.find((f) => {
      const name = f.name.toLowerCase();
      return name.endsWith('.bed') || name.endsWith('.bed.gz');
    });
    if (first) {
      setBedFile(first);
      setActiveIndex(0);
    }
  }

  async function handleUrlSubmit() {
    if (!url.trim()) return;
    setUrlLoading(true);
    setUrlError(null);
    try {
      const file = await fetchBedFromUrl(url);
      handleFiles([file]);
      setUrl('');
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Failed to fetch URL');
    } finally {
      setUrlLoading(false);
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex flex-col items-center px-4 md:px-6 pt-12 pb-10">
        <h2 className="text-2xl font-bold text-base-content mb-1">Upload BED files</h2>
        <p className="text-base-content/50 text-sm max-w-md text-center mb-8">
          Analyze, search for similar files, compare multiple files, or view in the embedding space. Up to 15 files.
        </p>

        <div className="w-full max-w-xl">
          {/* Drop zone (top) */}
          <button
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              handleFiles(Array.from(e.dataTransfer.files));
            }}
            className={`flex flex-col items-center justify-center w-full h-32 rounded-t-lg border-[1.5px] border-dashed border-b-0 transition-colors cursor-pointer gap-2 ${
              isDragOver ? 'border-secondary bg-secondary/10' : 'border-secondary/30 bg-secondary/5 hover:bg-secondary/10 hover:border-secondary/50'
            }`}
          >
            <Upload size={16} className="text-secondary" />
            <span className="text-sm font-medium text-base-content">Drop BED files here or click to browse</span>
            <span className="text-xs text-base-content/40">.bed and .bed.gz files supported</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".bed,.gz"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) handleFiles(Array.from(e.target.files));
              e.target.value = '';
            }}
          />

          {/* URL input (bottom, attached) */}
          <div className="flex items-center gap-2 border-[1.5px] border-solid border-secondary/30 rounded-b-lg px-3 py-2.5">
            <input
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit(); }}
              placeholder="Paste a URL to a BED file..."
              disabled={urlLoading}
              className="flex-1 bg-transparent outline-none text-sm text-base-content placeholder:text-base-content/40"
            />
            <button
              onClick={handleUrlSubmit}
              disabled={urlLoading || !url.trim()}
              className="btn btn-secondary btn-sm disabled:opacity-40"
            >
              {urlLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            </button>
          </div>

          {urlError && <p className="text-xs text-error mt-1.5 px-1">{urlError}</p>}
          <p className="text-xs text-base-content/30 mt-1.5 px-1">
            Paste a direct link to a .bed or .bed.gz file.{' '}
            Try:{' '}
            <button
              onClick={() => {
                setUrl('https://api.bedbase.org/v1/files/files/d/c/dcc005e8761ad5599545cc538f6a2a4d.bed.gz');
                setUrlError(null);
              }}
              className="text-secondary/60 hover:text-secondary hover:underline cursor-pointer"
            >
              example BED file
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// --- File page ---

export function FilePage() {
  const { bedFile, setBedFile } = useFile();
  const { regionSet, parsing, parseProgress, parseError, parseTime, analyzing } = useFile();
  const { files, addFiles, removeFile, setActiveIndex, clearAll } = useUploadedFiles();
  const { setFiles: setCompareFiles } = useFileSet();
  const { openTab } = useTab();
  const [showRelatedSets, setShowRelatedSets] = useState(false);
  const [showAddFiles, setShowAddFiles] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reportConfig, setReportConfig] = useState<ReportConfig>({ ...defaultReportConfig });
  const { handleOpenReport, handleDownload, ready: reportReady } = useFileReport();

  async function onDownload() {
    setDownloading(true);
    try { await handleDownload(reportConfig); } finally { setDownloading(false); }
  }

  if (files.length === 0) return <FileEmpty />;

  const activeKey = bedFile ? fileKey(bedFile) : null;
  const isMulti = files.length > 1;

  function activateFile(file: File, index: number) {
    setBedFile(file);
    setActiveIndex(index);
  }

  function handleRemove(index: number) {
    const removingActive = activeKey !== null && fileKey(files[index]) === activeKey;
    removeFile(index);
    if (removingActive) {
      const remaining = files.filter((_, i) => i !== index);
      if (remaining.length > 0) {
        const nextIdx = Math.min(index, remaining.length - 1);
        setBedFile(remaining[nextIdx]);
      } else {
        setBedFile(null);
      }
    }
  }

  function handleClearAll() {
    clearAll();
    setBedFile(null);
  }

  function handleCompare() {
    setCompareFiles(files);
    openTab('collections', 'files');
  }

  function handleAddFiles(newFiles: File[]) {
    for (const f of newFiles) {
      if (f.size > 250 * 1024 * 1024) {
        toast.warning(`${f.name} is large (${formatBytes(f.size)}). Parsing may be slow in the browser.`);
      }
    }
    addFiles(newFiles);
    if (!bedFile) {
      const first = newFiles.find((f) => {
        const name = f.name.toLowerCase();
        return name.endsWith('.bed') || name.endsWith('.bed.gz');
      });
      if (first) {
        setBedFile(first);
        setActiveIndex(files.length);
      }
    }
  }

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      <div className="px-4 md:px-6 pt-10 pb-10">
        <div className="mx-auto">
          <div className="grid gap-6 grid-cols-[minmax(220px,350px)_1fr]">

            {/* Left column: file list */}
            <div className="border border-base-300 rounded-lg p-3 self-start">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">
                  {isMulti ? `${files.length} Files` : 'File'}
                </span>
                <button
                  onClick={isMulti ? handleClearAll : () => handleRemove(0)}
                  className="text-[11px] text-base-content/30 hover:text-error transition-colors cursor-pointer"
                >
                  {isMulti ? 'Clear all' : 'Remove'}
                </button>
              </div>

              {/* File rows */}
              <div className="flex flex-col gap-0.5">
                {files.map((file, i) => (
                  <FileRow
                    key={fileKey(file)}
                    file={file}
                    isActive={isMulti ? activeKey === fileKey(file) : true}
                    onActivate={() => activateFile(file, i)}
                    onRemove={() => handleRemove(i)}
                  />
                ))}
              </div>

              {/* Add more */}
              <button
                onClick={() => setShowAddFiles(!showAddFiles)}
                className={`flex items-center gap-1.5 mt-2 px-3 py-1.5 w-full rounded-md text-xs transition-colors cursor-pointer ${
                  showAddFiles ? 'text-secondary bg-secondary/5' : 'text-secondary/70 hover:text-secondary hover:bg-secondary/5'
                }`}
              >
                <Plus size={12} className={`transition-transform ${showAddFiles ? 'rotate-45' : ''}`} />
                <span>Add files</span>
              </button>

              {showAddFiles && <AddFilesInline onFiles={handleAddFiles} />}

              {/* Compare action */}
              {isMulti && (
                <button
                  onClick={handleCompare}
                  className="flex items-center gap-2 mt-2 px-3 py-2 w-full rounded-md border border-success/30 bg-success/5 hover:bg-success/10 hover:border-success/50 transition-colors cursor-pointer"
                >
                  <GitCompareArrows size={12} className="text-success shrink-0" />
                  <span className="text-xs font-medium text-base-content">Compare {files.length} files</span>
                </button>
              )}
            </div>

            {/* Right column: detail + actions */}
            {bedFile ? (
              <div>
                {/* File name + stats */}
                <div className="mb-6">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-base-content truncate">{bedFile.name}</h2>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">Active</span>
                  </div>
                  <p className="text-xs text-base-content/40 mt-0.5">
                    {formatBytes(bedFile.size)}
                    {!parsing && parseTime != null && ` · parsed in ${parseTime.toFixed(0)} ms`}
                  </p>

                  {parsing ? (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs text-base-content/50">
                        <span>Parsing...</span>
                        <span>{Math.round(parseProgress * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-base-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-[width] duration-150 ease-out"
                          style={{ width: `${parseProgress * 100}%` }}
                        />
                      </div>
                    </div>
                  ) : regionSet && (
                    <div className="grid grid-cols-3 gap-2.5 mt-4">
                      <div className="bg-base-200/50 rounded-lg px-3 py-2.5">
                        <p className="text-[11px] text-base-content/40 mb-0.5">Regions</p>
                        <p className="text-sm font-medium text-base-content">{formatNumber(regionSet.numberOfRegions)}</p>
                      </div>
                      <div className="bg-base-200/50 rounded-lg px-3 py-2.5">
                        <p className="text-[11px] text-base-content/40 mb-0.5">Mean width</p>
                        <p className="text-sm font-medium text-base-content">{formatNumber(Math.round(regionSet.meanRegionWidth))} bp</p>
                      </div>
                      <div className="bg-base-200/50 rounded-lg px-3 py-2.5">
                        <p className="text-[11px] text-base-content/40 mb-0.5">Nucleotides</p>
                        <p className="text-sm font-medium text-base-content">{formatNumber(regionSet.nucleotidesLength)}</p>
                      </div>
                    </div>
                  )}
                  {parseError && (
                    <p className="text-xs text-error mt-2">{parseError}</p>
                  )}
                </div>

                {/* Action cards */}
                <h3 className="text-base font-semibold text-base-content mb-3">What do you want to do with this file?</h3>
                <div className="grid grid-cols-2 gap-2">
                  {actions.map((action) => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      onClickOverride={action.id === 'collections' ? () => setShowRelatedSets(true) : undefined}
                    />
                  ))}


                  {/* Report card */}
                  <div className={`col-span-2 border border-base-300 rounded-lg p-3 space-y-3 ${parsing || analyzing || !reportReady ? 'opacity-40 pointer-events-none' : ''}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <FileBarChart size={16} className="text-primary" />
                        <h3 className="text-sm font-semibold text-base-content">Generate comprehensive report</h3>
                      </div>
                      <p className="text-xs text-base-content/50 mt-0.5 ml-6">Create a printable report or download plots and data.</p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {([
                        ['summary', 'Summary stats', 'Regions, widths, nucleotides, format'],
                        ['plots', 'Distribution plots', 'Chromosome counts, widths, neighbor distances'],
                        ['refPlots', 'Reference plots', 'TSS distance, genomic partitions, enrichment'],
                        ['umap', 'UMAP embedding', 'Static scatter colored by assay category'],
                        ['chromosomeStats', 'Chromosome table', 'Per-chromosome region statistics'],
                      ] as const).map(([key, label, desc]) => (
                        <label key={key} className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={reportConfig[key]}
                            onChange={(e) => setReportConfig((prev) => ({ ...prev, [key]: e.target.checked }))}
                            className="checkbox checkbox-xs checkbox-primary mt-2.5"
                          />
                          <div>
                            <span className="text-xs font-medium text-base-content">{label}</span>
                            <p className="text-[11px] text-base-content/40 leading-tight">{desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleOpenReport(reportConfig)}
                        className="btn btn-sm btn-primary gap-1.5"
                      >
                        <FileBarChart size={14} />
                        Open report
                      </button>
                      <button
                        onClick={onDownload}
                        disabled={downloading}
                        className="btn btn-sm btn-ghost gap-1.5"
                      >
                        {downloading
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Download size={14} />}
                        Download plots and data
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center text-sm text-base-content/40">
                Select a file to see details
              </div>
            )}
          </div>
        </div>
      </div>

      {showRelatedSets && (
        <RelatedBedsetsModal
          file={bedFile ?? undefined}
          onClose={() => setShowRelatedSets(false)}
        />
      )}

    </div>
  );
}
