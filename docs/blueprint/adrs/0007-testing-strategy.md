---
id: ADR-0007
date: 2026-05-21
status: Superseded by ADR-0009
superseded-by: ADR-0009
deciders: Lauri Gates
domain: testing
relates-to:
  - PRD-001
  - ADR-0001
  - ADR-0003
  - ADR-0009
  - TRP-001
github-issues: []
name: blueprint-derive-adr
---

# ADR-0007: Testing Strategy — Syntax Validation and Manual Browser Smoke Tests

> **Superseded by [ADR-0009](0009-adopt-vitest.md)** on the test framework
> decision. Vitest is now adopted as a dev-only harness for the pure JS
> functions. The manual smoke matrix and the JSON corpus parse check
> remain in force; see ADR-0009 for the precise scope of supersedure
> (ADR-0003's single-file runtime is unchanged).

## Decision Drivers

- The extension runs inside a live ComfyUI instance and interacts with LiteGraph widget objects that are difficult to mock without a running frontend
- The corpus (JSON files) has a simple, schema-less structure that can be validated with `json.load`
- The JS has no pure-logic units that can be tested in Node.js without a DOM (the fuzzy scorer is the only exception)
- Setting up a full browser test suite (Playwright/Cypress) against a running ComfyUI instance is a significant infrastructure investment for a single-developer pack at v0.1

## Considered Options

1. **No test framework — syntax checks + manual browser smoke matrix** — `node --check` for JS parse errors, `python -c "import json; json.load(...)"` for corpus validity, manual smoke test table in CLAUDE.md
2. **Vitest/Jest unit tests** — Unit test the fuzzy scorer and corpus lookup in Node.js; skip DOM-dependent code
3. **Playwright end-to-end tests** — Spin up ComfyUI, load the extension, assert picker opens and selects correctly

## Decision Outcome

**Chosen option**: "No test framework — syntax checks + manual browser smoke matrix" because the majority of the code (DOM manipulation, widget patching, ComfyUI API calls) cannot be unit-tested without a live frontend, and the cost of standing up a browser test environment against ComfyUI exceeds the benefit at the current project scale. The manual smoke matrix in CLAUDE.md covers the critical paths. This decision is expected to be revisited if the fuzzy scorer grows in complexity or if corpus validation needs become more rigorous.

### Positive Consequences

- Zero test infrastructure to maintain
- Syntax check is a single CLI command, easy to run pre-commit
- Corpus validation is also a single command and catches the most likely contributor error (malformed JSON)
- Smoke matrix documents exactly what to verify manually

### Negative Consequences

- No regression coverage for the fuzzy scorer's scoring logic
- No automated guard against corpus schema drift
- Browser smoke tests are manual — easy to skip under time pressure

> **Coverage gap backlog**: The three negative consequences above have been
> formally captured in **[TRP-001](../../trps/regression-gaps-initial-scaffold.md)**
> as Medium-priority gaps. Specifically:
>
> | ADR consequence | TRP gap |
> |-----------------|---------|
> | No fuzzy scorer regression coverage | TRP-001 Gap 1 (`fuzzyScore` / `fuzzyRank`) |
> | No corpus schema drift guard | TRP-001 Gap 3 (JSON schema assertions) |
> | Manual browser smoke tests | Out of scope — no automation path without ComfyUI running |
>
> If this decision is ever revisited (e.g. Vitest is adopted), close TRP-001
> Gaps 1 and 2 first; Gap 3 can be addressed independently via a Python
> schema validator with no additional JS toolchain required.

## Pros and Cons of Options

### No framework — syntax + manual smoke

- ✅ Zero setup
- ✅ Catches parse errors and invalid JSON automatically
- ❌ No regression safety net for logic changes
- ❌ Smoke tests are only run when a developer remembers to

### Vitest/Jest unit tests

- ✅ Could unit-test `fuzzyScore`, `fuzzyRank`, `lookup`, `compileCorpus`
- ✅ Fast CI feedback loop
- ❌ Requires `package.json` and test toolchain
- ❌ Cannot test DOM-dependent code (picker, tooltip injection) without jsdom shims

### Playwright end-to-end

- ✅ Full confidence that picker works in a real browser against ComfyUI
- ❌ Requires a running ComfyUI instance in CI — major infrastructure burden
- ❌ Slow to run; significant maintenance surface

## Links

- `CLAUDE.md` § "Syntax checks before commit"
- `CLAUDE.md` § "Smoke matrix when changing the picker"
- `docs/trps/regression-gaps-initial-scaffold.md` — TRP-001 formalises the known gaps

---
*Generated from project analysis via /blueprint:derive-adr*
*Coverage gaps annotated via /blueprint:derive-tests (TRP-001)*
