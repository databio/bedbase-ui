import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type TabId = 'search' | 'analysis' | 'umap' | 'collections' | 'cart';

const TAB_IDS = new Set<string>(['search', 'analysis', 'umap', 'collections', 'cart']);

const tabBasePaths: Record<TabId, string> = {
  search: '/search',
  analysis: '/analysis',
  umap: '/umap',
  collections: '/collections',
  cart: '/cart',
};

export type ActiveTab = {
  id: TabId;
  param?: string; // e.g. bed file ID, bedset ID
};

function pathToActiveTab(pathname: string): ActiveTab | null {
  if (pathname.startsWith('/search')) return { id: 'search' };
  if (pathname.startsWith('/analysis')) {
    const match = pathname.match(/^\/analysis\/(.+)/);
    return { id: 'analysis', param: match?.[1] };
  }
  if (pathname.startsWith('/umap')) return { id: 'umap' };
  if (pathname.startsWith('/collections')) {
    const match = pathname.match(/^\/collections\/(.+)/);
    return { id: 'collections', param: match?.[1] };
  }
  if (pathname.startsWith('/cart')) return { id: 'cart' };
  return null; // "/" is the hub
}

function parseSplitParam(value: string): ActiveTab | null {
  // "umap" or "analysis:bed123"
  const colonIdx = value.indexOf(':');
  if (colonIdx === -1) {
    return TAB_IDS.has(value) ? { id: value as TabId } : null;
  }
  const tabId = value.slice(0, colonIdx);
  const param = value.slice(colonIdx + 1);
  return TAB_IDS.has(tabId) ? { id: tabId as TabId, param: param || undefined } : null;
}

function encodeSplitParam(tab: ActiveTab): string {
  return tab.param ? `${tab.id}:${tab.param}` : tab.id;
}

function tabToPath(tab: ActiveTab): string {
  const base = tabBasePaths[tab.id];
  return tab.param ? `${base}/${tab.param}` : base;
}

type TabContextValue = {
  activeTabs: ActiveTab[];
  openTab: (id: TabId, param?: string) => void;
  openSplit: (id: TabId, side: 'left' | 'right', param?: string) => void;
  closeTab: (id: TabId) => void;
  closeAll: () => void;
};

const TabContext = createContext<TabContextValue | null>(null);

export function TabProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const primaryTab = useMemo(
    () => pathToActiveTab(location.pathname),
    [location.pathname],
  );

  const splitRaw = new URLSearchParams(location.search).get('split');
  const splitTab = useMemo(() => {
    if (!splitRaw) return null;
    const parsed = parseSplitParam(splitRaw);
    return parsed && parsed.id !== primaryTab?.id ? parsed : null;
  }, [splitRaw, primaryTab?.id]);

  const activeTabs = useMemo(() => {
    const tabs: ActiveTab[] = [];
    if (primaryTab) tabs.push(primaryTab);
    if (splitTab) tabs.push(splitTab);
    return tabs;
  }, [primaryTab, splitTab]);

  const openTab = (id: TabId, param?: string) => {
    const target: ActiveTab = { id, param };
    const existing = activeTabs.find((t) => t.id === id);
    if (existing && existing.param === param) return;

    // Navigate to the tab (opens it or updates its param)
    navigate(tabToPath(target));
  };

  const openSplit = (id: TabId, side: 'left' | 'right', param?: string) => {
    const target: ActiveTab = { id, param };
    if (!primaryTab) {
      navigate(tabToPath(target));
      return;
    }

    // Swap: dragging an active tab to the other side
    if (splitTab && target.id === splitTab.id && side === 'left') {
      navigate(`${tabToPath(splitTab)}?split=${encodeSplitParam(primaryTab)}`);
      return;
    }
    if (splitTab && target.id === primaryTab.id && side === 'right') {
      navigate(`${tabToPath(splitTab)}?split=${encodeSplitParam(primaryTab)}`);
      return;
    }

    // No-op if dropped on same side
    if (target.id === primaryTab.id || target.id === splitTab?.id) return;

    if (side === 'right') {
      // Keep primary (left), dragged replaces split (right)
      navigate(`${location.pathname}?split=${encodeSplitParam(target)}`);
    } else {
      // Dragged replaces primary (left), keep split or current primary as split (right)
      const keepRight = splitTab || primaryTab;
      navigate(`${tabToPath(target)}?split=${encodeSplitParam(keepRight)}`);
    }
  };

  const closeTab = (id: TabId) => {
    if (id === primaryTab?.id && splitTab) {
      // Closing primary — promote split to primary
      navigate(tabToPath(splitTab));
    } else if (id === splitTab?.id) {
      // Closing split — keep primary, drop ?split=
      const params = new URLSearchParams(location.search);
      params.delete('split');
      const paramStr = params.toString();
      navigate(paramStr ? `${location.pathname}?${paramStr}` : location.pathname);
    } else {
      // Closing only tab — back to hub
      navigate('/');
    }
  };

  const closeAll = () => navigate('/');

  const value: TabContextValue = { activeTabs, openTab, openSplit, closeTab, closeAll };

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

export function useTab() {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error('useTab must be used within a TabProvider');
  return ctx;
}
