---
date: 2026-02-18
status: complete
description: "Phase 2: WASM parsing + Analysis tab for uploaded files"
---

# Phase 2: WASM Parsing + Analysis Tab (Uploaded Files)

## Context

Phase 1 delivered the tab system, hub, upload flow, and scaffold pages. The upload page shows a file preview with placeholder dashes for Regions, Genome, and Avg length. The Analysis tab is a stub. Phase 2 makes the uploaded-file path real: parse BED files client-side with gtars WASM, show real stats in the upload preview, and build the Analysis tab content for uploaded files.

## Dependencies to add

| Package | Purpose |
|---------|---------|
| `@databio/gtars` | WASM-compiled Rust library — `RegionSet` class for BED parsing + stats |
| `pako` | Gzip decompression for `.bed.gz` files |
| `vite-plugin-wasm` | Vite WASM module support |
| `vite-plugin-top-level-await` | Required companion for WASM init |
| `vega-embed` | Vega-Lite chart renderer for region distribution plot |

## Architecture

### Parsing pipeline

```
File (from FileContext)
  → parseBedFile()          [JS: read text, decompress .gz, split lines, extract [chr, start, end, rest]]
    → new RegionSet(entries) [WASM: construct region set from BedEntry[]]
      → rs.numberOfRegions, rs.meanRegionWidth, rs.nucleotidesLength, rs.classify
      → rs.chromosomeStatistics()  → Map<string, ChromosomeStatistics>
      → rs.regionDistribution(300) → DistributionSpecDataPoint[]
```

### Where RegionSet lives

Extend `FileContext` (rename to `file-context.tsx`) to hold the parsed RegionSet alongside the raw File. Parsing happens eagerly when a file is set — the upload page needs stats immediately for the preview, and the Analysis tab reads the same data.

```ts
type FileContextValue = {
  uploadedFile: File | null;
  setUploadedFile: (file: File | null) => void;
  regionSet: RegionSet | null;
  parsing: boolean;
  parseError: string | null;
};
```

When `setUploadedFile(file)` is called with a non-null file, the context triggers async parsing:
1. Set `parsing = true`
2. Call `parseBedFile(file)` → entries
3. Call `new RegionSet(entries)` → rs
4. Set `regionSet = rs`, `parsing = false`

When file is cleared (`setUploadedFile(null)`), clear `regionSet` too.

### WASM initialization

Call `init()` from `@databio/gtars` in `main.tsx` before React mounts (same pattern as bedhost). The `vite-plugin-wasm` + `vite-plugin-top-level-await` plugins handle the async boundary.

### Analysis tab routing

Per the master plan's subject model:
- `/analysis` (no param) + uploaded file in context → show uploaded file analysis
- `/analysis` (no param) + no uploaded file → empty state
- `/analysis/:id` → database file analysis (Phase 4, not this phase)

## Changes

### 1. Install dependencies and configure Vite

**`package.json`** — add `@databio/gtars`, `pako`, `vite-plugin-wasm`, `vite-plugin-top-level-await`, `vega-embed`, `@types/pako`

**`vite.config.ts`** — add `wasm()` and `topLevelAwait()` plugins, set `build.target: 'esnext'`, configure worker plugins

**`src/main.tsx`** — add `import init from '@databio/gtars'; init();` before React mount

### 2. BED file parsing utility (`src/lib/bed-parser.ts` — new)

Port from bedhost `utils.ts` (lines 214-259):
- `BedEntry` type: `[string, number, number, string]`
- `parseBedFile(file: File): Promise<BedEntry[]>` — reads text (or decompresses .gz via pako), splits lines, parses tab-separated columns, validates chr/start/end

### 3. Extend FileContext (`src/contexts/file-context.tsx`)

Add `regionSet`, `parsing`, `parseError` to context value. When `setUploadedFile` is called with a file, trigger eager parsing via `useEffect`. Import `RegionSet` from `@databio/gtars` and `parseBedFile` from the new utility.

### 4. Wire upload page preview (`src/components/upload/upload-page.tsx`)

Replace the three placeholder stat cards (Regions: —, Genome: —, Avg length: —) with real data from `regionSet`:
- **Regions**: `regionSet.numberOfRegions` (formatted with commas)
- **Genome**: "—" for now (genome detection requires API call, deferred to Phase 4)
- **Avg length**: `regionSet.meanRegionWidth` (formatted, rounded)

Show a small loading indicator while `parsing` is true. Show error state if `parseError` is set.

### 5. Analysis tab content (`src/components/analysis/` — new directory)

**`analysis-view.tsx`** — the main Analysis tab component. Reads from FileContext when no param (uploaded file mode). Shows:

1. **Summary stats card** — table with:
   - Identifier (from `rs.identifier`)
   - Total regions (`rs.numberOfRegions`)
   - Mean region width (`rs.meanRegionWidth`)
   - Total nucleotides (`rs.nucleotidesLength`)
   - Data format (`rs.classify.data_format`)
   - BED compliance (`rs.classify.bed_compliance`)
   - File size (from `uploadedFile.size`)
   - Processing time (measured during parse)

2. **Chromosome stats table** (`chromosome-stats.tsx`) — port from bedhost `chromosome-stats-panel.tsx`:
   - Calls `rs.chromosomeStatistics()`, extracts rows, frees WASM memory
   - Sorts by natural chromosome order
   - Columns: Chromosome, Count, Start, End, Min, Max, Mean, Median
   - Scrollable container with max-height
   - Download CSV button
   - Restyle from Bootstrap to Tailwind/DaisyUI

3. **Region distribution plot** (`region-distribution.tsx`) — port from bedhost `bed-plots.tsx`:
   - Calls `rs.regionDistribution(300)`
   - Vega-Lite faceted bar chart (one row per chromosome)
   - Responsive width via container observation
   - Standard chromosome sort order
   - Restyle container from Bootstrap to Tailwind/DaisyUI

**`analysis-empty.tsx`** — empty state when no file is uploaded and no param:
   - Upload drop zone (reuse the same pattern from hub's SearchInput)
   - Brief description of what the Analysis tab does
   - Example BED file links (clickable, load from URL — stretch goal, can be placeholder links initially)

### 6. Wire tab-content.tsx

Replace the Analysis tab placeholder with `<AnalysisView />`. Other tabs remain stubs.

### 7. Wire hub search input

Connect the hub's search submit to navigate to the Search tab: `openTab('search')` with query as param. The Search tab itself stays a stub — this just wires the navigation so the UX flow works.

## Files summary

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add gtars, pako, vega-embed, vite WASM plugins |
| `vite.config.ts` | Modify | Add wasm + topLevelAwait plugins |
| `src/main.tsx` | Modify | Add gtars init() call |
| `src/lib/bed-parser.ts` | **New** | BedEntry type + parseBedFile function |
| `src/contexts/file-context.tsx` | Modify | Add regionSet, parsing, parseError; eager parse on file set |
| `src/components/upload/upload-page.tsx` | Modify | Wire real stats into FilePreview |
| `src/components/analysis/analysis-view.tsx` | **New** | Main Analysis tab: summary stats, chrom table, distribution plot |
| `src/components/analysis/chromosome-stats.tsx` | **New** | Chromosome statistics table (port from bedhost) |
| `src/components/analysis/region-distribution.tsx` | **New** | Region distribution Vega-Lite plot (port from bedhost) |
| `src/components/analysis/analysis-empty.tsx` | **New** | Empty state with upload prompt |
| `src/components/tabs/tab-content.tsx` | Modify | Route analysis tab to AnalysisView |
| `src/components/hub/hub.tsx` | Modify | Wire search submit to openTab('search') |

## Verification

1. **Upload a BED file** → file preview shows real region count and avg length (not dashes)
2. **Upload a .bed.gz file** → same stats appear (gzip decompression works)
3. **Click "Analyze in detail"** on upload page → Analysis tab opens with summary stats table, chromosome stats table, and region distribution plot
4. **Open Analysis tab directly** with no file → empty state with upload prompt
5. **Open Analysis tab directly** with file in context → shows uploaded file analysis
6. **Clear file** → Analysis tab reverts to empty state, upload preview gone
7. **Hub search submit** → navigates to Search tab (still a stub, but URL updates correctly)
8. **Dev server starts** without WASM errors
9. **Build succeeds** (`npm run build`)
