import type { ActiveTab, TabId } from '../../contexts/tab-context';
import { tabMeta } from '../../lib/tab-meta';
import { AnalysisView } from '../analysis/analysis-view';

const tabPhase: Record<TabId, string> = {
  search: 'Phase 4',
  analysis: 'Phase 3',
  umap: 'Phase 5',
  collections: 'Phase 7',
  cart: 'Phase 8',
};

function PlaceholderTab({ tab }: { tab: ActiveTab }) {
  const meta = tabMeta[tab.id];
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-64">
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
  if (tab.id === 'analysis') return <AnalysisView param={tab.param} />;
  return <PlaceholderTab tab={tab} />;
}
