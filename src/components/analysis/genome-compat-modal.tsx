import { X } from 'lucide-react';
import type { components } from '../../bedbase-types';

type RefGenValidReturnModel = components['schemas']['RefGenValidReturnModel'];
type RefGenValidModel = components['schemas']['RefGenValidModel'];

const tierColors: Record<number, string> = {
  1: 'bg-success/20 border-success/30',
  2: 'bg-warning/20 border-warning/30',
  3: 'bg-warning/30 border-warning/40',
};
const defaultTierColor = 'bg-error/20 border-error/30';

function PercentBar({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return (
      <div className="relative h-4 rounded bg-base-200 overflow-hidden">
        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-base-content/40">N/A</span>
      </div>
    );
  }
  const pct = value * 100;
  return (
    <div className="relative h-4 rounded bg-base-200 overflow-hidden">
      <div className="absolute inset-y-0 left-0 bg-primary rounded" style={{ width: `${pct}%` }} />
      <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-medium ${pct > 30 ? 'text-white' : 'text-base-content'}`}>
        {pct.toFixed(2)}%
      </span>
    </div>
  );
}

function GenomeRow({ genome }: { genome: RefGenValidModel }) {
  const colors = tierColors[genome.tier_ranking] ?? defaultTierColor;
  return (
    <a
      href={genome.genome_digest ? `https://ui.refgenie.org/genomes/${genome.genome_digest}` : undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`grid grid-cols-[1fr_80px_80px_80px_60px] gap-2 items-center px-3 py-2.5 rounded-lg border ${colors} no-underline text-base-content hover:opacity-80 transition-opacity`}
    >
      <span className="text-xs font-semibold truncate">{genome.compared_genome || genome.provided_genome}</span>
      <PercentBar value={genome.xs} />
      <PercentBar value={genome.oobr} />
      <PercentBar value={genome.sequence_fit} />
      <span className="text-xs font-medium text-center">Tier {genome.tier_ranking}</span>
    </a>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  genomeStats: RefGenValidReturnModel;
}

export function GenomeCompatModal({ open, onClose, genomeStats }: Props) {
  if (!open) return null;

  const sorted = [...(genomeStats.compared_genome ?? [])].sort(
    (a, b) =>
      a.tier_ranking - b.tier_ranking ||
      b.xs - a.xs ||
      (b.oobr ?? 0) - (a.oobr ?? 0) ||
      (b.sequence_fit ?? 0) - (a.sequence_fit ?? 0),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-base-100 rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 shrink-0">
          <h3 className="text-sm font-semibold">Reference Genome Compatibility</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-base-200 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-auto p-4 space-y-4">
          <div className="text-xs text-base-content/60 space-y-1">
            <p>
              Below is a ranking of reference genome compatibility (tier 1 is best), based on:
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li><strong>XS</strong> (eXtra Sequences): proportion of shared regions in both this BED file and reference genome over total regions in this BED file.</li>
              <li><strong>OOBR</strong> (Out Of Bounds Regions): proportion of shared regions that do not exceed the bounds of the reference genome. Only calculated if XS is 100%.</li>
              <li><strong>SF</strong> (Sequence Fit): proportion of shared region lengths in both this BED file and reference genome over total region lengths in the reference genome.</li>
            </ul>
          </div>

          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_80px_80px_60px] gap-2 px-3 text-[10px] font-semibold text-base-content/50 uppercase tracking-wide">
            <span>Genome</span>
            <span className="text-center">XS</span>
            <span className="text-center">OOBR</span>
            <span className="text-center">SF</span>
            <span className="text-center">Tier</span>
          </div>

          {/* Rows */}
          <div className="space-y-1.5">
            {sorted.map((g) => (
              <GenomeRow key={g.compared_genome ?? g.provided_genome} genome={g} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
