# Development Workflow

## Project Context

`comfyui-sampler-info` is a **frontend-only** ComfyUI custom-node pack.
- `__init__.py` is a loader stub only — no Python nodes.
- All logic lives in `web/js/sampler-info.js` (single file, ~900 lines).
- Corpus data is in `web/data/samplers.json` and `web/data/schedulers.json`.

## Core Constraints

- **Additive only**: never overwrite existing tooltips. `refreshWidgetTooltip` returns early when corpus lookup returns `null`.
- **No Python dependencies**: the pack must remain frontend-only.
- **No unconditional tooltip writes**: always check that `lookup()` returned non-null.
- **Pack directory name is part of the URL**: do not rename `comfyui-sampler-info/`.
- **Frontend hook is version-sensitive**: picker depends on `widget.onPointerDown` from `comfyui-frontend-package >=1.40`.

## Commit Conventions

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- Scope optional but encouraged: `feat(picker):`, `fix(corpus):`, `docs(adr):`
- Keep subject line under 72 characters
- Reference issues when applicable: `fix(tooltip): handle null lookup (#42)`

## Branch & PR Conventions

- Feature work on `feature/<slug>` branches
- Bug fixes on `fix/<slug>` branches
- Open PRs to `main`; do not push directly to `main`

## Syntax Checks Before Commit

```sh
node --check web/js/sampler-info.js
python -c "import json; [json.load(open(f)) for f in ['web/data/samplers.json','web/data/schedulers.json']]"
```

## No Restart Required

Edits to JS / CSS / JSON take effect on browser hard-refresh (Ctrl+Shift+R / Cmd+Shift+R). No ComfyUI restart needed.

## Versioning

Semver in `pyproject.toml`:
- **patch** — corpus updates
- **minor** — picker features
- **major** — breaking schema changes
