---
paths:
  - "src/**/*.ts"
  - "web/data/**/*.json"
  - "__init__.py"
---

# Development Workflow

## Project Context

`comfyui-sampler-info` is a **frontend-only** ComfyUI custom-node pack.
- `__init__.py` is a loader stub only — no Python nodes. `WEB_DIRECTORY = "./web/dist"`.
- All logic lives in `src/index.ts` (TypeScript), compiled to
  `web/dist/index.js` via `bun build` (see ADR-0010).
- Corpus data is in `web/data/samplers.json` and `web/data/schedulers.json`
  (copied into `web/dist/data/` at build).

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

## Gates Before Commit

```sh
bun run typecheck
bun run build
bunx biome check .
bun run knip
node --check web/dist/index.js
python -c "import json; [json.load(open(f)) for f in ['web/data/samplers.json','web/data/schedulers.json']]"
```

## Rebuild + Refresh (No Restart)

After editing `src/index.ts` (or the corpus JSON), run `bun run build`,
then hard-refresh the browser (Ctrl+Shift+R / Cmd+Shift+R). The served
file is the built `web/dist/index.js`. No ComfyUI restart needed — only a
rebuild + refresh.

## Versioning

Semver in `pyproject.toml`:
- **patch** — corpus updates
- **minor** — picker features
- **major** — breaking schema changes
