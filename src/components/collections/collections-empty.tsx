import { useState } from 'react';
import { Globe, Layers, Search, ChevronRight, FolderOpen, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTab } from '../../contexts/tab-context';
import { useBucket } from '../../contexts/bucket-context';
import { useStats } from '../../queries/use-stats';
import { useBedsetList } from '../../queries/use-bedset-list';

export function CollectionsEmpty() {
  const [searchQuery, setSearchQuery] = useState('');
  const { openTab } = useTab();
  const navigate = useNavigate();
  const { bucketCount } = useBucket();
  const { data: stats } = useStats();
  const { data: sampleBedsets } = useBedsetList({ limit: 3 });

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 md:px-6 pt-12 pb-10">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-base-content mb-1 text-center">Collections</h2>
          <p className="text-base-content/50 text-sm max-w-md mx-auto text-center mb-8">
            Explore collections of BED files with BEDsets and manage your saved selections from the UMAP embeddings.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* BEDsets card */}
            <div className="flex flex-col rounded-lg border border-base-300 overflow-hidden">
              <div className="flex-1 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <Globe size={14} className="text-primary" />
                  </div>
                  <p className="text-sm font-medium text-base-content">BEDsets</p>
                </div>
                <ul className="space-y-1 text-xs text-base-content/50 list-disc list-inside">
                  <li>Curated collections of BED files</li>
                  <li>{stats ? `${stats.bedsets_number.toLocaleString()} BEDsets` : 'Browse BEDsets'} with aggregate statistics</li>
                  <li>Rich metadata — author, source, submission date</li>
                </ul>
              </div>
              <div className="border-t border-base-300">
              <div className="flex items-center gap-3 px-4 h-11 bg-primary/5">
                <Search size={16} className="text-base-content/30 shrink-0" />
                <input
                  type="text"
                  placeholder="Search BEDsets..."
                  className="flex-1 bg-transparent outline-none text-sm text-base-content placeholder:text-base-content/50 p-0 m-0 border-0 min-h-0"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      navigate('/collections/bedset' + (searchQuery.trim() ? '?q=' + encodeURIComponent(searchQuery.trim()) : ''));
                    }
                  }}
                />
                {searchQuery.trim() && (
                  <button
                    onClick={() => navigate('/collections/bedset?q=' + encodeURIComponent(searchQuery.trim()))}
                    className="p-1 rounded cursor-pointer transition-colors"
                  >
                    <ArrowRight size={14} className="text-primary" />
                  </button>
                )}
              </div>
              </div>
            </div>

            {/* Your Selections card */}
            <div className="flex flex-col rounded-lg border border-base-300 overflow-hidden">
              <div className="flex-1 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-md bg-secondary/10">
                    <Layers size={14} className="text-secondary" />
                  </div>
                  <p className="text-sm font-medium text-base-content">Your Selections</p>
                </div>
                <ul className="space-y-1 text-xs text-base-content/50 list-disc list-inside">
                  <li>Saved from UMAP embedding explorations</li>
                  <li>Stored locally in your browser</li>
                  <li>Aggregate analyses coming soon</li>
                </ul>
              </div>
              <div className="border-t border-base-300">
                <button
                  onClick={() => openTab('collections', 'selection')}
                  className="flex items-center gap-3 px-4 h-11 bg-secondary/5 hover:bg-secondary/10 transition-colors cursor-pointer text-left w-full"
                >
                  <Layers size={16} className="text-base-content/30 shrink-0" />
                  <span className="text-sm text-base-content/50 flex-1">
                    Browse selections
                    {bucketCount > 0 && (
                      <span className="text-base-content/30 ml-1">({bucketCount})</span>
                    )}
                  </span>
                  <ChevronRight size={14} className="text-base-content/30" />
                </button>
              </div>
            </div>
          </div>

          {/* Sample bedsets */}
          <h3 className="text-sm font-semibold text-base-content mb-4 mt-10 text-center">Browse a BEDset:</h3>
          <div className="grid grid-cols-3 gap-2">
            {sampleBedsets ? sampleBedsets.results.map((bs) => (
              <button
                key={bs.id}
                onClick={() => openTab('collections', 'bedset/' + bs.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-base-300 hover:border-base-content/20 hover:bg-base-200/30 transition-colors cursor-pointer text-left"
              >
                <FolderOpen size={14} className="text-base-content/30 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-base-content truncate">{bs.name}</p>
                  <p className="text-[11px] text-base-content/40 truncate">
                    {[bs.bed_ids ? `${bs.bed_ids.length} files` : '', bs.description || ''].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </button>
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

        </div>
      </div>
    </div>
  );
}
