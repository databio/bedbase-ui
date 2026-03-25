import { useRef, useState, useEffect } from 'react';
import {
  FileText,
  BarChart3, Table2, PieChart, Dna, Ruler,
  ChevronDown, Plus,
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
      <div className="px-4 md:px-6 pt-12 pb-10">
        <div className="max-w-3xl mx-auto">

          <h2 className="text-2xl font-bold text-base-content mb-1 text-center">Analyze a BED file</h2>
          <p className="text-base-content/50 text-sm max-w-md mx-auto text-center mb-8">
            Upload a file in the <a href="/upload" onClick={(e) => { e.preventDefault(); openTab('file'); }} className="text-primary hover:underline cursor-pointer">Upload</a> tab, or try one of the examples below.
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
            {(bedFile || files.length > 0) && (
              <div className="relative" ref={pickerRef}>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-accent/30 bg-accent/5 h-full">
                  <FileText size={14} className="text-accent shrink-0" />
                  {bedFile ? (
                    <button
                      className="min-w-0 flex-1 text-left cursor-pointer hover:opacity-70 transition-opacity"
                      onClick={() => openTab('analysis', 'file')}
                    >
                      <p className="text-xs font-medium text-base-content truncate">{bedFile.name}</p>
                      <p className="text-[11px] text-base-content/40">{formatBytes(bedFile.size)} · uploaded</p>
                    </button>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-base-content/40">No file selected</p>
                    </div>
                  )}
                  <button
                    onClick={() => setShowFilePicker(!showFilePicker)}
                    className="p-0.5 cursor-pointer hover:opacity-70 transition-opacity shrink-0"
                  >
                    <ChevronDown size={14} className={`text-base-content/40 transition-transform ${showFilePicker ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {showFilePicker && (
                  <div className="absolute top-full left-0 min-w-full mt-1 border border-base-300 rounded-lg bg-base-100 shadow-lg z-20 py-1 max-h-52 overflow-y-auto">
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
                          className={`flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-base-200 transition-colors cursor-pointer ${isActive ? 'bg-primary/5' : ''}`}
                        >
                          <FileText size={12} className={isActive ? 'text-primary shrink-0' : 'text-base-content/30 shrink-0'} />
                          <span className={`text-xs truncate flex-1 ${isActive ? 'font-medium text-base-content' : 'text-base-content'}`}>{file.name}</span>
                          <span className="text-[11px] text-base-content/30 shrink-0">{formatBytes(file.size)}</span>
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
      </div>

    </div>
  );
}
