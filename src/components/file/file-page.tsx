import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FlaskConical, ScatterChart, FolderOpen, X, FileText, FileBarChart } from 'lucide-react';
import { useTab, type TabId } from '../../contexts/tab-context';
import { useFile } from '../../contexts/file-context';
import { tabMeta, tabColorClasses } from '../../lib/tab-meta';

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// --- Action cards ---

const actions: { id: TabId; param?: string; label: string; description: string; icon: typeof Search }[] = [
  {
    id: 'search',
    param: 'file',
    label: 'Find similar files',
    description: 'Search BEDbase for files with similar genomic regions and compare overlap scores.',
    icon: Search,
  },
  {
    id: 'analysis',
    param: 'file',
    label: 'Analyze in detail',
    description: 'View statistics, chromosome distributions, and genomic annotations for your regions.',
    icon: FlaskConical,
  },
  {
    id: 'umap',
    label: 'View in embedding space',
    description: 'See where this file falls relative to others on the UMAP embedding.',
    icon: ScatterChart,
  },
  {
    id: 'collections',
    label: 'Browse related sets',
    description: 'Find curated BEDsets this file may belong to, grouped by experiment or cell type.',
    icon: FolderOpen,
  },
];

function ActionCard({ action }: { action: (typeof actions)[number] }) {
  const { openTab, openSplit, activeTabs } = useTab();
  const colors = tabColorClasses[tabMeta[action.id].color];
  const Icon = action.icon;

  function handleClick() {
    const isSplit = activeTabs.length > 1;
    if (isSplit) {
      const fileIsRight = activeTabs[1]?.id === 'file';
      // Replace the file tab in whichever half it occupies
      openSplit(action.id, fileIsRight ? 'right' : 'left', action.param);
    } else {
      // File is fullscreen — replace it
      openTab(action.id, action.param);
    }
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-start gap-3 p-4 rounded-lg border border-base-300 hover:border-base-content/20 hover:bg-base-200/30 transition-colors cursor-pointer text-left"
    >
      <Icon size={18} className={`${colors.text} mt-0.5 shrink-0`} />
      <div>
        <h3 className="text-sm font-semibold text-base-content">{action.label}</h3>
        <p className="text-base-content/50 text-xs mt-0.5">{action.description}</p>
      </div>
    </button>
  );
}

// --- File preview ---

function FilePreview({ file, onClear }: { file: File; onClear: () => void }) {
  const { regionSet, parsing, parseProgress, parseError, parseTime } = useFile();

  return (
    <div className="w-full max-w-2xl border border-base-300 rounded-lg p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileText size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-base-content truncate">{file.name}</p>
          <p className="text-xs text-base-content/40">
            {formatBytes(file.size)}
            {!parsing && parseTime != null && ` · parsed in ${parseTime.toFixed(0)} ms`}
          </p>
        </div>
        <button
          onClick={onClear}
          className="p-1 rounded hover:bg-base-200 transition-colors cursor-pointer"
        >
          <X size={16} className="text-base-content/40" />
        </button>
      </div>

      {parsing ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-base-content/50">
            <span>Parsing {formatBytes(file.size)} file...</span>
            <span>{Math.round(parseProgress * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-base-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-[width] duration-150 ease-out"
              style={{ width: `${parseProgress * 100}%` }}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-base-200/50 rounded-lg p-3">
              <p className="text-xs text-base-content/40">Regions</p>
              <p className={`text-md font-medium ${regionSet ? 'text-base-content' : 'text-base-content/30'}`}>
                {regionSet ? formatNumber(regionSet.numberOfRegions) : '—'}
              </p>
            </div>
            <div className="bg-base-200/50 rounded-lg p-3">
              <p className="text-xs text-base-content/40">Mean width</p>
              <p className={`text-md font-medium ${regionSet ? 'text-base-content' : 'text-base-content/30'}`}>
                {regionSet ? `${formatNumber(Math.round(regionSet.meanRegionWidth))} bp` : '—'}
              </p>
            </div>
            <div className="bg-base-200/50 rounded-lg p-3">
              <p className="text-xs text-base-content/40">Nucleotides</p>
              <p className={`text-md font-medium ${regionSet ? 'text-base-content' : 'text-base-content/30'}`}>
                {regionSet ? formatNumber(regionSet.nucleotidesLength) : '—'}
              </p>
            </div>
          </div>
          {parseError && (
            <p className="text-xs text-error mt-3 text-center">{parseError}</p>
          )}
        </>
      )}
    </div>
  );
}

// --- File page ---

export function FilePage() {
  const { bedFile, setBedFile } = useFile();
  const { closeTab } = useTab();
  const navigate = useNavigate();

  useEffect(() => {
    if (!bedFile) navigate('/search', { replace: true });
  }, [bedFile, navigate]);

  if (!bedFile) return null;

  function handleClear() {
    setBedFile(null);
    closeTab('file');
  }

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      <div className="flex flex-col items-center text-center px-4 pt-16 pb-8">
        <FilePreview file={bedFile} onClear={handleClear} />
      </div>

      <div className="flex-1">
        <div className="px-4 md:px-6 pb-16">
          <p className="text-center text-sm text-base-content/50 mb-6">What do you want to do with this file?</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
            {actions.map((action) => (
              <ActionCard key={action.id} action={action} />
            ))}
          </div>
          <button
            onClick={() => navigate('/file/report')}
            className="flex items-start gap-3 p-4 mt-3 rounded-lg border border-base-300 hover:border-base-content/20 hover:bg-base-200/30 transition-colors cursor-pointer text-left max-w-3xl mx-auto w-full"
          >
            <FileBarChart size={18} className="text-primary mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-base-content">Generate analysis report</h3>
              <p className="text-base-content/50 text-xs mt-0.5">Run a comprehensive analysis pipeline on your file and generate a downloadable report with region statistics, chromosome distributions, genomic feature annotations, and similarity rankings.</p>
            </div>
          </button>
        </div>
      </div>

    </div>
  );
}
