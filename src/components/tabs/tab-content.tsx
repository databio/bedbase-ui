import type { ActiveTab, TabId } from '../../contexts/tab-context';
import { tabMeta } from '../../lib/tab-meta';
import { AnalysisView } from '../analysis/analysis-view';
import { SearchView } from '../search/search-view';
import { FilePage } from '../file/file-page';

const tabPhase: Record<TabId, string> = {
  file: 'Phase 2',
  search: 'Phase 3',
  analysis: 'Phase 4',
  umap: 'Phase 5',
  collections: 'Phase 6',
  cart: 'Phase 6',
};

function PlaceholderTab({ tab }: { tab: ActiveTab }) {
  const meta = tabMeta[tab.id];
  return (
    <div className="flex flex-col items-center justify-center flex-1">
      <h2 className="text-2xl font-bold text-base-content">{meta.label}</h2>
      {tab.param && (
        <p className="text-base-content/80 mt-1 font-mono text-sm">{tab.param}</p>
      )}
      <p className="text-base-content/60 mt-2">
        Content goes here ({tabPhase[tab.id]})
      </p>
    </div>
  );
}

export function TabContent({ tab }: { tab: ActiveTab }) {
  if (tab.id === 'file') return <FilePage />;
  if (tab.id === 'search') return <SearchView param={tab.param} />;
  if (tab.id === 'analysis') return <AnalysisView param={tab.param} />;
  return <PlaceholderTab tab={tab} />;
}
