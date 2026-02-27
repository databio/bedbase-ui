import { useState, useMemo } from 'react';
import { Loader2, AlertCircle, Search, Plus, Check, Copy, CheckCheck, ExternalLink, Terminal, Download, X, ScatterChart } from 'lucide-react';
import { Breadcrumb } from '../shared/breadcrumb';
import { useTab } from '../../contexts/tab-context';
import { useCart } from '../../contexts/cart-context';
import { useBucket } from '../../contexts/bucket-context';
import { useBedsetMetadata } from '../../queries/use-bedset-metadata';
import { useBedsetBedfiles } from '../../queries/use-bedset-bedfiles';
import { API_BASE } from '../../lib/file-model-utils';
import { BedfileTable } from './bedfile-table';
import { KvTable } from '../shared/kv-table';
import { bedsetStatsSlots, type BedSetStats } from '../analysis/plots/bedset-plots';
import { PlotGallery } from '../analysis/plot-gallery';

const linkClass = 'inline-flex items-center gap-1.5 text-xs font-medium text-base-content/60 hover:text-base-content/80 bg-base-200 hover:bg-base-300 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer';

function CodeModal({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const code = `from geniml.bbclient import bbclient\n\nbbclient.load_bedset('${id}')`;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-base-100 rounded-lg shadow-lg w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
          <h3 className="text-sm font-semibold">Download BEDset</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-base-200 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <div className="p-4">
          <div className="relative">
            <pre className="bg-base-200 rounded-lg p-4 text-xs font-mono overflow-x-auto">
              <code>{code}</code>
            </pre>
            <button
              onClick={() => {
                navigator.clipboard.writeText(code);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="absolute top-2 right-2 btn btn-xs btn-ghost gap-1"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs font-mono text-base-content/30 hover:text-base-content/50 transition-colors cursor-pointer"
      title="Copy ID"
    >
      <span className="truncate">{id}</span>
      {copied ? <CheckCheck size={12} className="text-success shrink-0" /> : <Copy size={12} className="shrink-0" />}
    </button>
  );
}


export function CollectionDetail({ bedsetId }: { bedsetId: string }) {
  const { openTab } = useTab();
  const { addToCart, removeFromCart, isInCart } = useCart();
  const { createBucket, focusBucket } = useBucket();
  const [showCode, setShowCode] = useState(false);
  const { data: meta, isLoading: metaLoading, error: metaError, refetch } = useBedsetMetadata(bedsetId);
  const { data: bedfiles } = useBedsetBedfiles(bedsetId);

  // Must be above early returns — hooks must be called unconditionally
  const metaStats = meta?.statistics as Record<string, unknown> | undefined;
  const isNewFormat = metaStats != null && 'n_files' in metaStats;
  const plotSlots = useMemo(() => {
    if (!isNewFormat || !metaStats) return [];
    return bedsetStatsSlots(metaStats as unknown as BedSetStats);
  }, [metaStats, isNewFormat]);

  if (metaLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
        <Loader2 size={28} className="text-primary animate-spin" />
        <p className="text-sm text-base-content/50">Loading BEDset metadata...</p>
      </div>
    );
  }

  if (metaError) {
    const is404 = (metaError as { response?: { status?: number } })?.response?.status === 404;
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
        <AlertCircle size={28} className={is404 ? 'text-base-content/30' : 'text-error'} />
        <p className="text-sm font-medium text-base-content">
          {is404 ? 'BEDset not found' : 'Failed to load BEDset'}
        </p>
        <p className="text-xs text-base-content/50 max-w-md text-center">
          {is404
            ? `No BEDset with ID "${bedsetId}" exists in the database.`
            : String((metaError as Error).message || 'An unexpected error occurred.')}
        </p>
        <div className="flex gap-2 mt-1">
          {!is404 && (
            <button onClick={() => refetch()} className="btn btn-sm btn-outline">Retry</button>
          )}
          <button onClick={() => openTab('collections', 'bedset')} className="btn btn-sm btn-ghost gap-1.5">
            <Search size={14} /> Back to BEDsets
          </button>
        </div>
      </div>
    );
  }

  if (!meta) return null;

  // Info rows
  const infoRows: { label: string; value: string }[] = [];
  if (meta.author) infoRows.push({ label: 'Author', value: meta.author });
  if (meta.source) infoRows.push({ label: 'Source', value: meta.source });
  infoRows.push({ label: 'BED files', value: String(isNewFormat ? (metaStats as BedSetStats).n_files : (meta.bed_ids?.length ?? 0)) });
  infoRows.push({ label: 'MD5', value: meta.md5sum });

  // Stats rows — new format uses scalar_summaries, old uses mean/sd
  const statsRows: { label: string; value: string }[] = [];
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const fmtSd = (mean: number, sd?: number | null) =>
    sd != null ? `${fmt(mean)} ± ${fmt(sd)}` : fmt(mean);

  if (isNewFormat) {
    const ss = (metaStats as BedSetStats).scalar_summaries;
    if (ss) {
      for (const [key, summary] of Object.entries(ss)) {
        const UPPER_WORDS: Record<string, string> = { tss: 'TSS', gc: 'GC' };
        const label = key.replace(/_/g, ' ').replace(/\b\w+/g, (w) => UPPER_WORDS[w] ?? w.charAt(0).toUpperCase() + w.slice(1));
        if (summary && typeof summary === 'object' && 'mean' in summary) {
          const s = summary as { mean: number; sd?: number };
          statsRows.push({ label, value: fmtSd(s.mean, s.sd) });
        }
      }
    }
  } else if (metaStats) {
    // Old format fallback: stats.mean / stats.sd
    const meanStats = (metaStats as Record<string, unknown>).mean as Record<string, number> | undefined;
    const sdStats = (metaStats as Record<string, unknown>).sd as Record<string, number> | undefined;
    if (meanStats?.number_of_regions != null)
      statsRows.push({ label: 'Number of regions', value: fmtSd(meanStats.number_of_regions, sdStats?.number_of_regions) });
    if (meanStats?.mean_region_width != null)
      statsRows.push({ label: 'Mean region width', value: fmtSd(meanStats.mean_region_width, sdStats?.mean_region_width) });
    if (meanStats?.gc_content != null)
      statsRows.push({ label: 'GC content', value: fmtSd(meanStats.gc_content, sdStats?.gc_content) });
    if (meanStats?.median_tss_dist != null)
      statsRows.push({ label: 'Median TSS distance', value: fmtSd(meanStats.median_tss_dist, sdStats?.median_tss_dist) });
  }

  const bedfileList = bedfiles?.results ?? [];
  const inCartCount = bedfileList.filter((b) => isInCart(b.id)).length;
  const allInCart = bedfileList.length > 0 && inCartCount === bedfileList.length;
  const someInCart = inCartCount > 0 && !allInCart;

  const handleCartToggle = () => {
    if (allInCart) {
      for (const bed of bedfileList) removeFromCart(bed.id);
    } else {
      for (const bed of bedfileList) {
        if (!isInCart(bed.id)) {
          addToCart({
            id: bed.id,
            name: bed.name || 'Unnamed',
            genome: bed.genome_alias || '',
            tissue: bed.annotation?.tissue || '',
            cell_line: bed.annotation?.cell_line || '',
            cell_type: bed.annotation?.cell_type || '',
            description: bed.description || '',
            assay: bed.annotation?.assay || '',
          });
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto p-4 @md:p-6">
      <Breadcrumb crumbs={[
        { label: 'Collections', onClick: () => openTab('collections', '') },
        { label: 'BEDsets', onClick: () => openTab('collections', 'bedset') },
        { label: meta.name || bedsetId },
      ]} />

      <div className="space-y-6">
        {/* Header — matches DatabaseHeader layout */}
        <div className="space-y-5">
          <div className="flex flex-col @5xl:flex-row @5xl:items-start @5xl:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-semibold text-base-content">{meta.name}</p>
                <CopyableId id={bedsetId} />
              </div>
              {meta.description && (
                <p className="text-sm text-base-content/50 mt-1 leading-relaxed">{meta.description}</p>
              )}
            </div>
            <div className="shrink-0 flex flex-col @5xl:items-end gap-1.5">
              <div className="flex items-center gap-1 flex-wrap">
                {bedfileList.length > 0 && (
                  <button
                    onClick={() => {
                      const id = createBucket(`BEDset: ${meta.name}`, bedfileList.map((b) => b.id), `bedset:${bedsetId}`);
                      focusBucket(id);
                      openTab('umap', '');
                    }}
                    className={linkClass}
                  >
                    <ScatterChart size={13} />
                    View on UMAP
                  </button>
                )}
                {bedfileList.length > 0 && (
                  <button
                    onClick={handleCartToggle}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                      allInCart
                        ? 'text-success bg-success/20 hover:bg-success/30'
                        : someInCart
                          ? 'text-primary bg-primary/10 hover:bg-primary/20'
                          : 'text-base-content/60 hover:text-base-content/80 bg-base-200 hover:bg-base-300'
                    }`}
                  >
                    {allInCart ? <Check size={13} /> : <Plus size={13} />}
                    {allInCart
                      ? `${bedfileList.length} in cart`
                      : someInCart
                        ? `Add ${bedfileList.length - inCartCount} more to cart`
                        : `Add ${bedfileList.length} to cart`}
                  </button>
                )}
                <button onClick={() => setShowCode(true)} className={linkClass}>
                  <Terminal size={13} />
                  Download
                </button>
                <a
                  href={`${API_BASE}/bedset/${bedsetId}/pep`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  <Download size={13} />
                  PEP
                </a>
                <a
                  href={`${API_BASE}/bedset/${bedsetId}/metadata`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  <ExternalLink size={13} />
                  API
                </a>
              </div>
              {(meta.submission_date || meta.last_update_date) && (
                <p className="text-[11px] text-base-content/30">
                  {meta.submission_date && `Created: ${new Date(meta.submission_date).toLocaleDateString()}`}
                  {meta.submission_date && meta.last_update_date && ' · '}
                  {meta.last_update_date && `Updated: ${new Date(meta.last_update_date).toLocaleDateString()}`}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 @xl:grid-cols-2 gap-3">
            <KvTable title="Information" rows={infoRows} />
            {statsRows.length > 0 && <KvTable title="Statistics (mean ± sd)" rows={statsRows} />}
          </div>
        </div>

        {/* Aggregated distribution plots */}
        {plotSlots.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide">
              Plots
            </h3>
            <PlotGallery plots={plotSlots} />
          </div>
        )}

        {/* BED files */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide">
            BED files ({bedfileList.length})
          </h3>
          {bedfileList.length > 0 ? (
            <BedfileTable bedfiles={bedfileList} />
          ) : (
            <p className="text-sm text-base-content/40 py-4">No BED files in this bedset.</p>
          )}
        </div>
      </div>
      <CodeModal id={bedsetId} open={showCode} onClose={() => setShowCode(false)} />
    </div>
  );
}
