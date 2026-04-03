import { Layers, ChevronRight, FolderOpen, GitCompareArrows } from 'lucide-react';
import { useTab } from '../../contexts/tab-context';
import { useBucket } from '../../contexts/bucket-context';
import { useFileSet } from '../../contexts/fileset-context';
import { useUploadedFiles } from '../../contexts/uploaded-files-context';
import { useBedsetList } from '../../queries/use-bedset-list';

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function CollectionsEmpty() {
  const { openTab } = useTab();
  const { bucketCount } = useBucket();
  const { cached } = useFileSet();
  const { files: uploadedFiles } = useUploadedFiles();
  const { setFiles: setCompareFiles } = useFileSet();
  const { data: sampleBedsets } = useBedsetList({ limit: 3 });

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 md:px-6 pt-12 pb-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-base-content mb-8 text-center">Collections</h2>

          <p className="text-base-content/50 text-sm text-center mb-3">
            Browse BEDset collections, or search for them in the <a href="/search?type=bedset" onClick={(e) => { e.preventDefault(); openTab('search', 'bedset:'); }} className="text-primary hover:underline cursor-pointer">Search</a> tab.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {sampleBedsets ? sampleBedsets.results.map((bs) => (
              <a
                key={bs.id}
                href={`/collections/bedset/${bs.id}`}
                onClick={(e) => { e.preventDefault(); openTab('collections', 'bedset/' + bs.id); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-base-300 hover:border-base-content/20 hover:bg-base-200/30 transition-colors cursor-pointer text-left"
              >
                <FolderOpen size={14} className="text-base-content/30 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-base-content truncate">{bs.name}</p>
                  <p className="text-[11px] text-base-content/40 truncate">
                    {[bs.bed_ids ? `${bs.bed_ids.length} files` : '', bs.description || ''].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </a>
            )) : (
              [0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-base-300 animate-pulse">
                  <div className="w-3.5 h-3.5 bg-base-300 rounded shrink-0" />
                  <div className="flex-1">
                    <div className="h-3 w-24 bg-base-300 rounded mb-1" />
                    <div className="h-2.5 w-16 bg-base-300 rounded" />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Your Selections & File comparison */}
          <div className="flex flex-col gap-2 mt-2">
            <button
              onClick={() => openTab('collections', 'selection')}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-base-300 hover:bg-base-200/30 transition-colors cursor-pointer text-left w-full"
            >
              <Layers size={16} className="text-secondary shrink-0" />
              <span className="text-sm text-base-content/70 flex-1">
                Browse saved UMAP selections
                {bucketCount > 0 && (
                  <span className="text-base-content/40 ml-1">({bucketCount})</span>
                )}
              </span>
              <ChevronRight size={14} className="text-base-content/30 shrink-0" />
            </button>

            {cached ? (
              <button
                onClick={() => openTab('collections', 'files')}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg border border-success/30 bg-success/5 hover:bg-success/10 hover:border-success/50 transition-colors cursor-pointer"
              >
                <div className="p-1.5 rounded-md bg-success/10">
                  <GitCompareArrows size={14} className="text-success" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-base-content">
                    {cached.fileNames.length} files compared
                  </p>
                  <p className="text-xs text-base-content/40">
                    {formatNumber(cached.result.fileStats.reduce((s, f) => s + f.regions, 0))} total regions
                  </p>
                </div>
                <ChevronRight size={14} className="text-base-content/30 shrink-0" />
              </button>
            ) : uploadedFiles.length >= 2 ? (
              <button
                onClick={() => {
                  setCompareFiles(uploadedFiles);
                  openTab('collections', 'files');
                }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg border border-success/30 bg-success/5 hover:bg-success/10 hover:border-success/50 transition-colors cursor-pointer"
              >
                <GitCompareArrows size={16} className="text-success shrink-0" />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-base-content">Compare {uploadedFiles.length} loaded files</p>
                  <p className="text-xs text-base-content/40">Run Jaccard similarity, consensus regions, and set operations</p>
                </div>
                <ChevronRight size={14} className="text-base-content/30 shrink-0" />
              </button>
            ) : null}
          </div>
        </div>

        {/* --- Overview section (wider) --- */}
        <div className="max-w-5xl mx-auto mt-16 space-y-12">
          <div>
            <h3 className="text-base font-semibold text-base-content mb-3">What is a BEDset?</h3>
            <p className="text-sm text-base-content/60 leading-relaxed mb-3">
              A BEDset is a curated collection of BED files grouped by a shared experiment, project, or biological interest. BEDbase automatically generates a BEDset for each GEO project (GSE), so all BED files from a single study are organized together. Users can also create custom BEDsets to group files across projects and data sources.
            </p>
            <p className="text-sm text-base-content/60 leading-relaxed">
              Each BEDset page shows aggregate statistics across its member files, making it easy to understand the scope and composition of a collection at a glance. BEDsets can be searched by name or identifier in the Search tab.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-base-content mb-3">Local collections</h3>
            <p className="text-sm text-base-content/60 leading-relaxed mb-3">
              You can also build collections locally from your own data. Select groups of files on the UMAP to save them as named selections, or load multiple BED files and compare them side by side with Jaccard similarity, consensus regions, and set operations.
            </p>
            <p className="text-sm text-base-content/60 leading-relaxed">
              Local collections are stored in your browser session and don't require an account. Use them to explore relationships between your files or to compare your data against BEDbase.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
