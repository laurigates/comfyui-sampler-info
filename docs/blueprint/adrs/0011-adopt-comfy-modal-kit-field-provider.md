---
id: ADR-0011
date: 2026-07-02
status: Accepted
deciders: Lauri Gates
domain: api-design
relates-to:
  - PRD-001
  - ADR-0002
  - ADR-0008
  - ADR-0010
github-issues:
  - 63
name: adopt-comfy-modal-kit-field-provider
---

# ADR-0011: Adopt comfy-modal-kit field-provider registry + click coordination

## Decision Drivers

- **The pack does not compose with siblings.** This pack owns a *standalone*
  picker: it hand-patches `widget.onPointerDown` and hand-rolls its own fuzzy
  scorer + matched-char highlighting. Nothing else in the ecosystem can reuse
  the sampler corpus, and the on-canvas modal is reachable only by tapping the
  widget on the canvas — never from inside `comfyui-prompt-editor`'s all-fields
  node editor, which renders a dumb `<select>` for `sampler_name` /
  `scheduler` even when this pack is installed.
- **The click-intercept is a divergent copy.** The hand-patched
  `onPointerDown` chain (chain-original → honor-consumed → open-otherwise) is a
  subtly-divergent copy of the wrapper `@laurigates/comfy-modal-kit` now
  standardizes as `patchWidgetPointer`, plus the modal-stacking coordination
  (`isModalActive` / `setActiveModal`) this pack has no share in — two backdrops
  can coexist when a sibling pack's modal is also open.
- **Duplicated primitives.** The kit already exports `fuzzyRank` (fzf-lite
  scoring with word-boundary bonuses + AND-token semantics) and
  `highlightMatches`. This pack shipped a byte-adjacent copy of both
  (`fuzzyScore` / `fuzzyRank` / the `buildNameEl` highlighter) — the exact
  vendoring the kit exists to single-source (see kit ADR-0001).

The kit v0.4.0 provides the seam: a `Symbol.for`-rendezvous field-provider
registry (`registerFieldProvider` / `resolveFieldProvider`) with a
`FieldControl` contract (`el` / `getValue` / `hasChanged` / `focus?` /
`destroy?`), the `patchWidgetPointer` chain-then-consume coordinator, and the
`isModalActive` / `setActiveModal` reentrancy guard.

## Considered Options

1. **Register as a kit field provider + adopt `patchWidgetPointer`, reusing the
   kit's `fuzzyRank` + `highlightMatches`.** The corpus-annotated fuzzy list is
   extracted into a shared, instance-based body factory (`createPickerBody`)
   that both the on-canvas modal wrapper and the provider `create()` reuse. The
   pointer intercept routes through the kit coordinator. The local fuzzy scorer
   and highlighter are deleted in favor of the kit exports.
2. **Keep the standalone picker; do nothing.** Cheap, but the pack stays
   non-composing, the click-intercept stays a divergent copy, and the fuzzy
   primitives stay duplicated — the drift the kit was created to end.
3. **Register a provider but keep the local fuzzy/highlight copies.** Composes
   with the editor, but leaves two copies of the scorer to drift and does not
   adopt the standardized coordinator — half the benefit, all the maintenance.

## Decision Outcome

**Chosen option**: option 1. The corpus-annotated fuzzy list is now a
provider the shared registry mounts inline, the on-canvas intercept uses
`patchWidgetPointer` + the single-active-modal coordinator, and the ranker +
highlighter come from the kit. Everything is **additive and opt-in** — the
kit's inviolable rule (kit ADR-0001) and this pack's own additive hard rule
(never clobber; bare name when no corpus match) are both preserved.

### Mechanics

- **Shared body factory.** `createPickerBody({ values, corpus, initialValue,
  isScheduler, onCommit? })` builds the search input + corpus-annotated list as
  an instance (no module singleton). The modal wrapper passes `onCommit` to
  commit + close; the provider omits it, so a selection just marks the row
  current and the editor commits `getValue()` on save. This is the ONBOARDING
  "split the DOM builder from the self-committing modal wrapper" guidance.
- **Field provider.** `registerFieldProvider({ id: "comfyui-sampler-info",
  priority: 10, match, create })` matches combo widgets named `sampler_name` /
  `sampler` / `scheduler`. `create()` returns a `FieldControl` whose `el` is the
  picker body, `getValue()` is the selected token, `hasChanged()` compares
  against `initialValue`, `focus()` focuses the search input, and `destroy()`
  tears down the listeners/DOM.
- **Click coordinator.** The hand-patched `widget.onPointerDown` chain is
  replaced by `patchWidgetPointer(widget, (pointer, node) => …)` with an
  `isModalActive()` guard so the pack never stacks a second modal, and the
  on-canvas modal registers via `setActiveModal` / dismisses via
  `dismissActiveModal`.
- **Reused primitives.** `renderRows` ranks with the kit's `fuzzyRank(query,
  [name, …metadata], primaryWeight)` (name weighted 10×) and `buildNameEl`
  highlights via the kit's `highlightMatches`. The local `fuzzyScore` /
  `fuzzyRank` and the hand-rolled highlighter are deleted; their tests move to
  the kit's own suite.
- **Kept pack-local.** The corpus `lookup()` and the two JSON corpora are this
  pack's data — unchanged. The Option A tooltip enrichment
  (`refreshWidgetTooltip` + callback wrap) is untouched.

### Dependency

`@laurigates/comfy-modal-kit@^0.4.0` is a runtime dependency; `bun build
--target browser` inlines it into `web/dist/index.js` (nothing from
`node_modules/` ships to ComfyUI at runtime), preserving the ADR-0010
zero-runtime-bundle property.

### Positive Consequences

- The pack composes: `comfyui-prompt-editor` (and any future registry
  consumer) surfaces the corpus fuzzy list inline, per field, when this pack is
  installed.
- One active modal across all packs; the cross-pack stacking bug is fixed at
  the root.
- The fuzzy scorer + highlighter are single-sourced in the kit — no more
  vendored copies to drift.

### Negative Consequences

- A new runtime dependency and a build that must resolve it (mitigated: inlined
  at build, verified by `bun run build` in CI).
- The picker's on-canvas UX is not exercised by pytest or vitest; the
  frontend↔registry contract needs the live-smoke matrix (`CLAUDE.md` smoke
  table + `comfyui-pack-live-smoke.md`).

## Links

- Kit PR: laurigates/comfy-modal-kit#8 (publishes v0.4.0)
- Kit ADR-0001: `@laurigates/comfy-modal-kit` `docs/blueprint/adrs/0001-cross-pack-field-provider-and-click-coordination.md`
- Kit onboarding: `@laurigates/comfy-modal-kit` `docs/ONBOARDING.md` (provider section)
- ADR-0010 (TypeScript + bun build) — the build that inlines the kit
- ADR-0008 (widget-name detection) — the provider's `match()` reuses the same name sets

---
*Authored as part of the comfy-modal-kit field-provider adoption (issue #63).*
