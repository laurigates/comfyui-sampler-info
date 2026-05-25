# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for **comfyui-sampler-info** using the [MADR](https://adr.github.io/madr/) format.

## What is an ADR?

An ADR captures a significant architectural or design decision, the context in which it was made, the options considered, and the rationale for the chosen option. ADRs are immutable records — when a decision changes, a new ADR supersedes the old one rather than editing it.

## ADR Index

To list all ADRs programmatically:

```sh
fd -e md --exclude README.md . docs/blueprint/adrs/ \
  | sort \
  | xargs awk '/^# ADR/{title=$0} /^status:/{status=$2} END{print FILENAME, status, title}' \
  | column -t
```

## Current ADRs

| ID | Title | Status | Domain |
|----|-------|--------|--------|
| ADR-0001 | Project Language Choice — Python Stub + Vanilla JavaScript | Accepted | build-tooling |
| ADR-0002 | Frontend-Only ComfyUI Plugin Architecture | Accepted | frontend-framework |
| ADR-0003 | Single-File JavaScript Implementation (No Bundler) | Accepted | build-tooling |
| ADR-0004 | Static JSON Files as the Metadata Corpus | Accepted | data-layer |
| ADR-0005 | Package Management and Distribution via pyproject.toml and Comfy Registry | Accepted | deployment |
| ADR-0006 | CI/CD via GitHub Actions and Comfy-Org/publish-node-action | Accepted | deployment |
| ADR-0007 | Testing Strategy — Syntax Validation and Manual Browser Smoke Tests | Superseded by ADR-0009 | testing |
| ADR-0008 | Widget Detection by Name, Not by Node Type | Accepted | api-design |
| ADR-0009 | Adopt Vitest as a Dev-Only Test Harness for Pure JS Functions | Accepted | testing |

## Proposed ADRs

Decisions identified but not yet documented as full ADRs:

- [ ] Fuzzy scorer algorithm (fzf-style subsequence with word-boundary bonuses) vs alternatives (Levenshtein, trigram) — identified 2026-05-21
- [ ] Semver versioning policy for corpus-only vs feature vs breaking changes — identified 2026-05-21

## Status Definitions

| Status | Meaning |
|--------|---------|
| **Proposed** | Under discussion, not yet decided |
| **Accepted** | Decision in effect |
| **Deprecated** | No longer relevant but not replaced |
| **Superseded** | Replaced by a newer ADR (linked via `superseded_by`) |

## How to Add an ADR

1. Pick the next sequential number (`0009`, `0010`, …)
2. Copy the MADR template from `docs/blueprint/adrs/0001-project-language.md` as a starting point
3. Fill in the frontmatter (`id`, `date`, `status`, `domain`)
4. Document drivers, options considered, decision outcome, and consequences
5. Update this README's index table
6. If the new ADR supersedes an existing one, update the old ADR's `status` to `Superseded` and add `superseded_by`
