---
date: 2026-02-18
status: in-progress
description: "UI polish: BEDbase teal theme, connected tabs, animations"
---

# UI Polish: Theme, Connected Tabs, Animations

## Context

Phase 1 scaffold works but feels like a prototype. Three issues to fix before moving on:
1. DaisyUI default primary is violet — should be BEDbase brand teal (`#008080`)
2. The hub-to-tab transition is jarring — top bar appears, content swaps instantly
3. Tab buttons are flat buttons that don't reinforce the tab metaphor — the active tab should visually "connect" to its content panel below

## Changes

### 1. BEDbase teal theme (`src/app.css`)

Override DaisyUI's primary color to `#008080`. Since `success` in the default light theme (`#009485`) is too close to teal, also override it to a distinct green.

Add CSS `@keyframes` and Tailwind `@utility` classes for mount animations.

### 2. Shared tab metadata (`src/lib/tab-meta.ts` — new file)

Centralize tab config so tab-bar, feature-card, and tab-content all share it.

### 3. Connected tab buttons (`tab-bar.tsx` + `top-bar.tsx`)

Restructure TopBar into two sections with connected tab styling.

### 4. Animations

Top bar slides down, content fades in on mount.

### 5. Content area tab accent

Each tab content panel gets a subtle top border in its tab color.

## Files to modify

| File | Change |
|------|--------|
| `src/app.css` | Teal primary override, animation keyframes + utilities |
| `src/lib/tab-meta.ts` | **New** — shared tab config (labels, icons, colors) |
| `src/components/layout/top-bar.tsx` | Two-row layout, slide-down animation |
| `src/components/layout/tab-bar.tsx` | Connected tab styling, per-tab colors |
| `src/components/layout/content-area.tsx` | Per-tab accent border, fade-in animation |
| `src/components/hub/feature-card.tsx` | Use shared tabMeta, per-tab icon colors, fade-in |
| `src/components/tabs/tab-content.tsx` | Use shared tabMeta |
