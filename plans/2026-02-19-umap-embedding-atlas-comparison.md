---
date: 2026-02-19
status: complete
description: Comparison of bedbase-ui UMAP wrapper vs embedding-atlas internals
---

# UMAP Implementation Comparison: bedbase-ui vs embedding-atlas

## Overview

bedbase-ui wraps `EmbeddingViewMosaic` from `embedding-atlas` (v0.15.0) with a React layer that adds domain-specific features: BED file upload/projection, persistent selections (URL pinning, buckets), category-based legend filtering, and cross-tab navigation. The rendering itself is delegated entirely to embedding-atlas's WebGPU/WebGL2 pipeline.

This report identifies where bedbase-ui's wrapper layer introduces inefficiencies, correctness issues, or missed opportunities relative to how embedding-atlas is designed to be used.

---

## 1. Raw SQL String Interpolation (Correctness + Maintainability)

**bedbase-ui** builds all DuckDB queries via template string interpolation:

```typescript
// embedding-plot.tsx:127-133
`SELECT ... FROM data WHERE id IN ('${ids.join("','")}')`

// embedding-plot.tsx:250-256
`WHERE x >= ${value.xMin} AND x <= ${value.xMax} AND y >= ${value.yMin} AND y <= ${value.yMax}${filterClause}`

// embedding-plot.tsx:208
`WHERE ${colorGrouping} = '${category}'`
```

**embedding-atlas** uses the Mosaic SQL builder (`@uwdata/mosaic-sql`) throughout:

```typescript
// mosaic_client.ts:17-18
SQL.or(...points.map(p => SQL.eq(SQL.column(identifier), SQL.literal(p.identifier))))

// mosaic_client.ts:85-86
SQL.isBetween(SQL.column(source.x), [range.xMin, range.xMax])
```

### Problems

- **Injection risk.** While DuckDB WASM is client-side only (no multi-tenant risk), IDs coming from URL params (`?bed=...`, `?beds=...`) are interpolated directly into SQL. A malformed ID containing a single quote breaks the query silently.
- **Type coercion.** The SQL builder uses `SQL.literal()` which handles type-aware escaping. Raw interpolation doesn't distinguish between strings, numbers, and NULL.
- **Maintainability.** Every query is a standalone string. The SQL builder composes predicates, making it possible to add filters without string surgery.

### Recommendation

Replace raw SQL strings with Mosaic SQL builder calls. The coordinator already supports parameterized queries. This is a low-effort change that eliminates an entire class of bugs.

**Reference:** `embedding-atlas/packages/component/src/lib/embedding_view/mosaic_client.ts` — `predicateForDataPoints()`, `predicateForRangeSelection()`, `DataPointQuery` class.

---

## 2. Two-Pass Lasso Selection (Performance)

**bedbase-ui** handles polygon (lasso) selection with a two-query round trip:

```typescript
// embedding-plot.tsx:258-286
// Step 1: Bounding box query → get candidates (minimal columns)
const candidates = await coord.query(
  `SELECT x, y, id as identifier FROM data
   WHERE x >= ${xMin} AND x <= ${xMax} AND y >= ${yMin} AND y <= ${yMax}${filterClause}`
);
// Step 2: Client-side ray-casting filter
const filteredIds = candidates
  .filter(point => isPointInPolygon(point, value))
  .map(p => `'${p.identifier}'`).join(',');
// Step 3: Full data query for matched IDs
result = await coord.query(`SELECT ... FROM data WHERE id IN (${filteredIds})${filterClause}`);
```

**embedding-atlas** does it in a single SQL query with a database-side point-in-polygon predicate:

```typescript
// mosaic_client.ts:46-75 — pointInPolygonPredicate()
// Translates the ray-casting algorithm into SQL expressions
// Then combines with bounding box:
SQL.and(
  SQL.isBetween(SQL.column(source.x), [bounds.xMin, bounds.xMax]),
  SQL.isBetween(SQL.column(source.y), [bounds.yMin, bounds.yMax]),
  pointInPolygonPredicate(SQL.column(source.x), SQL.column(source.y), range)
)
```

### Problems

- **3 queries instead of 1.** The bounding box query transfers candidate rows to JS, then the filtered IDs go back to DuckDB for a second query. With dense regions this can mean transferring thousands of rows just to discard most of them.
- **Client-side geometry.** JavaScript `isPointInPolygon` runs on the main thread. DuckDB's vectorized execution would be faster for large candidate sets.
- **String concatenation of IDs.** The filtered IDs are joined into a SQL `IN (...)` clause via string interpolation, which has no upper bound. With a large selection this produces a massive SQL string.

### Recommendation

Implement `pointInPolygonPredicate` as a SQL expression using the Mosaic SQL builder, following the pattern in `mosaic_client.ts:46-75`. This eliminates the intermediate data transfer and keeps the work in DuckDB.

**Reference:** `embedding-atlas/packages/component/src/lib/embedding_view/mosaic_client.ts:46-95`

---

## 3. Timer-Based Async Coordination (Correctness)

**bedbase-ui** uses `setTimeout` in multiple places to sequence operations:

```typescript
// embedding-plot.tsx:118-119
setTimeout(() => setTooltipPoint(point), 300);

// embedding-plot.tsx:154-164
setTimeout(async () => {
  const points = await queryPoints(['custom_point']);
  if (points.length > 0) {
    centerOnPoint(points[0], 0.3, true);
    // ...
  }
}, 200);

// embedding-plot.tsx:296-300
setTimeout(() => {
  onSelectedPointsChange?.(pendingSelection);
  setPendingSelection(null);
}, 100);

// embedding-plot.tsx:339
await new Promise(r => setTimeout(r, 50));
```

**embedding-atlas** uses deterministic coordination internally:
- Reactive dependency tracking triggers re-renders only when inputs change.
- `requestAnimationFrame` for render batching (one RAF per frame, coalesced).
- Throttled hover queries with proper cancellation (see `throttleTooltip()` in `utils.ts` — pure TypeScript, framework-agnostic).

### Problems

- **Race conditions.** The 50ms, 100ms, 200ms, 300ms timeouts are tuned to "usually work" but have no guarantee. On a slow machine or under load, DuckDB initialization may not complete in 50ms, or the Mosaic coordinator may not have flushed in 200ms.
- **Stacking.** If a user rapidly uploads/removes files, multiple timeout callbacks can execute out of order.
- **Wasted frames.** A 300ms tooltip delay is either too slow (perceptible lag) or too fast (flicker if the underlying query hasn't resolved). The embedding-atlas throttle system uses a proper request queue that shows the tooltip as soon as the query resolves.

### Recommendation

Replace timeouts with deterministic coordination:
- Use the coordinator's promise completion to gate subsequent operations (the `initializeData()` promise already exists but isn't used consistently).
- For tooltip delays, port the throttle pattern from `embedding-atlas/packages/component/src/lib/utils.ts:throttleTooltip()` — it's pure TypeScript (no Svelte dependency) and can be used directly in React. It batches with a minimum delay but resolves immediately when the query completes.
- For selection state after data version changes, use a `useEffect` that watches `isReady` and `dataVersion` rather than a blind timeout. Or better yet, eliminate `dataVersion` entirely (see #4).

**Reference:** `embedding-atlas/packages/component/src/lib/utils.ts` — `throttleTooltip()` function (pure TS, copy-portable).

---

## 4. Full Remount on Data Changes (Performance)

**bedbase-ui** forces a full component remount when data changes:

```typescript
// embedding-plot.tsx:153
setDataVersion(v => v + 1);

// embedding-plot.tsx:422
<EmbeddingViewMosaic key={`embedding-${dataVersion}`} ... />
```

When `key` changes, React destroys the entire `EmbeddingViewMosaic` instance (including its WebGL/WebGPU context, compiled shaders, density maps, and internal state) and creates a new one from scratch.

**embedding-atlas** is designed for incremental updates:
- The `EmbeddingView.update(props)` method accepts partial prop updates.
- The dataflow system (`dataflow.ts`) tracks dependencies and only recomputes what changed.
- GPU resources (buffers, pipelines) are cached and reused.

### Problems

- **GPU context teardown/setup.** WebGPU device creation is async and involves adapter negotiation. WebGL context creation triggers shader compilation. This adds hundreds of milliseconds per remount.
- **Data retransfer.** All point data must be re-uploaded to GPU memory after remount.
- **State loss.** Viewport position, zoom level, and any internal caches are lost.

This currently happens on file upload and file removal — two common user actions.

### Recommendation

Instead of remounting, use `coordinator.clear()` (which is already called) and let Mosaic refetch. Under the hood, the `EmbeddingViewMosaic` React wrapper forwards prop changes to the Svelte internals, which watches its data source and re-renders when the underlying table changes. From your React code, this means: update the DuckDB table, call `coordinator.clear()`, and let the existing component instance pick up the change — no `key` swap needed.

If the Mosaic connector's change notifications aren't sufficient for a specific case, try updating a prop (like passing a new `filter` value) to trigger a refresh without destroying the component.

**Reference:** `embedding-atlas/packages/component/src/lib/embedding_view/embedding_view_api.ts` — `update()` method (called internally by the React wrapper when props change).

---

## 5. Auto-Labels Disabled (Feature Gap)

**bedbase-ui** explicitly disables automatic cluster labels:

```typescript
// embedding-plot.tsx:439
config={{ autoLabelEnabled: false }}
```

**embedding-atlas** has a sophisticated label system:
1. Generate density maps at two bandwidth scales (10, 5) for multi-resolution clustering.
2. Run connected-component analysis to find clusters.
3. Query text within each cluster's bounding rectangles.
4. Use TF-IDF keyword extraction to generate labels.
5. Apply dynamic label placement (Been et al., IEEE TVCG 2006) with scale-dependent visibility.
6. Cache results for consistent display across frames.

### Why This Matters

For BEDbase, labels would show dominant assay types or cell lines in each cluster region, giving users immediate orientation without needing to hover individual points. The UMAP has clear clusters (evidenced by the category-based coloring), and labels would annotate them.

### Recommendation

This was likely disabled for a reason (possibly performance, or the text column `name` doesn't produce useful cluster summaries). Options:

1. **Enable with custom `queryClusterLabels`.** Instead of the default TF-IDF summarizer, write a callback that returns the dominant assay/cell_line for each cluster region. This would produce labels like "ATAC-seq" or "K562" on the map.
2. **Provide static labels.** If the UMAP structure is stable, pre-compute cluster labels and pass them via the `labels` prop. This avoids the runtime density/clustering computation entirely.
3. **Enable default summarization** but with domain-specific stop words via `autoLabelStopWords` to filter out common but uninformative terms.

**Reference:** `embedding-atlas/packages/component/src/lib/embedding_view/labels.ts`; `embedding-atlas/packages/component/src/lib/text_summarizer/text_summarizer.ts`; `embedding-atlas/packages/component/src/lib/dynamic_label_placement/dynamic_label_placement.ts`

---

## 6. Selection State Complexity (Architecture)

**bedbase-ui** maintains 5+ overlapping selection arrays across 2 components:

| Location | State | Purpose |
|---|---|---|
| `UmapView` | `selectedPoints` | Interactive (click/range) |
| `UmapView` | `persistentPoints` | From EmbeddingPlot callback |
| `UmapView` | `allVisiblePoints` | Merged persistent + interactive |
| `EmbeddingPlot` | `persistentPoints` (state) | Merged preselected + bucket |
| `EmbeddingPlot` | `persistentRef` (ref) | `{ preselected: [], bucket: [] }` |
| `EmbeddingPlot` | `visualSelection` (memo) | Merged persistent + interactive + highlight |
| `EmbeddingPlot` | `pendingSelection` | Deferred selection after data version change |

The `updatePersistent` function merges two sub-arrays into a deduplicated list:
```typescript
// embedding-plot.tsx:71-83
const updatePersistent = (key: 'preselected' | 'bucket', points: UmapPoint[]) => {
  persistentRef.current[key] = points;
  const seen = new Set<string>();
  const merged: UmapPoint[] = [];
  for (const p of persistentRef.current.preselected) { ... }
  for (const p of persistentRef.current.bucket) { ... }
  setPersistentPoints(merged);
  onPersistentPointsChange?.(merged);
};
```

Then `visualSelection` merges again:
```typescript
// embedding-plot.tsx:98-114
const visualSelection = useMemo(() => {
  const merged: UmapPoint[] = [];
  for (const p of persistentPoints) { ... }
  for (const p of (selectedPoints || [])) { ... }
  for (const p of (highlightPoints || [])) { ... }
  return merged;
}, [selectedPoints, highlightPoints, persistentPoints]);
```

Then `allVisiblePoints` in UmapView merges yet again:
```typescript
// umap-view.tsx:48-58
const allVisiblePoints = useMemo(() => {
  const merged: UmapPoint[] = [];
  for (const p of persistentPoints) { ... }
  for (const p of selectedPoints) { ... }
  return merged;
}, [persistentPoints, selectedPoints]);
```

**embedding-atlas** exposes 3 clean, non-overlapping selection props (which you pass from React):
- `selection: DataPoint[]` — clicked/selected points
- `rangeSelection: Rectangle | Point[]` — geometric region
- `tooltip: DataPoint` — hovered point

### Problems

- **Triple deduplication.** The same `Set<string>` dedup runs 3 times per state change.
- **Stale closures.** `useImperativeHandle` at line 394 lists `[filterSelection, colorGrouping, selectedPoints]` as deps but `centerOnBedId`, `handleFileUpload`, etc. close over other state that isn't in the deps array.
- **Ref + state hybrid.** `persistentRef` is a mutable ref that also triggers state updates via `setPersistentPoints`. This breaks React's model — the ref mutation is invisible to React's dependency tracking, so derived values can be stale.

### Recommendation

Consolidate into a single selection model:

```typescript
type SelectionState = {
  pinned: Map<string, UmapPoint>;      // URL + bucket (persistent)
  interactive: Map<string, UmapPoint>;  // Click/range (ephemeral)
};
```

Use a `useReducer` with actions like `SET_PINNED`, `SET_INTERACTIVE`, `CLEAR_INTERACTIVE`. Compute `allVisible` as a single derived value. This eliminates the ref/state hybrid and the triple-merge.

---

## 7. Tooltip Lifecycle Management (Correctness)

**bedbase-ui** uses `createRoot` per tooltip, with a deferred unmount:

```typescript
// atlas-tooltip.tsx:104-127
constructor(target: HTMLElement, props: TooltipProps) {
  this.root = createRoot(target);
  // ...
}
destroy() {
  setTimeout(() => this.root.unmount(), 0);
}
```

**embedding-atlas** manages tooltips internally via its component lifecycle — the library handles positioning and show/hide. It accepts a `customTooltip` class with `constructor(target, props)`, `update(props)`, and `destroy()` methods. The default implementation (`DefaultTooltipRenderer`) uses plain DOM manipulation — no framework overhead.

### Problems

- **React root per tooltip.** Each `createRoot` call creates a separate React fiber tree with its own scheduler. This is heavyweight for a transient element.
- **Deferred unmount timing.** `setTimeout(() => this.root.unmount(), 0)` means the old tooltip's React tree persists for one macrotask after embedding-atlas calls `destroy()`. If a new tooltip is created in the same frame, two roots briefly coexist.
- **No access to React context.** The tooltip is rendered in an orphaned React root, so it can't access theme context, router context, or any other provider. The `onNavigate` callback works around this but is fragile.

### Recommendation

Use a React portal instead of `createRoot`. Render the tooltip in the main React tree (positioned absolutely over the canvas) and control visibility via state. This gives full context access and eliminates the root lifecycle overhead.

Alternatively, since embedding-atlas accepts a class-based custom component, the current approach is functionally correct — just avoid `createRoot` by using direct DOM manipulation (which is what embedding-atlas's `DefaultTooltipRenderer` does).

**Reference:** `embedding-atlas/packages/component/src/lib/embedding_view/EmbeddingViewImpl.svelte:678-705` — `DefaultTooltipRenderer` class uses plain DOM manipulation, no framework root.

---

## 8. WebGPU Fallback Override (Correctness)

**bedbase-ui** overrides `navigator.gpu` to force WebGL2:

```typescript
// mosaic-coordinator-context.tsx:117-119
if (!webgpuAvailable && webgl2Available) {
  if ('gpu' in navigator) {
    Object.defineProperty(navigator, 'gpu', { get: () => undefined, configurable: true });
  }
}
```

**embedding-atlas** handles the fallback internally:
```typescript
// EmbeddingViewImpl.svelte:331-378
function setupWebGPURenderer(canvas) {
  async function createRenderer() {
    let device = await requestWebGPUDevice();
    if (device == null) {
      if (canFallbackToWebGL) setupWebGLRenderer(canvas);
      return;
    }
    // ...
  }
}
```

### Context

This was added deliberately for two reasons:
1. **Fallback reliability.** embedding-atlas's built-in fallback didn't work reliably on some browsers — the WebGPU adapter request would succeed but the device would fail or hang, preventing the WebGL2 fallback from triggering.
2. **Custom error messaging.** The `webglStatus` state drives a domain-specific error message ("WebGL2 is unavailable. Please enable it or use a different browser to view the UMAP.") rendered in `embedding-plot.tsx:407-417`, replacing embedding-atlas's generic status bar with something actionable for BEDbase users.

### Problems

- **Global mutation.** Overriding `navigator.gpu` affects all code on the page, not just embedding-atlas. If any other library checks for WebGPU support, it'll see `undefined` even if the browser actually has partial WebGPU support.

### Recommendation

Both motivations are valid. Keep the workaround but add a comment documenting which browsers/conditions triggered the fallback issue. Consider filing upstream on embedding-atlas — their fallback logic (`setupWebGPURenderer` in `EmbeddingViewImpl.svelte:331-378`) has a `canFallbackToWebGL` guard but it may not cover all failure modes. Long-term, the fallback fix should live in the library, while the custom error message is a reasonable consumer-side concern.

---

## 9. Data Loading Strategy (Performance)

**bedbase-ui** loads UMAP data eagerly on app start:

```typescript
// mosaic-coordinator-context.tsx:93-95
useEffect(() => {
  initializeData().catch(() => {});
}, []);
```

This fetches the full JSON from HuggingFace (`hg38_umap_3_13.json`), loads it into DuckDB WASM, computes category rankings, and builds an ID lookup set — even if the user never visits the UMAP tab.

Additionally, after loading, it fetches all IDs into a JavaScript `Set`:
```typescript
// mosaic-coordinator-context.tsx:69-72
const ids = await coordinator.query('SELECT id FROM data', { type: 'json' });
setUmapBedIds(new Set(ids.map(row => row.id)));
```

### Problems

- **Unnecessary upfront cost.** If the user only uses the analysis or search tabs, the UMAP data download and DuckDB initialization are wasted.
- **Duplicate ID storage.** IDs exist in DuckDB and also in a JavaScript Set. For a large dataset this doubles memory for the ID column. The Set is used for "is this ID in the UMAP?" checks, but a single `SELECT 1 FROM data WHERE id = ?` query would be equivalent.

### Recommendation

- Lazy-load UMAP data on first UMAP tab visit. Keep the DuckDB coordinator initialized (it's lightweight), but defer the JSON fetch.
- Replace the JavaScript ID `Set` with a DuckDB query when needed. Alternatively, if the check is on a hot path, use a Bloom filter or keep the Set but load it lazily.

---

## 10. Color Handling (Minor)

**bedbase-ui** uses a fixed Tableau 20 palette:
```typescript
// tableau20.ts — 20 hardcoded hex colors
```

**embedding-atlas** uses D3 category scales with automatic extension:
```typescript
// colors.ts — generates N colors from D3 schemes, repeating if needed
```

### Not a Problem Per Se

The Tableau 20 palette is well-chosen and the 18+Other+Uploaded scheme is sound. However, the colors are passed as hex strings, and embedding-atlas converts them internally to RGB arrays. A minor optimization would be to pass RGB arrays directly, but the overhead is negligible.

---

## Summary of Recommendations

| # | Issue | Severity | Effort |
|---|---|---|---|
| 1 | SQL string interpolation → SQL builder | Medium (correctness) | Low |
| 2 | Two-pass lasso → SQL point-in-polygon | Medium (performance) | Medium |
| 3 | setTimeout coordination → deterministic | Medium (correctness) | Medium |
| 4 | Key-based remount → incremental update | High (performance) | Medium |
| 5 | Enable auto-labels | Low (feature) | Low |
| 6 | Selection state consolidation | Low (maintainability) | Medium |
| 7 | Tooltip createRoot → portal or DOM | Low (correctness) | Low |
| 8 | Document navigator.gpu override; file upstream | Low (hygiene) | Trivial |
| 9 | Lazy data loading | Low (performance) | Low |

Items 1, 2, 4, and 8 are the highest-value changes. Items 1 and 8 are near-trivial. Item 4 (eliminating the key-based remount) would have the most noticeable user-facing impact.

---

## Key Reference Files

**bedbase-ui:**
- `src/components/umap/embedding-plot.tsx` — Core wrapper, SQL queries, selection merging
- `src/components/umap/umap-view.tsx` — Container, state management, file upload
- `src/components/umap/atlas-tooltip.tsx` — Custom tooltip class
- `src/contexts/mosaic-coordinator-context.tsx` — DuckDB init, WebGL detection
- `src/lib/umap-utils.ts` — Types, point-in-polygon

**embedding-atlas:**
- `packages/component/src/lib/embedding_view/EmbeddingViewImpl.svelte` — Main implementation (~850 lines)
- `packages/component/src/lib/embedding_view/mosaic_client.ts` — SQL query builder, point-in-polygon predicate
- `packages/component/src/lib/embedding_view/labels.ts` — Label layout and placement
- `packages/component/src/lib/webgpu_renderer/downsample.ts` — GPU-based density-aware downsampling
- `packages/component/src/lib/webgpu_renderer/renderer.ts` — WebGPU rendering pipeline
- `packages/component/src/lib/dataflow.ts` — Reactive dependency graph for GPU resources
- `packages/component/src/lib/utils.ts` — `throttleTooltip()`, viewport utilities
- `packages/component/src/lib/embedding_view/statistics.ts` — Density approximation, O(n) median
