---
id: ADR-0001
date: 2026-05-21
status: Superseded by ADR-0010
deciders: Lauri Gates
domain: build-tooling
superseded-by: ADR-0010
relates-to:
  - PRD-001
  - ADR-0010
github-issues: []
name: blueprint-derive-adr
---

# ADR-0001: Project Language Choice — Python Stub + Vanilla JavaScript

> **Superseded by [ADR-0010](0010-adopt-typescript-bun-build.md)** (2026-06-06):
> the pack moved from vanilla JavaScript to TypeScript compiled to browser ESM
> via `bun build`. The Python-stub `__init__.py` loader contract is unchanged;
> only the JS-vs-TS language choice is superseded.

## Decision Drivers

- ComfyUI's plugin loader requires a Python `__init__.py` to register the extension and expose `WEB_DIRECTORY`
- All user-facing functionality is purely frontend UI (tooltips, modal picker) — no server-side logic needed
- JavaScript is the only language that can extend ComfyUI's LiteGraph/Vue frontend at runtime
- Keeping a zero-Python-dependency constraint dramatically simplifies installation and maintenance

## Considered Options

1. **Python stub + Vanilla JavaScript** — Minimal `__init__.py` (only `WEB_DIRECTORY` + empty mappings), all logic in JS
2. **Python stub + TypeScript** — Same stub pattern, but transpile TS → JS with a build step
3. **Full Python nodes + JavaScript** — Register Python ComfyUI nodes that inject data or serve dynamic endpoints

## Decision Outcome

**Chosen option**: "Python stub + Vanilla JavaScript" because the pack needs zero Python runtime behaviour — only the ComfyUI loader hook. Introducing TypeScript would require a build step and toolchain that adds complexity with no benefit for a single ~900-line JS file. Full Python nodes would add a dependency layer for something the frontend can serve itself via static JSON.

### Positive Consequences

- No Python dependencies to install or conflict with the ComfyUI environment
- No build step — edit JS/JSON and hard-refresh the browser; iteration is immediate
- Users can install via a simple `git clone`; no `pip install` needed
- `__init__.py` is a stable, documented ComfyUI plugin contract unlikely to break

### Negative Consequences

- No static type checking on JavaScript (vanilla JS has no compiler)
- All corpus data must be bundled as static files; dynamic/per-user data is not possible without a companion Python pack

## Pros and Cons of Options

### Python stub + Vanilla JavaScript

- ✅ Zero install friction — no Python deps
- ✅ No build toolchain required
- ✅ Immediate feedback loop (browser refresh)
- ❌ No type safety without additional tooling (JSDoc only)

### Python stub + TypeScript

- ✅ Static type checking
- ✅ Better IDE support
- ❌ Requires `tsc`/`esbuild` build step and `package.json`
- ❌ Overkill for a single-file extension

### Full Python nodes + JavaScript

- ✅ Could serve dynamic data or integrate with ComfyUI backend APIs
- ❌ Requires Python dependencies — breaks the zero-dep goal
- ❌ Adds server-side surface area to maintain

## Links

- ComfyUI custom node loading convention: `WEB_DIRECTORY` in `__init__.py`
- `comfyui-frontend-package` >= 1.40 required for the `widget.onPointerDown` hook

---
*Generated from project analysis via /blueprint:derive-adr*
