# CLAUDE.md

Frontend-only ComfyUI custom-node pack. No Python nodes — `__init__.py`
just exports an empty `NODE_CLASS_MAPPINGS` and `WEB_DIRECTORY = "./web"`
so ComfyUI's loader picks up the JS extension.

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
| `__init__.py` | Loader stub. `WEB_DIRECTORY = "./web"`, empty mappings. |
| `web/js/sampler-info.js` | The whole extension. Single file, ~900 lines. |
| `web/data/samplers.json` | Sampler corpus — exact tokens + prefix regex families. |
| `web/data/schedulers.json` | Scheduler corpus — same schema. |
| `pyproject.toml` | Comfy Registry metadata. `PublisherId` is the only field you may need to touch. |
| `.github/workflows/publish.yml` | Auto-publishes on `pyproject.toml` version bump. |
| `.github/workflows/ci.yml` | CI: lint, format, test, and security checks on push/PR. |
| `.github/dependabot.yml` | Automated dependency update PRs. |
| `.pre-commit-config.yaml` | Pre-commit hooks: ruff, biome, gitleaks, JSON validation. |
| `biome.json` | Biome (JS/JSON) linter + formatter config. |
| `tests/` | pytest test suite: Python stub + JSON corpus validation. |
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

`web/js/sampler-info.js` is served at
`/extensions/comfyui-sampler-info/js/sampler-info.js`. The pack dir
name (`comfyui-sampler-info`) IS the URL segment. If anyone renames
the dir, the `fetch(\`${DATA_BASE}/...\`)` calls break silently. Don't
rename the pack dir; if absolutely necessary, sync the `EXT_NAME`
constant at the top of `sampler-info.js`.

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
  ]
}
```

Lookup order: exact wins over prefix. Within prefix, first-match wins
(order matters — put more-specific patterns earlier).

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
uv sync --group dev          # install dev dependencies (ruff, pytest, pre-commit)
pre-commit install           # activate pre-commit hooks
```

### Lint & format

```sh
# Python
uv run ruff check .          # lint Python
uv run ruff check --fix .    # lint + autofix
uv run ruff format .         # format Python

# JavaScript / JSON
npx @biomejs/biome check .   # lint + format check JS/JSON
npx @biomejs/biome check --write .  # lint + autofix + format JS/JSON
```

### Tests

```sh
uv run pytest -v             # run all tests
uv run pytest tests/test_corpus.py  # corpus validation only
uv run pytest tests/test_init.py    # Python stub tests only
```

### Iterating on JS / CSS / JSON

**No ComfyUI restart needed.** The frontend serves these as static
files; just hard-refresh (Ctrl+Shift+R / Cmd+Shift+R) the browser tab.

If editing CSS that's injected via the JS `CSS` constant, you must
also dismiss any open picker dialog before it re-injects the style on
next open.

### Syntax checks before commit

```sh
node --check web/js/sampler-info.js
python -c "import json; [json.load(open(f)) for f in ['web/data/samplers.json','web/data/schedulers.json']]"
```

### Test live behavior

```sh
# Verify the pack loaded and the static assets serve
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8188/extensions/comfyui-sampler-info/js/sampler-info.js
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

## Acknowledgments

- **RES4LYF** by Clybius — the ~110 advanced RK / exponential-integrator
  sampler tokens described by the prefix patterns in `samplers.json`.
- **comfyui-touch-tooltips** — companion pack that turns the tooltip
  channel into a long-press popover for mobile.
