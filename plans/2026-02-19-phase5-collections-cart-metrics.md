---
date: 2026-02-19
status: complete
description: "Phase 5: Collections tab, Cart tab, and Metrics page for BEDbase UI"
parent: plans/2026-02-18-bedbase-ui-rewrite.md
---

# Phase 5: Collections + Cart + Metrics

## Context

Phases 1-4 delivered the tab scaffold, upload + WASM analysis, API-powered search, and database file analysis. The Collections and Cart tabs still render placeholders in `tab-content.tsx`, and the Metrics page shows "coming soon." Phase 5 fills these in — the last content areas before Phase 6 (UMAP + cross-tab navigation).

No new npm dependencies. `vega-embed` (for metrics charts) and all other packages are already installed.

---

## Part A: Collections Tab

### New query hooks (`src/queries/`)

| Hook | File | Endpoint | Return type |
|------|------|----------|-------------|
| `useBedsetList` | `use-bedset-list.ts` | `GET /bedset/list?query=&limit=&offset=` | `BedSetListResult` |
| `useBedsetMetadata` | `use-bedset-metadata.ts` | `GET /bedset/{id}/metadata` | `BedSetMetadata` |
| `useBedsetBedfiles` | `use-bedset-bedfiles.ts` | `GET /bedset/{id}/bedfiles` | `BedSetBedFiles` |

Follow the exact pattern of `useTextSearch`/`useBedMetadata` — `useQuery` from `@tanstack/react-query`, `useApi()` for the axios instance, type aliases from `bedbase-types.d.ts`.

The `BedSetMetadata` response includes `statistics` and `plots` inline, so a single metadata call is sufficient for the detail header — no separate stats/plots hooks needed.

### New components (`src/components/collections/`)

**`collections-view.tsx`** — Tab router (matches `SearchView`/`AnalysisView` pattern):
- No param → `CollectionsList` (browsable list)
- Param = bedset ID → `CollectionDetail`

**`collections-list.tsx`** — Searchable, paginated list of all bedsets:
- State: `query`, `offset`, `limit` (same pattern as `TextSearchResults` in `search-view.tsx`)
- Search input at top, results table below, pagination at bottom
- Each row: name, description (truncated), bed count (`bed_ids?.length`), submission date
- Click row → `openTab('collections', bedset.id)`
- Loading: skeleton table. Empty: "No bedsets found" message.

**`collection-detail.tsx`** — Single bedset detail page:
- Two parallel queries: `useBedsetMetadata(id)` + `useBedsetBedfiles(id)`
- Layout (top to bottom):
  1. Back breadcrumb → `openTab('collections')` (same ChevronLeft pattern as search)
  2. Header: name (h2), description, badges (author, source, md5 truncated, bed count, dates)
  3. Stats cards: GC content, median region width, TSS distance, number of regions — mean ± sd from `statistics.mean`/`statistics.sd`. Only render stats with non-null mean. Same card style as `StatsGrid` in analysis-view.
  4. Region commonality plot: if `plots?.region_commonality` exists, render as image using `fileModelToPlotSlot` (extracted to shared utility).
  5. "Add all to cart" button above BED files table
  6. BED files table using `BedfileTable` component
- Loading/error/404 states: same pattern as `DatabaseAnalysis` in `analysis-view.tsx`

**`bedfile-table.tsx`** — Table for `BedMetadataBasic[]` items:
- Columns: Name, Genome (badge), Description, Cart action
- Click row → `openTab('analysis', bedId)`
- Cart button per row: same pattern as `ResultsTable`
- Separate from `ResultsTable` because `BedMetadataBasic` is a different shape (no scores, different fields)

### Shared utility extraction

Extract from `src/lib/bed-analysis.ts` into new **`src/lib/file-model-utils.ts`**:
- `API_BASE` constant
- `fileModelToUrl(fm)` helper
- `fileModelToPlotSlot(fm, id, title)` helper

Update `bed-analysis.ts` to import from the new utility. This avoids duplication since `collection-detail.tsx` also needs `fileModelToPlotSlot` for the region commonality plot.

### Modifications

| File | Change |
|------|--------|
| `src/components/tabs/tab-content.tsx` | Add `CollectionsView` route for `tab.id === 'collections'` |
| `src/lib/bed-analysis.ts` | Extract `API_BASE`, `fileModelToUrl`, `fileModelToPlotSlot` to `file-model-utils.ts`; update imports |

---

## Part B: Cart Tab

### Cart context addition

Add `clearCart` method to `src/contexts/cart-context.tsx`:
- New method: `clearCart()` — sets cart to `{}` and saves to localStorage
- Add to `CartContextValue` type and provider value

### New utility (`src/lib/download-script.ts`)

Generate bash download script from cart items:
- Uses DRS endpoint: `${API_BASE}/objects/bed.${id}.bed_file/access/http` (same pattern as existing bedhost)
- `curl -L -o` commands for each file
- `downloadAsFile(content, filename)` helper to trigger browser download

### New component (`src/components/cart/cart-view.tsx`)

**Empty state** (cartCount === 0): Centered ShoppingCart icon, "Your cart is empty" message, button to go to search.

**Cart contents:**
1. Header bar: "Cart (N files)" title, "Clear all" button (with confirm), "Download script" button
2. Table: Name (clickable → opens analysis), Genome badge, Remove button (X icon)
3. Same DaisyUI `table table-sm text-xs` styling as `ResultsTable`

### Modifications

| File | Change |
|------|--------|
| `src/contexts/cart-context.tsx` | Add `clearCart` to type, implementation, and provider |
| `src/components/tabs/tab-content.tsx` | Add `CartView` route for `tab.id === 'cart'` |

---

## Part C: Metrics Page

### New query hooks (`src/queries/`)

| Hook | File | Endpoint | Return type |
|------|------|----------|-------------|
| `useDetailedStats` | `use-detailed-stats.ts` | `GET /detailed-stats?concise=true` | `FileStats` |
| `useDetailedUsage` | `use-detailed-usage.ts` | `GET /detailed-usage` | `UsageStats` |

### Vega-Lite spec builders (`src/lib/metrics-specs.ts`)

Pure functions returning Vega-Lite spec objects:

- `barSpec(data: Record<string, number>, opts?)` — for `{key: number}` maps (genome, assay, organism, compliance, etc.). Sorted by value descending. Same Vega-Lite schema version as existing `region-distribution.ts`.
- `histogramSpec(data: BinValues, opts?)` — for `BinValues` objects (file size, regions, region width). Shows binned bars + vertical rules for mean/median.
- `pieSpec(data: Record<string, number>, opts?)` — arc chart for small-cardinality data (data format, bed comments).
- `timeBarSpec(data: Record<string, number>, opts?)` — bar chart with chronologically sorted string keys (GEO yearly data).

### Reusable Vega renderer (`src/components/metrics/vega-chart.tsx`)

Generalizes the existing `VegaFull` in `plot-gallery.tsx`:
- Takes a complete Vega-Lite spec (not a builder function)
- Auto-injects `width` based on container size via `ResizeObserver`
- `useRef` + `useEffect` pattern with `vega-embed`
- Same `renderer: 'svg'`, `actions: false` config

### MetricsPage rewrite (`src/components/metrics/metrics-page.tsx`)

Replace placeholder with full implementation:

**State:** `activeSection: 'files' | 'usage' | 'geo'`

**Data:** `useStats()` (already exists), `useDetailedStats()`, `useDetailedUsage()`

**Layout:**
1. Header: "BEDbase Metrics" + summary stat badges (N beds, N bedsets, N genomes)
2. Pill tabs: "File Statistics" | "Usage Statistics" | "GEO Statistics" — `btn btn-sm` with active `btn-primary`
3. Chart grid: responsive `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`
4. Each chart in a card: `border border-base-300 rounded-lg p-4`

**File Statistics** (from `FileStats`):
- Bars: by genome, by assay, by organism, bed compliance, GEO status
- Pies: data format, bed comments
- Histograms: file size, number of regions, mean region width

**Usage Statistics** (from `UsageStats`):
- Bars: most viewed beds, bed search terms, most viewed bedsets, bedset search terms

**GEO Statistics** (from `FileStats.geo`):
- Time bars: annual file count, cumulative file count
- Histogram: GEO file sizes

Loading: skeleton grid. Error: error card with retry.

---

## Implementation Order

1. **Shared utility** — Create `file-model-utils.ts`, update `bed-analysis.ts` imports
2. **Collections hooks** — `use-bedset-list.ts`, `use-bedset-metadata.ts`, `use-bedset-bedfiles.ts`
3. **Collections components** — `bedfile-table.tsx`, `collections-list.tsx`, `collection-detail.tsx`, `collections-view.tsx`
4. **Cart** — Extend cart context with `clearCart`, create `download-script.ts`, create `cart-view.tsx`
5. **Metrics hooks** — `use-detailed-stats.ts`, `use-detailed-usage.ts`
6. **Metrics components** — `metrics-specs.ts`, `vega-chart.tsx`, rewrite `metrics-page.tsx`
7. **Wire up** — Update `tab-content.tsx` to route collections and cart, remove placeholder phase labels

## New files

| File | Purpose |
|------|---------|
| `src/lib/file-model-utils.ts` | Shared `API_BASE`, `fileModelToUrl`, `fileModelToPlotSlot` |
| `src/lib/download-script.ts` | Bash script generation + browser download trigger |
| `src/lib/metrics-specs.ts` | Vega-Lite spec builders: bar, histogram, pie, time bar |
| `src/queries/use-bedset-list.ts` | Bedset list hook |
| `src/queries/use-bedset-metadata.ts` | Bedset metadata hook |
| `src/queries/use-bedset-bedfiles.ts` | Bedset bedfiles hook |
| `src/components/collections/collections-view.tsx` | Collections tab router |
| `src/components/collections/collections-list.tsx` | Browsable bedset list with search |
| `src/components/collections/collection-detail.tsx` | Bedset detail page |
| `src/components/collections/bedfile-table.tsx` | Reusable BedMetadataBasic table |
| `src/components/cart/cart-view.tsx` | Cart tab UI |
| `src/components/metrics/vega-chart.tsx` | Reusable responsive Vega-Lite renderer |

## Modified files

| File | Change |
|------|--------|
| `src/components/tabs/tab-content.tsx` | Route collections + cart tabs, remove placeholder labels |
| `src/contexts/cart-context.tsx` | Add `clearCart` method |
| `src/lib/bed-analysis.ts` | Extract shared utils, update imports |
| `src/components/metrics/metrics-page.tsx` | Full rewrite from placeholder |

## Verification

1. **Collections list**: Open Collections tab → bedset list loads with names, descriptions, bed counts. Search "ENCODE" → filtered results. Pagination works.
2. **Collection detail**: Click a bedset → detail page shows name, description, stats cards, region commonality plot, BED files table. Click a BED file → Analysis tab opens.
3. **Add all to cart**: Click "Add all to cart" on bedset detail → all bed files added to cart context + localStorage.
4. **Cart view**: Open Cart tab → shows all cart items. Remove individual item works. Clear all works (with confirmation).
5. **Cart download**: Click "Download script" → browser downloads a `.sh` file with curl commands for each file.
6. **Cart empty state**: Clear cart → shows empty state with link to search.
7. **Bedset memberships navigation**: From Analysis tab, click a bedset membership badge → Collections tab opens at that bedset's detail page.
8. **Metrics - file stats**: Open Metrics page → file stats tab shows bar charts (by genome, assay, organism), pie charts (data format), histograms (file size, regions, region width).
9. **Metrics - usage stats**: Switch to Usage tab → bar charts for popular files, search terms.
10. **Metrics - GEO stats**: Switch to GEO tab → time bar charts and histogram.
11. **Dev server starts** without errors, **build succeeds** (`npm run build`).
