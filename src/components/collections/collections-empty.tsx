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
      <div className="px-4 md:px-6 pt-12 pb-10">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-base-content mb-1 text-center">Collections</h2>
          <p className="text-base-content/50 text-sm max-w-md mx-auto text-center mb-8">
            Browse BEDset collections and manage your saved UMAP selections.
            Search for BEDsets in the <a href="/search" onClick={(e) => { e.preventDefault(); openTab('search'); }} className="text-primary hover:underline cursor-pointer">Search</a> tab.
            Upload files in the <a href="/upload" onClick={(e) => { e.preventDefault(); openTab('file'); }} className="text-primary hover:underline cursor-pointer">Upload</a> tab.
          </p>

          {/* Sample bedsets */}
          <h3 className="text-sm font-semibold text-base-content mb-4 text-center">Browse a BEDset:</h3>
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

          {/* Your Selections */}
          <h3 className="text-sm font-semibold text-base-content mb-4 mt-10 text-center">Your selections:</h3>
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

          {/* Uploaded files comparison prompt or cached result */}
          {(cached || uploadedFiles.length >= 2) && (
            <>
              <h3 className="text-sm font-semibold text-base-content mb-4 mt-10 text-center">File comparison:</h3>
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
              ) : (
                <button
                  onClick={() => {
                    setCompareFiles(uploadedFiles);
                    openTab('collections', 'files');
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg border border-success/30 bg-success/5 hover:bg-success/10 hover:border-success/50 transition-colors cursor-pointer"
                >
                  <GitCompareArrows size={16} className="text-success shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-base-content">Compare {uploadedFiles.length} uploaded files</p>
                    <p className="text-xs text-base-content/40">Run Jaccard similarity, consensus regions, and set operations</p>
                  </div>
                  <ChevronRight size={14} className="text-base-content/30 shrink-0" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
