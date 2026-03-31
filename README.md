# BEDbase UI

Web interface for [BEDbase](https://bedbase.org) — the open-access platform for accessing, aggregating, and analyzing genomic region data.

## Features

- **Search** — Text search across BED file metadata with genome/assay filters, or upload a BED file to find similar files by genomic content
- **Analysis** — Instant client-side statistics via WASM (region counts, width distributions, chromosome stats, genome compatibility), or view full metadata for any database file
- **UMAP** — Interactive embedding visualization of hg38 BED files (DuckDB WASM + embedding-atlas). Lasso/rectangle selection, category filtering, and upload projection
- **Collections** — Browse BEDsets (curated groups of BED files), saved UMAP selections, and multi-file comparisons (Jaccard similarity, consensus regions, set operations)
- **Cart** — Collect files across the app and generate download scripts or create new BEDsets via PEPhub
- **Split view** — Drag any tab to view two features side by side (e.g. search results next to the UMAP)

## Stack

| Layer | Technology |
|---|---|
| Framework | React 19, TypeScript |
| Styling | Tailwind CSS 4, DaisyUI 5 |
| Routing | React Router 7 + custom tab context |
| Data fetching | React Query, Axios |
| Visualization | embedding-atlas, Observable Plot, Vega |
| WASM | @databio/gtars (BED parsing + analysis) |
| Build | Vite 7 |
| Deployment | Cloudflare Pages |

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
    file/           # Upload hub and file management
    graphics/       # Landing page illustrations
    hub/            # Landing page
    layout/         # App shell, tab header, split view
    metrics/        # Metrics dashboard
    search/         # Text and BED-to-BED search
    shared/         # Reusable components
    tabs/           # Tab content router
    umap/           # UMAP visualization, legend, table, selections
  contexts/         # React contexts (tabs, cart, file, API, buckets, mosaic)
  lib/              # Utilities, constants, BED parser, analysis logic
  queries/          # React Query hooks for API calls
```
