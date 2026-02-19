import { Loader2 } from 'lucide-react';
import { useBedNeighbours } from '../../queries/use-bed-neighbours';
import { ResultsTable } from '../search/results-table';

export function SimilarFiles({ bedId }: { bedId: string }) {
  const { data, isLoading, error } = useBedNeighbours(bedId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 size={14} className="animate-spin text-base-content/40" />
        <span className="text-xs text-base-content/40">Loading similar files...</span>
      </div>
    );
  }

  if (error || !data?.results?.length) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide">
        Similar files
        <span className="ml-1.5 font-normal text-base-content/30">({data.results.length})</span>
      </h3>
      <ResultsTable results={data.results} />
    </div>
  );
}
