import { useState, useCallback, useRef } from 'react';
import { Upload } from 'lucide-react';
import { compressedDistributionSlots, type CompressedDistributions } from '../analysis/plots/compressed-plots';
import { PlotGallery } from '../analysis/plot-gallery';
import type { PlotSlot } from '../../lib/plot-specs';

export function DebugPage() {
  const [slots, setSlots] = useState<PlotSlot[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        // The compressed blob may be the top-level object or nested under "distributions"
        const distributions: CompressedDistributions =
          json.distributions?.distributions ? json.distributions : json;
        const result = compressedDistributionSlots(distributions);
        if (result.length === 0) {
          setError('No plots could be rendered from this file. Expected a compressed bedstat JSON.');
          setSlots([]);
        } else {
          setSlots(result);
        }
      } catch (e) {
        setError(`Failed to parse JSON: ${e instanceof Error ? e.message : String(e)}`);
        setSlots([]);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file.');
      setSlots([]);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      <div className="max-w-5xl w-full mx-auto px-4 md:px-6 py-8">
        <h1 className="text-lg font-semibold text-base-content mb-1">Compressed Plot Debug</h1>
        <p className="text-sm text-base-content/50 mb-6">
          Drop a bedstat compressed JSON to preview the rendered plot specs.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-10 mb-6 cursor-pointer transition-colors ${
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-base-300 hover:border-base-content/30'
          }`}
        >
          <Upload size={28} className="text-base-content/30" />
          <p className="text-sm text-base-content/50">
            {fileName ? (
              <>
                Loaded <span className="font-mono font-medium text-base-content/80">{fileName}</span>
              </>
            ) : (
              'Drop a .json file here or click to browse'
            )}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-error/10 text-error text-sm">
            {error}
          </div>
        )}

        {slots.length > 0 && (
          <div className="@container">
            <p className="text-xs text-base-content/40 mb-3">
              {slots.length} plot{slots.length !== 1 ? 's' : ''} rendered
            </p>
            <PlotGallery plots={slots} columns={4} />
          </div>
        )}
      </div>
    </div>
  );
}
