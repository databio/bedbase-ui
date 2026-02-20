---
date: 2026-02-19
status: in-progress
description: UMAP embedding wrapper improvements — 5 subplans
---

## Implementation Log

**Subplans A-D:** Implemented and compiling clean.
**Subplan E:** Spike failed — `coordinator.clear({ clients: false })` + filter re-emit does not reliably keep the custom point visible after user interactions (point disappears on deselect and can't be relocated). Reverted to key-based remount per Spike 3 fallback. Needs upstream embedding-atlas changes to work.


# UMAP Embedding Wrapper Improvements

Five improvements to bedbase-ui's UMAP wrapper, split into independent subplans ordered by dependency and risk. Each subplan is independently committable and revertable.

Auto-labels (embedding-atlas's TF-IDF cluster labeling) excluded — we handle UMAP generation and clustering ourselves.

**Source analysis:** `plans/2026-02-19-umap-embedding-atlas-comparison.md`

---

## Subplan A: SQL Builder Migration

**Risk: Low** | Depends on: nothing

Convert all raw SQL string interpolation to the Mosaic SQL builder. Prevents query breakage from malformed IDs and centralizes column mappings.

### Dependency note
`vg` from `@uwdata/vgplot` re-exports most SQL functions (`Query`, `sql`, `column`, `literal`, `cast`, `eq`, `and`, `or`, `isBetween`, `lt`, `lte`, `gt`, `gte`). But it does NOT re-export `isIn`, `add`, `sub`, `mul`, `mod` — needed for ID queries (this subplan) and polygon predicates (Subplan B). Add `@uwdata/mosaic-sql` as an explicit dependency (already installed as transitive dep).

### Files modified
- `repos/bedbase-ui/src/lib/umap-utils.ts` — add `umapSelectParams()` helper
- `repos/bedbase-ui/src/components/umap/embedding-plot.tsx` — convert 6 query sites
- `repos/bedbase-ui/src/components/umap/embedding-stats.tsx` — convert 1 query

### Step 1: Add dependency

```bash
cd repos/bedbase-ui && npm install @uwdata/mosaic-sql
```

### Step 2: Create shared select-params helper in `umap-utils.ts`

```typescript
import * as vg from '@uwdata/vgplot';

export function umapSelectParams(colorGrouping: string) {
  return {
    x: vg.column('x'),
    y: vg.column('y'),
    cell_line_category: vg.column('cell_line_category'),
    assay_category: vg.column('assay_category'),
    category: vg.column(colorGrouping),
    text: vg.column('name'),
    identifier: vg.column('id'),
    fields: vg.sql`{'Description': description, 'Assay': assay, 'Cell Line': cell_line}`,
  };
}
```

This centralizes the SELECT clause repeated in 4 of the 6 query sites.

### Step 3: Convert queries in `embedding-plot.tsx`

**Query 1 — `queryPoints` (lines 124-134):**
```typescript
import { isIn } from '@uwdata/mosaic-sql';

const q = vg.Query.from('data')
  .select(umapSelectParams(colorGrouping))
  .where(isIn(vg.column('id'), ids.map(id => vg.literal(id))));
```

**Query 2 — `fetchLegendItems` (lines 188-201):**
```typescript
const q = vg.Query.from('data')
  .select({
    name: vg.sql`CASE
      WHEN ${vg.column(colorGrouping)} = ${UPLOADED_CATEGORY} THEN 'Uploaded BED'
      WHEN ${vg.column(colorGrouping)} = ${OTHER_CATEGORY} THEN 'Other'
      ELSE MIN(${vg.column(colName)})
    END`,
    category: vg.column(colorGrouping),
  })
  .groupby(vg.column(colorGrouping))
  .orderby(vg.column(colorGrouping));
```

**Query 3 — `queryByCategory` (lines 203-212):**
```typescript
const q = vg.Query.from('data')
  .select(umapSelectParams(colorGrouping))
  .where(vg.eq(vg.column(colorGrouping), vg.literal(category)));
```

Note: `category` arrives as `String(item.category)` from `umap-view.tsx:106`. The column contains integers. Use `vg.literal(Number(category))` to match types correctly.

**Query 4 — `handleRangeSelection` rectangle (lines 250-257):**
```typescript
const predicate = vg.and(
  vg.isBetween(vg.column('x'), [value.xMin, value.xMax]),
  vg.isBetween(vg.column('y'), [value.yMin, value.yMax]),
  ...(filterSelection
    ? [vg.eq(vg.column(colorGrouping), vg.literal(filterSelection.category))]
    : []),
);
const q = vg.Query.from('data').select(umapSelectParams(colorGrouping)).where(predicate);
```

**Queries 5+6 — `handleRangeSelection` polygon (lines 258-286):**
Convert the bounding box query and final ID query to SQL builder. These will be replaced entirely in Subplan B, but need builder form first:
```typescript
// Bounding box candidates
const bbQ = vg.Query.from('data')
  .select({ x: vg.column('x'), y: vg.column('y'), identifier: vg.column('id') })
  .where(vg.and(
    vg.isBetween(vg.column('x'), [xMin, xMax]),
    vg.isBetween(vg.column('y'), [yMin, yMax]),
    ...(filterSelection ? [vg.eq(vg.column(colorGrouping), vg.literal(filterSelection.category))] : []),
  ));

// Final filtered query
const matchedIds = candidates.filter(p => isPointInPolygon(p, value)).map(p => p.identifier);
const q = vg.Query.from('data')
  .select(umapSelectParams(colorGrouping))
  .where(isIn(vg.column('id'), matchedIds.map(id => vg.literal(id))));
```

### Step 4: Convert query in `embedding-stats.tsx`

Line 19:
```typescript
const q = vg.Query.from('data')
  .select({ category: vg.column(colorGrouping), count: vg.sql`COUNT(*)` })
  .groupby(vg.column(colorGrouping));
```

### Verify
Exercise each code path: click a point, lasso select, rectangle select, click legend, upload a file, check stats panel. Compare data shown to previous behavior. Check console for DuckDB errors.

---

## Subplan B: SQL Point-in-Polygon

**Risk: Low-Medium** | Depends on: Subplan A

Replace the two-pass lasso selection (bounding box query → client-side filter → second query) with a single SQL query using a database-side point-in-polygon predicate.

### Files modified
- `repos/bedbase-ui/src/lib/umap-utils.ts` — add `pointInPolygonPredicate()`, `boundingRect()`
- `repos/bedbase-ui/src/components/umap/embedding-plot.tsx` — rewrite polygon branch of `handleRangeSelection`

### Step 1: Port `pointInPolygonPredicate` to `umap-utils.ts`

Adapted from `embedding-atlas/packages/component/src/lib/embedding_view/mosaic_client.ts:46-75`. Uses `add`, `sub`, `mul`, `mod` from `@uwdata/mosaic-sql` (added in Subplan A):

```typescript
import { add, sub, mul, mod } from '@uwdata/mosaic-sql';

export function pointInPolygonPredicate(x: any, y: any, polygon: { x: number; y: number }[]) {
  const parts: any[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const { x: x1, y: y1 } = polygon[i];
    const { x: x2, y: y2 } = polygon[j];
    const pred1 = y1 < y2
      ? vg.and(vg.lte(vg.literal(y1), y), vg.lt(y, vg.literal(y2)))
      : vg.and(vg.lte(vg.literal(y2), y), vg.lt(y, vg.literal(y1)));
    const pred2 = (y1 < y2 ? vg.lt : vg.gt)(
      sub(mul(vg.literal(x2 - x1), y), mul(vg.literal(y2 - y1), x)),
      vg.literal((x2 - x1) * y1 - (y2 - y1) * x1),
    );
    parts.push(vg.cast(vg.and(pred1, pred2), 'INT'));
  }
  const sum = parts.reduce((a, b) => add(a, b));
  return vg.eq(mod(sum, vg.literal(2)), vg.literal(1));
}

export function boundingRect(points: { x: number; y: number }[]) {
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (const p of points) {
    if (p.x < xMin) xMin = p.x; if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y; if (p.y > yMax) yMax = p.y;
  }
  return { xMin, yMin, xMax, yMax };
}
```

### Step 2: Rewrite polygon branch in `handleRangeSelection`

Replace queries 5+6 (bounding box → client filter → ID query) with single query:

```typescript
} else if (Array.isArray(value) && value.length >= 3) {
  const bounds = boundingRect(value);
  const predicate = vg.and(
    vg.isBetween(vg.column('x'), [bounds.xMin, bounds.xMax]),
    vg.isBetween(vg.column('y'), [bounds.yMin, bounds.yMax]),
    pointInPolygonPredicate(vg.column('x'), vg.column('y'), value),
    ...(filterSelection
      ? [vg.eq(vg.column(colorGrouping), vg.literal(filterSelection.category))]
      : []),
  );
  const q = vg.Query.from('data').select(umapSelectParams(colorGrouping)).where(predicate);
  result = (await coord.query(q, { type: 'json' })) as any[];
}
```

### Step 3: Remove `isPointInPolygon`
Delete from `umap-utils.ts` and remove import from `embedding-plot.tsx`.

### Verify
- Draw lasso selections of various sizes. Spot-check boundary points.
- Draw very small lasso (< 3 vertices) — should return empty.
- Compare selection results to previous behavior with same lasso shape.
- Check performance on dense regions.

---

## Subplan C: Selection State Consolidation

**Risk: Medium** | Depends on: nothing (but easier after B/C)

Replace 5+ overlapping selection arrays and triple deduplication with a single `useReducer`.

### Files modified
- `repos/bedbase-ui/src/components/umap/umap-view.tsx` — host reducer, derived values
- `repos/bedbase-ui/src/components/umap/embedding-plot.tsx` — remove internal selection state, receive callbacks

### Current state inventory (to eliminate)

| Component | State | Role |
|---|---|---|
| EmbeddingPlot | `persistentRef` (ref) | `{ preselected: [], bucket: [] }` |
| EmbeddingPlot | `persistentPoints` (state) | merged preselected + bucket |
| EmbeddingPlot | `visualSelection` (memo) | persistent + interactive + highlight |
| EmbeddingPlot | `pendingSelection` (state) | deferred after dataVersion |
| UmapView | `selectedPoints` (state) | interactive selection |
| UmapView | `persistentPoints` (state) | received from EmbeddingPlot callback |
| UmapView | `allVisiblePoints` (memo) | persistent + interactive |

### New model

**Reducer in UmapView:**

```typescript
type SelectionState = {
  preselected: UmapPoint[];   // from URL params
  bucket: UmapPoint[];        // from bucket context
  interactive: UmapPoint[];   // from click/lasso/range
  pending: UmapPoint[] | null;
};

type SelectionAction =
  | { type: 'SET_PRESELECTED'; points: UmapPoint[] }
  | { type: 'SET_BUCKET'; points: UmapPoint[] }
  | { type: 'SET_INTERACTIVE'; points: UmapPoint[] }
  | { type: 'SET_PENDING'; points: UmapPoint[] | null }
  | { type: 'APPLY_PENDING' }
  | { type: 'CLEAR_INTERACTIVE' };
```

**Derived values (useMemo in UmapView):**
- `persistentPoints` = deduplicated preselected + bucket
- `allVisiblePoints` = deduplicated persistent + interactive

**EmbeddingPlot changes:**
- Remove: `persistentRef`, `persistentPoints` state, `updatePersistent`, `pendingSelection`, `visualSelection` memo
- New props: `persistentPoints`, `interactivePoints`, callbacks for each dispatch action
- `visualSelection` becomes a simple merge of received props (single dedup pass)
- Preselection/bucket query effects stay in EmbeddingPlot (they need `coordinator` and `isReady`) but call the new callbacks

### Verify
Test all selection paths:
1. `?bed=<id>` — pin appears, persists through interactions
2. `?beds=<id1>,<id2>` — multiple pins
3. Bucket items — appear as persistent points
4. Click point — appears in table/stats
5. Lasso select — selection + persistent all visible
6. Upload BED file — custom point appears, merges correctly
7. Remove BED file — custom point gone, other selections preserved
8. Switch color grouping — legend updates, filter works

---

## Subplan D: Replace setTimeout with Deterministic Coordination

**Risk: Low-Medium** | Depends on: Subplan C

### Files modified
- `repos/bedbase-ui/src/lib/umap-utils.ts` — add `throttleTooltip()` (port from embedding-atlas)
- `repos/bedbase-ui/src/components/umap/embedding-plot.tsx` — replace 5 setTimeout sites

### Step 1: Port `throttleTooltip` to `umap-utils.ts`

Copy from `embedding-atlas/packages/component/src/lib/utils.ts:36-83`. Pure TypeScript, zero dependencies, ~50 lines. Implements proper async throttling: 300ms delay on first hover after idle, immediate if tooltip was recently visible.

### Step 2: Replace each setTimeout

| Location | Current | Replacement |
|---|---|---|
| Line 119: tooltip in `centerOnPoint` | 300ms blind delay | `throttledTooltip(point)` via ported utility |
| Lines 154-164: post-upload centering | 200ms after `setDataVersion` | useEffect on `dataVersion` (or remove entirely in Subplan E) |
| Lines 296-300: pending selection | 100ms after `dataVersion` | `requestAnimationFrame` or `dispatch({ type: 'APPLY_PENDING' })` in reducer effect |
| Line 339: pre-preselection delay | 50ms yield | Remove — `isReady` already guarantees DuckDB is initialized |
| Line 371: pre-bucket delay | 100ms yield | Remove — same reason |

### Verify
- Preselected IDs appear without perceptible delay
- File upload centers correctly without flash
- Tooltip timing feels natural (slight delay on first hover, responsive on subsequent)
- Rapid mouse movement doesn't cause tooltip flicker

---

## Subplan E: Incremental Update Instead of Key-Based Remount

**Risk: High — spike first** | Depends on: Subplans B, D, E

This is the highest-impact performance change but also the riskiest. The current `key={dataVersion}` destroys and recreates the entire WebGPU/WebGL context on every file upload/remove.

### The core problem

The Svelte `$effect` in `EmbeddingViewMosaic.svelte` tracks `coordinator`, `table`, `x`, `y`, `category`. After `coordinator.clear()`, none of these change, so the effect doesn't re-run and the disconnected client won't refetch data.

### Approach: spike first

Before implementing, run a spike to validate the mechanism:

**Spike 1:** Change `coordinator.clear()` to `coordinator.clear({ clients: false })` and remove `key={dataVersion}`. Upload a BED file. Does the new point appear?

**Spike 2 (if spike 1 fails):** After `coordinator.clear({ clients: false })`, re-emit the current filter state on the `filter` Selection to trigger the Mosaic client to re-query:
```typescript
filter.update({ source: legendFilterSource, value: filterSelection?.category ?? null,
  predicate: filterSelection ? vg.eq(colorGrouping, filterSelection.category) : null });
```

**Spike 3 (if spike 2 fails):** This item cannot be done without upstream changes to embedding-atlas. Keep the key-based remount; the other 5 subplans still provide significant value.

### Implementation (if spike validates)

1. Remove `dataVersion` state and `key` prop from EmbeddingViewMosaic
2. In `handleFileUpload` and `handleFileRemove`: use `coordinator.clear({ clients: false })` + filter re-emit
3. Remove `pendingSelection` mechanism (no longer needed)
4. Post-upload centering proceeds directly (no setTimeout, no dataVersion wait)

### Verify
- Upload BED file — custom point appears within ~100ms, no plot flash
- Remove BED file — point disappears without plot flash
- Viewport state preserved (no zoom reset)
- All selection behavior still works
- Chrome DevTools Performance tab: zero frame drops during upload/remove

---

## Execution Order Summary

| # | Subplan | Risk | Depends on |
|---|---|---|---|
| 1 | A — SQL builder | Low | — |
| 2 | B — SQL point-in-polygon | Low-Med | A |
| 3 | C — Selection consolidation | Medium | — |
| 4 | D — setTimeout removal | Low-Med | C |
| 5 | E — Incremental update (spike) | High | A, C, D |

Commit after each subplan. Subplan E should be on a feature branch until the spike validates the approach.

## Key files

- `repos/bedbase-ui/src/components/umap/embedding-plot.tsx` — central file, touched by A-E
- `repos/bedbase-ui/src/components/umap/umap-view.tsx` — parent state, touched by C
- `repos/bedbase-ui/src/lib/umap-utils.ts` — utilities, touched by A, B, D
- `repos/bedbase-ui/src/components/umap/embedding-stats.tsx` — touched by A
- `embedding-atlas/packages/component/src/lib/embedding_view/mosaic_client.ts` — reference for B
- `embedding-atlas/packages/component/src/lib/utils.ts` — reference for D (throttleTooltip)
