---
date: 2026-02-18
status: in-progress
description: BEDbase UI rewrite — tab-based split-view with unified file-first experience
---

# BEDbase UI Rewrite: Tab-Based Split-View Architecture

## Context

BEDbase currently has disjoint features (search, WASM analysis, UMAP, bed detail pages) on separate routes with separate upload flows. The UMAP in particular has no natural home — it's useful *in context of* what you're looking at, but doesn't belong on any specific page. It's a lens, not a destination.

The vision: redefine the UI so features can be viewed alongside each other without switching your entire view. Two equally-weighted entry points — **bring your own file** or **browse the database** — with a tab system that lets you see one or two features at a time, connected by shared state.

### Two primary users

1. **Browser/Downloader** — searches for BED files, inspects them, downloads via cart. Primary flow: search → browse results → inspect → download.
2. **Uploader/Analyzer** — brings their own BED file for analysis and comparison. Primary flow: upload → analyze → find similar → see in context.

The UI should be **reactive to input** rather than asking users to choose a mode. Type a query → search happens. Upload a file → analysis starts. Open UMAP → explore visually. Available next-steps adapt based on what you've provided.

## Decision: New repo for prototype

The scope is a full UI paradigm shift, not incremental additions. A new repo:
- Lets us prototype freely without risking the production UI
- Avoids fighting existing Bootstrap layout assumptions and route structure
- The complex pieces (Mosaic/DuckDB WASM for UMAP, gtars WASM, API query hooks) are portable
- Existing bedhost UI stays live at api.bedbase.org while this develops

**Stack**: Vite + React 18 + TypeScript + Tailwind CSS v4 + DaisyUI v5.

**Location**: New repo at `repos/bedbase-ui/` in this workspace.

## UI Styling Rules

Utility-first with Tailwind CSS, DaisyUI for component classes and semantic color tokens, Lucide React for icons.

### Setup (app.css)

```css
@import 'tailwindcss';
@plugin "@tailwindcss/typography";
@plugin "daisyui" {
  themes: light --default, dark --prefersdark;
}
```

### Key rules

- **No inline styles** unless physically impossible with classes (e.g., dynamic width from JS). Comment why if used.
- **Semantic tokens only** — use DaisyUI's `primary`, `base-300`, `error`, etc. Never raw Tailwind palette (`blue-500`, `gray-200`).
- **DaisyUI component classes as base**: `btn`, `btn-primary`, `card`, `card-body`, `badge`, `input`, `input-bordered`, `modal`, `modal-box`, `tooltip`, `dropdown`.
- **Opacity modifiers** for subtle tints: `bg-primary/5`, `bg-primary/10`, `text-base-content/60`.
- **Variant maps** as lookup objects, not ternary chains.
- **Interactive states** always paired with transitions: `hover:shadow-md transition-shadow`, `hover:bg-base-300 transition-colors`.
- **Selected state**: `border-primary/40 bg-primary/5`.
- **Default card/container**: `border border-base-300 shadow-sm rounded-lg`.
- **Responsive**: mobile-first, `md:` breakpoint for tablet+.
- **Dark mode**: handled by DaisyUI themes automatically. No manual `dark:` variants.
- **No `@apply`**, no scoped/module CSS for layout or color.
- **Icons**: Lucide React (`lucide-react`).

## The Tab Model

### Core concept

Tabs — but tabs where the content area can show one or two at a time. Not a window manager. Everyone understands tabs; the only novel part is "you can have two active at once."

No React portals needed. No `createPortal`, no fixed positioning, no z-index management. Everything lives in normal DOM flow — a top bar with tabs and an input bar, and a content area below rendered as a CSS grid.

```
<div>
  <TopBar>
    <InputBar />           {/* search/file/URL toggle */}
    <Tabs />               {/* Search | Analysis | UMAP | Collections */}
  </TopBar>
  <ContentArea>            {/* grid: 1fr or 1fr 1fr */}
    {activeTab1Content}
    {activeTab2Content?}
  </ContentArea>
</div>
```

### Tabs

| Tab | Content | Needs input? |
|-----|---------|-------------|
| **Search** | Text-to-bed results, bed-to-bed results | Text query or BED file |
| **Analysis** | Unified bed detail + WASM analysis view | BED file (uploaded or selected from search/UMAP) |
| **UMAP** | Embedding visualization | None — works standalone |
| **Collections** | Browse BEDsets, view collection details | None — works standalone |

### Tab behavior

- Click a tab → it becomes active, full width in content area
- Click a second tab (or click a split icon on a tab) → content area becomes two columns, both tabs active
- Click an active tab's close/unsplit → back to single tab, remaining one fills the space
- Max 2 tabs active at once
- Inactive tabs are still visible in the tab bar, just not highlighted

### Landing state

On page load, no tab is "open" in the content area. The user sees:
- The input bar (prominent, centered or near-top)
- Feature cards below describing each tab (Search, Analysis, UMAP, Collections)

Taking an action transitions to tab view:
- Type a query → Search tab activates, results appear, cards disappear
- Upload a file → Analysis tab activates (or a summary section appears first), cards disappear
- Click a feature card → that tab activates

This means the "hub" with cards is the zero-state. Tabs appear once you do something. The feature cards are essentially large, descriptive tab triggers.

### Future enhancement: animations + overlays

Backdrop/dim effects, card-to-tab expand animations, and floating overlays are deferred. These would use React portals (`createPortal` to `document.body`) for the overlay rendering. Not needed for the core tab + split-view system.

## Cross-tab data flow

BED file IDs and selections flow between tabs via shared context:
- **Analysis → UMAP**: viewing a bed file in Analysis, open UMAP tab alongside → that file is highlighted on the embedding
- **Search → UMAP**: have search results, open UMAP tab → all result files shown on the embedding
- **Collections → UMAP**: viewing a bedset, open UMAP tab → all bed files in the bedset appear on the embedding
- **Search → Analysis**: click a search result → Analysis tab activates showing that file's details

This requires a shared `activeBedIds` in state — a list of bed IDs/files that the focused tab broadcasts. UMAP reads this to highlight/position points.

### Flow examples

1. Upload file → Analysis tab shows stats → click UMAP tab to split → uploaded file highlighted on embedding
2. Search "H3K27ac" → Search tab shows results → split with UMAP → results shown on embedding
3. Click UMAP card → browse embedding → draw selection → download selected files
4. Search → click a result → Analysis tab opens showing that database file's details

## Merging Bed Splash + Analytics

The current bed splash (database file detail) and analytics (uploaded file analysis) show overlapping information from different sources. The merged **Analysis** tab unifies them:

### Always shown (both sources)
- Basic stats: region count, mean width, nucleotide count, GC content
- Genome compliance / data format classification
- Chromosome stats table (per-chrom region counts, min/max/mean lengths)
- Region distribution plot (bar chart by chromosome)
- Reference genome compatibility analysis

### Database files additionally show
- Full annotation metadata (cell line, assay, antibody, etc.)
- Pre-computed plots (from server)
- Similar files (neighbors)
- BEDset memberships
- Download links (BED, BigBED)
- Add to cart
- **No WASM analysis** — all data comes from pre-computed server results

### Uploaded files additionally show
- WASM-computed chromosome stats table + region distribution plot
- Processing time
- File size
- Option to "submit to BEDbase" (future)
- **No pre-computed plots** — all analysis done client-side via gtars WASM

The tab component checks its data source (database ID vs uploaded File/RegionSet) and conditionally renders the appropriate sections. Clean separation: DB files use server data, uploaded files use WASM.

## Architecture

### Shared state

```
BedFileContext
├── file: File | null              # uploaded file
├── fileUrl: string | null         # or URL
├── inputMode: 'search' | 'file' | 'url'
├── searchQuery: string | null     # text search query
├── regionSet: RegionSet | null    # WASM-parsed (cached, computed eagerly)
├── umapCoords: [x, y] | null     # from /bed/umap (cached, computed eagerly)
└── loading states

TabContext (useReducer)
├── activeTabs: TabId[]            # 0, 1, or 2 active tabs
├── openTab(id)                    # activate a tab (auto-splits if one already open)
├── closeTab(id)                   # deactivate a tab
├── activeBedIds: string[]         # bed IDs the focused tab broadcasts
├── setActiveBedIds(ids)           # any tab can set this
└── constraints: max 2 active
```

The `activeBedIds` is the key cross-tab communication channel. When the Search tab has results, it sets `activeBedIds` to the result IDs. When Analysis is viewing a file, it sets it to that single ID. UMAP reads `activeBedIds` to highlight/position points.

### Layout rendering

No React portals. Normal DOM flow:
- Top bar: input bar + tab buttons
- Content area: CSS Grid, `1fr` for single tab, `1fr 1fr` for split
- Each active tab renders its content component in a grid cell
- Inactive tabs are unmounted (or kept alive in DOM but hidden, TBD based on performance needs — UMAP may need to stay mounted)

### Component structure

```
src/
  contexts/
    bed-file-context.tsx          # shared file state + eager computation
    tab-context.tsx               # tab layout state machine
    api-context.tsx               # axios instance (port from existing)

  components/
    layout/
      top-bar.tsx                 # container for input bar + tab buttons
      input-bar.tsx               # unified bar: dropdown toggle for search/file/URL modes
      tab-bar.tsx                 # tab buttons with active/inactive states
      content-area.tsx            # CSS grid container, 1fr or 1fr 1fr

    analysis/
      bed-analysis.tsx            # unified bed detail/analysis view
      stats-table.tsx             # basic stats (region count, width, etc.)
      chromosome-stats.tsx        # per-chrom stats table (port from existing)
      region-distribution.tsx     # bar chart (port from existing)
      annotation-table.tsx        # metadata key-value pairs (port from existing)
      plots-grid.tsx              # pre-computed plot thumbnails (port from existing)
      similar-files.tsx           # neighbor results
      bedset-memberships.tsx      # associated bedsets

    search/
      search-results.tsx          # text + bed2bed results combined
      result-card.tsx             # individual result (clickable → opens analysis)

    umap/
      umap-view.tsx               # embedding-atlas + Mosaic (port from existing)

    collections/
      bedset-browser.tsx          # browse bedsets
      bedset-detail.tsx           # bedset detail view

    hub/
      feature-card.tsx            # card shown in zero-state, triggers tab activation

  queries/                        # port TanStack Query hooks from existing
  pages/
    app.tsx                       # single-page app: top bar + content area
```

## Design decisions (Phase 1 learnings)

### Analysis tab subject model

The Analysis tab always shows **one file** — whichever file you navigated to it with. The subject is determined by the navigation action and URL param:

- `/analysis` (no param) + uploaded file exists → show uploaded file analysis
- `/analysis` (no param) + no uploaded file → empty state (upload drop zone + feature description + example files)
- `/analysis/bed123` → show database file analysis

When viewing a database file AND an uploaded file exists in context, a small comparison strip can appear (overlap score, shared regions), but the page content is about the database file. The uploaded file is ambient context, not a co-subject.

### Tab empty states

Each tab has a useful empty state rather than a blank page:
- **Analysis**: upload drop zone (reuses hub component), list of analyses performed, clickable example BED files
- **Search**: search input, example queries
- **UMAP**: loads standalone, no empty state needed
- **Collections**: loads standalone, no empty state needed

### Routes outside the tab system

Some pages live outside the tab system (no navbar pill):
- `/upload` — file preview + "what do you want to do?" action cards
- `/upload/report` — aggregated analysis report
- `/metrics` — BEDbase usage metrics

The navbar file icon (left of Search) appears when a file is uploaded, linking to `/upload`.

### Upload flow

Files are uploaded to the browser for WASM processing, NOT sent to BEDbase servers. No server-side ID is assigned. The file lives in a React context (`FileContext`) and is lost on refresh. The `/upload` route redirects to `/` if no file is in context.

## Implementation approach

This is a **master plan**. Each phase below gets its own detailed plan file (`plans/YYYY-MM-DD-phase-N-<name>.md`) with implementation specifics, acceptance criteria, and testing. We review/approve each phase plan before executing it.

## Phases (overview)

### Phase 1: Scaffold + tab system ✅

- Vite + React + TypeScript + Tailwind CSS v4 + DaisyUI v5 project
- Tab context with URL-based routing (primary tab in pathname, split tab in `?split=` query param)
- Navbar with logo, tab pills, drag-to-split
- Hub landing page with search/upload input, feature rows with graphics, metrics bar, footer
- Upload flow: file context, `/upload` route with preview + action cards, navbar file indicator
- Scaffold pages: `/upload/report`, `/metrics`, cart tab
- BEDbase teal (#008080) theme, per-tab semantic colors

### Phase 2: WASM parsing + Analysis tab (uploaded files)

- Wire gtars WASM — init, parse uploaded BED files client-side
- Replace placeholder metadata in file preview with real parsed data (region count, genome, avg length)
- Build Analysis tab content for uploaded files:
  - Basic stats (region count, mean width, GC content, nucleotide count)
  - Chromosome stats table (per-chrom region counts, min/max/mean lengths)
  - Region distribution plot (bar chart by chromosome)
- Analysis tab empty state: upload drop zone, feature description, example BED files
- Wire hub search input to navigate to Search tab with query
- **Milestone**: upload file → real metadata in preview → Analysis tab shows WASM-computed stats

### Phase 3: API layer + Search tab

- Set up API client (axios or fetch wrapper) + TanStack Query for caching
- Port core query hooks from bedhost: text search, bed2bed search, bed metadata, stats
- Build Search tab with real results (text search + bed2bed)
- Wire hub stats bar to real API numbers
- Search tab empty state: search input, example queries
- Click search result → navigates to `/analysis/<bed-id>`
- **Milestone**: text search and bed2bed search return real results, clicking a result opens Analysis

### Phase 4: Database file analysis

- Wire bed metadata API to Analysis tab for database files (`/analysis/<bed-id>`)
- Show annotation metadata (cell line, assay, antibody, genome, source)
- Pre-computed plots from server
- Similar files (neighbors)
- Bedset memberships
- Download links / add to cart
- Comparison strip: when viewing a database file with an uploaded file in context, show overlap score and similarity
- **Milestone**: clicking a search result opens full analysis view with all database info + comparison context

### Phase 5: Collections + Cart + Metrics

- Bedset browser and detail views
- Cart functionality (add/remove files, bulk download)
- Metrics page (`/metrics`) with BEDbase usage stats
- **Milestone**: full browsing, cart, and metrics workflows

### Phase 6: UMAP tab + cross-tab navigation

- Port Mosaic coordinator, DuckDB WASM, embedding-atlas integration
- Wire `activeBedIds` from tab context to highlight points on the embedding
- Wire uploaded file UMAP coordinates from API
- Cross-tab navigation: view search results on UMAP, highlight analysis file (uploaded or database) on UMAP, view bedset members on UMAP
- **Milestone**: UMAP renders, cross-tab highlighting works for search/analysis/collections, uploaded file appears as custom point

### Phase 7: File report generation

- Generate a comprehensive PDF/HTML report for uploaded BED files
- Report includes all WASM-computed analysis: summary stats, chromosome statistics table, region distribution plot, reference genome compatibility results
- Configurable sections: user selects which analyses to include before generating
- Downloadable as PDF (via browser print/save-as-PDF) and shareable as a standalone HTML file
- Report route at `/file/report` — requires a file in context, redirects to `/` if none
- Report styled independently from the app shell (clean print layout, no navbar/tabs)
- **Milestone**: upload a file → analyze → click "Generate report" → downloadable report with all analysis results

### Future: Overlay animations

- Card-to-tab expand animations using React portals
- Backdrop/dim effects when transitioning
- Floating overlay mode as alternative to inline split

## Key files to port from existing UI

| Source (bedhost/ui/src/) | Purpose | Portability |
|--------------------------|---------|-------------|
| `queries/*.ts` (21 files) | All API hooks | High — just copy + update base URL |
| `components/bed-analytics-components/` | Chromosome stats, region distribution plot | High — self-contained |
| `components/umap/` (13 files) | UMAP visualization | Medium — depends on Mosaic coordinator context |
| `contexts/mosaic-coordinator-context.tsx` | DuckDB WASM + Mosaic | Medium — standalone but complex init |
| `utils.ts` (`handleBedFileInput`, `parseBedFile`) | WASM file parsing | High |
| `components/bed-splash-components/` | Plots, header, genome modal | High — mostly presentational |

## Phase-level testing

Each phase has its own verification criteria (defined in its sub-plan). General principle: each phase should produce something runnable and testable before moving on.

| Phase | Testable outcome |
|-------|-----------------|
| 1 | ✅ Tab system works with placeholder content — activate, split, close |
| 2 | Upload a file → real stats in preview and Analysis tab |
| 3 | Text search and bed2bed search return results, clicking opens Analysis |
| 4 | Click search result → full database file analysis with comparison context |
| 5 | Bedset browsing, cart, metrics page, and cross-tab workflows |
| 6 | UMAP renders, cross-tab bed ID highlighting works |
| 7 | Upload file → generate report → download PDF/HTML with full analysis |

## End-to-end verification (all phases complete)

1. Upload a BED file → see real stats in Analysis tab
2. Split with UMAP tab → file positioned in embedding space
3. Search "H3K27ac" → browse results → split with UMAP → results highlighted on embedding
4. Click a search result → Analysis tab shows full database file details + comparison to uploaded file
5. Open UMAP tab standalone → browse embedding → draw selection → download
6. Browse collections → view a bedset → split with UMAP → bedset files on embedding
7. Upload file → analyze → generate report → download as PDF/HTML
8. Tabs activate, split, and close cleanly
