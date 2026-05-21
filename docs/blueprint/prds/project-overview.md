---
id: PRD-001
created: 2026-05-21
modified: 2026-05-21
status: Draft
version: "1.0"
relates-to: []
github-issues: []
name: blueprint-derive-prd
---

# comfyui-sampler-info — Product Requirements Document

## Executive Summary

### Problem Statement

ComfyUI's native `sampler_name`, `sampler`, and `scheduler` combo widgets present a flat
alphabetical list of 50–155+ cryptic string tokens with no descriptions, no dates, no
guidance on when to use each option. With popular extension packs like RES4LYF loaded,
users face over 155 strings in an undifferentiated dropdown, making sampler/scheduler
selection a guessing game for everyone except experts who have memorized the academic
literature.

Additionally, on mobile and touch-screen devices the native dropdown mispositioning
on zoomed/panned canvases makes selection painful or impossible.

### Proposed Solution

A frontend-only ComfyUI custom-node pack (`comfyui-sampler-info`) that enriches every
`sampler_name` / `sampler` / `scheduler` combo widget with two additive features:

1. **Hover/long-press tooltips** — corpus-derived metadata (paper year, algorithm family,
   ODE order, type classification, one-sentence summary, recommended use-cases, compatible
   schedulers, and supersession notes) surfaced via LiteGraph's native hover mechanism and
   via `comfyui-touch-tooltips` on long-press.

2. **Fuzzy-search modal picker** — a centered HTML dialog that replaces the native dropdown
   click handler with a searchable, keyboard-navigable modal showing structured rows with
   badges and metadata. The native left/right arrow cycling is preserved.

Both features are strictly **additive**: widgets without corpus entries fall back gracefully,
and existing Python-side tooltips (e.g., from Wan/Hunyuan/LTX wrapper nodes) are never
overwritten.

### Business Impact

- **Lower barrier to entry** — new ComfyUI users can make informed sampler choices without
  researching academic papers or forum posts.
- **Faster expert workflows** — fuzzy-search and keyboard navigation reduce the time to
  locate and select the right sampler from a long list.
- **Mobile viability** — touch-optimized picker (16px inputs, 36px touch targets, momentum
  scroll) enables usable workflows on tablets and phones.
- **Community knowledge capture** — the JSON corpus acts as a living, PR-able reference for
  sampler metadata, benefiting the broader ComfyUI ecosystem.

---

## Stakeholders & Personas

### Stakeholder Matrix

| Role | Name/Team | Responsibility | Contact |
|------|-----------|----------------|---------|
| Author / Maintainer | Lauri Gates | Feature development, corpus curation, releases | GitHub: @laurigates |
| Corpus Contributors | Open-source community | PRs adding/refining sampler metadata | GitHub PRs |
| ComfyUI Core | Comfy-Org | Frontend API stability (`widget.onPointerDown`, `widget.options.tooltip`) | comfyui-frontend-package |
| Comfy Registry | Comfy-Org | Distribution channel | registry.comfy.org |
| ComfyUI Manager | Comfy-Org | Secondary discovery/install channel | custom-node-list.json |

### User Personas

#### Primary: ComfyUI Generalist User

- **Description**: Image/video generation practitioner using ComfyUI for creative or
  production workflows; ranges from hobbyist to professional. Not necessarily familiar with
  the academic literature on diffusion samplers.
- **Needs**: Quick, informed sampler/scheduler selection without context-switching to
  external resources.
- **Pain Points**: 155+ undescribed options in alphabetical order; no hint of what each
  does or when to use it; dropdown mispositioning on mobile.
- **Goals**: Pick an appropriate sampler faster and with more confidence; learn about
  options serendipitously.

#### Secondary: Expert / Power User

- **Description**: Researcher or advanced practitioner who understands sampler math but
  wants faster navigation in large sampler lists (especially with RES4LYF).
- **Needs**: Fast fuzzy-search to jump to a known sampler without scrolling; confirmation
  of year/paper provenance.
- **Pain Points**: Alphabetical list buries related samplers across the list; no search.
- **Goals**: Keyboard-driven selection in under 3 keystrokes.

#### Tertiary: Corpus Contributor

- **Description**: Community member (researcher, RES4LYF user, custom-pack author) who
  wants to add or correct sampler metadata.
- **Needs**: A clear, minimal JSON schema; validation instructions; confidence that partial
  entries won't break anything.
- **Pain Points**: Uncertainty about which fields are required; risk of inventing inaccurate
  metadata.
- **Goals**: Submit a PR for a new sampler family with only the fields they're sure about.

---

## Functional Requirements

### Core Features

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| FR-001 | Hover tooltips | Set `widget.options.tooltip` from corpus on combo widgets named `sampler_name`, `sampler`, `scheduler`. Surfaced by LiteGraph native hover (desktop) and comfyui-touch-tooltips (mobile). | P0 |
| FR-002 | Fuzzy-search picker modal | Intercept widget click; open a centered HTML `<dialog>` with search input, per-row badges (order, type, year, family), summary, good_for, pairs_with. | P0 |
| FR-003 | fzf-style scoring | Subsequence matching with word-boundary bonuses for underscore-separated tokens. AND-token support (space-separated). Matched characters highlighted. | P0 |
| FR-004 | Keyboard navigation | ↑/↓ navigate rows, Enter selects, Esc closes, PgUp/PgDn jump 8 rows, type-from-anywhere always filters. | P0 |
| FR-005 | Corpus — sampler metadata | `web/data/samplers.json`: exact token entries + prefix regex families. Fields: year, family, order, type, summary, good_for, pairs_with, supersedes_by, notes. | P0 |
| FR-006 | Corpus — scheduler metadata | `web/data/schedulers.json`: same schema as samplers corpus. | P0 |
| FR-007 | Additive / non-clobbering | Never overwrite an existing tooltip when corpus lookup returns null. Picker rows render bare names for uncovered tokens. | P0 |
| FR-008 | Widget-name-based detection | Enhancement applied by widget name (`sampler_name`, `sampler`, `scheduler`), not by node type — covers all compatible nodes automatically. | P0 |
| FR-009 | Mobile-friendly picker | 16px minimum input font (no iOS auto-zoom), 36px minimum touch targets, momentum scrolling, works on zoomed/panned canvas. | P1 |
| FR-010 | Prefix regex family coverage | Pattern-based matching to cover RES4LYF's ~110 token variants at family level without 1:1 enumeration. First-match wins; more-specific patterns listed first. | P1 |
| FR-011 | Arrow-button cycling preserved | Native `<` / `>` buttons on the combo widget retain their original increment/decrement behavior; only the center-click is intercepted. | P1 |
| FR-012 | Long-press mobile tooltip | When `comfyui-touch-tooltips` companion pack is installed, the same tooltip text surfaces on long-press for mobile users. | P1 |
| FR-013 | Graceful picker fallback | If `widget.onPointerDown` hook is no longer called by the frontend, picker silently stops opening and falls back to native dropdown. Tooltip enrichment (FR-001) continues to work. | P1 |
| FR-014 | Static asset serving | Pack served as a ComfyUI frontend extension via `WEB_DIRECTORY = "./web"`. No Python nodes. JSON data files fetched at runtime via `/extensions/comfyui-sampler-info/data/`. | P0 |

### User Stories

- As a generalist user, I want to hover over the sampler widget and see a description of the selected sampler so that I understand what I've picked without leaving ComfyUI.
- As a generalist user, I want to click the sampler widget and see a searchable list with descriptions so that I can find the right sampler without scrolling through 155 options.
- As a power user, I want to type "dpm sde" and immediately see all DPM SDE-flavored variants highlighted so that I can select without reaching for the mouse.
- As a mobile user, I want the picker to open with large touch targets and not trigger iOS zoom so that I can use ComfyUI workflows on my tablet.
- As a corpus contributor, I want a clear schema and validation command so that I can add my custom-pack samplers in a PR without risking breakage.
- As a Wan/Hunyuan workflow user, I want the pack to leave my nodes' existing tooltips intact so that the richer Python-side descriptions aren't replaced.

---

## Non-Functional Requirements

### Performance

- Corpus JSON files (`samplers.json`, `schedulers.json`) fetched once at extension load with `cache: "no-cache"`. All subsequent lookups are in-memory O(1) for exact tokens, O(n) for prefix scan.
- Picker modal renders synchronously from the pre-loaded corpus; no per-open network requests.
- JS extension is a single ~900-line file; no bundler, no build step, minimal parse cost.

### Security

- No user data is sent to any external service.
- No Python runtime dependencies; no server-side code executed by the pack.
- Corpus is static JSON with no executable content.

### Accessibility

- Picker uses native `<dialog>` element (built-in focus trapping and ARIA role).
- Keyboard-complete workflow: all picker actions reachable without mouse.
- Touch targets meet 36px minimum for mobile usability.

### Compatibility

- **ComfyUI frontend**: `comfyui-frontend-package >= 1.40` (when `widget.onPointerDown` hook landed). Tested against 1.43.17.
- **Tooltip path** (`widget.options.tooltip`): LiteGraph convention, stable across frontend versions.
- **Picker hook** (`widget.onPointerDown`): version-sensitive; graceful fallback if hook signature changes.
- **Python**: `>= 3.10` (ComfyUI minimum; the pack's own Python surface is a 3-line stub).
- **Browsers**: any modern browser supported by ComfyUI's Vue frontend.

---

## Technical Considerations

### Architecture

The pack is a **frontend-only ComfyUI extension**:

```
__init__.py                    # Loader stub — WEB_DIRECTORY + empty NODE_CLASS_MAPPINGS
web/
  js/
    sampler-info.js            # Single-file extension (~900 lines, no build step)
  data/
    samplers.json              # Sampler corpus (exact + prefix)
    schedulers.json            # Scheduler corpus (exact + prefix)
```

**Extension registration**: Uses ComfyUI's `app.registerExtension` API with `nodeCreated`
and `beforeRegisterNodeDef` lifecycle hooks to enumerate and enhance combo widgets.

**Corpus lookup**: Two-level: exact hash-map lookup → prefix regex scan (first-match wins).
Corpus compiled at load time (regexes pre-compiled, invalid patterns warned and skipped).

**Modal picker**: Pure HTML/CSS injected into `document.body`. Uses `<dialog>` element.
CSS injected once via a `<style>` tag with a stable ID to prevent duplication.

**URL dependency**: Static assets served at `/extensions/comfyui-sampler-info/data/...`.
The pack directory name is the URL segment; renaming the directory breaks fetches unless
the `EXT_NAME` constant in `sampler-info.js` is updated in sync.

### Dependencies

| Dependency | Role | Version Floor |
|-----------|------|---------------|
| comfyui-frontend-package | Frontend runtime (Vue, LiteGraph, widget hooks) | >= 1.40 |
| comfyui-touch-tooltips | Optional: long-press mobile tooltip surface | any |

No Python runtime dependencies beyond a standard ComfyUI installation.

### Integration Points

| System | Integration | Notes |
|--------|------------|-------|
| LiteGraph / ComfyUI frontend | `widget.options.tooltip` (write) | Stable convention |
| ComfyUI frontend | `widget.onPointerDown` (intercept) | Version-sensitive; graceful fallback |
| ComfyUI frontend | `app.registerExtension` API | Standard extension entry point |
| Comfy Registry | `pyproject.toml [tool.comfy]` + GitHub Actions `publish.yml` | Auto-publish on version bump |
| ComfyUI Manager | `custom-node-list.json` PR | Secondary install channel |
| comfyui-touch-tooltips | Reads `widget.options.tooltip` written by this pack | Optional companion |

### Corpus Schema

Both JSON corpus files share the same structure:

```json
{
  "exact": {
    "<token>": {
      "year": 2022,
      "family": "DPM-Solver++",
      "order": 2,
      "type": "deterministic multistep",
      "summary": "One sentence.",
      "good_for": "When to use it.",
      "pairs_with": ["karras", "exponential"],
      "supersedes_by": "dpmpp_2m",
      "notes": "Optional edge-case note."
    }
  },
  "prefix": [
    {
      "match": "^res_\\d+s",
      "family": "RES single-step",
      "summary": "...",
      "good_for": "...",
      "pairs_with": ["..."]
    }
  ]
}
```

All fields optional. Renderer skips missing fields gracefully.

### Corpus Coverage (v0.1.0)

| Category | Count |
|----------|-------|
| ComfyUI core samplers (exact) | 48 |
| ComfyUI core schedulers + bong_tangent (exact) | 10 |
| RES4LYF prefix families | 14 |

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Sampler corpus coverage (exact) | 48 core tokens | 100% of tokens visible in a standard + RES4LYF install | Count of `null` lookups logged in console |
| Scheduler corpus coverage (exact) | 10 tokens | 100% of core schedulers | Manual audit |
| Picker open latency | < 50ms (corpus pre-loaded) | < 50ms | Browser devtools perf trace |
| ComfyUI Manager registry listing | Not yet listed | Listed and accepted | PR merge |
| Comfy Registry publish | Not yet published | v0.1.0 published | registry.comfy.org listing |
| Mobile usability | Improved vs native | No iOS auto-zoom, no misposition | Manual device testing |

---

## Scope

### In Scope

- Tooltip enrichment for `sampler_name`, `sampler`, `scheduler` combo widgets (any node).
- Fuzzy-search picker modal replacing the native dropdown click.
- JSON corpus for ComfyUI core samplers (48) and schedulers (10).
- Prefix-pattern corpus coverage for RES4LYF sampler families (~14 patterns).
- Mobile-friendly picker UX.
- GitHub Actions auto-publish to Comfy Registry on `pyproject.toml` version bump.
- Community contributions to the corpus via PRs.

### Out of Scope

- Python nodes or server-side data generation.
- Support for non-combo widget types (sliders, text inputs, etc.).
- Automatic corpus updates from ComfyUI's `samplers.py` (manual curation only).
- Tooltip/picker for widgets not named `sampler_name` / `sampler` / `scheduler`.
- Full 1:1 enumeration of all ~110 RES4LYF tokens (family-level prefix matching used instead until community provides per-token data).
- Dark/light theme switching (single CSS theme only in v0.1).

---

## Timeline & Phases

### Current Phase: Initial Release (v0.1.0)

Feature-complete for the two core enhancements. Corpus covers ComfyUI core samplers and
schedulers plus RES4LYF prefix families. Pending:
- Comfy Registry publisher registration (`PublisherId = "TODO-publisher-id"` in pyproject.toml).
- ComfyUI Manager `custom-node-list.json` PR.
- Screenshot assets for README (`docs/picker.png`, `docs/tooltip.png`).

### Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| v0.1.0 — Initial release | Core tooltip + picker, sampler/scheduler corpus | In progress (pending registry setup) |
| v0.1.x — Corpus patches | Community corpus additions (RES4LYF token-specific data, provenance for uncertain years, custom-pack samplers) | Ongoing via PRs |
| v0.2.x — Picker enhancements | UX improvements to picker (theme, multi-column layout, pinning favorites, etc.) | Planned |
| v1.0.0 — Schema stability | Any breaking schema changes requiring major version bump | Future |

---

*Generated from existing documentation via blueprint derive-prd.*
*Review and update as project evolves.*
