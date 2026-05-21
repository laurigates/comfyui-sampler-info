---
id: ADR-0004
date: 2026-05-21
status: Accepted
deciders: Lauri Gates
domain: data-layer
relates-to:
  - PRD-001
  - ADR-0001
  - ADR-0002
github-issues: []
name: blueprint-derive-adr
---

# ADR-0004: Static JSON Files as the Metadata Corpus

## Decision Drivers

- Sampler and scheduler metadata (year, family, ODE order, summary, good-for, pairs-with) is stable reference data that changes only when the academic literature or ComfyUI itself changes
- The corpus must be editable by contributors via PRs without touching any code
- No server-side query capability is needed — the entire corpus fits comfortably in memory after a single fetch
- Two lookup strategies are required: exact token matching (O(1) hash lookup) and family-level regex matching for token families like RES4LYF's ~110 variants

## Considered Options

1. **Static JSON files** — `web/data/samplers.json` and `web/data/schedulers.json`, fetched once at extension setup, held in memory
2. **Hardcoded JS objects** — Corpus embedded directly in `sampler-info.js` as JS object literals
3. **SQLite / IndexedDB** — Persisted structured store in the browser

## Decision Outcome

**Chosen option**: "Static JSON files" because they decouple corpus updates from code changes (a JSON PR is reviewable by non-developers), are served by ComfyUI's existing static file infrastructure with no extra setup, and are compact enough (~48 samplers × ~8 fields each) to hold entirely in memory. The two-tier schema (`exact` + `prefix` regex array) handles both the per-token and per-family lookup patterns needed.

### Positive Consequences

- Corpus contributors can open PRs editing only JSON — no JS knowledge required
- Browser caches the files between sessions; re-fetched with `cache: "no-cache"` to pick up updates after a hard refresh
- Easy to validate: `python -c "import json; json.load(open('web/data/samplers.json'))"`
- The `prefix` regex array covers RES4LYF's ~110 tokens without 1:1 enumeration

### Negative Consequences

- Entire corpus is loaded eagerly on extension setup — if the corpus grows to thousands of entries, startup latency may become noticeable (not a concern at current scale)
- No incremental updates; the full file is re-fetched each hard-refresh
- `cache: "no-cache"` means every hard-refresh fetches both files unconditionally

## Pros and Cons of Options

### Static JSON files

- ✅ Editable without JS knowledge
- ✅ Served by existing static infrastructure
- ✅ Trivially validated
- ❌ Eager full-load (acceptable at current corpus size)

### Hardcoded JS objects

- ✅ No extra HTTP requests
- ❌ Corpus updates require touching `sampler-info.js` — higher review friction
- ❌ Non-developers cannot contribute corpus entries without understanding JS syntax

### SQLite / IndexedDB

- ✅ Supports complex queries, incremental updates
- ❌ Massive overkill for reference data of this size
- ❌ Requires schema migration logic

## Links

- `web/data/samplers.json` — sampler corpus
- `web/data/schedulers.json` — scheduler corpus
- `CLAUDE.md` § "Corpus schema"
- `README.md` § "How the corpus works"

---
*Generated from project analysis via /blueprint:derive-adr*
