---
id: ADR-0002
date: 2026-05-21
status: Accepted
deciders: Lauri Gates
domain: frontend-framework
relates-to:
  - PRD-001
  - ADR-0001
github-issues: []
name: blueprint-derive-adr
---

# ADR-0002: Frontend-Only ComfyUI Plugin Architecture

## Decision Drivers

- The two features (tooltip enrichment and fuzzy-search picker) are entirely UI concerns — no server computation is required
- ComfyUI's modern Vue-based frontend exposes a public `app.registerExtension` API and per-widget hooks (`onPointerDown`, `callback`) that cover both use cases without any Python involvement
- Adding Python nodes would impose a hard dependency on ComfyUI's internal node system and complicate versioning
- The additive design principle ("never clobber existing tooltips") is easier to enforce in pure JS where the extension sees the same widget objects as the rest of the frontend

## Considered Options

1. **Frontend-only** — Register via `app.registerExtension`, patch widget callbacks/hooks in JS, serve corpus as static JSON
2. **Hybrid (Python node + JS)** — Register Python `KSampler`-wrapping nodes that inject metadata server-side, with a JS extension for UI
3. **Pure Python ComfyUI nodes** — Add new node types with tooltip text baked into Python, rely on ComfyUI's native label rendering

## Decision Outcome

**Chosen option**: "Frontend-only" because both features (tooltip rewrite, picker modal) are pure UI affordances that the `app.registerExtension` API supports fully. A hybrid or pure-Python approach would require users to route through new node types and would prevent the pack from enriching widgets on nodes authored by other packs (e.g. `WanVideoSampler`, `easy kSampler`).

### Positive Consequences

- Works on any node that exposes a `sampler_name`, `sampler`, or `scheduler` combo widget — including third-party nodes — via widget-name detection rather than node-type detection
- No Python process involvement at runtime means zero latency added to graph execution
- The corpus can evolve (JSON edits) without any Python restart
- Additive contract is easy to reason about: `lookup()` returns `null` → no change

### Negative Consequences

- Depends on `widget.onPointerDown` being called by the Vue frontend before its own dropdown logic; if this hook is renamed or removed in a future `comfyui-frontend-package` release, Option B (picker) silently falls back to the native dropdown
- Cannot serve per-session or user-specific metadata (e.g. last-used samplers) without a Python companion

## Pros and Cons of Options

### Frontend-only

- ✅ Works across all node types automatically
- ✅ No Python dependency
- ✅ Corpus updates require only a browser refresh
- ❌ Version-sensitive hook (`onPointerDown`) may drift with frontend releases

### Hybrid (Python node + JS)

- ✅ Could leverage server-side ComfyUI state (e.g. installed samplers list)
- ❌ Only enriches nodes of the registered types, not third-party nodes
- ❌ Adds install complexity and Python dep surface

### Pure Python nodes

- ✅ Stable — Python API is slower-moving than the frontend
- ❌ Cannot intercept existing node widgets at all
- ❌ Users must replace existing nodes with new types

## Links

- `app.registerExtension` ComfyUI frontend API
- `comfyui-frontend-package` >= 1.40: `widget.onPointerDown` hook first available
- `CLAUDE.md` § "Frontend hook is version-sensitive"

---
*Generated from project analysis via /blueprint:derive-adr*
