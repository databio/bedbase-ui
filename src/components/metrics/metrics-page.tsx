import { BarChart3 } from 'lucide-react';

export function MetricsPage() {
  return (
    <div className="flex-1 overflow-auto flex flex-col">
      <div className="flex flex-col items-center justify-center flex-1 min-h-64 px-4">
        <BarChart3 size={32} className="text-primary mb-3" />
        <h2 className="text-2xl font-bold text-base-content">Metrics</h2>
        <p className="text-base-content/60 mt-2">BEDbase usage metrics coming soon.</p>
      </div>
    </div>
  );
}
