---
paths:
  - "pyproject.toml"
  - "*.toml"
  - "*.json"
  - ".github/workflows/*.yml"
---

# Dependencies and Distribution

Package metadata, dependency policy, and Comfy Registry publication workflow.


## Source

- **Commit**: 60a3d1c (2026-05-21)
- **Type**: feat
- **Confidence**: High (explicit hard rule in CLAUDE.md: "Don't add a Python dependency")


## Rule

This is a **frontend-only** pack. The `dependencies` list in `pyproject.toml` must contain only `comfyui-frontend-package>=<version>` — never a Python runtime library. If a feature genuinely requires Python, it belongs in a separate companion pack.


## pyproject.toml Structure

```toml
[project]
name = "comfyui-sampler-info"
version = "X.Y.Z"                # semver — bump this to trigger auto-publish
requires-python = ">=3.10"

# Frontend-only: the ONLY allowed runtime dependency
dependencies = [
    "comfyui-frontend-package>=1.40",   # floor tied to widget.onPointerDown availability
]

[tool.comfy]
PublisherId = "<registered-id>"   # must be set before first publish
DisplayName = "Sampler Info"
```


## Versioning Policy

| Change | Version bump |
|--------|-------------|
| Corpus updates (add/fix sampler or scheduler entries) | `patch` |
| New picker features or UI enhancements | `minor` |
| Breaking schema changes (`exact`/`prefix` structure, `EXT_NAME` rename) | `major` |

Bumping `version` in `pyproject.toml` and pushing to `main` is the trigger for the CI publish workflow.


## CI/CD Publication

GitHub Actions workflow (`.github/workflows/publish.yml`) uses `Comfy-Org/publish-node-action@v1`. It fires on:
- Push to `main` when `pyproject.toml` is modified
- Manual `workflow_dispatch`

Required secret: `REGISTRY_ACCESS_TOKEN` — a personal access token from [registry.comfy.org](https://registry.comfy.org/).


## Do

```toml
# Correct — single frontend runtime dependency
dependencies = [
    "comfyui-frontend-package>=1.40",
]
```


## Don't

```toml
# Wrong — no Python runtime libraries
dependencies = [
    "comfyui-frontend-package>=1.40",
    "requests>=2.0",       # no — this is frontend-only
    "numpy",               # no — there are no Python nodes
]
```

```js
// Wrong — no npm/node_modules
import fuzzy from 'fuzzysort';   // no — implement fzf-lite scoring inline
```


## Supersedes

None

---

*Derived from git history via /blueprint:derive-rules*
