# CLAUDE.md

Frontend-only ComfyUI custom-node pack. No Python nodes — `__init__.py`
just exports an empty `NODE_CLASS_MAPPINGS` and `WEB_DIRECTORY = "./web/dist"`
so ComfyUI's loader picks up the built extension. The extension is
authored in TypeScript (`src/index.ts`) and compiled to browser ESM via
`bun build` (see ADR-0010).

## Documentation & Design Records

**Full PRD**: See [`docs/blueprint/prds/project-overview.md`](docs/blueprint/prds/project-overview.md) for comprehensive requirements.

**Architecture Decisions:**

| ID | Title | Domain |
|----|----|--------|
| [ADR-0001](docs/blueprint/adrs/0001-project-language.md) | Project Language — Python Stub + Vanilla JavaScript — *Superseded by ADR-0010* | build-tooling |
| [ADR-0002](docs/blueprint/adrs/0002-frontend-only-plugin-architecture.md) | Frontend-Only Plugin Architecture | frontend-framework |
| [ADR-0003](docs/blueprint/adrs/0003-single-file-js-implementation.md) | Single-File JavaScript (No Bundler) — *Superseded by ADR-0010* | build-tooling |
| [ADR-0004](docs/blueprint/adrs/0004-static-json-corpus.md) | Static JSON Corpus Format | data-layer |
| [ADR-0005](docs/blueprint/adrs/0005-package-management-and-distribution.md) | Package Management via pyproject.toml | deployment |
| [ADR-0006](docs/blueprint/adrs/0006-ci-cd-github-actions.md) | CI/CD via GitHub Actions | deployment |
| [ADR-0007](docs/blueprint/adrs/0007-testing-strategy.md) | Testing Strategy (Syntax + Browser Smoke) — *Superseded by ADR-0009* | testing |
| [ADR-0008](docs/blueprint/adrs/0008-widget-name-detection.md) | Widget Detection by Name | api-design |
| [ADR-0009](docs/blueprint/adrs/0009-adopt-vitest.md) | Vitest as Dev-Only Test Harness | testing |
| [ADR-0010](docs/blueprint/adrs/0010-adopt-typescript-bun-build.md) | Adopt TypeScript + bun build (supersedes ADR-0001, ADR-0003) | build-tooling |

**Test Coverage**: [`docs/trps/regression-gaps-initial-scaffold.md`](docs/trps/regression-gaps-initial-scaffold.md) tracks coverage gaps from initial release (v0.1.0 at 100% feature completion).

## What it does

Two additive enhancements on combo widgets named `sampler_name` /
`sampler` / `scheduler`:

1. **Option A — tooltip rewrite.** On widget value change, set
   `widget.options.tooltip` to a corpus-derived multi-line description.
   Surfaced by LiteGraph's native hover and by
   [comfyui-touch-tooltips](https://github.com/laurigates/comfyui-touch-tooltips)
   on long-press.
2. **Option B — fuzzy-search picker.** Intercept the widget's click
   (modern frontend's `widget.onPointerDown` hook) and open an HTML
   modal dialog instead of the native dropdown. fzf-lite scoring with
   word-boundary bonuses, AND-token support, char highlighting, keyboard
   nav + always-on type-to-filter.

## File layout

| Path | Purpose |
|------|---------|
| `__init__.py` | Loader stub. `WEB_DIRECTORY = "./web/dist"`, empty mappings. |
| `src/index.ts` | The whole extension — TypeScript source (port of the former single-file JS). Compiled to `web/dist/index.js`. |
| `src/comfyui-shims.d.ts` | Types the `/scripts/app.js` runtime import (see ADR-0010 type-seam notes). |
| `web/dist/` | **Generated** — `bun build` output (`index.js` + copied `data/`). Git-ignored; force-shipped to the registry via `[tool.comfy] includes`. Do not edit by hand. |
| `web/data/samplers.json` | Sampler corpus — exact tokens + prefix regex families. Copied into `web/dist/data/` at build. |
| `web/data/schedulers.json` | Scheduler corpus — same schema. |
| `tsconfig.json` | TypeScript config — strict, `tsc --noEmit` type gate. |
| `knip.json` | Dead-code / unused-dependency check config. |
| `pyproject.toml` | Comfy Registry metadata. `PublisherId` + `[tool.comfy] includes`. |
| `.github/workflows/publish.yml` | Builds the frontend, then auto-publishes on `pyproject.toml` version bump. |
| `.github/workflows/ci.yml` | CI: lint, format, typecheck+build, test, and security checks on push/PR. |
| `.github/dependabot.yml` | Automated dependency update PRs. |
| `.pre-commit-config.yaml` | Pre-commit hooks: ruff, biome, gitleaks, JSON validation. |
| `biome.json` | Biome (TS/JS/JSON) linter + formatter config. |
| `package.json` | Dev toolchain — `bun build`, `tsc`, Vitest, Biome, knip. |
| `vitest.config.js` | Vitest configuration (Node env, `tests/js/**/*.test.js`; imports `src/index.ts`). |
| `tests/` | pytest test suite: Python stub + JSON corpus validation. |
| `tests/js/` | Vitest test suite for the pure functions in `src/index.ts` (ADR-0009). |
| `RELEASE-CHECKLIST.md` | Manual publish steps (one-time + per-release). |

## Hard rules

### Additive only — never clobber existing tooltips

`refreshWidgetTooltip` returns early when the corpus lookup returns
`null`. That's the contract: if we don't have metadata for a token,
the existing tooltip stays. Wan / Hunyuan / LTX wrapper widgets that
already ship thoughtful Python-side tooltips must keep them.

Same for the picker: rows render with `(no metadata for this option
yet)` rather than fabricating a description.

### Pack directory name is part of the URL

The built `web/dist/index.js` is served at
`/extensions/comfyui-sampler-info/index.js` (because `WEB_DIRECTORY =
"./web/dist"`), and the corpus at
`/extensions/comfyui-sampler-info/data/*.json`. The pack dir name
(`comfyui-sampler-info`) IS the URL segment, and `DATA_BASE` derives the
corpus URL from it (not from the JS file location). If anyone renames the
dir, the `fetch(\`${DATA_BASE}/...\`)` calls break silently. Don't rename
the pack dir; if absolutely necessary, sync the `EXT_NAME` constant at the
top of `src/index.ts`.

### Frontend hook is version-sensitive

The picker depends on the modern Vue frontend calling
`widget.onPointerDown(pointer, node, canvas)` before its own dropdown
logic. Verified against `comfyui-frontend-package` 1.43.17. The
`pyproject.toml` floor is `>=1.40` based on when the hook landed.

If the picker stops opening:

1. Open browser devtools console, look for `comfyui-sampler-info`
   warnings.
2. Check what hook the bundle uses now:

   ```sh
   grep -oE 'processWidgetClick\(e[^)]*\)\{[^}]{0,400}' \
     .venv/lib/python3.10/site-packages/comfyui_frontend_package/static/assets/api-*.js \
     | head -1
   ```

   Look for `if(typeof n.<HOOK>==\`function\`...`. If the property name
   changed (e.g. `onPointerDown` → `onPointerClick`), update the
   intercept in `enhanceNode()`.

The tooltip path (`widget.options.tooltip`) is the LiteGraph-side
convention and far more stable — Option A keeps working even if Option
B breaks.

## Corpus schema

Both JSON files share this schema:

```json
{
  "exact": {
    "<token>": {
      "year": 2022,            // paper / ComfyUI integration year, or null
      "family": "DPM-Solver++",
      "order": 2,              // ODE order (number) or "adaptive" / "variable"
      "type": "deterministic multistep",  // free-form short label
      "summary": "One sentence describing what this sampler does.",
      "good_for": "When to reach for it",
      "pairs_with": ["karras", "exponential"],
      "supersedes_by": "dpmpp_2m",        // optional, only when consensus
      "notes": "Optional edge-case note"
    }
  },
  "prefix": [
    {
      "match": "^res_\\d+s",   // regex, anchored
      "family": "RES (single-step exponential RK)",
      "summary": "...",
      "good_for": "...",
      "pairs_with": ["..."]
    }
  ],
  "alias": {
    "res_2m": "res_multistep"  // token -> canonical exact token it reuses
  }
}
```

Lookup order: **exact → alias → prefix → null**. Exact wins over an alias;
an alias (when its canonical target exists) wins over prefix. Within prefix,
first-match wins (order matters — put more-specific patterns earlier).

`alias` keeps the corpus DRY: when a wrapper exposes a sampler that is the
*same algorithm* as one we already describe but under a different name (e.g.
RES4LYF's `res_2m` is core `res_multistep`, `heun_2s` is core `heun`), point
the alias at the canonical token instead of duplicating the description. The
lookup reuses the canonical entry and appends an "Alias of `…`" note; the
canonical entry itself is never mutated. Only map genuine equivalences —
families with no exact core counterpart (e.g. `res_3m`, the Lawson/ETD-RK
tokens) stay on their `prefix` family description.

Every field is optional. The renderer skips missing fields gracefully.

### Adding entries

1. Find the canonical token name from ComfyUI's
   `comfy/samplers.py:KSAMPLER_NAMES` (or `SCHEDULER_HANDLERS`).
2. Add to `exact` if it's a single token, or to `prefix` if it's a
   family pattern.
3. Validate JSON:

   ```sh
   python -c "import json; json.load(open('web/data/samplers.json'))"
   ```

4. No restart needed — hard-refresh the browser.

## Dev workflow

### Setup

```sh
uv sync --group dev          # install Python dev dependencies (ruff, pytest, pre-commit)
bun install                  # install the JS/TS toolchain (typescript, types, vitest, biome, knip)
pre-commit install           # activate pre-commit hooks
```

### Build

```sh
bun run build                # compile src/index.ts → web/dist/index.js (+ copy corpus)
bun run typecheck            # tsc --noEmit type gate
just build                   # same as `bun run build`
```

The served file is `web/dist/index.js` — `web/dist/` is git-ignored and
generated. Build before testing live behavior or running the screenshot
pipeline.

### Lint & format

```sh
# Python
uv run ruff check .          # lint Python
uv run ruff check --fix .    # lint + autofix
uv run ruff format .         # format Python

# TypeScript / JS / JSON
bunx biome check .           # lint + format check
bunx biome check --write .   # lint + autofix + format
bun run knip                 # unused exports / dead-code / unused-dep check
```

### Tests

```sh
# Python (corpus integrity + __init__ stub)
uv run pytest -v             # run all Python tests
uv run pytest tests/test_corpus.py  # corpus validation only
uv run pytest tests/test_init.py    # Python stub tests only

# TypeScript (pure functions in src/index.ts — ADR-0009)
bun run test                 # run Vitest once (imports src/index.ts directly)
bun run test:watch           # watch mode for TDD
```

### Iterating on TS / CSS / JSON

The browser serves `web/dist/`, so **after editing `src/index.ts` you
must `bun run build`** before hard-refreshing (Ctrl+Shift+R / Cmd+Shift+R).
No ComfyUI restart is needed — only a rebuild + refresh. Editing the
corpus JSON in `web/data/` also needs a `bun run build` (it is copied
into `web/dist/data/`).

If editing CSS that's injected via the `CSS` constant in `src/index.ts`,
also dismiss any open picker dialog before it re-injects the style on
next open.

### Gates before commit

```sh
bun run typecheck
bun run build
bunx biome check .
bun run knip
python -c "import json; [json.load(open(f)) for f in ['web/data/samplers.json','web/data/schedulers.json']]"
```

### Test live behavior

```sh
# Verify the pack loaded and the built asset serves (build first)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8188/extensions/comfyui-sampler-info/index.js
```

### Smoke matrix when changing the picker

After non-trivial picker changes, verify in browser:

| Widget | Expected |
|---|---|
| `KSampler.sampler_name` | Picker opens, rows have full metadata + badges |
| `KSampler.scheduler` | Picker opens, rows have scheduler corpus |
| `WanVideoSampler.scheduler` | Picker opens; rows are bare names (no corpus match expected — additive) |
| `easy kSampler.sampler_name` | Picker opens (widget name detection is generic) |

Keyboard: <kbd>↑</kbd> <kbd>↓</kbd> <kbd>PgUp</kbd> <kbd>PgDn</kbd>
<kbd>Enter</kbd> <kbd>Esc</kbd>, type from anywhere to filter,
<kbd>Backspace</kbd> from anywhere.

## Releases

See `RELEASE-CHECKLIST.md` for the full playbook. High level:

- Semver in `pyproject.toml` — patch for corpus updates, minor for
  picker features, major for breaking schema changes.
- Push to `main` with a version bump in `pyproject.toml` →
  `Comfy-Org/publish-node-action` auto-publishes to Comfy Registry.
- Branch-protection conventions: stage/commit on feature branches,
  open PRs. (The initial commit landed on `feature/initial-scaffold`
  for this reason; renamed to `main` only at first push.)

## Things not to do

- **Don't import any module from `comfyui_frontend_package`** in JS —
  the pack must work against any compatible frontend version. Use the
  documented `app.registerExtension` API and the `widget.*` hooks only.
- **Don't add a Python dependency.** The whole point is frontend-only.
  If a feature genuinely needs Python (e.g. serving dynamic data), it
  belongs in a separate companion pack.
- **Don't write `widget.options.tooltip` unconditionally.** Always
  check that `lookup()` returned a non-null match. The additive rule
  is the entire reason the pack composes well with Wan / Hunyuan /
  LTX.
- **Don't extend the corpus with information you're not sure about.**
  Mark uncertain years as `null` and uncertain summaries with `notes:
  "verify"` rather than inventing plausible-sounding facts. The whole
  pack's credibility rests on the corpus being right.
- **Don't hand-edit `docs/picker.png` or `docs/tooltip.png`.** They
  are generated by `just screenshots` (Docker + Playwright). The
  picker shot is the genuine pack UI; the tooltip shot renders
  `widget.options.tooltip` as an HTML overlay (the canvas-painted
  hover tooltip is too fragile to drive headlessly). To refresh,
  edit `screenshots/capture.mjs` / `workflow.json` and re-run the
  recipe. See `screenshots/README.md` for pins (ComfyUI ref +
  Playwright version) and troubleshooting.

## Regenerating README screenshots

```sh
just screenshots
```

Builds `screenshots/Dockerfile` and runs it with the `docs/` directory
mounted, producing `docs/picker.png` and `docs/tooltip.png`. First
build is ~4 minutes (CPU torch + Chromium download); cached rebuilds
are ~30s. The full toolchain lives in `screenshots/` — see
`screenshots/README.md`.

## Acknowledgments

- **RES4LYF** by Clybius — the ~110 advanced RK / exponential-integrator
  sampler tokens described by the prefix patterns in `samplers.json`.
- **comfyui-touch-tooltips** — companion pack that turns the tooltip
  channel into a long-press popover for mobile.
