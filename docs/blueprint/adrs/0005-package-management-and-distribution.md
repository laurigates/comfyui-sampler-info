---
id: ADR-0005
date: 2026-05-21
status: Accepted
deciders: Lauri Gates
domain: deployment
relates-to:
  - PRD-001
  - ADR-0001
github-issues: []
name: blueprint-derive-adr
---

# ADR-0005: Package Management and Distribution via pyproject.toml and Comfy Registry

## Decision Drivers

- ComfyUI's package ecosystem uses `pyproject.toml` as the standard metadata descriptor for custom nodes published to the Comfy Registry
- The pack has no Python runtime dependencies, but the distribution channel (Comfy Registry / ComfyUI Manager) expects a PEP 517-compliant descriptor
- The `[tool.comfy]` table in `pyproject.toml` carries Registry-specific fields (`PublisherId`, `DisplayName`, `Icon`) that the `Comfy-Org/publish-node-action` reads during publishing
- Semantic versioning via the `version` field in `pyproject.toml` gates registry releases

## Considered Options

1. **pyproject.toml + Comfy Registry** — Standard ComfyUI ecosystem path; `version` bump in `pyproject.toml` triggers CI publish
2. **package.json only** — Pure JS package descriptor; not recognised by ComfyUI Manager or the Comfy Registry
3. **Manual publishing only** — No automated publishing; rely on ComfyUI Manager's GitHub URL scanner

## Decision Outcome

**Chosen option**: "pyproject.toml + Comfy Registry" because it is the accepted standard for ComfyUI custom nodes and is the only path to appearing in ComfyUI Manager's install UI. Even though the pack has no Python runtime deps, `pyproject.toml` is the right descriptor: it expresses the `requires-python >= 3.10` floor, the `comfyui-frontend-package >= 1.40` runtime dependency, and the `[tool.comfy]` Registry metadata.

### Positive Consequences

- Users can install via ComfyUI Manager search ("sampler info") once accepted into the registry
- Version bumps are the single trigger for release — no manual registry upload step
- `pyproject.toml` is a well-understood format; contributors know how to read it
- `requires-python` and `dependencies` entries communicate the minimum environment requirements clearly

### Negative Consequences

- Publishing requires a `REGISTRY_ACCESS_TOKEN` secret stored in the GitHub repo settings — one manual setup step per publisher account
- `PublisherId = "TODO-publisher-id"` must be filled in before the first publish (documented in `RELEASE-CHECKLIST.md`)
- No `package.json` means standard JS tooling (npm, bun) doesn't recognise the project without additional config

## Pros and Cons of Options

### pyproject.toml + Comfy Registry

- ✅ Canonical ComfyUI distribution path
- ✅ Discoverable in ComfyUI Manager
- ✅ Automated publish on version bump
- ❌ Requires Publisher ID registration at registry.comfy.org before first release

### package.json only

- ✅ Familiar to JS developers
- ❌ Not recognised by ComfyUI Manager or Comfy Registry
- ❌ No automated publish path

### Manual publishing only

- ✅ No CI setup required
- ❌ Error-prone; requires human action on every release
- ❌ Registry acceptance requires a `pyproject.toml` anyway

## Links

- `pyproject.toml` — project metadata and registry config
- `.github/workflows/publish.yml` — CI publish workflow
- `RELEASE-CHECKLIST.md` — Publisher ID registration and release steps
- Comfy Registry: https://registry.comfy.org/

---
*Generated from project analysis via /blueprint:derive-adr*
