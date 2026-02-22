import { useSelectionStats, type Breakdown } from '../../queries/use-selection-stats';

// ── Formatting helpers ──────────────────────────────────────────────

function fmt(n: number, decimals = 1): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(decimals) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(decimals) + 'K';
  return n.toFixed(decimals);
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

// ── Skeleton ────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-block bg-base-300 rounded animate-pulse ${className}`}>
      &nbsp;
    </span>
  );
}

// ── Section wrapper ─────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">
        {title}
      </h4>
      <div className="border border-base-300 rounded-lg bg-base-100 p-3">
        {children}
      </div>
    </div>
  );
}

// ── Mini distribution chart ─────────────────────────────────────────

function MiniDistribution({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const max = values[values.length - 1]; // already sorted ascending
  if (max === 0) return null;

  return (
    <div className="flex items-end gap-px h-5" title={`${values.length} values`}>
      {values.map((v, i) => (
        <div
          key={i}
          className="bg-primary/30 rounded-t-[1px] min-h-[2px]"
          style={{
            height: `${Math.max((v / max) * 100, 8)}%`,
            width: `${Math.max(100 / values.length - 1, 3)}%`,
          }}
        />
      ))}
    </div>
  );
}

// ── Stat row with distribution ──────────────────────────────────────

function StatRow({
  label,
  avg,
  values,
  formatValue,
  isLoading,
}: {
  label: string;
  avg: number | null;
  values: number[];
  formatValue: (n: number) => string;
  isLoading: boolean;
}) {
  const min = values.length > 0 ? values[0] : null;
  const max = values.length > 0 ? values[values.length - 1] : null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-base-content/50 font-medium w-16 shrink-0">{label}</span>
      <span className="text-xs font-semibold text-base-content/80 w-14 shrink-0 text-right">
        {isLoading && avg == null ? (
          <Skeleton className="w-10 h-3.5" />
        ) : avg != null ? (
          formatValue(avg)
        ) : (
          <span className="text-base-content/30">--</span>
        )}
      </span>
      <div className="flex-1 min-w-0 max-w-32">
        {isLoading && values.length === 0 ? (
          <Skeleton className="w-full h-5" />
        ) : (
          <MiniDistribution values={values} />
        )}
      </div>
      <span className="text-[10px] text-base-content/30 shrink-0">
        {min != null && max != null && min !== max
          ? `${formatValue(min)}–${formatValue(max)}`
          : ''}
      </span>
    </div>
  );
}

// ── Breakdown line ──────────────────────────────────────────────────

function BreakdownLine({
  label,
  items,
  isLoading,
}: {
  label: string;
  items: Breakdown[];
  isLoading: boolean;
}) {
  if (!isLoading && items.length === 0) return null;

  if (isLoading && items.length === 0) {
    return (
      <div className="flex items-baseline gap-1.5 text-xs">
        <span className="text-base-content/50 font-medium shrink-0 w-16">{label}</span>
        <Skeleton className="w-36 h-3.5" />
      </div>
    );
  }

  const top3 = items.slice(0, 3);
  const remaining = items.slice(3).reduce((sum, i) => sum + i.count, 0);

  return (
    <div className="flex items-baseline gap-1.5 text-xs">
      <span className="text-base-content/50 font-medium shrink-0 w-16">{label}</span>
      <span className="text-base-content/70">
        {top3.map((item, i) => (
          <span key={item.label}>
            {i > 0 && ', '}
            {item.label}{' '}
            <span className="text-base-content/40">({item.count})</span>
          </span>
        ))}
        {remaining > 0 && (
          <span className="text-base-content/30">, +{remaining} more</span>
        )}
      </span>
    </div>
  );
}

// ── Partition bar ───────────────────────────────────────────────────

const PARTITION_COLORS = [
  { key: 'exon', label: 'Exon', color: 'bg-info/60' },
  { key: 'intron', label: 'Intron', color: 'bg-success/50' },
  { key: 'intergenic', label: 'Intergenic', color: 'bg-warning/50' },
  { key: 'promoter', label: 'Promoter', color: 'bg-error/40' },
] as const;

function PartitionBar({
  exon,
  intron,
  intergenic,
  promoter,
  isLoading,
}: {
  exon: number | null;
  intron: number | null;
  intergenic: number | null;
  promoter: number | null;
  isLoading: boolean;
}) {
  const values = [exon, intron, intergenic, promoter];
  const hasData = values.some((v) => v != null);

  if (isLoading && !hasData) {
    return <Skeleton className="w-full h-6" />;
  }
  if (!hasData) return null;

  const segments = PARTITION_COLORS.map((p, i) => ({
    ...p,
    value: values[i] ?? 0,
  })).filter((s) => s.value > 0);

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="space-y-1.5">
      <div className="flex h-3 rounded-full overflow-hidden bg-base-200">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={`${seg.color} transition-all`}
            style={{ width: `${(seg.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
        {segments.map((seg) => (
          <span key={seg.key} className="flex items-center gap-1">
            <span className={`inline-block w-2 h-2 rounded-sm ${seg.color}`} />
            <span className="text-base-content/50">{seg.label}</span>
            <span className="text-base-content/70 font-medium">{pct(seg.value)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────

export function SelectionStats({
  bedIds,
  totalCount,
}: {
  bedIds: string[];
  totalCount: number;
}) {
  const { stats, isLoading } = useSelectionStats(bedIds);

  if (bedIds.length === 0) return null;

  const hasComposition =
    isLoading ||
    stats.genomes.length > 0 ||
    stats.assays.length > 0 ||
    stats.cellTypes.length > 0 ||
    stats.tissues.length > 0 ||
    stats.targets.length > 0;

  const hasPartitions =
    isLoading ||
    stats.avgExonPct != null ||
    stats.avgIntronPct != null ||
    stats.avgIntergenicPct != null ||
    stats.avgPromoterPct != null;

  const fmtInt = (n: number) => fmt(n, 0);
  const fmtGc = (n: number) => pct(n);

  return (
    <div className="space-y-4">
      {/* Composition */}
      {hasComposition && (
        <Section title="Composition">
          <div className="space-y-1.5">
            <BreakdownLine label="Genome" items={stats.genomes} isLoading={isLoading} />
            <BreakdownLine label="Assay" items={stats.assays} isLoading={isLoading} />
            <BreakdownLine label="Cell type" items={stats.cellTypes} isLoading={isLoading} />
            <BreakdownLine label="Tissue" items={stats.tissues} isLoading={isLoading} />
            <BreakdownLine label="Target" items={stats.targets} isLoading={isLoading} />
          </div>
        </Section>
      )}

      {/* Stats grid — side by side when there's room */}
      <div className="grid grid-cols-1 @xl:grid-cols-2 gap-4">
        {/* Size & Shape */}
        <Section title="Size & Shape">
          <div className="space-y-2">
            <StatRow
              label="Regions"
              avg={stats.avgRegions}
              values={stats.regionCounts}
              formatValue={fmtInt}
              isLoading={isLoading}
            />
            <StatRow
              label="Width"
              avg={stats.avgWidth}
              values={stats.widths}
              formatValue={fmtInt}
              isLoading={isLoading}
            />
          </div>
        </Section>

        {/* Genomic Location */}
        <Section title="Genomic Location">
          <div className="space-y-3">
            {hasPartitions && (
              <PartitionBar
                exon={stats.avgExonPct}
                intron={stats.avgIntronPct}
                intergenic={stats.avgIntergenicPct}
                promoter={stats.avgPromoterPct}
                isLoading={isLoading}
              />
            )}
            <StatRow
              label="GC%"
              avg={stats.avgGc}
              values={stats.gcValues}
              formatValue={fmtGc}
              isLoading={isLoading}
            />
            <StatRow
              label="TSS dist"
              avg={stats.avgTssDist}
              values={stats.tssDistances}
              formatValue={fmtInt}
              isLoading={isLoading}
            />
          </div>
        </Section>
      </div>

      {/* Sample note */}
      <div className="text-[10px] text-base-content/30">
        {stats.loaded < stats.queried
          ? `Loading ${stats.loaded}/${stats.queried}...`
          : totalCount > stats.queried
            ? `Showing ${stats.queried} of ${totalCount} files`
            : `Based on ${totalCount} file${totalCount !== 1 ? 's' : ''}`}
      </div>
    </div>
  );
}
