import { X } from 'lucide-react';
import type { ActiveFilter } from '../../lib/umap-utils';

type Props = {
  activeFilters: ActiveFilter[];
  currentVariable: string;
  onRemoveFilter: (id: string) => void;
  onClearAll: () => void;
};

export function ActiveFiltersPanel({ activeFilters, currentVariable, onRemoveFilter, onClearAll }: Props) {
  // Group filters by variable for display
  const byVariable = new Map<string, ActiveFilter[]>();
  for (const f of activeFilters) {
    const arr = byVariable.get(f.variable) || [];
    arr.push(f);
    byVariable.set(f.variable, arr);
  }

  return (
    <div className="border border-base-300 rounded-lg overflow-clip bg-base-100 shrink-0">
      <div className="px-3 py-2 border-b border-base-300 bg-base-200 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="text-xs font-bold">Filters</span>
          <span className="text-xs text-base-content/40">({activeFilters.length})</span>
        </span>
        <button
          onClick={onClearAll}
          className="btn btn-xs btn-soft btn-error h-[18px] min-h-0 text-[10px] px-1.5"
        >
          Clear all
        </button>
      </div>
      <div className="p-2 flex flex-wrap gap-1">
        {[...byVariable.entries()].map(([variable, filters]) => (
          filters.map((f) => {
            const isCurrent = variable === currentVariable;
            return (
              <span
                key={f.id}
                className={`inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 ${
                  isCurrent
                    ? 'bg-primary/10 text-primary'
                    : 'bg-base-200 text-base-content/70'
                }`}
              >
                <span className="font-medium">{f.variableLabel}:</span>
                <span className="truncate max-w-24">{f.label}</span>
                <button
                  onClick={() => onRemoveFilter(f.id)}
                  className="hover:text-error cursor-pointer transition-colors shrink-0"
                >
                  <X size={10} />
                </button>
              </span>
            );
          })
        ))}
      </div>
    </div>
  );
}
