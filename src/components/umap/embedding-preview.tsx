import { useState } from 'react';
import { useTab } from '../../contexts/tab-context';
import { EmbeddingPlot } from './embedding-plot';
import { useMosaicCoordinator } from '../../contexts/mosaic-coordinator-context';

type Props = {
  bedIds?: string[];
  height?: number;
  className?: string;
};

export function EmbeddingPreview({ bedIds, height = 200, className }: Props) {
  const { openTab } = useTab();
  const { webglStatus } = useMosaicCoordinator();
  const [hasError, setHasError] = useState(false);

  if (webglStatus.error || hasError) return null;

  return (
    <div
      className={`border border-base-300 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${className || ''}`}
      onClick={() => openTab('umap', '')}
    >
      <div className="pointer-events-none" onError={() => setHasError(true)}>
        <EmbeddingPlot
          bedIds={bedIds}
          preselectedIds={bedIds}
          height={height}
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
        />
      </div>
    </div>
  );
}
