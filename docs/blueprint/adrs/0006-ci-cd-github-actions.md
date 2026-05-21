---
id: ADR-0006
date: 2026-05-21
status: Accepted
deciders: Lauri Gates
domain: deployment
relates-to:
  - PRD-001
  - ADR-0005
github-issues: []
name: blueprint-derive-adr
---

# ADR-0006: CI/CD via GitHub Actions and Comfy-Org/publish-node-action

## Decision Drivers

- The project is hosted on GitHub; GitHub Actions is the native, zero-cost CI platform
- `Comfy-Org/publish-node-action@v1` is the official action provided by Comfy-Org for publishing custom nodes to the Comfy Registry, handling authentication and registry API calls
- Publishing should be automatic and gated on a meaningful signal (version bump in `pyproject.toml`) rather than triggered by any push or by a manual step
- No build, test, or lint steps exist yet; the CI scope is intentionally narrow (publish only)

## Considered Options

1. **GitHub Actions + `Comfy-Org/publish-node-action`** — Official publish action triggered on `pyproject.toml` change to `main`
2. **GitHub Actions + custom publish script** — Write a shell script that calls the registry API directly
3. **Manual publish only** — No CI; developer runs registry CLI locally

## Decision Outcome

**Chosen option**: "GitHub Actions + `Comfy-Org/publish-node-action`" because it is the officially supported and documented path from Comfy-Org, handling auth (via `personal_access_token`) and registry submission. Triggering on `paths: [pyproject.toml]` pushes to `main` means only version bumps trigger publishing, not corpus or JS changes — a clean separation of concerns.

### Positive Consequences

- Publish is automatic and reproducible; no developer machine state is involved
- `workflow_dispatch` allows manual re-triggers without a code change
- `permissions: issues: write` allows the action to open GitHub issues on publish failure
- `actions/checkout@v4` is pinned to a stable major version

### Negative Consequences

- No automated tests, linting, or syntax checks run in CI — the `node --check` and `python -c` validation steps from CLAUDE.md are manual only
- A publish will fire even if the version bump has an error (e.g. malformed JSON in corpus files)
- The workflow runs only on pushes to `main`; there is no PR-level CI check

## Pros and Cons of Options

### GitHub Actions + Comfy-Org/publish-node-action

- ✅ Official, maintained action from Comfy-Org
- ✅ Auth handled by the action; no custom API calls
- ✅ Triggered precisely on version bumps
- ❌ No validation step before publish

### GitHub Actions + custom publish script

- ✅ Full control over publish logic
- ❌ Must implement and maintain registry API calls
- ❌ Auth handling is manual

### Manual publish only

- ✅ Maximum control
- ❌ Error-prone; easy to forget or publish the wrong version
- ❌ No audit trail in CI

## Links

- `.github/workflows/publish.yml`
- `Comfy-Org/publish-node-action` — https://github.com/Comfy-Org/publish-node-action
- `RELEASE-CHECKLIST.md` — full release playbook

---
*Generated from project analysis via /blueprint:derive-adr*
