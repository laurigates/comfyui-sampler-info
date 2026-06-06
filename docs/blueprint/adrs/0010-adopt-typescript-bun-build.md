---
id: ADR-0010
date: 2026-06-06
status: Accepted
deciders: Lauri Gates
domain: build-tooling
supersedes:
  - ADR-0001
  - ADR-0003
relates-to:
  - PRD-001
  - ADR-0001
  - ADR-0002
  - ADR-0003
  - ADR-0005
  - ADR-0006
  - ADR-0009
github-issues: []
name: blueprint-derive-adr
---

# ADR-0010: Adopt TypeScript + bun build (supersedes ADR-0001, ADR-0003)

## Decision Drivers

- The single-file vanilla-JS implementation (ADR-0003) grew the negative
  consequence both ADR-0001 and ADR-0003 named explicitly: **no static type
  checking**. The pack reaches deep into the minified ComfyUI frontend's
  LiteGraph widget/node objects (`widget.onPointerDown`, `widget.callback`,
  `node.widgets`, `app.graph._nodes`, `app.canvas.current_node`). Those
  accesses are exactly where a frontend-version bump silently breaks the pack
  (see the "Frontend hook is version-sensitive" hard rule). Type checking
  against `@comfyorg/comfyui-frontend-types` turns a class of those breakages
  into compile errors.
- A bun-externalization spike confirmed the toolchain can keep the
  zero-runtime-bundle property: `bun build ./src/index.ts --target browser
  --format esm --outdir web/dist --external '/scripts/*'` emits browser-clean
  ESM with the `/scripts/app.js` runtime import left **unbundled** (resolved at
  runtime against ComfyUI's served module). This is the property ADR-0003
  valued — the browser still loads a plain ES module, ComfyUI still serves it
  as a static file — now with a typed source.
- ADR-0009 already introduced a `package.json` + a dev dependency (Vitest), so
  ADR-0003's "no `package.json` / no `node_modules`" premise no longer held in
  full. Adding a build step on top of an existing dev toolchain is a smaller
  delta than ADR-0003 assumed.

## Considered Options

1. **TypeScript source in `src/`, built to `web/dist/` via `bun build`** —
   typed authoring, browser-ESM output, `/scripts/*` externalized.
2. **Stay on single-file vanilla JS (ADR-0003 status quo)** — no build, no
   types.
3. **TypeScript with `tsc` emit instead of `bun build`** — `tsc` can emit ESM,
   but does not understand the `--external '/scripts/*'` runtime-import concept
   and would not strip/keep the served-path import cleanly; it is a type
   checker first, a bundler never.

## Decision Outcome

**Chosen option**: "TypeScript source in `src/`, built to `web/dist/` via
`bun build`". The spike proved the output preserves the runtime contract, and
the type checker pays for itself at the frontend seam. `tsc --noEmit` is the
type gate; `bun build` is the emit. The two are decoupled — `tsc` never emits,
`bun` never type-checks — which keeps each fast and single-purpose.

### Build & serve mechanics

- **Source**: `src/index.ts` (the port of the former `web/js/sampler-info.js`)
  plus `src/comfyui-shims.d.ts`.
- **Type gate**: `bun run typecheck` → `tsc --noEmit` against
  `@comfyorg/comfyui-frontend-types` (dev dependency).
- **Emit**: `bun run build` →
  `bun build ./src/index.ts --target browser --format esm --outdir web/dist
  --external '/scripts/*'`, then copies `web/data/` → `web/dist/data/`.
- **Serve**: `__init__.py` sets `WEB_DIRECTORY = "./web/dist"`. ComfyUI serves
  that tree at `/extensions/comfyui-sampler-info/`, so the built JS is at
  `/extensions/comfyui-sampler-info/index.js` and the corpus at
  `/extensions/comfyui-sampler-info/data/*.json`. `EXT_NAME` and `DATA_BASE`
  are unchanged — the fetch path still derives from the pack directory name,
  not the JS file location.
- **Distribution**: `web/dist/` is git-ignored (it is generated). The Comfy
  Registry tarball includes it via `[tool.comfy] includes = ["web/dist"]`, and
  CI (`publish.yml`) runs `bun run build` before `publish-node-action` so the
  artifact exists at publish time.

### Type-seam notes (for future maintainers)

- `@comfyorg/comfyui-frontend-types` exports `ComfyApp` and `ComfyExtension` at
  the module root, but **not** `LGraphNode` / `LGraphCanvas` / the widget
  interfaces (they are declared internally, un-exported). The pack therefore
  models the small surface it touches with local structural interfaces
  (`SamplerNode`, `PatchedWidget`) rather than importing un-exportable types.
- TypeScript will not match an ambient `declare module` against a rooted
  (`/scripts/app.js`) path specifier. A `paths` mapping in `tsconfig.json`
  points that import at `src/comfyui-shims.d.ts` for type resolution; the
  emitted import string stays `/scripts/app.js` and `--external '/scripts/*'`
  keeps it unbundled.

### Positive Consequences

- Static type checking at the version-sensitive frontend seam — the single
  largest source of silent breakage now has a compile-time gate.
- Output is still plain browser ESM served as a static file; no runtime
  bundler, no framework, no change to how ComfyUI loads the extension.
- The five pure functions keep their exact export names
  (`compileCorpus`, `fuzzyRank`, `fuzzyScore`, `lookup`, `safeRegex`), so the
  Vitest suite (ADR-0009) imports the `.ts` source directly with no build
  dependency in tests.
- `knip` + `tsc` + Vitest + Biome give a complete local gate chain.

### Negative Consequences

- The "edit → hard-refresh" loop now requires a `bun run build` step (the
  served file is `web/dist/index.js`, not the source). Mitigated by `just
  build` and a fast (~15ms) incremental build.
- A build artifact must be present for the screenshot pipeline and the registry
  publish; both are wired to build first, but a fresh checkout has no
  `web/dist/` until `bun run build` runs.
- One more dev dependency set (`typescript`, `@comfyorg/comfyui-frontend-types`,
  `knip`) and a `tsconfig.json` to maintain.

## Pros and Cons of Options

### TypeScript + bun build

- ✅ Static types at the frontend seam
- ✅ Browser-ESM output preserves the runtime contract (spike-confirmed)
- ✅ Decoupled type gate (`tsc --noEmit`) and emit (`bun build`)
- ❌ Adds a build step to the edit-refresh loop
- ❌ Generated artifact must be built before publish / screenshots

### Stay on single-file vanilla JS (ADR-0003)

- ✅ Zero build toolchain
- ❌ No type safety at the exact place breakage happens
- ❌ ADR-0009 already eroded the "no package.json" premise

### TypeScript with `tsc` emit

- ✅ Single tool for typecheck + emit
- ❌ `tsc` is not a bundler; the `/scripts/*` externalize concept is a bundler
  feature
- ❌ Worse fit than `bun build` for the browser-ESM-with-external target

## Links

- Bun externalization spike: `bun build ./src/index.ts --target browser
  --format esm --outdir web/dist --external '/scripts/*'` (PASSED)
- `CLAUDE.md` § "File layout", § "Dev workflow"
- ADR-0001 (Project Language) and ADR-0003 (Single-File JS) — superseded by
  this ADR
- ADR-0009 (Vitest dev harness) — the tests now import the `.ts` source

---
*Authored as part of the TypeScript + bun build migration.*
