import { FileBarChart } from 'lucide-react';

export function ReportPage() {
  return (
    <div className="flex-1 overflow-auto flex flex-col">
      <div className="flex flex-col items-center justify-center flex-1 min-h-64 px-4">
        <FileBarChart size={32} className="text-primary mb-3" />
        <h2 className="text-2xl font-bold text-base-content">Analysis Report</h2>
        <p className="text-base-content/60 mt-2">Report generation coming soon.</p>
      </div>
    </div>
  );
}
