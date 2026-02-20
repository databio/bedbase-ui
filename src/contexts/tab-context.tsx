import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type TabId = 'file' | 'search' | 'analysis' | 'umap' | 'collections' | 'cart';

/** Provided by each tab panel so in-content navigation knows which tab it originated from. */
export const TabPanelContext = createContext<TabId | null>(null);

const TAB_IDS = new Set<string>(['file', 'search', 'analysis', 'umap', 'collections', 'cart']);

const tabBasePaths: Record<TabId, string> = {
  file: '/file',
  search: '/search',
  analysis: '/analysis',
  umap: '/umap',
  collections: '/collections',
  cart: '/cart',
};

export type ActiveTab = {
  id: TabId;
  param?: string; // e.g. bed file ID, search query, 'file'
};

function pathToActiveTab(pathname: string, search: string): ActiveTab | null {
  if (pathname.startsWith('/file')) return { id: 'file' };
  if (pathname.startsWith('/search')) {
    // 'file' stays as a path segment: /search/file
    const match = pathname.match(/^\/search\/(.+)/);
    if (match?.[1]) return { id: 'search', param: decodeURIComponent(match[1]) };
    // Text queries use ?q= param
    const q = new URLSearchParams(search).get('q');
    return { id: 'search', param: q || undefined };
  }
  if (pathname.startsWith('/analysis')) {
    const match = pathname.match(/^\/analysis\/(.+)/);
    return { id: 'analysis', param: match?.[1] };
  }
  if (pathname.startsWith('/umap')) {
    const bed = new URLSearchParams(search).get('bed');
    return { id: 'umap', param: bed || undefined };
  }
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

/** Returns just the path portion (no query string) */
function tabToPath(tab: ActiveTab): string {
  // Search text queries go in ?q=, only 'file' stays in the path
  if (tab.id === 'search') {
    return tab.param === 'file' ? '/search/file' : '/search';
  }
  // UMAP bed ID goes in ?bed= query param, not in the path
  if (tab.id === 'umap') return '/umap';
  const base = tabBasePaths[tab.id];
  return tab.param ? `${base}/${tab.param}` : base;
}

/** Builds a full URL with path + query params (?q= for search, ?split= for split tab) */
function buildUrl(primary: ActiveTab, split?: ActiveTab | null): string {
  const path = tabToPath(primary);
  const params = new URLSearchParams();

  // Search text queries go in ?q=
  if (primary.id === 'search' && primary.param && primary.param !== 'file') {
    params.set('q', primary.param);
  }

  // UMAP bed ID goes in ?bed= regardless of which panel it's in
  const umapTab = primary.id === 'umap' ? primary : split?.id === 'umap' ? split : null;
  if (umapTab?.param) {
    params.set('bed', umapTab.param);
  }

  if (split) {
    params.set('split', encodeSplitParam(split));
  }

  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

type TabContextValue = {
  activeTabs: ActiveTab[];
  openTab: (id: TabId, param?: string, source?: TabId) => void;
  openSplit: (id: TabId, side: 'left' | 'right', param?: string) => void;
  closeTab: (id: TabId) => void;
  closeAll: () => void;
};

const TabContext = createContext<TabContextValue | null>(null);

export function TabProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const primaryTab = useMemo(
    () => pathToActiveTab(location.pathname, location.search),
    [location.pathname, location.search],
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

  // Remember each tab's last param so switching back restores it
  const lastParams = useRef<Partial<Record<TabId, string>>>({});

  useEffect(() => {
    for (const tab of activeTabs) {
      if (tab.param) lastParams.current[tab.id] = tab.param;
    }
  }, [activeTabs]);

  const openTab = (id: TabId, param?: string, source?: TabId) => {
    window.scrollTo(0, 0);
    const existing = activeTabs.find((t) => t.id === id);

    // Empty string means "explicitly no param" — clear any saved state
    // undefined means "no preference" → restore last known param if tab not active
    const resolvedParam = param === '' ? undefined : (param ?? (existing ? undefined : lastParams.current[id]));
    if (param === '') delete lastParams.current[id];

    const target: ActiveTab = { id, param: resolvedParam };

    // Double-click reset: already on this tab with no param → clear saved state
    if (existing && !resolvedParam) {
      delete lastParams.current[id];
    }

    if (existing && existing.param === resolvedParam) return;

    if (splitTab) {
      if (id === primaryTab?.id) {
        // Updating param of the primary tab — keep split
        navigate(buildUrl(target, splitTab));
      } else if (id === splitTab.id) {
        // Updating param of the split tab — keep primary
        navigate(buildUrl(primaryTab!, target));
      } else if (param) {
        // Replace the panel that didn't originate the navigation, keep the one that did
        if (source === splitTab.id) {
          navigate(buildUrl(target, splitTab));
        } else {
          navigate(buildUrl(primaryTab!, target));
        }
      } else {
        // Navbar click (no param) — go fullscreen, drop the split
        navigate(buildUrl(target));
      }
    } else {
      navigate(buildUrl(target));
    }
  };

  const openSplit = (id: TabId, side: 'left' | 'right', param?: string) => {
    const resolvedParam = param ?? lastParams.current[id];
    const target: ActiveTab = { id, param: resolvedParam };
    if (!primaryTab) {
      navigate(buildUrl(target));
      return;
    }

    // Swap: dragging an active tab to the other side
    if (splitTab && target.id === splitTab.id && side === 'left') {
      navigate(buildUrl(splitTab, primaryTab));
      return;
    }
    if (splitTab && target.id === primaryTab.id && side === 'right') {
      navigate(buildUrl(splitTab, primaryTab));
      return;
    }

    // No-op if dropped on same side
    if (target.id === primaryTab.id || target.id === splitTab?.id) return;

    if (side === 'right') {
      // Keep primary (left), dragged replaces split (right)
      navigate(buildUrl(primaryTab, target));
    } else {
      // Dragged replaces primary (left), keep split or current primary as split (right)
      const keepRight = splitTab || primaryTab;
      navigate(buildUrl(target, keepRight));
    }
  };

  const closeTab = (id: TabId) => {
    if (id === primaryTab?.id && splitTab) {
      // Closing primary — promote split to primary
      navigate(buildUrl(splitTab));
    } else if (id === splitTab?.id) {
      // Closing split — keep primary
      navigate(buildUrl(primaryTab!));
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
  const panelTabId = useContext(TabPanelContext);
  if (!ctx) throw new Error('useTab must be used within a TabProvider');
  return {
    ...ctx,
    openTab: (id: TabId, param?: string) => ctx.openTab(id, param, panelTabId ?? undefined),
  };
}
