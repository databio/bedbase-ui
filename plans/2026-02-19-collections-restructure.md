---
date: 2026-02-19
status: complete
description: Restructure collections page into 2-card landing with sub-routes for bedsets and selections
---

# Collections Page Restructure

## Context

The collections page currently shows BEDsets search/table and saved selections in a single monolithic page. We're restructuring it to mirror the analysis page's 2-card landing pattern, creating a proper hierarchy: landing page → list pages → detail pages. This sets up the architecture for future aggregate analysis on both BEDsets and user selections.

## Route Structure

| URL | Param | Component | Description |
|-----|-------|-----------|-------------|
| `/collections` | none | `CollectionsEmpty` | Landing page with 2 cards |
| `/collections/bedset` | `'bedset'` | `BedsetList` | BEDset search + results table |
| `/collections/bedset/:id` | `'bedset/:id'` | `CollectionDetail` | BEDset detail (existing) |
| `/collections/selection` | `'selection'` | `SelectionList` | Table of saved selections |
| `/collections/selection/:id` | `'selection/:id'` | `SelectionDetail` | Selection detail + management |

No changes to `tab-context.tsx` needed — the existing `(.+)` regex already captures multi-segment params.

## Implementation Steps

### 1. Create `collections-empty.tsx` — Landing page

**File:** `src/components/collections/collections-empty.tsx`

Two-card layout modeled exactly after `analysis-empty.tsx` (lines 47-142):
- Centered `<h2>Collections</h2>` + description
- `max-w-3xl mx-auto` wrapper, `grid grid-cols-1 md:grid-cols-2 gap-3`
- **Left card: "BEDsets"**
  - Globe icon in `bg-primary/10`, same card structure as analysis database card
  - Bullet list: curated collections info, file counts (use `useStats` if available), metadata
  - Footer: Search input + button (same styling as analysis-empty.tsx lines 70-89)
  - On submit: `navigate('/collections/bedset?q=' + encodeURIComponent(query))` via `useNavigate()`
- **Right card: "Your Selections"**
  - Appropriate icon (e.g., `Layers`) in `bg-secondary/10`
  - Bullet list: saved from UMAP, local to browser, group analysis coming soon
  - Footer: "Browse selections" link → `openTab('collections', 'selection')`
  - Show bucket count from `useBucket().bucketCount` if > 0

### 2. Create `bedset-list.tsx` — BEDset search + table

**File:** `src/components/collections/bedset-list.tsx`

Extract from current `collections-list.tsx` lines 239-368:
- Back button: `openTab('collections', '')` with "Collections" text
- Read initial query from `useLocation().search` → `?q=` param
- Initialize `query` and `submitted` state from initial query
- Full search bar, limit selector, paginated table, skeleton/error/empty states
- Move `SkeletonTable` and `Pagination` helper components here
- Row click: `openTab('collections', 'bedset/' + bs.id)` (changed from `openTab('collections', bs.id)`)

### 3. Create `selection-list.tsx` — Selection list

**File:** `src/components/collections/selection-list.tsx`

Clean table page (no inline expand — rows click through to detail):
- Back button: `openTab('collections', '')` with "Collections" text
- Table of saved selections from `useBucket()`
- Columns: drag handle, name, file count, created date, delete button
- Row click: `openTab('collections', 'selection/' + bucket.id)`
- Drag-and-drop reordering preserved (reuse drag logic from current SavedSelectionsCard)
- Empty state: "No saved selections yet" with guidance about UMAP

### 4. Create `selection-detail.tsx` — Selection detail

**File:** `src/components/collections/selection-detail.tsx`

New component for managing a single selection:
- Back button: `openTab('collections', 'selection')` with "Selections" text
- Look up bucket by ID from `useBucket().buckets`
- **Not found fallback**: If bucket not in localStorage, show "Selection not found" message + back button
- **Header**: Editable name (inline edit pattern), file count, created date
- **Actions**: View on UMAP (enable bucket + `openTab('umap')`), Delete bucket (navigates back to list)
- **BED file list**: Table of bed IDs with remove buttons per row. Click bed ID → `openTab('analysis', bedId)`
- **Auto-deletion detection**: If `removeBedFromBucket` empties the bucket (bucket-context auto-deletes empty buckets), detect bucket becoming undefined and redirect to selection list

### 5. Update `collections-view.tsx` — Route dispatcher

**File:** `src/components/collections/collections-view.tsx`

```tsx
export function CollectionsView({ param }: { param?: string }) {
  if (param === 'bedset') return <BedsetList />;
  if (param?.startsWith('bedset/')) return <CollectionDetail bedsetId={param.slice(7)} />;
  if (param === 'selection') return <SelectionList />;
  if (param?.startsWith('selection/')) return <SelectionDetail selectionId={param.slice(10)} />;
  return <CollectionsEmpty />;
}
```

### 6. Update `collection-detail.tsx` — Fix back navigation

**File:** `src/components/collections/collection-detail.tsx`

- Line 179: `openTab('collections')` → `openTab('collections', 'bedset')`
- Line 183: "Collections" → "BEDsets"
- Line 127 (error state): Same back button update

### 7. Delete `collections-list.tsx`

Content has been split into `collections-empty.tsx`, `bedset-list.tsx`, and `selection-list.tsx`.

## Navigation Summary

| From | To | Call |
|------|----|------|
| Landing → BEDset list | search footer | `navigate('/collections/bedset?q=...')` |
| Landing → Selection list | card footer | `openTab('collections', 'selection')` |
| BEDset list → Landing | back button | `openTab('collections', '')` |
| BEDset list → BEDset detail | row click | `openTab('collections', 'bedset/' + id)` |
| BEDset detail → BEDset list | back button | `openTab('collections', 'bedset')` |
| Selection list → Landing | back button | `openTab('collections', '')` |
| Selection list → Selection detail | row click | `openTab('collections', 'selection/' + id)` |
| Selection detail → Selection list | back button | `openTab('collections', 'selection')` |
| Selection detail → UMAP | action | `openTab('umap')` |
| Selection detail → Analysis | bed ID click | `openTab('analysis', bedId)` |

## Key Design Decisions

- **`openTab('collections', '')` clears lastParams** — ensures Collections tab in navbar goes to landing, not a remembered sub-page
- **No tab-context changes** — multi-segment params already work via `(.+)` regex
- **Query pass-through via `?q=`** — landing card search navigates to bedset list with URL param, bypassing `openTab` for this one case
- **Selection list is click-through only** — no inline expand; detail page handles all management
- **Bucket auto-delete on empty** — already handled by bucket-context, detail page detects and redirects

## Verification

1. Navigate to `/collections` — should see 2-card landing page
2. Type in BEDsets search footer, press Enter — should navigate to `/collections/bedset?q=query` with pre-filled search
3. Click "Browse selections" on right card — should navigate to `/collections/selection`
4. Click a BEDset row — should navigate to `/collections/bedset/:id`
5. BEDset detail back button — should go to `/collections/bedset` (list, not landing)
6. Click a selection row — should navigate to `/collections/selection/:id`
7. Selection detail: rename, remove beds, delete, View on UMAP all work
8. Remove last bed from selection — bucket auto-deletes, redirects to selection list
9. Navigate to `/collections/selection/nonexistent-id` — shows "not found" fallback
10. All back buttons reach the landing page from any depth
11. Collections tab in navbar restores to landing (not a sub-page) after using back buttons

## Future

- `/analysis/bed/:id` route change (separate task)
- Aggregate analysis on selection detail page
- Aggregate analysis on bedset detail page
- Server-side selection persistence (when/if API supports it)
