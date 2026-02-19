import { useState } from 'react';
import { X, FileText } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFile } from '../../contexts/file-context';
import { useTab, type TabId } from '../../contexts/tab-context';
import { tabMeta, tabIds, tabColorClasses } from '../../lib/tab-meta';
import { Hub } from '../hub/hub';
import { TabContent } from '../tabs/tab-content';
import { ReportPage } from '../report/report-page';
import { UploadPage } from '../upload/upload-page';
import { MetricsPage } from '../metrics/metrics-page';
import { Footer } from './footer';

export function AppLayout() {
  const { activeTabs, openTab, openSplit, closeTab } = useTab();
  const { uploadedFile } = useFile();
  const navigate = useNavigate();
  const location = useLocation();
  const [dragOverSide, setDragOverSide] = useState<'left' | 'right' | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const primaryId = activeTabs[0]?.id;
  const splitId = activeTabs[1]?.id;
  const isSplit = activeTabs.length > 1;

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

  function renderTab(id: string, isActive: boolean) {
    const meta = tabMeta[id as keyof typeof tabMeta];
    const Icon = meta.icon;
    const colors = tabColorClasses[meta.color];

    const showLabel = id !== 'cart';

    if (isActive) {
      return (
        <div
          key={id}
          draggable
          onDragStart={(e) => handleDragStart(e, id)}
          onDragEnd={handleDragEnd}
          className={`flex items-center gap-1.5 ${showLabel ? 'px-4' : 'px-3'} py-3 text-sm font-semibold rounded-lg ${colors.bgFaint} text-base-content cursor-grab active:cursor-grabbing`}
        >
          <span className="flex items-center h-5"><Icon size={14} /></span>
          {showLabel && <span>{meta.label}</span>}
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
      <button
        key={id}
        draggable
        onDragStart={(e) => handleDragStart(e, id)}
        onDragEnd={handleDragEnd}
        onClick={() => openTab(id as TabId)}
        className={`flex items-center gap-1.5 ${showLabel ? 'px-4' : 'px-3'} py-3 text-sm font-medium transition-colors cursor-grab active:cursor-grabbing rounded-lg text-base-content/60 hover:text-base-content hover:bg-base-200`}
      >
        <span className="flex items-center h-5"><Icon size={14} /></span>
        {showLabel && <span>{meta.label}</span>}
      </button>
    );
  }

  function renderContent() {
    if (location.pathname.startsWith('/upload/report')) {
      return <ReportPage />;
    }

    if (location.pathname.startsWith('/upload')) {
      return <UploadPage />;
    }

    if (location.pathname.startsWith('/metrics')) {
      return <MetricsPage />;
    }

    if (activeTabs.length === 0) {
      return <Hub />;
    }

    if (!isSplit) {
      return (
        <main className="flex-1 flex flex-col px-4 pb-4 relative">
          {isDragging && (
            <div className="absolute inset-0 z-10 grid grid-cols-2 gap-4">
              <div
                onDragOver={(e) => handleDragOver(e, 'left')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'left')}
                className={`rounded-lg transition-colors ${
                  dragOverSide === 'left' ? 'bg-primary/10 border-2 border-dashed border-primary/30' : ''
                }`}
              />
              <div
                onDragOver={(e) => handleDragOver(e, 'right')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'right')}
                className={`rounded-lg transition-colors ${
                  dragOverSide === 'right' ? 'bg-primary/10 border-2 border-dashed border-primary/30' : ''
                }`}
              />
            </div>
          )}
          <div className={`@container flex-1 bg-base-100 rounded-lg border border-base-300 border-t-2 shadow-sm ${tabColorClasses[tabMeta[primaryId].color].borderTopFaint}`}>
            <TabContent tab={activeTabs[0]} />
          </div>
        </main>
      );
    }

    return (
      <main className="flex-1 px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className={`@container bg-base-100 rounded-lg border border-base-300 border-t-2 shadow-sm ${tabColorClasses[tabMeta[primaryId].color].borderTopFaint} relative`}
          onDragOver={(e) => handleDragOver(e, 'left')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'left')}
        >
          {isDragging && dragOverSide === 'left' && (
            <div className="absolute inset-0 z-10 rounded-lg bg-primary/10 border-2 border-dashed border-primary/30" />
          )}
          <TabContent tab={activeTabs[0]} />
        </div>
        <div
          className={`@container bg-base-100 rounded-lg border border-base-300 border-t-2 shadow-sm ${tabColorClasses[tabMeta[splitId!].color].borderTopFaint} relative`}
          onDragOver={(e) => handleDragOver(e, 'right')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'right')}
        >
          {isDragging && dragOverSide === 'right' && (
            <div className="absolute inset-0 z-10 rounded-lg bg-primary/10 border-2 border-dashed border-primary/30" />
          )}
          <TabContent tab={activeTabs[1]} />
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
          {uploadedFile && (
            <button
              onClick={() => navigate('/upload')}
              title="Your file"
              className={`flex items-center px-3 py-3 text-sm rounded-lg transition-colors cursor-pointer ${
                location.pathname.startsWith('/upload')
                  ? 'bg-primary/8 text-primary font-semibold'
                  : 'text-base-content/60 hover:text-base-content hover:bg-base-200'
              }`}
              aria-label="Uploaded file"
            >
              <span className="flex items-center h-5"><FileText size={14} /></span>
            </button>
          )}
          {tabIds.map((id) =>
            renderTab(id, id === primaryId || id === splitId),
          )}
        </div>
      </header>
      {renderContent()}
      <Footer />
    </div>
  );
}
