import { useRef } from 'react';
import {
  Upload, FileText, ArrowRight, Search,
  BarChart3, Table2, PieChart, Dna, Ruler, Globe, Lock,
} from 'lucide-react';
import { useFile } from '../../contexts/file-context';
import { useTab } from '../../contexts/tab-context';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// --- Capabilities ---

const capabilities = [
  { icon: BarChart3, label: 'Region distribution', description: 'Per-chromosome region count histograms' },
  { icon: Table2, label: 'Chromosome statistics', description: 'Count, start, end, min/max/mean/median widths' },
  { icon: Ruler, label: 'Region widths', description: 'Width distribution and summary statistics' },
  { icon: Dna, label: 'GC content', description: 'GC percentage across regions' },
  { icon: PieChart, label: 'Genomic partitions', description: 'Promoter, intron, exon, intergenic breakdown' },
  { icon: BarChart3, label: 'Neighbor distances', description: 'Distance to nearest neighboring regions' },
];

// --- Sample files ---

const sampleFiles = [
  { label: 'CTCF ChIP-seq (K562)', description: '45K regions · hg38' },
  { label: 'DNase-seq (GM12878)', description: '120K regions · hg38' },
  { label: 'H3K27ac peaks', description: '68K regions · hg38' },
];

// --- Main component ---

export function AnalysisEmpty() {
  const { uploadedFile, setUploadedFile } = useFile();
  const { openTab } = useTab();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setUploadedFile(file);
    openTab('analysis', 'upload');
  }

  function handleAnalyzeUploaded() {
    openTab('analysis', 'upload');
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 md:px-6 pt-10 pb-10">
        <div className="max-w-3xl mx-auto">

          {/* Two ways to analyze — with integrated actions */}
          <h3 className="text-md font-semibold text-base-content mb-4 text-center">Analyze a BED file</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Database card */}
            <div className="flex flex-col rounded-lg border border-base-300 overflow-hidden">
              <div className="flex-1 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <Globe size={14} className="text-primary" />
                  </div>
                  <p className="text-sm font-medium text-base-content">Database</p>
                </div>
                <ul className="space-y-1 text-xs text-base-content/50 list-disc list-inside">
                  {/* TODO: fetch real count from API */}
                  <li>93,000+ BED files with precomputed analyses</li>
                  <li>Rich metadata — species, cell line, assay, antibody</li>
                  <li>Full analysis pipeline with genomic annotations</li>
                </ul>
              </div>
              <div className="border-t border-base-300">
                <button
                  onClick={() => openTab('search')}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-base-200/50 transition-colors cursor-pointer text-left w-full"
                >
                  <Search size={16} className="text-base-content/30 shrink-0" />
                  <span className="text-sm text-base-content/50">Search BEDbase for a file</span>
                </button>
              </div>
            </div>

            {/* Upload card */}
            <div className="flex flex-col rounded-lg border border-base-300 overflow-hidden">
              <div className="flex-1 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-md bg-success/10">
                    <Lock size={14} className="text-success" />
                  </div>
                  <p className="text-sm font-medium text-base-content">Upload</p>
                </div>
                <ul className="space-y-1 text-xs text-base-content/50 list-disc list-inside">
                  <li>Instant results — runs in your browser via WebAssembly</li>
                  <li>Private — your file never leaves your device</li>
                  <li>Supports .bed and .bed.gz files</li>
                </ul>
              </div>
              <div className="border-t border-base-300">
                {uploadedFile ? (
                  <button
                    onClick={handleAnalyzeUploaded}
                    className="flex items-center gap-3 px-4 py-3 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer text-left w-full"
                  >
                    <FileText size={16} className="text-primary shrink-0" />
                    <span className="text-sm font-medium text-base-content truncate flex-1 min-w-0">{uploadedFile.name}</span>
                    <span className="text-xs text-base-content/40 shrink-0">{formatBytes(uploadedFile.size)}</span>
                    <ArrowRight size={14} className="text-primary shrink-0" />
                  </button>
                ) : (
                  <button
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('bg-primary/10');
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('bg-primary/10');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('bg-primary/10');
                      const f = e.dataTransfer.files[0];
                      if (f) handleFile(f);
                    }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-base-200/50 transition-colors cursor-pointer text-left w-full"
                  >
                    <Upload size={16} className="text-base-content/30 shrink-0" />
                    <span className="text-sm text-base-content/50">Drop a file here or click to browse</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* What's included */}
          <h3 className="text-sm font-semibold text-base-content mb-4 mt-10 text-center">What's included in an analysis?</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {capabilities.map((cap) => {
              const Icon = cap.icon;
              return (
                <div key={cap.label} className="flex items-start gap-2.5 p-3 rounded-lg bg-base-200/50">
                  <Icon size={16} className="text-base-content/30 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-base-content">{cap.label}</p>
                    <p className="text-xs text-base-content/40 mt-0.5">{cap.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sample files */}
          <h3 className="text-sm font-semibold text-base-content mb-4 mt-10 text-center">Try a sample file:</h3>
          <div className="grid grid-cols-3 gap-2">
            {sampleFiles.map((sample) => (
              <button
                key={sample.label}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-base-300 hover:border-base-content/20 hover:bg-base-200/30 transition-colors cursor-pointer text-left"
              >
                <FileText size={14} className="text-base-content/30 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-base-content">{sample.label}</p>
                  <p className="text-[11px] text-base-content/40">{sample.description}</p>
                </div>
              </button>
            ))}
          </div>

        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".bed,.bed.gz,.gz"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
