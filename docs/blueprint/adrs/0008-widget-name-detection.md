---
id: ADR-0008
date: 2026-05-21
status: Accepted
deciders: Lauri Gates
domain: api-design
relates-to:
  - PRD-001
  - ADR-0002
github-issues: []
name: blueprint-derive-adr
---

# ADR-0008: Widget Detection by Name, Not by Node Type

## Decision Drivers

- ComfyUI's ecosystem has dozens of third-party node packs (WanVideoSampler, easy kSampler, HyVideoSampler, LTXVBaseSampler…) that each expose sampler/scheduler combo widgets under the conventional names `sampler_name`, `sampler`, and `scheduler`
- Detecting by node type (e.g. `node.type === "KSampler"`) would require maintaining an allowlist of every node type in the ecosystem — an unbounded maintenance burden
- Widget name is the de-facto convention in the ComfyUI ecosystem; ComfyUI core itself uses `sampler_name` and `scheduler` consistently

## Considered Options

1. **Widget name detection** — Match any widget where `widget.name` is in `{"sampler_name", "sampler", "scheduler"}`
2. **Node type allowlist** — Only enhance widgets on known node types (KSampler, KSamplerAdvanced, SamplerCustom, …)
3. **Widget type detection** — Match any `COMBO` widget whose `options.values` includes known sampler tokens

## Decision Outcome

**Chosen option**: "Widget name detection" because it is zero-maintenance — any new node that follows the naming convention automatically gets tooltip enrichment and the picker, without a code change. It is also the most precise signal available without inspecting widget values (which would require corpus-aware logic in the detection path itself).

### Positive Consequences

- Third-party nodes that follow the convention (WanVideoSampler, easy kSampler, HyVideoSampler, LTXVBaseSampler) work automatically
- No allowlist to maintain as new community packs appear
- Detection is O(1) per widget — a `Set.has()` lookup

### Negative Consequences

- If any node pack uses `sampler` or `scheduler` as a widget name for something other than a sampler/scheduler selection, this pack would incorrectly open the picker on it (low probability in practice given the specificity of the names)
- `sampler` alone is a common English word; a node that happens to name a non-sampler combo `sampler` would be affected

## Pros and Cons of Options

### Widget name detection

- ✅ Universal — works on any conforming node automatically
- ✅ Zero maintenance as the ecosystem grows
- ✅ O(1) lookup via `Set`
- ❌ Very unlikely false positives on unconventionally named widgets

### Node type allowlist

- ✅ Precise — no false positives
- ❌ Requires updating the allowlist for every new node type
- ❌ New community packs don't benefit until explicitly added

### Widget type + value detection

- ✅ Could distinguish sampler combos from other combos by value content
- ❌ Requires loading corpus before detection — creates an ordering dependency
- ❌ More complex; partial corpus load could cause incorrect detection

## Links

- `web/js/sampler-info.js` — `SAMPLER_WIDGET_NAMES`, `SCHEDULER_WIDGET_NAMES` constants
- `CLAUDE.md` — "Sampler/scheduler widgets are detected by widget name, not node type"
- `README.md` § "Usage" — lists supported node types

---
*Generated from project analysis via /blueprint:derive-adr*
