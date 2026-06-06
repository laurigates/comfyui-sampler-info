---
id: ADR-0003
date: 2026-05-21
status: Superseded by ADR-0010
deciders: Lauri Gates
domain: build-tooling
superseded-by: ADR-0010
relates-to:
  - PRD-001
  - ADR-0001
  - ADR-0002
  - ADR-0010
github-issues: []
name: blueprint-derive-adr
---

# ADR-0003: Single-File JavaScript Implementation (No Bundler)

> **Superseded by [ADR-0010](0010-adopt-typescript-bun-build.md)** (2026-06-06):
> a `bun build` step now compiles a single TypeScript source (`src/index.ts`)
> to a single browser-ESM file (`web/dist/index.js`). The "one source → one
> served file, loaded directly by the browser" property is preserved; the
> "no bundler / no build step" constraint is what's superseded.

## Decision Drivers

- ComfyUI serves JS extension files as static assets from `WEB_DIRECTORY`; the browser loads them directly as ES modules — no bundler output is needed
- The entire extension (corpus loading, tooltip formatting, fuzzy scorer, picker UI, wiring) is cohesive and small enough (~900 lines) to be readable in one file
- A bundler (Vite, esbuild, Webpack) would require `package.json`, `node_modules`, and a build step, adding friction to the zero-toolchain goal
- The syntax check `node --check web/js/sampler-info.js` is sufficient to catch parse errors without a full build

## Considered Options

1. **Single vanilla JS file, no bundler** — `web/js/sampler-info.js` (~900 lines), served directly as an ES module
2. **Multiple files + ES module imports** — Split into `corpus.js`, `picker.js`, `tooltip.js`, etc., imported via `import`
3. **Bundled JS (Vite/esbuild)** — Author in TypeScript or multi-file JS, emit a single built file to `web/js/`

## Decision Outcome

**Chosen option**: "Single vanilla JS file, no bundler" because the code size is manageable (~900 lines) and all sections are tightly coupled through shared state (`PICKER_STATE`, `SAMPLERS`, `SCHEDULERS`, `CORPUS_LOADED`). Splitting into modules would require coordinating that shared state across import boundaries without gaining readability. A bundler would add the toolchain the project explicitly avoids.

### Positive Consequences

- No build step — edit and hard-refresh
- No `package.json` or `node_modules` to maintain
- Syntax check via `node --check` is a one-liner in the dev workflow
- Single code-review surface; no import graph to trace

### Negative Consequences

- As the file grows beyond ~900 lines, navigating becomes harder without IDE support
- No tree-shaking or minification (acceptable for a browser extension of this size)
- Cannot use npm packages; any utility (e.g. a more complete fzf scorer) must be vendored inline

## Pros and Cons of Options

### Single vanilla JS file, no bundler

- ✅ Zero build toolchain
- ✅ Direct edit → refresh loop
- ✅ Entire codebase visible in one scroll
- ❌ File grows harder to navigate past ~1500 lines

### Multiple files + ES module imports

- ✅ Better logical separation
- ❌ ComfyUI's static server requires explicit import paths; no module resolution
- ❌ Shared mutable state (`PICKER_STATE` etc.) becomes harder to track across imports

### Bundled JS (Vite/esbuild)

- ✅ TypeScript, minification, tree-shaking
- ❌ Build step breaks the "edit → refresh" workflow
- ❌ Adds `node_modules` and build config to the repo

## Links

- `CLAUDE.md` § "Iterating on JS / CSS / JSON"
- `CLAUDE.md` § "Syntax checks before commit"

---
*Generated from project analysis via /blueprint:derive-adr*
