# BEDbase UI

A standalone web interface for [BEDbase](https://bedbase.org) — the open-access platform for accessing, aggregating, and analyzing genomic region data.

This is a ground-up rewrite of the UI that was previously embedded inside the [bedhost](https://github.com/databio/bedhost) API server repository. The rewrite separates the frontend into its own deployable artifact with a modernized stack and a new interaction model built around tabs and split views rather than traditional page routing.

## Stack

| Layer | Old (bedhost/ui) | New (bedbase-ui) |
|---|---|---|
| React | 18 | 19 |
| Styling | Bootstrap 5 + Sass | Tailwind CSS 4 + DaisyUI 5 |
| Routing | React Router (page-based) | React Router + tab context |
| Data fetching | React Query + Axios | React Query + Axios |
| Visualization | embedding-atlas, Vega, Chart.js, Three.js | embedding-atlas, Vega |
| WASM | @databio/gtars | @databio/gtars |
| Animations | Framer Motion | CSS transitions |
| Build | Vite | Vite 7 |

## What changed in the rewrite

### Why rewrite

The old UI lived inside the bedhost API server repository (`bedhost/ui/`), coupling frontend deployment to the backend. It grew organically with page-based routing that made it hard to cross-reference data — viewing a BED file on the UMAP meant leaving the analysis page and losing context. The rewrite starts from a different interaction model: tabs with persistent state and side-by-side views, so users can explore BEDbase without losing their place.

Three specific goals guided the redesign:

1. **Make each major feature equally easy to locate and use.** The old UI buried some features behind nested navigation or secondary pages. The new UI gives Search, Analysis, UMAP, Collections, and Cart equal standing as top-level tabs, each one click away at all times.

2. **Improve cross-feature interactions while strengthening the unique identity of each feature.** The tab and split-view system lets features stay open simultaneously and pass data between them (e.g. search results highlighted on the UMAP, or an analysis file located in collections) without either feature losing its own state or layout.

3. **Prioritize the needs of browsing users and analyzing users reasonably equally.** The old UI leaned toward browsing (search, browse collections, view splash pages). The new UI treats local file analysis as a first-class workflow — upload a file, get instant WASM-powered stats, then fan out to search for similar files, project onto the UMAP, or check collection membership, all from the same session.

Separating the UI into its own repo also allows independent iteration without touching the API.

### Architectural changes

**Tab-based navigation replaces page routing.** The old UI navigates between full pages (`/search`, `/umap`, `/bed/:id`). The new UI uses a tab bar — Search, Analysis, UMAP, Collections, Cart — where switching tabs preserves state. Your last search query, the file you were analyzing, and your UMAP selections all survive tab switches.

**Split view.** Any tab can be dragged to the left or right half of the screen. View search results next to the UMAP, or compare an analysis with a collection side by side. The old UI had no equivalent.

**Portal-mounted UMAP.** Both UIs use `createPortal` to keep the UMAP alive, but for different purposes. The old UI portals the UMAP for an expand/collapse animation (compact card that expands to fullscreen overlay). The new UI portals the UMAP so it can move between layout slots (full tab, split left, split right) as users rearrange tabs — DuckDB state, selections, and viewport persist across every layout change.

**Standalone repo.** Decoupled from bedhost. Own CI pipeline, own Cloudflare Pages deployment. The only link to the backend is the `VITE_API_BASE` environment variable.

**Unified analysis tab.** The old UI has separate pages for uploaded file analysis (`/analyze`) and database file viewing (`/bed/:id`). The new UI merges these into a single Analysis tab that handles both local files (WASM-parsed) and database files (API-fetched) with a consistent layout.

**File page as a hub.** When you upload a BED file, the new UI shows a dedicated File page with action cards — search for similar files, analyze, view on UMAP, find in collections. The old UI went straight to the analyzer. The file page makes the uploaded file a first-class object you can act on in multiple ways.

### Features carried over

All core functionality from the old UI is reimplemented:

- Text search with genome/assay filters and pagination
- BED-to-BED similarity search (upload a file, find similar)
- UMAP embedding visualization (embedding-atlas, DuckDB WASM, Mosaic coordinator)
- Custom file projection (upload BED, get UMAP coordinates, plot as custom point)
- Lasso and rectangle selection on UMAP with bucket system for saving named selections
- Category color grouping (assay vs cell line) with legend filtering and pinning
- Client-side BED file analysis via WASM (chromosome stats, region distribution)
- Genome compatibility analysis (tier-ranked XS%, OOBR%, sequence fit)
- Annotation metadata display (genome, tissue, cell type, assay, antibody)
- Plot gallery with click-to-expand modal
- Similar/neighbor files panel
- BEDset membership display
- Exact match indicators in search results
- BEDset browsing and detail views
- Saved UMAP selections as browsable collections with rename, reorder, and detail views
- Cart with download script generation
- Metrics dashboard
- Multi-language code snippets (Python, R, Rust) with syntax highlighting on landing page
- Landing page with search, file upload, example queries, and global stats

### Intentionally different

These old UI features were dropped or replaced by design:

- **Dedicated BED splash page** (`/bed/:id`) — The old splash page put plots, statistics, UMAP preview, neighbors, and BEDset memberships on a single scrollable page. It was comprehensive but crowded — too much information competing for attention without a clear hierarchy. The Analysis tab breaks this into focused sections (stats, plots, annotations, neighbors, BEDset memberships) and lets users bring in the UMAP or search via split view when they actually want that context, rather than forcing it all onto one page.
- **Sticky UMAP alongside search results** — The old UI tried to show the UMAP inline with BED-to-BED search results, but this created a tension: forcing the UMAP into search was cluttered, while the UMAP on its own had no search context. The split-view model resolves this — the UMAP is its own full tab, and users who want search context can drag the Search tab alongside it. Each feature keeps its own layout; the user decides when to combine them.
- **Expand/collapse UMAP card** — replaced by split view. Instead of a card that expands to a fullscreen overlay, the UMAP is a full tab that can share the screen with any other tab.

### Not yet implemented

- **File report generation** — Route exists (`/file/report`) but is a stub. Planned as a downloadable summary of all analysis results for an uploaded file.

## Development

```bash
npm install
npm run dev
```

The dev server uses `VITE_API_BASE` from `.env.development` (defaults to `https://api-dev.bedbase.org/v1`).

### Type generation

Regenerate TypeScript types from the API's OpenAPI spec:

```bash
npm run generate-types
```

### Build

```bash
npm run build
```

Production builds use `VITE_API_BASE` from `.env.production` (`https://api.bedbase.org/v1`).

## Project structure

```
src/
  components/
    analysis/      # BED file analysis (local WASM + database API)
    cart/           # Cart view and download
    collections/    # BEDset browsing, detail, and saved UMAP selections
    file/           # Uploaded file page
    graphics/       # Landing page illustrations
    hub/            # Landing page
    layout/         # App shell, tab header, split view
    metrics/        # Metrics dashboard
    report/         # File report (stub)
    search/         # Text and BED-to-BED search
    shared/         # Reusable components
    tabs/           # Tab content router
    umap/           # UMAP visualization, legend, table, selections
  contexts/         # React contexts (tabs, cart, file, API, buckets, mosaic)
  lib/              # Utilities, constants, BED parser, analysis logic
  queries/          # React Query hooks for API calls
```
