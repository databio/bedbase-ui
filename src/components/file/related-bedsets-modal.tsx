import { X, FolderOpen } from 'lucide-react';
import { useTab } from '../../contexts/tab-context';
import { useRelatedBedsets, type AggregatedBedset } from '../../queries/use-related-bedsets';

type Props = {
  file: File | undefined;
  onClose: () => void;
};

export function RelatedBedsetsModal({ file, onClose }: Props) {
  const { openTab } = useTab();
  const { data, isSearching, isLoadingMetadata, totalNeighbors, neighborsLoaded } =
    useRelatedBedsets(file, true);

  function handleBedsetClick(bedsetId: string) {
    openTab('collections', 'bedset/' + bedsetId);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-base-100 rounded-lg shadow-lg w-full max-w-xl mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 shrink-0">
          <h3 className="text-sm font-semibold">Related BEDsets</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-base-200 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-auto p-4">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <span className="loading loading-spinner loading-md text-primary" />
              <p className="text-sm text-base-content/50">Searching for similar BED files...</p>
            </div>
          ) : isLoadingMetadata ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-base-content/50">
                <span>Loading metadata...</span>
                <span>
                  {neighborsLoaded}/{totalNeighbors}
                </span>
              </div>
              <div className="w-full h-1.5 bg-base-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-[width] duration-150 ease-out"
                  style={{ width: `${(neighborsLoaded / Math.max(totalNeighbors, 1)) * 100}%` }}
                />
              </div>
              {data.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {data.map((bs) => (
                    <BedsetRow key={bs.id} bedset={bs} onClick={handleBedsetClick} />
                  ))}
                </div>
              )}
            </div>
          ) : data.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs text-base-content/40 mb-3">
                BEDsets found among {totalNeighbors} most similar BED files
              </p>
              {data.map((bs) => (
                <BedsetRow key={bs.id} bedset={bs} onClick={handleBedsetClick} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <FolderOpen size={28} className="text-base-content/20" />
              <p className="text-sm text-base-content/50">No BEDsets found among similar BED files.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BedsetRow({ bedset, onClick }: { bedset: AggregatedBedset; onClick: (id: string) => void }) {
  return (
    <button
      onClick={() => onClick(bedset.id)}
      className="flex items-center gap-3 w-full p-3 rounded-lg border border-base-300 hover:border-base-content/20 hover:bg-base-200/30 transition-colors cursor-pointer text-left"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-base-content truncate">{bedset.name}</p>
        {bedset.description && (
          <p className="text-xs text-base-content/50 truncate mt-0.5">{bedset.description}</p>
        )}
      </div>
      <span className="badge badge-primary badge-sm shrink-0">
        {bedset.count}/{bedset.total}
      </span>
    </button>
  );
}
