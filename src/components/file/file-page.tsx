import { useRef, useState } from 'react';
import { Search, FlaskConical, ScatterChart, FolderOpen, X, FileText, Upload, GitCompareArrows, Plus } from 'lucide-react';
import { useTab, type TabId } from '../../contexts/tab-context';
import { useFile } from '../../contexts/file-context';
import { useUploadedFiles } from '../../contexts/uploaded-files-context';
import { useFileSet } from '../../contexts/fileset-context';
import { tabMeta, tabColorClasses } from '../../lib/tab-meta';
import { RelatedBedsetsModal } from './related-bedsets-modal';

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

// --- Drop zone ---

function DropZone({ onFiles, multiple, compact }: { onFiles: (files: File[]) => void; multiple?: boolean; compact?: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <>
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
        className={`flex flex-col items-center justify-center w-full rounded-lg border-2 border-dashed transition-colors cursor-pointer gap-2 ${
          compact ? 'h-20' : 'max-w-xl h-32'
        } ${
          isDragOver ? 'border-secondary bg-secondary/10' : 'border-secondary/30 bg-secondary/5 hover:bg-secondary/10 hover:border-secondary/50'
        }`}
      >
        <div className="flex items-center gap-2">
          {compact ? <Plus size={14} className="text-secondary" /> : <Upload size={16} className="text-secondary" />}
          <span className={`font-medium text-base-content ${compact ? 'text-xs' : 'text-sm'}`}>
            {compact ? 'Add more files' : `Drop BED file${multiple ? 's' : ''} here or click to browse`}
          </span>
        </div>
        {!compact && (
          <span className="text-xs text-base-content/40">.bed and .bed.gz files supported</span>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept=".bed,.gz"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFiles(Array.from(e.target.files));
          }
          e.target.value = '';
        }}
      />
    </>
  );
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
        className="p-0.5 rounded hover:bg-base-300 transition-colors cursor-pointer shrink-0"
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

// --- Empty state ---

function FileEmpty() {
  const { setBedFile } = useFile();
  const { addFiles, setActiveIndex } = useUploadedFiles();

  function handleFiles(files: File[]) {
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

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex flex-col items-center px-4 md:px-6 pt-12 pb-10">
        <h2 className="text-2xl font-bold text-base-content mb-1">Upload BED files</h2>
        <p className="text-base-content/50 text-sm max-w-md text-center mb-8">
          Analyze, search for similar files, compare multiple files, or view in the embedding space.
        </p>
        <DropZone onFiles={handleFiles} multiple />
      </div>
    </div>
  );
}

// --- File page ---

export function FilePage() {
  const { bedFile, setBedFile } = useFile();
  const { regionSet, parsing, parseProgress, parseError, parseTime } = useFile();
  const { files, addFiles, removeFile, setActiveIndex, clearAll } = useUploadedFiles();
  const { setFiles: setCompareFiles } = useFileSet();
  const { openTab } = useTab();
  const [showRelatedSets, setShowRelatedSets] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

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
          <div className="grid gap-6 grid-cols-[minmax(180px,300px)_1fr]">

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
                onClick={() => addInputRef.current?.click()}
                className="flex items-center gap-1.5 mt-2 px-3 py-1.5 w-full rounded-md text-xs text-secondary/70 hover:text-secondary hover:bg-secondary/5 transition-colors cursor-pointer"
              >
                <Plus size={12} />
                <span>Add files</span>
              </button>
              <input
                ref={addInputRef}
                type="file"
                multiple
                accept=".bed,.gz"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) handleAddFiles(Array.from(e.target.files));
                  e.target.value = '';
                }}
              />

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
                  <h2 className="text-lg font-semibold text-base-content truncate">{bedFile.name}</h2>
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
