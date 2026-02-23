import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFile } from '../../contexts/file-context';
import { useTab, TabPanelContext, type TabId } from '../../contexts/tab-context';
import { useCart } from '../../contexts/cart-context';
import { tabMeta, tabIds, tabColorClasses } from '../../lib/tab-meta';
import { Hub } from '../hub/hub';
import { TabContent } from '../tabs/tab-content';
import { ReportPage } from '../report/report-page';
import { MetricsPage } from '../metrics/metrics-page';
import { UmapView } from '../umap/umap-view';
import { Footer } from './footer';

export function AppLayout() {
  const { activeTabs, openTab, openSplit, closeTab } = useTab();
  const { bedFile } = useFile();
  const { cartCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [dragOverSide, setDragOverSide] = useState<'left' | 'right' | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const primaryId = activeTabs[0]?.id;
  const splitId = activeTabs[1]?.id;
  const isSplit = activeTabs.length > 1;

  // Portal-based UMAP: once opened, never unmount (DuckDB WASM init is slow)
  // A single UmapView is rendered into a stable container via createPortal.
  // The container is moved between layout slots (full-screen / split panels)
  // so the component is never remounted when switching layouts.
  const umapEverOpened = useRef(false);
  const isUmapPrimary = primaryId === 'umap';
  const isUmapSplit = splitId === 'umap';
  const isUmapVisible = isUmapPrimary || isUmapSplit;
  if (isUmapVisible) umapEverOpened.current = true;

  const umapContainerRef = useRef<HTMLDivElement | null>(null);
  if (umapEverOpened.current && !umapContainerRef.current) {
    umapContainerRef.current = document.createElement('div');
    umapContainerRef.current.style.display = 'contents';
  }

  const umapSlotRef = useCallback((node: HTMLDivElement | null) => {
    const container = umapContainerRef.current;
    if (node && container) {
      node.appendChild(container);
    }
  }, []);

  function handleDragStart(e: React.DragEvent, tabId: string) {
    e.dataTransfer.setData('text/plain', tabId);
    e.dataTransfer.effectAllowed = 'move';

    // Custom drag image: clone with opaque bg so rounded corners look clean
    const el = e.currentTarget as HTMLElement;
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.top = '-9999px';
    wrapper.style.left = '-9999px';
    wrapper.style.background = 'transparent';
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.backgroundColor = 'rgba(229, 231, 235, 0.5)';
    clone.style.color = '#1f2937';
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);
    e.dataTransfer.setDragImage(clone, el.offsetWidth / 2, el.offsetHeight / 2);
    requestAnimationFrame(() => wrapper.remove());

    setIsDragging(true);
  }

  function handleDragEnd() {
    setIsDragging(false);
    setDragOverSide(null);
  }

  function handleDrop(e: React.DragEvent, side: 'left' | 'right') {
    e.preventDefault();
    const tabId = e.dataTransfer.getData('text/plain') as TabId;
    if (tabId) {
      openSplit(tabId, side);
    }
    setIsDragging(false);
    setDragOverSide(null);
  }

  function handleDragOver(e: React.DragEvent, side: 'left' | 'right') {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSide(side);
  }

  function handleDragLeave() {
    setDragOverSide(null);
  }

  const tabBasePaths: Record<TabId, string> = {
    file: '/file',
    search: '/search',
    analysis: '/analysis',
    umap: '/umap',
    collections: '/collections',
    cart: '/cart',
  };

  function renderTab(id: string, isActive: boolean) {
    const meta = tabMeta[id as keyof typeof tabMeta];
    const Icon = meta.icon;
    const colors = tabColorClasses[meta.color];

    const showLabel = id !== 'cart';
    const href = tabBasePaths[id as TabId];
    const badge = id === 'cart' && cartCount > 0 ? (
      <span className="absolute -top-0.75 -right-1.25 min-w-3 h-3 flex items-center justify-center rounded-full bg-primary text-white text-[7px] font-bold leading-none">
        {cartCount > 99 ? '99+' : cartCount}
      </span>
    ) : null;

    if (isActive) {
      return (
        <div
          key={id}
          draggable
          onDragStart={(e) => handleDragStart(e, id)}
          onDragEnd={handleDragEnd}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            openTab(id as TabId);
          }}
          className={`flex items-center gap-1.5 ${showLabel ? 'px-4' : 'px-3'} py-3 text-sm font-semibold rounded-lg ${colors.bgFaint} text-base-content cursor-grab active:cursor-grabbing hover:opacity-70 transition-opacity`}
          title={`Back to ${meta.label}`}
        >
          <span className="relative flex items-center h-5"><Icon size={14} />{badge}</span>
          {showLabel && <span>{meta.label}</span>}
          <button
            onClick={(e) => { e.stopPropagation(); closeTab(id as TabId); }}
            className="ml-1 p-0.5 rounded hover:bg-base-300 transition-colors cursor-pointer hover:opacity-100"
            aria-label={`Close ${meta.label}`}
          >
            <X size={12} />
          </button>
        </div>
      );
    }

    return (
      <a
        key={id}
        href={href}
        draggable
        onDragStart={(e) => handleDragStart(e, id)}
        onDragEnd={handleDragEnd}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          openTab(id as TabId);
        }}
        className={`flex items-center gap-1.5 ${showLabel ? 'px-4' : 'px-3'} py-3 text-sm font-medium transition-colors cursor-grab active:cursor-grabbing rounded-lg text-base-content/60 hover:text-base-content hover:bg-base-200 no-underline`}
      >
        <span className="relative flex items-center h-5"><Icon size={14} />{badge}</span>
        {showLabel && <span>{meta.label}</span>}
      </a>
    );
  }

  function renderContent() {
    if (location.pathname.startsWith('/file/report')) {
      return <ReportPage />;
    }

    if (location.pathname.startsWith('/metrics')) {
      return <MetricsPage />;
    }

    if (activeTabs.length === 0) {
      return <Hub />;
    }

    if (!isSplit) {
      return (
        <main className="flex-1 flex flex-col relative">
          {isDragging && (
            <div className="absolute inset-0 z-10 grid grid-cols-2">
              <div
                onDragOver={(e) => handleDragOver(e, 'left')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'left')}
                className={`transition-colors ${
                  dragOverSide === 'left' ? 'bg-primary/10 border-2 border-dashed border-primary/30' : ''
                }`}
              />
              <div
                onDragOver={(e) => handleDragOver(e, 'right')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'right')}
                className={`transition-colors ${
                  dragOverSide === 'right' ? 'bg-primary/10 border-2 border-dashed border-primary/30' : ''
                }`}
              />
            </div>
          )}
          <div className={`absolute top-0 inset-x-0 h-6 bg-gradient-to-b ${tabColorClasses[tabMeta[primaryId].color].glowFrom} to-transparent pointer-events-none z-0`} />
          {isUmapPrimary ? (
            <div ref={umapSlotRef} className="@container flex-1 relative z-[1] flex flex-col" />
          ) : (
            <TabPanelContext.Provider value={activeTabs[0].id}>
              <div className="@container flex-1 relative z-[1] flex flex-col">
                <TabContent tab={activeTabs[0]} />
              </div>
            </TabPanelContext.Provider>
          )}
        </main>
      );
    }

    return (
      <main className="grid grid-cols-1 md:grid-cols-2 overflow-hidden h-[calc(100vh-52px)]">
        <div
          className="@container relative flex flex-col overflow-hidden min-h-0"
          onDragOver={(e) => handleDragOver(e, 'left')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'left')}
        >
          {isDragging && (
            <div
              className={`absolute inset-0 z-[9999] transition-colors ${dragOverSide === 'left' ? 'bg-primary/10 border-2 border-dashed border-primary/30' : ''}`}
              onDragOver={(e) => handleDragOver(e, 'left')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'left')}
            />
          )}
          <div className={`absolute top-0 inset-x-0 h-6 bg-gradient-to-b ${tabColorClasses[tabMeta[primaryId].color].glowFrom} to-transparent pointer-events-none z-10`} />
          {isUmapPrimary ? (
            <div ref={umapSlotRef} className="flex-1 overflow-y-auto min-h-0 flex flex-col" />
          ) : (
            <TabPanelContext.Provider value={activeTabs[0].id}>
              <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
                <TabContent tab={activeTabs[0]} />
              </div>
            </TabPanelContext.Provider>
          )}
        </div>
        <div
          className={`@container relative border-l border-base-300 flex flex-col overflow-hidden min-h-0`}
          onDragOver={(e) => handleDragOver(e, 'right')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'right')}
        >
          {isDragging && (
            <div
              className={`absolute inset-0 z-[9999] transition-colors ${dragOverSide === 'right' ? 'bg-primary/10 border-2 border-dashed border-primary/30' : ''}`}
              onDragOver={(e) => handleDragOver(e, 'right')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'right')}
            />
          )}
          <div className={`absolute top-0 inset-x-0 h-6 bg-gradient-to-b ${tabColorClasses[tabMeta[splitId!].color].glowFrom} to-transparent pointer-events-none z-10`} />
          {isUmapSplit ? (
            <div ref={umapSlotRef} className="flex-1 overflow-y-auto min-h-0 flex flex-col" />
          ) : (
            <TabPanelContext.Provider value={activeTabs[1].id}>
              <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
                <TabContent tab={activeTabs[1]} />
              </div>
            </TabPanelContext.Provider>
          )}
        </div>
      </main>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-base-100">
      <header className="flex items-center px-4 py-2.5 bg-base-100">
        <button
          onClick={() => navigate('/')}
          className="shrink-0 mr-4 ml-1 mb-0.5 cursor-pointer"
        >
          <img src="/bedbase_logo.svg" alt="BEDbase" className="h-8" />
        </button>
        <div className="flex items-center justify-end flex-1 gap-1">
          {bedFile && renderTab('file', 'file' === primaryId || 'file' === splitId)}
          {tabIds.map((id) =>
            renderTab(id, id === primaryId || id === splitId),
          )}
        </div>
      </header>
      {renderContent()}
      {/* Portal-based UMAP: single instance, moved between layout slots */}
      {umapEverOpened.current && umapContainerRef.current && (
        <>
          {!isUmapVisible && <div style={{ display: 'none' }} ref={umapSlotRef} />}
          {createPortal(
            <TabPanelContext.Provider value="umap">
              <UmapView />
            </TabPanelContext.Provider>,
            umapContainerRef.current,
          )}
        </>
      )}
      <Footer />
    </div>
  );
}
