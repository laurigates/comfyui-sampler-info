---
id: ADR-0009
date: 2026-05-25
status: Accepted
deciders: Lauri Gates
domain: testing
supersedes:
  - ADR-0007
relates-to:
  - PRD-001
  - ADR-0003
  - ADR-0007
  - TRP-001
github-issues: []
name: blueprint-derive-adr
---

# ADR-0009: Adopt Vitest as a Dev-Only Test Harness for Pure JS Functions

## Decision Drivers

- **TRP-001 Gaps 1 & 2 require unit coverage** on pure functions in
  `web/js/sampler-info.js` (`fuzzyScore`, `fuzzyRank`, `compileCorpus`,
  `lookup`, `safeRegex`). ADR-0007 explicitly named "no regression
  coverage for the fuzzy scorer's scoring logic" as a known negative
  consequence of the previous strategy.
- The pure functions are straightforwardly Node-testable — no DOM,
  no ComfyUI runtime, no network. The cost of testing them is one
  devDependency and a one-line `vitest.config.js`.
- Vitest 4.x has minimal configuration, native ES module support,
  and parallel-by-default execution. Field-validated against the
  current `vitest/config` API (`defineConfig`, `test.include`,
  `test.environment`).
- The dev-only cost (~50 MB `node_modules`, an `npm install` step,
  ~30 s of CI time) is acceptable for the regression value on a
  scorer that is the most likely target of future tuning.

## Scope of Supersedure

This ADR **supersedes ADR-0007 only on the test framework decision** —
the manual smoke matrix in `CLAUDE.md` and the JSON corpus parse
check both remain in force. ADR-0007's broader "what is the testing
strategy" is replaced by: pure functions → Vitest; corpus integrity
→ pytest (per `tests/test_corpus.py`); DOM-dependent picker / tooltip
injection → manual smoke matrix (unchanged).

This ADR **does NOT supersede ADR-0003** (Single-File JavaScript
Implementation, No Bundler). The shipped runtime is unchanged:

- `web/js/sampler-info.js` is still a single ES module file.
- ComfyUI still serves `web/` as static assets directly to the
  browser — no bundler, no build step.
- Nothing under `web/` consumes `node_modules`.
- The `package.json` and `node_modules/` added by this ADR are
  **dev-only**: they exist on contributor and CI machines and are
  used exclusively by `npm test`. They are not part of the
  published Comfy Registry artifact and never reach a user's
  ComfyUI install.

ADR-0003's "no `package.json`, no `node_modules`" prohibition was a
shorthand for "no *runtime* bundler / npm dependency chain ships to
users." The dev test harness preserves that intent — the runtime
remains zero-toolchain.

## Considered Options

1. **Vitest as a dev-only test runner** — add `package.json` +
   `vitest.config.js` + `tests/js/`, gitignore `node_modules/`
2. **Stay with ADR-0007** — accept the regression gap, document
   `fuzzyScore` / `fuzzyRank` invariants in prose only
3. **Use a Python-side JS evaluator** — e.g. `py_mini_racer` to
   execute the JS in pytest and avoid Node entirely
4. **Switch the scorer to Python** — re-implement `fuzzyScore` in
   `tests/` as a reference and compare outputs (still requires
   running JS somehow)

## Decision Outcome

**Chosen option**: "Vitest as a dev-only test runner". Vitest is the
de-facto standard for pure JS unit testing, has minimal config, and
its ES module support matches the runtime's module style (no
transpilation gap between test and production code). The dev cost is
one devDependency and an `npm install` step on contributor / CI
machines. The user-facing runtime is unchanged.

Option 3 (Python-side JS evaluator) was rejected because `py_mini_racer`
adds a substantial native dependency to `tests/`, fragments the test
harness across two languages, and produces less helpful error output
than Vitest. Option 4 (port to Python) was rejected because keeping
the scorer in JS at one source of truth is more reliable than
maintaining two implementations.

### Positive Consequences

- TRP-001 Gaps 1 & 2 can be closed with focused unit tests.
- The fuzzy scorer gets a regression net — future tuning has a fast
  feedback loop.
- Contributors who edit `sampler-info.js` can run `npm test` for
  sub-second feedback on scoring logic.
- The test environment matches the runtime (native ES modules, Node
  V8 engine — close to the browser V8 the pack actually runs in).

### Negative Consequences

- Contributors now need Node 22+ and `npm install` before running
  the JS test suite (Python pytest is unchanged).
- CI gains a Node setup step (~30 s) and an install step (~10 s).
- A `package.json` and (locally) `node_modules/` exist in the repo
  — gitignored, but visible in `ls`.
- `node_modules` consumes ~50 MB on disk per checkout.

## Pros and Cons of Options

### Vitest as a dev-only test runner

- ✅ Standard tooling, well-known DX
- ✅ Native ESM, matches runtime module style
- ✅ Closes TRP-001 Gaps 1 & 2
- ❌ Adds Node toolchain dependency for contributors
- ❌ `node_modules/` on disk (gitignored)

### Stay with ADR-0007

- ✅ Zero additional toolchain
- ❌ TRP-001 Gaps 1 & 2 remain open indefinitely
- ❌ Scorer tuning has no regression safety net

### Python-side JS evaluator (`py_mini_racer`)

- ✅ No Node dependency
- ❌ Native build dep (V8 wrapper) on every contributor machine
- ❌ Two-language test stack is harder to maintain
- ❌ JS errors surface as Python exceptions — worse DX

### Port scorer to Python for parity testing

- ✅ Could use pure pytest
- ❌ Two implementations to keep in sync — guaranteed drift
- ❌ Doesn't actually exercise the JS the runtime uses

## Implementation Notes

- `package.json` is `"private": true` and only lists Vitest under
  `devDependencies`. No runtime `dependencies` field.
- `vitest.config.js` sets `environment: "node"` and includes only
  `tests/js/**/*.test.js`. The `web/` directory is excluded — those
  files are static assets, not test sources.
- `sampler-info.js` calls `app.registerExtension(...)` at top-level.
  Test files mock the `../../../scripts/app.js` import via
  `vi.mock(...)` before importing the module under test. This keeps
  `sampler-info.js` itself unchanged apart from adding `export`
  keywords to the pure functions being tested (`compileCorpus`,
  `safeRegex`, `lookup`, `fuzzyScore`, `fuzzyRank`).
- The existing `.claude/rules/dependencies.md` rule's "no npm /
  node_modules" guidance refers to *runtime* dependencies. Dev
  devDependencies are a separate category — that rule may be
  refined in a follow-up if it causes confusion.

## Links

- ADR-0003 — Single-File JavaScript Implementation (still in force
  for the runtime)
- ADR-0007 — Testing Strategy (superseded by this ADR on the
  framework decision; smoke matrix unchanged)
- TRP-001 — `docs/trps/regression-gaps-initial-scaffold.md`
  (Gaps 1 & 2 close once Wave 3 lands the tests)
- `package.json`, `vitest.config.js`, `tests/js/`

---
*Authored as part of the Wave 2 / TRP-001 backlog landing.*
