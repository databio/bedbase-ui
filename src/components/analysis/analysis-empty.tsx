import { useRef, useState } from 'react';
import {
  Upload, FileText, ArrowRight, Search,
  BarChart3, Table2, PieChart, Dna, Ruler, Globe, Lock,
} from 'lucide-react';
import { useFile } from '../../contexts/file-context';
import { useTab } from '../../contexts/tab-context';
import { useStats } from '../../queries/use-stats';
import { useSampleBeds } from '../../queries/use-sample-beds';
import { useBedMetadata } from '../../queries/use-bed-metadata';
import { EXAMPLE_BED_ID } from '../../lib/const';

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

// --- Main component ---

export function AnalysisEmpty() {
  const [searchQuery, setSearchQuery] = useState('');
  const { bedFile, setBedFile } = useFile();
  const { openTab } = useTab();
  const { data: stats } = useStats();
  const { data: exampleBed } = useBedMetadata(EXAMPLE_BED_ID);
  const { data: sampleBeds } = useSampleBeds(3);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setBedFile(file);
    openTab('analysis', 'file');
  }

  function handleAnalyzeFile() {
    openTab('analysis', 'file');
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 md:px-6 pt-12 pb-10">
        <div className="max-w-3xl mx-auto">

          {/* Two ways to analyze — with integrated actions */}
          <h2 className="text-2xl font-bold text-base-content mb-1 text-center">Analyze a BED file</h2>
          <p className="text-base-content/50 text-sm max-w-md mx-auto text-center mb-8">
            Open any BED file from BEDbase to explore statistics and metadata, or upload your own for instant client-side analysis.
          </p>
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
                  <li>{stats ? `${stats.bedfiles_number.toLocaleString()} BED files` : 'Thousands of BED files'} with precomputed analyses</li>
                  <li>Rich metadata — species, cell line, assay, antibody</li>
                  <li>Full analysis pipeline with genomic annotations</li>
                </ul>
              </div>
              <div className="border-t border-base-300">
                <div className="flex items-center gap-3 px-4 h-11 bg-primary/5">
                  <Search size={16} className="text-base-content/30 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search BEDbase for a file..."
                    className="flex-1 bg-transparent outline-none text-sm text-base-content placeholder:text-base-content/50 p-0 m-0 border-0 min-h-0"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) openTab('search', searchQuery.trim());
                    }}
                  />
                  {searchQuery.trim() && (
                    <button
                      onClick={() => openTab('search', searchQuery.trim())}
                      className="p-1 rounded cursor-pointer transition-colors"
                    >
                      <ArrowRight size={14} className="text-primary" />
                    </button>
                  )}
                </div>
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
                {bedFile ? (
                  <button
                    onClick={handleAnalyzeFile}
                    className="flex items-center gap-3 px-4 h-11 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer text-left w-full"
                  >
                    <FileText size={16} className="text-primary shrink-0" />
                    <span className="text-sm font-medium text-base-content truncate flex-1 min-w-0">{bedFile.name}</span>
                    <span className="text-xs text-base-content/40 shrink-0">{formatBytes(bedFile.size)}</span>
                    <ArrowRight size={14} className="text-primary shrink-0" />
                  </button>
                ) : (
                  <button
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('bg-success/10');
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('bg-success/10');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('bg-success/10');
                      const f = e.dataTransfer.files[0];
                      if (f) handleFile(f);
                    }}
                    className="flex items-center gap-3 px-4 h-11 bg-success/5 hover:bg-success/10 transition-colors cursor-pointer text-left w-full"
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
            {exampleBed ? (
              <button
                onClick={() => openTab('analysis', 'bed/' + EXAMPLE_BED_ID)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-base-300 hover:border-base-content/20 hover:bg-base-200/30 transition-colors cursor-pointer text-left"
              >
                <FileText size={14} className="text-base-content/30 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-base-content truncate">{exampleBed.name || 'Unnamed'}</p>
                  <p className="text-[11px] text-base-content/40">{[exampleBed.genome_alias, exampleBed.annotation?.assay].filter(Boolean).join(' · ') || EXAMPLE_BED_ID.slice(0, 8)}</p>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-base-300 animate-pulse">
                <div className="w-3.5 h-3.5 bg-base-300 rounded shrink-0" />
                <div className="flex-1">
                  <div className="h-3 w-24 bg-base-300 rounded mb-1" />
                  <div className="h-2.5 w-16 bg-base-300 rounded" />
                </div>
              </div>
            )}
            {sampleBeds ? sampleBeds.filter((bed) => bed.id !== EXAMPLE_BED_ID).slice(0, 2).map((bed) => (
              <button
                key={bed.id}
                onClick={() => openTab('analysis', 'bed/' + bed.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-base-300 hover:border-base-content/20 hover:bg-base-200/30 transition-colors cursor-pointer text-left"
              >
                <FileText size={14} className="text-base-content/30 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-base-content truncate">{bed.name || 'Unnamed'}</p>
                  <p className="text-[11px] text-base-content/40">{[bed.genome_alias, bed.annotation?.assay].filter(Boolean).join(' · ') || bed.id.slice(0, 8)}</p>
                </div>
              </button>
            )) : (
              [0, 1].map((i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-base-300 animate-pulse">
                  <div className="w-3.5 h-3.5 bg-base-300 rounded shrink-0" />
                  <div className="flex-1">
                    <div className="h-3 w-24 bg-base-300 rounded mb-1" />
                    <div className="h-2.5 w-16 bg-base-300 rounded" />
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".bed,.gz"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const name = f.name.toLowerCase();
          if (!name.endsWith('.bed') && !name.endsWith('.bed.gz')) return;
          handleFile(f);
        }}
      />
    </div>
  );
}
