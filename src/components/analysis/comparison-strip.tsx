import { useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { useFile } from '../../contexts/file-context';
import { useTab } from '../../contexts/tab-context';

export function ComparisonStrip() {
  const { bedFile } = useFile();
  const { openTab } = useTab();
  const [dismissed, setDismissed] = useState(false);

  if (!bedFile || dismissed) return null;

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-info/10 rounded-lg text-xs">
      <span className="text-base-content/70">
        You have <span className="font-medium text-base-content">{bedFile.name}</span> loaded
      </span>
      <button
        onClick={() => openTab('search', 'file')}
        className="btn btn-xs btn-ghost text-info gap-1"
      >
        Compare with this file
        <ArrowRight size={12} />
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="btn btn-xs btn-ghost btn-circle ml-auto"
      >
        <X size={12} />
      </button>
    </div>
  );
}
