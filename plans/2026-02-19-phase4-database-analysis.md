---
date: 2026-02-19
status: complete
description: "Phase 4: Database file analysis for BEDbase UI"
parent: plans/2026-02-18-bedbase-ui-rewrite.md
---

# Phase 4: Database File Analysis

## Context

Phases 1–3 delivered the tab scaffold, upload + WASM analysis, and API-powered search. Clicking a search result calls `openTab('analysis', bedId)`, but the Analysis tab only handles `param === 'file'` (uploaded files). For any database bed ID, it falls through to the empty state. Phase 4 wires the Analysis tab to the API so database files display full metadata, stats, plots, similar files, bedset memberships, and download links.

## New query hooks

Three new hooks in `src/queries/`, following the exact pattern from Phase 3 (`useTextSearch`, etc.):

| Hook | Endpoint | Purpose |
|------|----------|---------|
| `useBedMetadata(id)` | `GET /bed/{id}/metadata?full=true` | Full metadata, stats, plots, files, bedsets |
| `useBedNeighbours(id)` | `GET /bed/{id}/neighbours?limit=10` | Similar files by embedding |
| `useBedGenomeStats(id)` | `GET /bed/{id}/genome-stats` | Ref genome compatibility (optional — defer if data sparse) |

`useBedMetadata` returns `BedMetadataAll` which includes `stats`, `plots`, `files`, `annotation`, `bedsets` — everything we need in a single call. The neighbours endpoint is a separate call since it's a different data concern and can load independently.

**Types** — alias from `bedbase-types.d.ts`:
```ts
import type { components } from '../../bedbase-types';
type BedMetadataAll = components['schemas']['BedMetadataAll'];
type BedListSearchResult = components['schemas']['BedListSearchResult'];
```

## Extend BedAnalysis type

Current `BedAnalysis` (`src/lib/bed-analysis.ts`) needs additions for database-only fields:

```ts
export type BedAnalysis = {
  source: 'local' | 'database';
  id?: string;
  fileName?: string;
  fileSize?: number;
  parseTime?: number;

  summary: {
    regions: number;
    meanRegionWidth: number;
    nucleotides: number;        // 0 for database (not available from API)
    gcContent?: number;         // NEW — database only
    medianTssDist?: number;     // NEW — database only
    dataFormat: string | null;
    bedCompliance: string | null;
  };

  metadata?: {
    species?: string;
    cellLine?: string;
    cellType?: string;          // NEW
    assay?: string;
    antibody?: string;
    target?: string;            // NEW
    tissue?: string;
    treatment?: string;         // NEW
    librarySource?: string;     // NEW
    description?: string;
  };

  genomicFeatures?: {           // NEW — database only
    exon: number;
    intron: number;
    intergenic: number;
    promoterCore: number;
    promoterProx: number;
    fiveUtr: number;
    threeUtr: number;
  };

  chromosomeStats: ChromosomeRow[];  // empty for database files

  plots: {
    regionDistribution?: DistributionPoint[];  // WASM only
  };

  // NEW — database only fields
  serverPlots?: PlotSlot[];       // image-based plots from FileModel
  bedsets?: { id: string; name: string; description?: string }[];
  downloadUrls?: { bed?: string; bigBed?: string };
  submissionDate?: string;
  lastUpdateDate?: string;
  isUniverse?: boolean;
  licenseId?: string;
};
```

Add `fromApiResponse(data: BedMetadataAll): BedAnalysis` producer function alongside existing `fromRegionSet`.

### Plot URL extraction

Each plot in `BedPlots` is a `FileModel` with `access_methods`. Helper function:

```ts
function fileModelToPlotSlot(fm: FileModel, id: string, title: string): PlotSlot | null {
  const httpMethod = fm.access_methods?.find(m => m.type === 'http');
  const url = httpMethod?.access_url?.url;
  if (!url) return null;
  const thumb = fm.thumbnail_path
    ? url.replace(/[^/]+$/, '') + fm.thumbnail_path.split('/').pop()
    : url;
  return { id, title, type: 'image', thumbnail: thumb, full: url };
}
```

Alternatively, use the API's file redirect: `${API_BASE}/files/${plot.path}`. We'll evaluate both during implementation and use whichever is more reliable.

### Download URLs

Extract from `BedFiles.bed_file` and `BedFiles.bigbed_file` access methods — same pattern as plot URLs. Find http access method → use `access_url.url`.

## Wire AnalysisView for database files

Modify `src/components/analysis/analysis-view.tsx`:

```tsx
export function AnalysisView({ param }: { param?: string }) {
  if (param === 'file') return <LocalAnalysis />;
  if (param) return <DatabaseAnalysis bedId={param} />;
  return <AnalysisEmpty />;
}
```

New `DatabaseAnalysis` component (in the same file or split out):
- Calls `useBedMetadata(bedId)`
- On success: `fromApiResponse(data)` → `<AnalysisPanels analysis={analysis} />`
- Loading: centered spinner
- Error: error message with retry
- 404: "BED file not found" message with link back to search

## New components

### 1. Annotation table — `src/components/analysis/annotation-table.tsx`

Two-column key-value table from `BedAnalysis.metadata`. Skips empty values. Fields:

| Label | Field |
|-------|-------|
| Organism | species |
| Cell type | cellType |
| Cell line | cellLine |
| Tissue | tissue |
| Assay | assay |
| Antibody | antibody |
| Target | target |
| Treatment | treatment |
| Library source | librarySource |

Styling: `table table-sm` DaisyUI, same visual weight as chromosome stats.

### 2. Genomic feature bar chart — `src/components/analysis/genomic-features.tsx`

Horizontal bar chart (or simple stat rows) showing the 7 genomic feature percentages from `BedAnalysis.genomicFeatures`. Each bar: label + percentage + visual bar using `bg-primary` with width proportional to percentage. Simple CSS bars, no Chart.js dependency needed.

### 3. Similar files — `src/components/analysis/similar-files.tsx`

- Calls `useBedNeighbours(bedId)` independently
- Renders results using the existing `ResultsTable` component from search
- Section header: "Similar files" with count
- Clicking a result → `openTab('analysis', resultId)` (already wired in ResultsTable)
- Loading/error states inline

### 4. Bedset memberships — `src/components/analysis/bedset-memberships.tsx`

- Reads `BedAnalysis.bedsets`
- Renders as badge list: each bedset is a clickable chip
- Click → `openTab('collections', bedsetId)`
- If empty, don't render section

### 5. Download/action bar — `src/components/analysis/action-bar.tsx`

Horizontal bar below header with:
- **Download BED** button (links to `downloadUrls.bed`)
- **Download BigBED** button (links to `downloadUrls.bigBed`)
- **Add to cart** / **In cart** toggle (reuses `useCart` pattern from ResultsTable)
- **Copy ID** button (copies bed ID to clipboard)

Styling: `flex gap-2` with `btn btn-sm` buttons.

### 6. Comparison strip — `src/components/analysis/comparison-strip.tsx`

Shown when viewing a database file AND `FileContext.bedFile` exists:
- Thin banner: "You have [filename] loaded — Compare with this file"
- Click → opens search tab with bed-to-bed search: `openTab('search', 'file')`
- Dismiss button (local state, reappears on next database file)

This is intentionally lightweight — full overlap computation is future work.

## Extended AnalysisPanels layout

The existing `AnalysisPanels` component gets extended for database files:

```
AnalysisHeader (LocalHeader or DatabaseHeader)
ComparisonStrip (if database file + uploaded file in context)
ActionBar (database files only — downloads, cart, copy ID)
StatsGrid (already exists — extended with gcContent, medianTssDist)
AnnotationTable (database files only)
GenomicFeatures (database files only)
PlotGallery (local: Vega plots from WASM; database: image plots from server)
ChromosomeStats (local files only — empty for database)
SimilarFiles (database files only)
BedsetMemberships (database files only)
```

The `AnalysisPanels` receives `analysis: BedAnalysis` and conditionally renders sections based on `analysis.source` and data presence.

## StatsGrid changes

Extend `StatsGrid` to show additional database fields:
- GC content (as percentage, e.g. "42.3%")
- Median TSS distance (e.g. "1,234 bp")

These appear alongside existing stats (regions, mean width, nucleotides) only when values exist.

## Files summary

| File | Action | Description |
|------|--------|-------------|
| `src/queries/use-bed-metadata.ts` | **New** | Fetch full bed metadata |
| `src/queries/use-bed-neighbours.ts` | **New** | Fetch similar files |
| `src/lib/bed-analysis.ts` | Modify | Add fields to `BedAnalysis`, add `fromApiResponse()`, add `fileModelToPlotSlot()` |
| `src/lib/plot-specs.ts` | No change | `PlotSlot` already supports `type: 'image'` |
| `src/components/analysis/analysis-view.tsx` | Modify | Add `DatabaseAnalysis` component, extend `AnalysisPanels` layout |
| `src/components/analysis/annotation-table.tsx` | **New** | Metadata key-value table |
| `src/components/analysis/genomic-features.tsx` | **New** | Genomic feature percentage bars |
| `src/components/analysis/similar-files.tsx` | **New** | Neighbours section using `ResultsTable` |
| `src/components/analysis/bedset-memberships.tsx` | **New** | Bedset badge list |
| `src/components/analysis/action-bar.tsx` | **New** | Download + cart + copy ID bar |
| `src/components/analysis/comparison-strip.tsx` | **New** | Upload-in-context banner |

## Verification

1. **Search → Analysis**: Text search "K562 CTCF" → click a result → Analysis tab opens at `/analysis/<id>` → full metadata, stats, plots, annotation table, similar files, bedset memberships load
2. **Stats display**: Regions, mean width, GC content, median TSS distance shown correctly
3. **Annotation table**: Cell line, tissue, assay, antibody, etc. shown (skipping empty fields)
4. **Server plots**: Pre-computed plot images appear in gallery grid, click opens modal with full image
5. **Genomic features**: Bar chart / stat rows show exon, intron, intergenic, promoter percentages
6. **Similar files**: Neighbour results load independently, clicking one navigates to its analysis page
7. **Bedset memberships**: Bedset badges shown, clickable (navigates to collections tab)
8. **Downloads**: BED and BigBED download buttons work (open download in new tab)
9. **Cart**: Add-to-cart button works, syncs with cart context
10. **Comparison strip**: Upload a file → search for something → click a result → strip appears showing uploaded file name
11. **URL direct access**: Navigate to `/analysis/<known-bed-id>` directly → loads correctly
12. **Error handling**: Navigate to `/analysis/nonexistent-id` → shows 404 message
13. **Dev server starts** without errors, **build succeeds** (`npm run build`)
