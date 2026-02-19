import { useState, useRef, type ReactNode } from 'react';
import { Search, Upload, FileText, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFile } from '../../contexts/file-context';
import { useTab } from '../../contexts/tab-context';
import { FileSearchGraphic } from '../graphics/file-search-graphic';
import { BedAnalyzerGraphic } from '../graphics/bed-analyzer-graphic';
import { CodeSnippetGraphic } from '../graphics/code-snippet-graphic';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// --- Search / upload input ---

function SearchInput({ onFileSelect }: { onFileSelect: (f: File) => void }) {
  const [query, setQuery] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadedFile, setUploadedFile } = useFile();
  const navigate = useNavigate();
  const { openTab } = useTab();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onFileSelect(f);
  };

  const handleSubmit = () => {
    if (!query) return;
    openTab('search', query);
  };

  return (
    <div className="w-full max-w-2xl">
      {/* Text search row */}
      <div className="flex items-center gap-2 border border-base-300 rounded-t-lg px-3 py-2.5">
        <input
          type="text"
          placeholder="Search for BED files..."
          className="flex-1 bg-transparent outline-none text-sm text-base-content placeholder:text-base-content/50"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <button
          type="button"
          onClick={handleSubmit}
          className="btn btn-primary btn-sm"
          disabled={!query}
        >
          <Search size={16} />
        </button>
      </div>

      {/* File upload row or file indicator */}
      {uploadedFile ? (
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-b-lg border border-base-300 border-t-0 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
          onClick={() => navigate('/upload')}
        >
          <FileText size={16} className="text-primary shrink-0 mx-2" />
          <span className="text-sm font-medium text-base-content/70 truncate flex-1">{uploadedFile.name}</span>
          <span className="text-xs text-base-content/40">{formatBytes(uploadedFile.size)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}
            className="p-0.5 rounded hover:bg-base-300 transition-colors cursor-pointer"
          >
            <X size={14} className="text-base-content/40" />
          </button>
        </div>
      ) : (
        <div
          className={`flex items-center gap-2 px-3 py-2.5 rounded-b-lg border border-dashed border-t-0 transition-colors cursor-pointer ${
            isDragOver ? 'border-primary bg-primary/10' : 'border-base-300 bg-primary/5'
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={16} className="text-base-content/30 shrink-0 mx-2" />
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium text-base-content/70">Upload BED file</span>
            <span className="text-[11px] text-base-content/45">.bed, .bigbed, .gz</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".bed,.bigbed,.bb,.gz,application/gzip,application/x-gzip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileSelect(f);
            }}
          />
        </div>
      )}
      <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
        <span className="text-base-content/30 text-xs">Try:</span>
        {['K562 CTCF', 'ENCODE DNase-seq', 'H3K27ac ChIP-seq', 'promoter regions'].map((term) => (
          <button
            key={term}
            onClick={() => setQuery(term)}
            className="text-xs px-2.5 py-1 rounded-full border border-base-300 text-base-content/50 hover:text-base-content hover:border-base-content/30 transition-colors cursor-pointer"
          >
            {term}
          </button>
        ))}
      </div>
    </div>
  );
}

// --- About features ---

const aboutFeatures: { title: string; description: string; graphic?: ReactNode }[] = [
  {
    title: 'Download and cache your data locally',
    description:
      'Use the BEDbase clients to access BED files and BED sets programmatically. The clients handle downloading and caching, enabling efficient reuse of genomic region data without manual API calls. Available in Python, Rust, and R.',
    graphic: <CodeSnippetGraphic />,
  },
  {
    title: 'Search for BED files',
    description:
      'BEDbase indexes genomic intervals directly, enabling similarity-based search grounded in the actual content of BED files rather than unstructured metadata. Search by submitting a query string or uploading a BED file.',
    graphic: <FileSearchGraphic />,
  },
  {
    title: 'Analyze your BED files',
    description:
      'Upload a BED file or provide a URL to quickly explore its contents. The BED Analyzer generates key statistics, summary tables, and visualizations for region counts, lengths, genome coverage, and more.',
    graphic: <BedAnalyzerGraphic />,
  },
  {
    title: 'Visualize BED file similarity',
    description:
      'Explore BED file similarity using an interactive UMAP of hg38-based embeddings. Compare existing BEDbase data and upload your own BED file to see how it relates to other genomic region sets.',
  },
];

// --- Hub ---

export function Hub() {
  const { setUploadedFile } = useFile();
  const navigate = useNavigate();

  function handleFileSelect(file: File) {
    setUploadedFile(file);
    navigate('/upload');
  }

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      <div className="flex flex-col items-center justify-center text-center px-4 pt-28 pb-40">
        <h1 className="font-thin text-primary text-7xl mb-5">BEDbase</h1>
        <p className="text-base font-normal text-base-content/50 max-w-2xl mb-16">
          The open access platform for aggregating, analyzing, and serving genomic region data.
        </p>
        <SearchInput onFileSelect={handleFileSelect} />
        {/* TODO: fetch real counts from API */}
        <div className="flex items-center gap-4 mt-20 text-sm text-base-content/50">
          <span><strong className="text-primary">93,026</strong> BED files</span>
          <span className="text-base-content/20">•</span>
          <span><strong className="text-success">18,547</strong> BEDsets</span>
          <span className="text-base-content/20">•</span>
          <span><strong className="text-info">5</strong> genomes</span>
        </div>
      </div>

      <div className="flex-1">
        <div className="bg-base-200/50 px-4 md:px-6 py-16">
          <div className="max-w-5xl mx-auto flex flex-col gap-16">
            {aboutFeatures.map((feature, i) => (
              <div
                key={feature.title}
                className={`flex flex-col md:flex-row items-center gap-8 ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
              >
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-base-content mb-2">{feature.title}</h3>
                  <p className="text-base-content/60 text-sm leading-relaxed text-balance">{feature.description}</p>
                </div>
                <div className="flex-1 w-full">
                  <div className="border border-base-300 rounded-lg h-48 bg-base-100 overflow-hidden">
                    {feature.graphic}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
