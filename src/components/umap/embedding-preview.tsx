import { useTab } from '../../contexts/tab-context';
import { useMosaicCoordinator } from '../../contexts/mosaic-coordinator-context';
import { EmbeddingPlot } from './embedding-plot';

export function EmbeddingPreview() {
  const { openTab } = useTab();
  const { webglStatus } = useMosaicCoordinator();

  if (webglStatus.error) return null;

  return (
    <div className="relative w-full h-full cursor-pointer" onClick={() => openTab('umap')}>
      {/* Transparent overlay blocks all plot interaction — click navigates to UMAP tab */}
      <div className="absolute inset-0 z-10" />
      <EmbeddingPlot
        height={192}
        simpleTooltip
        showStatus={false}
        persistentPoints={[]}
        interactivePoints={[]}
        pendingPoints={null}
        onPreselectedChange={() => {}}
        onBucketChange={() => {}}
        onInteractiveChange={() => {}}
        onSetPending={() => {}}
        onApplyPending={() => {}}
        pinnedCategories={[]}
        onPinnedCategoriesChange={() => {}}
      />
    </div>
  );
}
