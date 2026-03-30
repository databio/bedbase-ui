import { useRef, useState, useEffect } from 'react';
import {
  FileText,
  ChevronDown, Plus, CircleArrowRight,
} from 'lucide-react';
import { useFile } from '../../contexts/file-context';
import { useUploadedFiles } from '../../contexts/uploaded-files-context';
import { useTab } from '../../contexts/tab-context';
import { useSampleBeds } from '../../queries/use-sample-beds';
import { useBedMetadata } from '../../queries/use-bed-metadata';
import { EXAMPLE_BED_ID } from '../../lib/const';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// --- Genomic partitions illustration ---

const partitions = [
  { label: 'Intergenic', pct: 42, color: 'teal', opacity: 0.7 },
  { label: 'Intron', pct: 28, color: 'teal', opacity: 0.7 },
  { label: 'Promoter', pct: 14, color: 'teal', opacity: 0.7 },
  { label: 'Exon', pct: 10, color: 'teal', opacity: 0.7 },
  { label: "5' UTR", pct: 4, color: 'teal', opacity: 0.7 },
  { label: "3' UTR", pct: 2, color: 'teal', opacity: 0.7 },
];

function GenomicPartitionsGraphic() {
  const maxPct = Math.max(...partitions.map((p) => p.pct));
  return (
    <svg viewBox="0 0 220 100" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {partitions.map((p, i) => {
        const barWidth = (p.pct / maxPct) * 130;
        const y = 4 + i * 15.5;
        return (
          <g key={p.label}>
            <text x="62" y={y + 10} fontSize="9" textAnchor="end" fill="currentColor" opacity={0.55} fontFamily="system-ui">{p.label}</text>
            <rect x="66" y={y + 0.5} width={barWidth} height={13} rx={2} fill={p.color} opacity={p.opacity} />
          </g>
        );
      })}
    </svg>
  );
}

// --- Main component ---

export function AnalysisEmpty() {
  const { bedFile, setBedFile } = useFile();
  const { files, addFiles, setActiveIndex } = useUploadedFiles();
  const { openTab } = useTab();
  const { data: exampleBed } = useBedMetadata(EXAMPLE_BED_ID);
  const { data: sampleBeds } = useSampleBeds(3);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showFilePicker) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowFilePicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showFilePicker]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 md:px-6 pt-12 pb-20">
        <div className="max-w-3xl mx-auto">

          <h2 className="text-2xl font-bold text-base-content mb-8 text-center">Analyze a BED file</h2>

          <p className="text-base-content/50 text-sm text-center mb-3">
            Try an example below, use the <a href="/search" onClick={(e) => { e.preventDefault(); openTab('search'); }} className="text-primary hover:underline cursor-pointer">Search</a> tab to find a file, or <a href="/upload" onClick={(e) => { e.preventDefault(); openTab('file'); }} className="text-primary hover:underline cursor-pointer">upload</a> your own.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(bedFile || files.length > 0) && (
              <div className="relative" ref={pickerRef}>
                <div className="flex rounded-lg border border-accent/30 bg-accent/5 h-full overflow-hidden">
                  <button
                    type="button"
                    onClick={() => bedFile && openTab('analysis', 'file')}
                    className="flex items-center gap-2 px-4 py-2.5 flex-1 min-w-0 text-left cursor-pointer hover:bg-accent/10 transition-colors"
                  >
                    <FileText size={14} className="text-accent shrink-0" />
                    {bedFile ? (
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-base-content truncate">{bedFile.name}</p>
                        <p className="text-[11px] text-base-content/40">{formatBytes(bedFile.size)} · uploaded</p>
                      </div>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-base-content/40">No file selected</p>
                      </div>
                    )}
                  </button>
                  {files.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowFilePicker(!showFilePicker)}
                      className="flex items-center justify-center px-2 border-l border-accent/20 hover:bg-accent/10 transition-colors cursor-pointer"
                    >
                      <ChevronDown size={14} className={`text-base-content/40 transition-transform shrink-0 ${showFilePicker ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>

                {showFilePicker && (
                  <div className="absolute top-full left-0 min-w-full mt-1 border border-base-300 rounded-lg bg-base-100 shadow-lg z-20 max-h-52 overflow-hidden">
                  <div className="py-1 max-h-52 overflow-y-auto">
                    {files.map((file, idx) => {
                      const isActive = bedFile && `${file.name}|${file.size}|${file.lastModified}` === `${bedFile.name}|${bedFile.size}|${bedFile.lastModified}`;
                      return (
                        <button
                          key={`${file.name}|${file.size}|${file.lastModified}`}
                          onClick={() => {
                            setBedFile(file);
                            setActiveIndex(idx);
                            setShowFilePicker(false);
                            openTab('analysis', 'file');
                          }}
                          className={`group flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-base-200 transition-colors cursor-pointer ${isActive ? 'bg-primary/5' : ''}`}
                        >
                          <FileText size={12} className={isActive ? 'text-primary shrink-0' : 'text-base-content/30 shrink-0'} />
                          <span className={`text-xs truncate flex-1 ${isActive ? 'font-medium text-base-content' : 'text-base-content'}`}>{file.name}</span>
                          <span className="w-10 h-3.5 shrink-0 flex items-center justify-end">
                            <span className="text-[11px] text-base-content/30 group-hover:hidden">{formatBytes(file.size)}</span>
                            <CircleArrowRight size={14} className="text-primary hidden group-hover:block" />
                          </span>
                        </button>
                      );
                    })}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-base-200 transition-colors cursor-pointer"
                    >
                      <Plus size={12} className="text-secondary shrink-0" />
                      <span className="text-xs text-secondary font-medium">Upload new file</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".bed,.gz"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const newFiles = Array.from(e.target.files);
                          addFiles(newFiles);
                          const first = newFiles[0];
                          if (first) {
                            setBedFile(first);
                            setActiveIndex(files.length);
                          }
                          setShowFilePicker(false);
                          openTab('analysis', 'file');
                        }
                        e.target.value = '';
                      }}
                    />
                  </div>
                  </div>
                )}
              </div>
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
        {/* --- Overview sections (wider) --- */}
        <div className="max-w-5xl mx-auto mt-16 space-y-12">

            {/* Quality control & statistics */}
            <div className="flex flex-col md:flex-row gap-6 items-center">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-base-content mb-3">Quality control & statistics</h3>
                <p className="text-sm text-base-content/60 leading-relaxed mb-3">
                  Every BED file in BEDbase passes through a standardization and quality control pipeline before it is available for analysis. Files are sorted by genomic coordinates, checked for valid formatting, and filtered by thresholds on file size, region count, and mean region width. This ensures consistency and prevents misleading results from malformed data.
                </p>
                <p className="text-sm text-base-content/60 leading-relaxed">
                  Files that pass QC receive comprehensive statistics and diagnostic plots that reveal distribution patterns, enrichments, and potential biological roles, including region distributions across chromosomes, width distributions, GC content, genomic partition breakdowns, TSS distances, and neighbor region distances.
                </p>
              </div>
              <div className="w-full md:w-64 shrink-0 border border-base-300 rounded-lg bg-base-200/30 aspect-[4/3] flex items-center justify-center p-3">
                <GenomicPartitionsGraphic />
              </div>
            </div>

            {/* Reference genome compatibility */}
            <div className="flex flex-col md:flex-row-reverse gap-6 items-center">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-base-content mb-3">Reference genome compatibility</h3>
                <p className="text-sm text-base-content/60 leading-relaxed mb-3">
                  BEDbase assesses each file's compatibility against reference genomes using three metrics: chromosome name sensitivity (XS), out-of-bounds region detection (OOBR), and sequence fit specificity (SF). These combine into a tiered ranking from Tier 1 (best match) to Tier 4 (poor match).
                </p>
                <p className="text-sm text-base-content/60 leading-relaxed">
                  This is especially useful when a BED file's original reference genome is unknown or incorrectly annotated — a common problem in public repositories. The compatibility scores help identify the correct genome for downstream analysis.
                </p>
              </div>
              <div className="w-full md:w-64 shrink-0 border border-base-300 rounded-lg bg-base-200/30 aspect-[4/3] flex items-center justify-center">
                <div className="text-center px-4">
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    {[1, 2, 3, 4].map((tier) => (
                      <div
                        key={tier}
                        className={`w-8 h-8 rounded border text-[10px] font-bold flex items-center justify-center ${
                          tier === 1 ? 'bg-success/20 border-success/30 text-success' :
                          tier === 2 ? 'bg-warning/20 border-warning/30 text-warning' :
                          tier === 3 ? 'bg-warning/30 border-warning/40 text-warning' :
                          'bg-error/20 border-error/30 text-error'
                        }`}
                      >
                        T{tier}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-base-content/55">Tiered compatibility scoring</p>
                </div>
              </div>
            </div>

            {/* BED classification */}
            <div className="flex flex-col md:flex-row gap-6 items-center">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-base-content mb-3">BED file classification</h3>
                <p className="text-sm text-base-content/60 leading-relaxed mb-3">
                  BEDbase automatically classifies each file's format during processing. Files are categorized as UCSC BED, ENCODE narrowPeak, broadPeak, gappedPeak, RNA elements, or generic BED-like formats. Each category also has a "relaxed score" variant for files where the score column doesn't conform to the original 0-1000 specification but all other columns do.
                </p>
                <p className="text-sm text-base-content/60 leading-relaxed">
                  This classification helps researchers understand what kind of data a file contains and what downstream analyses are appropriate, without needing to manually inspect column formats.
                </p>
              </div>
              <div className="w-full md:w-64 shrink-0 border border-base-300 rounded-lg bg-base-200/30 aspect-[4/3] flex items-center justify-center">
                <div className="text-center px-4 space-y-1.5">
                  {['narrowPeak', 'broadPeak', 'gappedPeak', 'UCSC BED', 'BED-like'].map((fmt) => (
                    <div
                      key={fmt}
                      className={`text-[10px] font-mono rounded px-2 py-0.5 ${
                        fmt === 'narrowPeak'
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'text-base-content/30 bg-base-300/40'
                      }`}
                    >
                      {fmt}
                    </div>
                  ))}
                </div>
              </div>
            </div>

        </div>
      </div>

    </div>
  );
}
