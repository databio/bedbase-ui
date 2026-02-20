import type { ActiveTab } from '../../contexts/tab-context';
import { tabMeta } from '../../lib/tab-meta';
import { AnalysisView } from '../analysis/analysis-view';
import { SearchView } from '../search/search-view';
import { FilePage } from '../file/file-page';
import { CollectionsView } from '../collections/collections-view';
import { CartView } from '../cart/cart-view';

function PlaceholderTab({ tab }: { tab: ActiveTab }) {
  const meta = tabMeta[tab.id];
  return (
    <div className="flex flex-col items-center justify-center flex-1">
      <h2 className="text-2xl font-bold text-base-content">{meta.label}</h2>
      {tab.param && (
        <p className="text-base-content/80 mt-1 font-mono text-sm">{tab.param}</p>
      )}
      <p className="text-base-content/60 mt-2">Coming soon</p>
    </div>
  );
}

export function TabContent({ tab }: { tab: ActiveTab }) {
  if (tab.id === 'file') return <FilePage />;
  if (tab.id === 'search') return <SearchView param={tab.param} />;
  if (tab.id === 'analysis') return <AnalysisView param={tab.param} />;
  if (tab.id === 'umap') return null; // Rendered via portal in app-layout
  if (tab.id === 'collections') return <CollectionsView param={tab.param} />;
  if (tab.id === 'cart') return <CartView />;
  return <PlaceholderTab tab={tab} />;
}
