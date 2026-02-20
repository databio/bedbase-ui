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

function buildTitle(tab: ActiveTab): string {
  const { id, param } = tab;
  if (id === 'analysis' && param?.startsWith('bed/'))
    return `BEDbase | ${param.slice(4)}`;
  if (id === 'search' && param && param !== 'file')
    return `BEDbase | Search: ${param}`;
  if (id === 'collections' && param?.startsWith('bedset/'))
    return `BEDbase | ${param.slice(7)}`;
  return `BEDbase | ${tabMeta[id].label}`;
}

export function TabContent({ tab }: { tab: ActiveTab }) {
  let content: React.ReactNode;
  if (tab.id === 'file') content = <FilePage />;
  else if (tab.id === 'search') content = <SearchView param={tab.param} />;
  else if (tab.id === 'analysis') content = <AnalysisView param={tab.param} />;
  else if (tab.id === 'umap') content = null; // Rendered via portal in app-layout
  else if (tab.id === 'collections') content = <CollectionsView param={tab.param} />;
  else if (tab.id === 'cart') content = <CartView />;
  else content = <PlaceholderTab tab={tab} />;

  return (
    <>
      <title>{buildTitle(tab)}</title>
      {content}
    </>
  );
}
