# Phase 6: UMAP Tab + Cross-Tab Navigation

## Context

Phases 1-5 delivered the tab scaffold, WASM analysis, API-powered search, database file analysis, collections, cart, and metrics. The UMAP tab currently renders a "Coming soon" placeholder. Phase 6 ports the embedding-atlas + DuckDB WASM visualization from the bedhost `new_ui` branch and wires cross-tab highlighting so search results, analysis files, and collection members can be viewed on the UMAP.

### Source: bedhost `new_ui` branch

The `new_ui` branch of bedhost (`repos/bedhost/ui/src/components/umap/`) contains the preferred implementation. Key pattern: `embedding-container.tsx` wrapping `embedding-plot.tsx` with extracted children (legend, table, selections, stats). The container manages a state machine for fullscreen portal expand/collapse.

### Adaptation for bedbase-ui

**Keep**: `embedding-plot.tsx` core (forwardRef, DuckDB queries, range/lasso selection, sticky initial, custom point). All children (legend, table, selections, stats). Mosaic coordinator context. Tooltip.

**Discard**: Expand/collapse portal state machine and `.expandable-card` CSS.

**Split into two**:
1. **`UmapView`** — full UMAP tab (always expanded layout, no state machine)
2. **`EmbeddingPreview`** — compact, read-only mini view for embedding in other pages (analysis, search)

### Key design decisions

**URL params for individual bed IDs**: `/umap?bed=abc123` or `/umap?beds=id1,id2,id3`. Shareable links for small sets.

**App-wide `BucketContext`**: Persistent localStorage-backed selection buckets. Any tab can create buckets. "View on UMAP" from search/collections auto-creates a named bucket and navigates to UMAP. Buckets are NOT bedsets — they're a local client-side feature for managing saved selections across sessions.

**No `UmapContext`**: Replaced by the combination of URL params (individual IDs) and BucketContext (sets of IDs). Eliminates transient state.

---

## Part A: Infrastructure

### New dependencies

```
npm install embedding-atlas@^0.15.0 @uwdata/vgplot@^0.21.1
```

`vite-plugin-wasm` and `vite-plugin-top-level-await` are already installed/configured.

### New file: `src/lib/tableau20.ts`

21-color palette array from old UI's `utils.ts`. Used as `categoryColors` in `EmbeddingViewMosaic` and for legend swatches.

### New file: `src/lib/umap-utils.ts`

- `isPointInPolygon(point, polygon)` — ray-casting for lasso selection (from old `utils.ts`)
- `UMAP_URL` constant
- `UmapPoint` type: `{ identifier, text, x, y, category, fields: { Description, Assay, 'Cell Line' } }`
- `LegendItem` type: `{ category: number; name: string }`

### New file: `src/contexts/mosaic-coordinator-context.tsx`

Port from `repos/bedhost/ui/src/contexts/mosaic-coordinator-context.tsx` (new_ui branch):

```ts
type MosaicCoordinatorContextValue = {
  getCoordinator: () => Coordinator;
  initializeData: () => Promise<void>;
  addCustomPoint: (x: number, y: number, description?: string) => Promise<void>;
  deleteCustomPoint: () => Promise<void>;
  webglStatus: { checking: boolean; webgl2: boolean; error: string | null };
};
```

- Lazy singleton coordinator via `vg.Coordinator(vg.wasmConnector())`
- `initializeData()` loads HuggingFace JSON into DuckDB, computes ranked category columns
- WebGPU → WebGL2 fallback detection
- `addCustomPoint` inserts `id='custom_point'` with category = `max + 1`
- Remove `react-hot-toast` dependency

### New file: `src/contexts/bucket-context.tsx`

App-wide, localStorage-persisted selection bucket manager:

```ts
type SelectionBucket = {
  id: string;           // unique ID (uuid or timestamp-based)
  name: string;         // user-visible label, e.g. "Search: H3K27ac"
  bedIds: string[];     // the bed file IDs in this bucket
  enabled: boolean;     // whether highlighted on UMAP
  createdAt: number;    // timestamp
  order: number;        // display order (for drag-to-reorder)
};

type BucketContextValue = {
  buckets: SelectionBucket[];          // sorted by order
  createBucket: (name: string, bedIds: string[]) => string;  // returns bucket id
  deleteBucket: (id: string) => void;
  toggleBucket: (id: string) => void;
  renameBucket: (id: string, name: string) => void;
  reorderBuckets: (orderedIds: string[]) => void;  // set new order from ID array
  clearBuckets: () => void;
  enabledBedIds: string[];             // deduplicated union of all enabled buckets' bedIds
  bucketCount: number;
};
```

- `localStorage` key: `bedbase-buckets`
- `enabledBedIds` is a memoized flat array: all enabled buckets' bedIds, deduplicated
- `createBucket` returns the new bucket's ID; the bucket starts `enabled: true`
- `reorderBuckets` takes an array of bucket IDs in desired order and re-assigns `order` values
- `buckets` is always returned sorted by `order`

### Provider wiring: `src/pages/app.tsx`

Add `MosaicCoordinatorProvider` and `BucketProvider` to provider tree.

### Keep-mounted UMAP: `src/components/layout/app-layout.tsx`

DuckDB WASM init is slow; unmounting discards it. Strategy:
- `umapEverOpened` ref (starts `false`, set `true` on first UMAP tab activation)
- Render `<UmapView />` in `<div style={{ display: isUmapActive ? 'contents' : 'none' }}>`, only after `umapEverOpened`
- `TabContent` returns `null` for `tab.id === 'umap'`

---

## Part B: Query Hook

### New file: `src/queries/use-bed-umap.ts`

`useMutation` wrapping `POST /bed/umap`:

```ts
export function useBedUmap() {
  const { api } = useApi();
  return useMutation({
    mutationFn: async (file: File): Promise<number[]> => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post<number[]>('/bed/umap', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
  });
}
```

---

## Part C: Core Plot Component

### New file: `src/components/umap/embedding-plot.tsx`

Direct port of `repos/bedhost/ui/src/components/umap/embedding-plot.tsx` (new_ui branch). The `forwardRef` wrapping `EmbeddingViewMosaic`.

**Props** (same as new_ui):
- `bedIds`, `height`, `colorGrouping`, `filterSelection`
- `highlightPoints` (bucket points from parent)
- `selectedPoints`, `onSelectedPointsChange`
- `onLegendItemsChange`, `onFilterSelectionChange`
- `customCoordinates`, `customFilename`
- `preselectPoint`, `stickyInitial`, `centerInitial`, `tooltipInitial`, `simpleTooltip`, `showStatus`

**Exposed ref**: `centerOnBedId`, `handleFileUpload`, `handleFileRemove`, `handleLegendClick`, `queryByCategory`, `clearRangeSelection`

**Key internals** (all from new_ui):
- `isReady` after `initializeData()`
- `filter = vg.Selection.intersect()` for legend filtering
- `visualSelection = dedupe(selectedPoints, highlightPoints)`
- `skipNextSelectionRef` on legend clicks
- `handleRangeSelection` with lasso (`isPointInPolygon`)
- `dataVersion` key for remount after custom point mutations
- `fetchLegendItems` on colorGrouping change

**Changes from source**: Replace Bootstrap → Tailwind/DaisyUI. Import utilities from new paths. Use `useTab().openTab` for navigation.

---

## Part D: Supporting Components

### New file: `src/components/umap/atlas-tooltip.tsx`

Port from new_ui. Class-based (embedding-atlas API). `simpleTooltip` / full modes. Restyle with Tailwind. Pass `onNavigate` callback for "Go!" link.

### New file: `src/components/umap/embedding-legend.tsx`

Port from new_ui. Cell Line / Assay toggle, color swatch table, click-to-filter, "Save Selection" button on active filter. Restyle with DaisyUI (`btn btn-xs`, `table table-sm text-xs`, `bg-primary/5`).

### New file: `src/components/umap/embedding-table.tsx`

Port from new_ui. Table of selected points. Click row → center plot. "View" → `openTab('analysis', id)`. Filter out `custom_point`. Restyle with DaisyUI.

### New file: `src/components/umap/embedding-selections.tsx`

Port from new_ui, **enhanced to use `BucketContext`**:

In new_ui, buckets are component-local state. In bedbase-ui, they come from `BucketContext` (localStorage-persisted, app-wide). The UI is the same: checkbox toggle, inline rename, trash delete, "Save Selection" button. But the data layer calls `BucketContext` methods instead of local `setBuckets`.

**Key change**: When saving a selection (range/lasso/legend category), the selected bed IDs are extracted and passed to `createBucket(name, bedIds)`. The component reads `buckets` from context.

To integrate with the UMAP-specific "plot selection" concept (saving currently-selected points on the map as a bucket):
- "Save Selection" in the Selections panel: takes `selectedPoints` (UmapPoint[]) → extracts `.identifier` → calls `createBucket(name, identifiers)`
- "Save Selection" in the Legend panel: calls `queryByCategory` → extracts identifiers → `createBucket`

### New file: `src/components/umap/embedding-stats.tsx`

Port from new_ui. Bar chart of selection counts per category. Fetches totals from DuckDB. Restyle with DaisyUI.

---

## Part E: Full UMAP Tab

### New file: `src/components/umap/umap-view.tsx`

Top-level orchestrator. Replaces `embedding-container.tsx`'s expanded state without portal/state machine.

**State** (managed here, not in context):
- `colorGrouping: 'cell_line_category' | 'assay_category'`
- `legendItems: LegendItem[]`
- `filterSelection: LegendItem | null`
- `selectedPoints: UmapPoint[]` (from interactive plot selection)
- `file: File | null` (local UMAP file upload)
- `customCoordinates: number[] | null`

**Data sources**:
- `bedFile` from `FileContext` — auto-project uploaded file onto UMAP
- `enabledBedIds` from `BucketContext` — union of all enabled bucket IDs
- URL params: `?bed=abc123` or `?beds=id1,id2,id3` — parsed from location

**bedIds computation**: merge URL param IDs + enabledBedIds (deduplicated). Pass as `bedIds` to `EmbeddingPlot`.

**Bucket integration**:
- `bucketPoints`: map `enabledBedIds` through the plot ref to get full UmapPoint data (query DuckDB for coordinates). Or simpler: pass `enabledBedIds` as `bedIds` prop → EmbeddingPlot handles the highlighting.
- For the `highlightPoints` prop (which renders bucket points distinctly from interactive selection): query DuckDB for all `enabledBedIds` that are NOT in `selectedPoints`. This keeps bucket highlights visible alongside interactive selections.

**File handling**: Two file sources:
1. `bedFile` from FileContext (uploaded via File tab)
2. Local `file` from hidden input within UMAP tab

`useEffect` on file changes: call `getBedUmap(file)` → `addCustomPoint(x, y, name)`.

**Layout**:
```
<div className="flex flex-col h-full overflow-hidden p-4 @md:p-6 gap-4">
  {/* Header row */}
  <div className="flex items-center gap-3 shrink-0">
    title + bucket badge + file status + upload button
  </div>
  {/* Main: plot + sidebar */}
  <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
    <div className="flex-[77.5] flex flex-col gap-3 min-w-0">
      <EmbeddingPlot ref={plotRef} ... className="flex-1 min-h-0" />
      <EmbeddingTable selectedPoints={...} className="max-h-64 shrink-0" />
    </div>
    <div className="flex-[22.5] flex flex-col gap-3 overflow-y-auto">
      <EmbeddingLegend ... />
      <EmbeddingSelections ... />
      <EmbeddingStats ... />
    </div>
  </div>
</div>
```

---

## Part F: Compact Preview Component

### New file: `src/components/umap/embedding-preview.tsx`

Compact, read-only mini UMAP for embedding in other pages.

**Props**: `bedIds?: string[]`, `height?: number`, `className?: string`

**Behavior**:
- Renders `EmbeddingPlot` at given height, `simpleTooltip=true`, `showStatus=false`
- `preselectPoint=true`, `centerInitial=false`, `tooltipInitial=true`
- Non-interactive overlay: `pointer-events: none` on the plot, entire card clickable
- Click → `openTab('umap')` (bucket or URL params already set by host page)
- WebGL error → graceful fallback (small error message or hidden)
- Style: `border border-base-300 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow`

**Usage**: Database analysis page (when `genome_alias === 'hg38'`).

---

## Part G: Collections Tab — Bucket Management

The Collections tab becomes the unified home for both server-side bedsets and local buckets.

### Modified file: `src/components/collections/collections-list.tsx`

Currently shows a centered "BEDsets" header with search + table. Restructure to have two section-header areas (same pattern as analysis-view section headers):

**Layout**:
```
<div className="flex flex-col h-full overflow-auto px-4 @md:px-6">
  {/* Buckets section (shown first — user's local data) */}
  <div className="space-y-3 pt-8 pb-6">
    <h3 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide">
      My Buckets
    </h3>
    {buckets.length > 0 ? <BucketsTable /> : <BucketsEmpty />}
  </div>

  <div className="border-b border-base-300 mb-6" />

  {/* BEDsets section (existing, moved below) */}
  <div className="space-y-3 pb-6">
    <h3 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide">
      BEDsets
    </h3>
    <p className="text-base-content/50 text-sm">
      Curated collections of BED files grouped by experiment, cell type, or other criteria.
    </p>
    {/* existing search + table + pagination */}
  </div>
</div>
```

### New inline component: `BucketsTable` (in collections-list.tsx or extracted)

Table of all buckets from `BucketContext`:

| Column | Content |
|--------|---------|
| Drag handle | `GripVertical` icon for reordering |
| Enable | Checkbox → `toggleBucket(id)` |
| Name | Inline-editable text → `renameBucket(id, name)` |
| Count | `{bucket.bedIds.length} files` badge |
| Created | `bucket.createdAt` formatted as date |
| Actions | "View on UMAP" button → `openTab('umap')` (bucket is already enabled). Trash icon → `deleteBucket(id)` with confirmation. |

**Reordering**: Drag-and-drop rows to reorder. On drop, call `reorderBuckets(newOrderedIds)`. Use HTML5 drag events (same pattern as tab drag in `app-layout.tsx` — `draggable`, `onDragStart/End/Over/Drop`). No new dependency needed.

**Inline rename**: Click name → text input, Enter/Escape/blur to confirm/cancel. Same pattern as `embedding-selections.tsx` in the old UI.

**Empty state**: "No buckets yet. Buckets are created when you view search results or collection members on the UMAP." with a subtle `ScatterChart` icon.

**"Clear all buckets"** button in the section header (only shown when buckets exist), with confirmation dialog.

### Modified file: `src/components/collections/collections-view.tsx`

No change needed — `CollectionsList` already renders when `param` is empty. The bucket section is added within `CollectionsList`.

---

## Part H: Cross-Tab Wiring

### Search → UMAP

**`src/components/search/search-view.tsx`**: In `TextSearchResults` and `BedSearchResults`:
- Add "View on UMAP" button (visible when results loaded):
  ```tsx
  <button onClick={() => {
    const ids = data.results.map(r => r.metadata?.id).filter(Boolean);
    createBucket(`Search: ${query}`, ids);
    openTab('umap');
  }} className="btn btn-xs btn-ghost gap-1">
    <ScatterChart size={12} /> View on UMAP
  </button>
  ```
- One click: auto-creates a named bucket + navigates to UMAP

### Analysis → UMAP

**`src/components/analysis/action-bar.tsx`**: Add UMAP button for database files:
```tsx
<button onClick={() => openTab('umap', undefined, { bed: analysis.id })} className={linkClass}>
  <ScatterChart size={13} /> UMAP
</button>
```
This navigates to `/umap?bed=abc123` — the UMAP reads the URL param.

**`src/components/analysis/analysis-view.tsx`**:
- In `AnalysisPanels` for hg38 database files: render `<EmbeddingPreview bedIds={[analysis.id]} />`
- In `LocalHeader`: "View on UMAP" button → `openTab('umap')` (custom point handled via FileContext)

### Collections → UMAP

**`src/components/collections/collection-detail.tsx`**:
- Add "View on UMAP" button:
  ```tsx
  <button onClick={() => {
    createBucket(`Bedset: ${meta.name}`, bedfileList.map(b => b.id));
    openTab('umap');
  }} className={linkClass}>
    <ScatterChart size={13} /> View on UMAP
  </button>
  ```

### Tab URL param support

**`src/contexts/tab-context.tsx`**: The UMAP tab needs to read query params (`?bed=` or `?beds=`). Check if the current routing already passes search params through `tab.param` or if we need to parse `location.search` directly in `UmapView`. The simplest approach: `UmapView` reads `useSearchParams()` directly for `bed`/`beds` params, independent of the tab param system.

---

## Part H: Tab Content Changes

### `src/components/tabs/tab-content.tsx`

Return `null` for `tab.id === 'umap'` (rendering handled at app-layout level):

```tsx
if (tab.id === 'umap') return null;
```

---

## New Files Summary

| File | Purpose |
|------|---------|
| `src/lib/tableau20.ts` | 21-color categorical palette |
| `src/lib/umap-utils.ts` | `isPointInPolygon`, `UMAP_URL`, `UmapPoint`, `LegendItem` types |
| `src/contexts/mosaic-coordinator-context.tsx` | DuckDB WASM singleton + data init + custom point mutations + WebGL detection |
| `src/contexts/bucket-context.tsx` | App-wide localStorage-persisted selection buckets |
| `src/queries/use-bed-umap.ts` | POST /bed/umap mutation |
| `src/components/umap/atlas-tooltip.tsx` | Class-based tooltip for embedding-atlas |
| `src/components/umap/embedding-plot.tsx` | Core EmbeddingViewMosaic forwardRef wrapper (port from new_ui) |
| `src/components/umap/embedding-legend.tsx` | Color grouping toggle + filterable legend + save selection |
| `src/components/umap/embedding-table.tsx` | Table of highlighted points with navigation |
| `src/components/umap/embedding-selections.tsx` | Bucket manager UI (reads/writes BucketContext) |
| `src/components/umap/embedding-stats.tsx` | Bar chart of selection counts per category |
| `src/components/umap/umap-view.tsx` | Full UMAP tab orchestrator |
| `src/components/umap/embedding-preview.tsx` | Compact read-only preview for other pages |

## Modified Files Summary

| File | Change |
|------|--------|
| `src/pages/app.tsx` | Add MosaicCoordinatorProvider + BucketProvider |
| `src/components/layout/app-layout.tsx` | Keep-mounted UMAP rendering |
| `src/components/tabs/tab-content.tsx` | Return null for umap tab |
| `src/components/search/search-view.tsx` | "View on UMAP" button → auto-create bucket + navigate |
| `src/components/analysis/analysis-view.tsx` | EmbeddingPreview for hg38 files, UMAP button in LocalHeader |
| `src/components/analysis/action-bar.tsx` | Add UMAP button (navigates with URL param) |
| `src/components/collections/collections-list.tsx` | Restructure: add "My Buckets" section with table above existing BEDsets |
| `src/components/collections/collection-detail.tsx` | "View on UMAP" → auto-create bucket + navigate |

## Implementation Order

1. `src/lib/tableau20.ts` + `src/lib/umap-utils.ts`
2. `npm install embedding-atlas @uwdata/vgplot`
3. `src/contexts/mosaic-coordinator-context.tsx`
4. `src/contexts/bucket-context.tsx`
5. Provider wiring in `src/pages/app.tsx`
6. `src/queries/use-bed-umap.ts`
7. `src/components/umap/atlas-tooltip.tsx`
8. `src/components/umap/embedding-plot.tsx` (largest file — core port)
9. `src/components/umap/embedding-legend.tsx`
10. `src/components/umap/embedding-table.tsx`
11. `src/components/umap/embedding-selections.tsx` (wired to BucketContext)
12. `src/components/umap/embedding-stats.tsx`
13. `src/components/umap/umap-view.tsx`
14. `src/components/umap/embedding-preview.tsx`
15. Tab content + keep-mounted changes
16. Collections bucket management (`collections-list.tsx` restructure)
17. Cross-tab wiring (search, analysis, collections)

## Verification

### UMAP rendering
1. Open UMAP tab → loading spinner → all points render with cell line coloring
2. Toggle Cell Line / Assay → colors re-map, legend updates
3. Click legend item → filter; click again → clear
4. "Save Selection" on legend filter → bucket created + persisted in localStorage
5. Reload page → buckets persist, enabled buckets highlight on UMAP
6. Toggle bucket on/off → highlighted points update
7. Rectangle/lasso selection → selected points in table
8. Click point in table → plot centers
9. Click "View" in table → Analysis tab opens
10. Switch away and back to UMAP → instant (no DuckDB reload)

### Cross-tab navigation
11. Text search → "View on UMAP" → bucket auto-created + UMAP opens with results highlighted
12. Bed-to-bed search → same auto-bucket flow
13. Database analysis → UMAP button in action bar → `/umap?bed=abc123` → single point highlighted
14. Database analysis (hg38) → EmbeddingPreview shown → click → full UMAP tab
15. Collection detail → "View on UMAP" → bucket auto-created → members highlighted

### File projection
16. Upload BED file → open UMAP → custom point projected and appears
17. Upload file within UMAP tab → same projection flow
18. Remove file → custom point disappears

### Collections bucket management
19. Collections tab shows "My Buckets" section above "BEDsets"
20. Buckets table: rename inline (click name → edit), delete (trash icon + confirm), toggle enable/disable
21. Drag-to-reorder buckets → order persists in localStorage
22. "View on UMAP" from bucket row → UMAP opens with that bucket's points
23. "Clear all buckets" works with confirmation
24. Empty bucket state message shown when no buckets exist

### Error handling + build
25. WebGL unavailable → error card
26. `npm run build` succeeds
