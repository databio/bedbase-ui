import { useState, useRef } from 'react';
import { X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFile } from '../../contexts/file-context';
import { useTab, type TabId } from '../../contexts/tab-context';
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

  // Keep-mounted UMAP: once opened, never unmount (DuckDB WASM init is slow)
  const umapEverOpened = useRef(false);
  const isUmapActive = primaryId === 'umap';
  if (isUmapActive) umapEverOpened.current = true;

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
      <span className="absolute -top-0.5 -right-1 min-w-3 h-3 flex items-center justify-center rounded-full bg-primary text-white text-[7px] font-bold leading-none">
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
          className={`flex items-center gap-1.5 ${showLabel ? 'px-4' : 'px-3'} py-3 text-sm font-semibold rounded-lg ${colors.bgFaint} text-base-content cursor-grab active:cursor-grabbing`}
        >
          <a
            href={href}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              openTab(id as TabId);
            }}
            className="flex items-center gap-1.5 cursor-pointer hover:opacity-70 transition-opacity"
            title={`Back to ${meta.label}`}
          >
            <span className="relative flex items-center h-5"><Icon size={14} />{badge}</span>
            {showLabel && <span>{meta.label}</span>}
          </a>
          <button
            onClick={() => closeTab(id as TabId)}
            className="ml-1 p-0.5 rounded hover:bg-base-300 transition-colors cursor-pointer"
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

    // UMAP tab is rendered by the keep-mounted section below
    if (isUmapActive && !isSplit) return null;

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
          <div className="@container flex-1 relative z-[1] flex flex-col">
            <TabContent tab={activeTabs[0]} />
          </div>
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
          {isDragging && dragOverSide === 'left' && (
            <div className="absolute inset-0 z-20 bg-primary/10 border-2 border-dashed border-primary/30" />
          )}
          <div className={`absolute top-0 inset-x-0 h-6 bg-gradient-to-b ${tabColorClasses[tabMeta[primaryId].color].glowFrom} to-transparent pointer-events-none z-10`} />
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
            <TabContent tab={activeTabs[0]} />
          </div>
        </div>
        <div
          className={`@container relative border-l border-base-300 flex flex-col overflow-hidden min-h-0`}
          onDragOver={(e) => handleDragOver(e, 'right')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'right')}
        >
          {isDragging && dragOverSide === 'right' && (
            <div className="absolute inset-0 z-20 bg-primary/10 border-2 border-dashed border-primary/30" />
          )}
          <div className={`absolute top-0 inset-x-0 h-6 bg-gradient-to-b ${tabColorClasses[tabMeta[splitId!].color].glowFrom} to-transparent pointer-events-none z-10`} />
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
            <TabContent tab={activeTabs[1]} />
          </div>
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
      {/* Keep-mounted UMAP: rendered once opened, hidden when not active */}
      {umapEverOpened.current && (
        <div
          style={{ display: isUmapActive && !isSplit ? 'contents' : 'none' }}
        >
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
            <div className={`absolute top-0 inset-x-0 h-6 bg-gradient-to-b ${tabColorClasses[tabMeta['umap'].color].glowFrom} to-transparent pointer-events-none z-0`} />
            <div className="@container flex-1 relative z-[1] flex flex-col">
              <UmapView />
            </div>
          </main>
        </div>
      )}
      <Footer />
    </div>
  );
}
