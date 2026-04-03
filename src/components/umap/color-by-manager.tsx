import { useState, useRef, useEffect } from 'react';
import { Download, BarChart3, Palette } from 'lucide-react';

export type ColorField = {
  key: string;
  label: string;
  continuous?: boolean;
};

const CORE_FIELDS: ColorField[] = [
  { key: 'cell_line_category', label: 'Cell Line' },
  { key: 'assay_category', label: 'Assay' },
  { key: 'target_category', label: 'Target' },
  { key: 'tissue_category', label: 'Tissue' },
  { key: 'cell_type_category', label: 'Cell Type' },
  { key: 'number_of_regions_category', label: 'Regions', continuous: true },
  { key: 'mean_region_width_category', label: 'Mean Width', continuous: true },
  { key: 'gc_content_category', label: 'GC Content', continuous: true },
];

const EXTENDED_FIELDS: ColorField[] = [
  { key: 'species_name_category', label: 'Species' },
  { key: 'data_format_category', label: 'Data Format' },
  { key: 'treatment_category', label: 'Treatment' },
  { key: 'antibody_category', label: 'Antibody' },
  { key: 'median_tss_dist_category', label: 'Median TSS Dist', continuous: true },
];

type Props = {
  colorGrouping: string;
  setColorGrouping: (grouping: string) => void;
  tier2Loaded: boolean;
  onLoadTier2: () => void;
  tier2Loading: boolean;
  variant?: 'legend' | 'chip';
};

export function ColorByManager({
  colorGrouping,
  setColorGrouping,
  tier2Loaded,
  onLoadTier2,
  tier2Loading,
  variant = 'legend',
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentField = [...CORE_FIELDS, ...EXTENDED_FIELDS].find((f) => f.key === colorGrouping);

  return (
    <span className={`flex items-center relative ${variant === 'legend' ? '-my-0.5' : ''}`} ref={ref}>
      {variant === 'chip' ? (
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-base-content/65 hover:text-base-content/80 bg-base-200 hover:bg-base-300 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
          title={`Color by: ${currentField?.label ?? 'Color'}`}
        >
          <Palette size={12} />
          {currentField?.label ?? 'Color'}
        </button>
      ) : (
        <input
          type="button"
          className="btn btn-xs h-[18px] min-h-0 text-[10px] px-1.5"
          value={currentField?.label ?? 'Color'}
          onClick={() => setOpen(!open)}
          title="Color by..."
        />
      )}

      {open && (
        <>
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
        <div className={`absolute z-50 bg-base-100 border border-base-300 rounded-lg shadow-lg w-52 overflow-y-auto overscroll-contain max-h-80 ${
          variant === 'chip' ? 'left-0 bottom-full mb-1' : 'right-0 top-full mt-1'
        }`}>
          {/* Core metadata */}
          <div className="px-3 py-1.5 bg-base-200 border-b border-base-300">
            <span className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider">Core</span>
          </div>
          <ul className="py-1">
            {CORE_FIELDS.map((field) => (
              <li key={field.key}>
                <button
                  className={`w-full text-left px-3 py-1 text-xs flex items-center justify-between hover:bg-base-200 transition-colors ${
                    colorGrouping === field.key ? 'bg-primary/10 text-primary font-medium' : ''
                  }`}
                  onClick={() => {
                    setColorGrouping(field.key);
                    setOpen(false);
                  }}
                >
                  <span>{field.label}</span>
                  {field.continuous && (
                    <BarChart3 size={10} className="text-base-content/30" />
                  )}
                </button>
              </li>
            ))}
          </ul>

          {/* Extended metadata */}
          <div className="px-3 py-1.5 bg-base-200 border-y border-base-300 flex items-center justify-between">
            <span className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider">Extended</span>
            {!tier2Loaded && (
              <button
                className="btn btn-xs h-[16px] min-h-0 text-[9px] px-1.5 btn-primary btn-outline"
                onClick={onLoadTier2}
                disabled={tier2Loading}
              >
                {tier2Loading ? (
                  <span className="loading loading-spinner w-2.5 h-2.5" />
                ) : (
                  <>
                    <Download size={9} />
                    Load
                  </>
                )}
              </button>
            )}
          </div>
          <ul className={`py-1 ${!tier2Loaded ? 'opacity-40 pointer-events-none' : ''}`}>
            {EXTENDED_FIELDS.map((field) => (
              <li key={field.key}>
                <button
                  className={`w-full text-left px-3 py-1 text-xs flex items-center justify-between hover:bg-base-200 transition-colors ${
                    colorGrouping === field.key ? 'bg-primary/10 text-primary font-medium' : ''
                  }`}
                  onClick={() => {
                    setColorGrouping(field.key);
                    setOpen(false);
                  }}
                  disabled={!tier2Loaded}
                >
                  <span>{field.label}</span>
                  {field.continuous && (
                    <BarChart3 size={10} className="text-base-content/30" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
        </>
      )}
    </span>
  );
}

/** Check if a color grouping key represents a continuous (binned) field */
export function isContinuousGrouping(key: string): boolean {
  return [...CORE_FIELDS, ...EXTENDED_FIELDS].some(
    (f) => f.key === key && f.continuous,
  );
}

/** Get the human-readable label for a color grouping key */
export function getGroupingLabel(key: string): string {
  return [...CORE_FIELDS, ...EXTENDED_FIELDS].find((f) => f.key === key)?.label ?? key;
}
