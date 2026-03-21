import {
  FileText,
  BarChart3, Table2, PieChart, Dna, Ruler,
} from 'lucide-react';
import { useFile } from '../../contexts/file-context';
import { useTab } from '../../contexts/tab-context';
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
  const { bedFile } = useFile();
  const { openTab } = useTab();
  const { data: exampleBed } = useBedMetadata(EXAMPLE_BED_ID);
  const { data: sampleBeds } = useSampleBeds(3);

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 md:px-6 pt-12 pb-10">
        <div className="max-w-3xl mx-auto">

          <h2 className="text-2xl font-bold text-base-content mb-1 text-center">Analyze a BED file</h2>
          <p className="text-base-content/50 text-sm max-w-md mx-auto text-center mb-8">
            Find a file in the <a href="/search" onClick={(e) => { e.preventDefault(); openTab('search'); }} className="text-primary hover:underline cursor-pointer">Search</a> tab, or upload your own in the <a href="/upload" onClick={(e) => { e.preventDefault(); openTab('file'); }} className="text-primary hover:underline cursor-pointer">Upload</a> tab.
          </p>

          {/* What's included */}
          <h3 className="text-sm font-semibold text-base-content mb-4 text-center">What's included in an analysis?</h3>
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

          {/* Try a file */}
          <h3 className="text-sm font-semibold text-base-content mb-4 mt-10 text-center">Try a file:</h3>
          <div className="grid grid-cols-3 gap-2">
            {bedFile && (
              <button
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-accent/30 bg-accent/5 hover:bg-accent/10 transition-colors cursor-pointer text-left"
                onClick={() => openTab('analysis', 'file')}
              >
                <FileText size={14} className="text-accent shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-base-content truncate">{bedFile.name}</p>
                  <p className="text-[11px] text-base-content/40">{formatBytes(bedFile.size)} · uploaded</p>
                </div>
              </button>
            )}
            {exampleBed ? (
              <a
                href={`/analysis/bed/${EXAMPLE_BED_ID}`}
                onClick={(e) => { e.preventDefault(); openTab('analysis', 'bed/' + EXAMPLE_BED_ID); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-base-300 hover:border-base-content/20 hover:bg-base-200/30 transition-colors cursor-pointer text-left"
              >
                <FileText size={14} className="text-base-content/30 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-base-content truncate">{exampleBed.name || 'Unnamed'}</p>
                  <p className="text-[11px] text-base-content/40">{[exampleBed.genome_alias, exampleBed.annotation?.assay].filter(Boolean).join(' · ') || EXAMPLE_BED_ID.slice(0, 8)}</p>
                </div>
              </a>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-base-300 animate-pulse">
                <div className="w-3.5 h-3.5 bg-base-300 rounded shrink-0" />
                <div className="flex-1">
                  <div className="h-3 w-24 bg-base-300 rounded mb-1" />
                  <div className="h-2.5 w-16 bg-base-300 rounded" />
                </div>
              </div>
            )}
            {sampleBeds ? sampleBeds.filter((bed) => bed.id !== EXAMPLE_BED_ID).slice(0, bedFile ? 1 : 2).map((bed) => (
              <a
                key={bed.id}
                href={`/analysis/bed/${bed.id}`}
                onClick={(e) => { e.preventDefault(); openTab('analysis', 'bed/' + bed.id); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-base-300 hover:border-base-content/20 hover:bg-base-200/30 transition-colors cursor-pointer text-left"
              >
                <FileText size={14} className="text-base-content/30 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-base-content truncate">{bed.name || 'Unnamed'}</p>
                  <p className="text-[11px] text-base-content/40">{[bed.genome_alias, bed.annotation?.assay].filter(Boolean).join(' · ') || bed.id.slice(0, 8)}</p>
                </div>
              </a>
            )) : (
              (bedFile ? [0] : [0, 1]).map((i) => (
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

    </div>
  );
}
