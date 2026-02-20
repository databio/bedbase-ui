---
date: 2026-02-19
status: in-progress
description: Phase 6 - UMAP Tab + Cross-Tab Navigation with embedding-atlas, DuckDB WASM, and bucket-based selection management
---

# Phase 6: UMAP Tab + Cross-Tab Navigation

Plan provided by user. See implementation details in the plan prompt.

## Implementation Order

1. `src/lib/tableau20.ts` + `src/lib/umap-utils.ts`
2. `npm install embedding-atlas @uwdata/vgplot`
3. `src/contexts/mosaic-coordinator-context.tsx`
4. `src/contexts/bucket-context.tsx`
5. Provider wiring in `src/pages/app.tsx`
6. `src/queries/use-bed-umap.ts`
7. `src/components/umap/atlas-tooltip.tsx`
8. `src/components/umap/embedding-plot.tsx`
9. `src/components/umap/embedding-legend.tsx`
10. `src/components/umap/embedding-table.tsx`
11. `src/components/umap/embedding-selections.tsx`
12. `src/components/umap/embedding-stats.tsx`
13. `src/components/umap/umap-view.tsx`
14. `src/components/umap/embedding-preview.tsx`
15. Tab content + keep-mounted changes
16. Collections bucket management
17. Cross-tab wiring

## Implementation Log

- 2026-02-19: Started implementation
