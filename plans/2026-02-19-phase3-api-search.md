---
date: 2026-02-19
status: complete
description: "Phase 3: API layer + Search tab for BEDbase UI"
parent: plans/2026-02-18-bedbase-ui-rewrite.md
---

# Phase 3: API Layer + Search Tab

## Context

Phases 1 and 2 delivered the tab scaffold, upload flow, and WASM-based analysis for uploaded BED files. The search tab is still a placeholder, the hub stats bar shows hardcoded numbers, and there's no API communication at all. Phase 3 wires the UI to the BEDbase API (`api.bedbase.org/v1`) and builds the Search tab with real text search and bed-to-bed search results.

## Dependencies to add

| Package | Purpose |
|---------|---------|
| `@tanstack/react-query` | Data fetching, caching, loading/error states |
| `axios` | HTTP client — consistent with existing bedhost UI, auto JSON, better errors |
| `openapi-typescript` (dev) | Generate `bedbase-types.d.ts` from live API OpenAPI spec |

## Architecture

### API client (`src/lib/api.ts` — new)

Axios instance, same pattern as bedhost's `api-context.tsx` but simpler (no React context — just an exported instance):

```ts
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? 'https://api.bedbase.org/v1',
});
```

- Base URL from `VITE_API_BASE` env var, defaults to production API
- Auto JSON parsing, proper error objects with `error.response.status`
- No context wrapper needed — query hooks import `api` directly

### API types (`bedbase-types.d.ts` — generated)

Generate from the live API using `openapi-typescript`:

```bash
npx openapi-typescript https://api.bedbase.org/v1/openapi.json -o bedbase-types.d.ts
```

This produces auto-generated types matching the real API contract. Each query hook aliases what it needs at the top:

```ts
import type { components } from '../../bedbase-types';
type SearchResponse = components['schemas']['BedListSearchResult'];
```

Same pattern as the existing bedhost UI hooks.

### QueryClient provider (`src/pages/app.tsx` — modify)

Wrap the app in `<QueryClientProvider>`. QueryClient config:
- `retry: 1` (one retry)
- `staleTime: 5 * 60 * 1000` (5 min default)

### Query hooks (`src/queries/` — new directory)

Port from `repos/bedhost/ui/src/queries/`:

| Hook | API endpoint | Key differences from original |
|------|-------------|-------------------------------|
| `useTextSearch` | `GET /bed/search/text` | Cleaner types, no `autoRun` — uses `enabled` directly |
| `useBedSearch` | `POST /bed/search/bed` | FormData file upload |
| `useStats` | `GET /stats` | Simple, auto-enabled |

Each hook follows the pattern:
```ts
export function useTextSearch(query: string, opts?: { limit?: number; offset?: number; enabled?: boolean }) {
  return useQuery({
    queryKey: ['text-search', query, opts?.limit, opts?.offset],
    queryFn: async () => {
      const { data } = await api.get<BedSearchResult>('/bed/search/text', {
        params: { query, limit: opts?.limit ?? 10, offset: opts?.offset ?? 0 },
      });
      return data;
    },
    enabled: opts?.enabled !== false && !!query,
  });
}
```

### Fix search tab param extraction (`src/contexts/tab-context.tsx` — modify)

Currently `pathToActiveTab` doesn't extract a param for the search tab (line 22):
```ts
if (pathname.startsWith('/search')) return { id: 'search' };
```

Fix to extract query param from path:
```ts
if (pathname.startsWith('/search')) {
  const match = pathname.match(/^\/search\/(.+)/);
  return { id: 'search', param: match?.[1] ? decodeURIComponent(match[1]) : undefined };
}
```

This preserves search queries in the URL (`/search/K562%20CTCF`).

## Search tab subject model

Follows the same pattern as the Analysis tab:

- `/search` (no param) → **empty state** — search input + file upload widget + example queries
- `/search/<query>` (text query param) → **text search** results
- `/search/upload` (special param) → **bed-to-bed search** using the uploaded file from FileContext

The upload page's "Find similar files" card calls `openTab('search', 'upload')`.

## Search tab UI

### Search view (`src/components/search/search-view.tsx` — new)

Routes on `param`:
- **No param** → `<SearchEmpty />` — the empty/landing state
- **`'upload'`** → bed-to-bed search using `uploadedFile` from FileContext. If no file in context, redirects to empty state.
- **Any other param** → text search using param as query string

Both search modes share the same results layout (result cards + pagination). The difference is only the query hook used and the header shown above results.

**Text search mode:**
- Header: search input pre-filled with query, editable (submit navigates to `/search/<new-query>`)
- Uses `useTextSearch(param)` hook
- Results as cards below

**Bed-to-bed search mode:**
- Header: shows uploaded file name + size, with a "Change file" link back to hub
- Uses `useBedSearch(uploadedFile)` hook
- Results as cards below

### Result card (`src/components/search/result-card.tsx` — new)

Each result card shows:
- **Name** (bold) — `metadata.name` or "Unnamed"
- **Score badge** — `score * 100` as percentage, colored primary if > 50%
- **Genome badge** — `metadata.genome_alias`
- **Annotation badges** — tissue, cell_line, assay (only if non-empty)
- **Description** (muted italic) — truncated to 2 lines
- Click → `openTab('analysis', result.metadata.id)` — opens Analysis tab for that bed file

Styling follows existing DaisyUI patterns (no Bootstrap):
- Card: `border border-base-300 rounded-lg p-4 hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-pointer`
- Badges: `badge badge-sm` with semantic colors

### Search empty state (`src/components/search/search-empty.tsx` — new)

Mirrors the hub's input pattern — a combined search + upload widget:
- Text search input (same as hub's SearchInput top row)
- File upload drop zone below it (same as hub's SearchInput bottom row)
- Example query chips ("K562 CTCF", "ENCODE DNase-seq", etc.)
- Brief description of search capabilities

When a file is uploaded from this widget → set file in FileContext + navigate to `/search/upload`.
When a query is submitted → navigate to `/search/<query>`.

### Pagination

Simple offset-based pagination at the bottom of results:
- "Showing X–Y of Z results"
- Previous / Next buttons
- 10 results per page default

### Loading state

Skeleton cards (3 placeholder cards with pulse animation) while fetching.

### Error state

Error message with retry button. Special handling for:
- 413 (file too large for bed-to-bed search)
- 415 (invalid BED format)

## Hub stats bar (`src/components/hub/hub.tsx` — modify)

Replace the hardcoded stats (line 167-173) with `useStats()` data:
- `stats.bedfiles_number` → "X BED files"
- `stats.bedsets_number` → "X BEDsets"
- `stats.genomes_number` → "X genomes"
- Show skeleton/placeholder while loading

## Files summary

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add `@tanstack/react-query`, `axios`, `openapi-typescript` (dev) |
| `bedbase-types.d.ts` | **New** (generated) | Auto-generated types from live API OpenAPI spec |
| `src/lib/api.ts` | **New** | Axios instance with base URL config |
| `src/queries/use-text-search.ts` | **New** | Text search hook |
| `src/queries/use-bed-search.ts` | **New** | Bed-to-bed search hook |
| `src/queries/use-stats.ts` | **New** | Platform stats hook |
| `src/contexts/tab-context.tsx` | Modify | Extract param from `/search/...` path |
| `src/pages/app.tsx` | Modify | Add `QueryClientProvider` wrapper |
| `src/components/search/search-view.tsx` | **New** | Main search tab — routes on param (empty/text/upload) |
| `src/components/search/search-empty.tsx` | **New** | Empty state with search input + file upload widget |
| `src/components/search/result-card.tsx` | **New** | Individual search result card |
| `src/components/upload/upload-page.tsx` | Modify | "Find similar files" calls `openTab('search', 'upload')` |
| `src/components/tabs/tab-content.tsx` | Modify | Route search tab to `SearchView` |
| `src/components/hub/hub.tsx` | Modify | Wire stats bar to `useStats()` |

## Verification

1. **Text search**: Type "K562 CTCF" in hub search input → Search tab opens → real results from API appear with names, scores, genome badges, annotation badges
2. **Click example query**: Click "ENCODE DNase-seq" chip on hub → same flow
3. **Click result**: Click a search result card → Analysis tab opens at `/analysis/<bed-id>` (will show empty/placeholder until Phase 4 wires db metadata)
4. **Bed-to-bed search**: Upload a BED file → go to upload page → click "Find similar files" → navigates to `/search/upload` → results from bed-to-bed API appear
4b. **Bed-to-bed from search tab**: Open search tab (empty state) → upload a file via the drop zone → navigates to `/search/upload` → results appear
5. **Hub stats**: Hub stats bar shows real numbers from API (not 93,026 / 18,547 / 5)
6. **URL persistence**: Navigate to `/search/H3K27ac` directly → search tab opens with query, results load
7. **Pagination**: Search with many results → Previous/Next buttons work, offset updates
8. **Error states**: Upload a non-BED file → attempt bed search → appropriate error message
9. **Dev server starts** without errors
10. **Build succeeds** (`npm run build`)
