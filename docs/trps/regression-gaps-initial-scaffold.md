---
id: TRP-001
created: 2026-05-21
modified: 2026-05-21
status: Active
scope: "full"
date_range: "2026-05-21 to 2026-05-21"
commits_analyzed: 3
test_framework: "none (syntax-check + manual smoke matrix per ADR-0007)"
relates-to:
  - PRD-001
  - ADR-0007
github-issues: []
---

# TRP-001: Initial Scaffold — Coverage Gaps from First Feature Commit

Test Regression Plan identifying coverage gaps from git history analysis.


## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 0 | Fix commits with no tests at all |
| High | 0 | Fix commits with stale/unupdated test files |
| Medium | 3 | Feature sub-areas missing automated tests in core logic/data |
| Low | 1 | Peripheral module with no test, low blast radius |
| **Total** | **4** | |

**Analysis scope**: 3 commits from 2026-05-21 to 2026-05-21
**Test framework**: None — project deliberately chose "syntax check + manual smoke" (ADR-0007)

**Context**: The repository has a single `feat:` commit (`60a3d1c`) that shipped the entire
codebase in one go. There are no `fix:` commits, so there are no regression test
gaps in the traditional sense. However, the feat commit introduced several
pure-logic modules that are straightforwardly unit-testable today, and ADR-0007
explicitly lists their lack of coverage as a known negative consequence of the
chosen strategy. This TRP formalises those gaps as a backlog to close if and
when the project decides to invest in a test harness.


## Critical Gaps

_None._ No `fix:` commits in the analysed range.


## High Gaps

_None._ No `fix:` commits in the analysed range.


## Medium Gaps

Feature commit `60a3d1c` shipped three testable units without any automated
verification. Each maps directly to a "Negative Consequence" acknowledged in
ADR-0007.

| # | Commit | Date | Subject | Affected Module | Suggested Test |
|---|--------|------|---------|-----------------|----------------|
| 1 | `60a3d1c` | 2026-05-21 | feat: initial release scaffold | `web/js/sampler-info.js` — fuzzy scorer (`fuzzyScore`, `fuzzyRank`) | Vitest unit tests |
| 2 | `60a3d1c` | 2026-05-21 | feat: initial release scaffold | `web/js/sampler-info.js` — corpus helpers (`compileCorpus`, `lookup`, `safeRegex`) | Vitest unit tests |
| 3 | `60a3d1c` | 2026-05-21 | feat: initial release scaffold | `web/data/samplers.json` + `web/data/schedulers.json` — schema / content integrity | JSON schema validator |


### Gap 1 — Fuzzy scorer (`fuzzyScore` / `fuzzyRank`)

- **Commit**: `60a3d1ce7ccc80a50bcc115ca023ba4e47076e40`
- **Date**: 2026-05-21
- **File**: `web/js/sampler-info.js` (lines 466–551)
- **Why medium**: `fuzzyScore` and `fuzzyRank` are pure functions with no DOM
  dependency. They contain scoring bonuses for word-boundary hits, consecutive
  matches, and AND-token semantics. All of this logic can regress silently if
  the scorer is tuned. ADR-0007 explicitly named this as "No regression coverage
  for the fuzzy scorer's scoring logic."
- **Suggested test file**: `web/js/sampler-info.test.js` (Vitest, Node)
- **Key scenarios**:

  ```
  Test: exact prefix character match gets start-of-string bonus
  Given: query = "e", target = "euler"
  Then:  score > score for same query against "heun" (mid-string match)

  Test: word-boundary bonus fires on underscore separator
  Given: query = "dpms", target = "dpmpp_2m_sde"
  Then:  result is non-null and nameMatches contains the boundary positions

  Test: AND-token semantics — all tokens must match
  Given: query = "dpm sde", target = "euler"
  Then:  fuzzyRank returns null (euler does not contain "sde")

  Test: AND-token semantics — both tokens match
  Given: query = "dpm sde", target = "dpmpp_2m_sde"
  Then:  fuzzyRank returns non-null with a positive score

  Test: partial query returns null when characters are not a subsequence
  Given: query = "xyz", target = "euler"
  Then:  fuzzyScore returns null

  Test: empty query returns zero score with no matches
  Given: query = ""
  Then:  fuzzyScore returns { score: 0, matches: [] }
  ```


### Gap 2 — Corpus helpers (`compileCorpus`, `lookup`, `safeRegex`)

- **Commit**: `60a3d1ce7ccc80a50bcc115ca023ba4e47076e40`
- **Date**: 2026-05-21
- **File**: `web/js/sampler-info.js` (lines 44–67)
- **Why medium**: `lookup` implements exact-before-prefix precedence, which is a
  behaviour contract that any future corpus edit could accidentally break.
  `compileCorpus` silently drops entries with invalid regexes — the drop
  behaviour is untested. `safeRegex` swallows bad patterns; a test anchors the
  expected fallback.
- **Suggested test file**: `web/js/sampler-info.test.js` (same file as Gap 1)
- **Key scenarios**:

  ```
  Test: exact match wins over a matching prefix
  Given: corpus with exact["euler"] and prefix[{match: "^eu"}]
  Then:  lookup(corpus, "euler") returns the exact entry, not the prefix entry

  Test: prefix match fires when no exact entry exists
  Given: corpus with prefix[{match: "^res_\\d+m$", re: /^res_\d+m$/}]
  Then:  lookup(corpus, "res_2m") returns the prefix entry

  Test: null returned for unknown token
  Given: corpus with no matching exact or prefix
  Then:  lookup(corpus, "unknown_sampler") returns null

  Test: compileCorpus filters out entries with invalid regex patterns
  Given: raw = { prefix: [{ match: "[invalid" }, { match: "^euler" }] }
  Then:  compileCorpus(raw).prefix has length 1 (only the valid entry)

  Test: lookup ignores non-string tokens
  Given: token = null / undefined / 42
  Then:  lookup(corpus, token) returns null without throwing
  ```


### Gap 3 — Corpus JSON schema and content integrity

- **Commit**: `60a3d1ce7ccc80a50bcc115ca023ba4e47076e40`
- **Date**: 2026-05-21
- **Files**: `web/data/samplers.json`, `web/data/schedulers.json`
- **Why medium**: Both files have an implicit schema (`exact` map of token
  objects, `prefix` array with a `match` regex field). ADR-0007 identified
  "No automated guard against corpus schema drift" as a known gap. A
  contributor adding a new sampler could accidentally break the `prefix`
  lookup by omitting the required `match` field or writing an invalid regex.
  A `json.load` parse check (already suggested in ADR-0007) passes — it only
  verifies valid JSON. It does **not** verify:
  - Every `prefix` entry has a `match` field
  - Every `match` value is a valid regex
  - No exact entry key contains whitespace (which would never match a
    widget token)
- **Suggested test**: Python `pytest` (or a standalone script) using
  `jsonschema` or hand-rolled assertions; alternatively a Vitest test that
  imports the JSON and asserts structural invariants.
- **Key scenarios**:

  ```
  Test: all prefix entries have a non-empty "match" field
  Given: web/data/samplers.json
  Then:  every item in .prefix has typeof item.match === "string" && item.match !== ""

  Test: all "match" values compile to valid regex
  Given: web/data/samplers.json and web/data/schedulers.json
  Then:  new RegExp(item.match) does not throw for any prefix entry

  Test: no exact key contains leading/trailing whitespace
  Given: both corpus files
  Then:  Object.keys(data.exact).every(k => k === k.trim())

  Test: schedulers.json prefix array is empty or all entries have "match"
  Given: web/data/schedulers.json (currently has no prefix entries)
  Then:  same structural guarantees hold even if prefix entries are added later
  ```


## Low Gaps

| # | Commit | Date | Subject | File | Reason Low |
|---|--------|------|---------|------|------------|
| 1 | `60a3d1c` | 2026-05-21 | feat: initial release scaffold | `__init__.py` | Only 3 constants; no logic to regress |


### Gap 4 — Python stub (`__init__.py`)

- **Commit**: `60a3d1ce7ccc80a50bcc115ca023ba4e47076e40`
- **File**: `__init__.py`
- **Why low**: The file exports `WEB_DIRECTORY`, `NODE_CLASS_MAPPINGS`, and
  `NODE_DISPLAY_NAME_MAPPINGS` — all constants. There is no logic to unit
  test. A simple smoke test asserting the import succeeds and the expected
  symbols exist is sufficient.
- **Suggested test**: `tests/test_init.py` (pytest)
- **Scenario**:

  ```
  Test: package imports cleanly and exposes required ComfyUI symbols
  Given: import comfyui_sampler_info (or the package root)
  Then:  WEB_DIRECTORY == "./web"
         NODE_CLASS_MAPPINGS == {}
         NODE_DISPLAY_NAME_MAPPINGS == {}
  ```


## Recommended Test Creation Order

1. **Gap 2 first (corpus helpers)** — `compileCorpus` / `lookup` / `safeRegex` are
   the foundation everything else sits on. If `lookup` has a precedence bug,
   the fuzzy scorer returns correct scores but the tooltip shows wrong data.
   Pure functions, zero dependencies, easy to add to a Vitest suite in minutes.

2. **Gap 1 next (fuzzy scorer)** — Once corpus helpers are locked down by tests,
   add scorer tests in the same file. The scorer is the only complex algorithm
   in the codebase and the most likely target of future tuning.

3. **Gap 3 (JSON schema)** — A one-shot Python script or small pytest module;
   fastest to write, protects the corpus from contributor mistakes on every PR.

4. **Gap 4 (Python stub)** — Low value but trivial; add alongside Gap 3 to
   make `pytest` a complete pass/fail signal in CI.


## Module Coverage Summary

| Module / File | Feat Commits | With Inline Tests | Gap % |
|---------------|-------------|-------------------|-------|
| `web/js/sampler-info.js` (logic) | 1 | 0 | 100% |
| `web/data/samplers.json` | 1 | 0 | 100% |
| `web/data/schedulers.json` | 1 | 0 | 100% |
| `__init__.py` | 1 | 0 | 100% |

> Note: DOM-dependent code (picker, tooltip injection, widget patching) is
> intentionally excluded from this plan — ADR-0007 documents the cost/benefit
> analysis and the manual smoke matrix in `CLAUDE.md` is the agreed substitute.


## Relationship to ADR-0007

The three medium gaps in this plan correspond 1:1 to the negative consequences
listed in ADR-0007 § "Negative Consequences":

| ADR-0007 consequence | TRP gap |
|----------------------|---------|
| "No regression coverage for the fuzzy scorer's scoring logic" | Gap 1 |
| "No automated guard against corpus schema drift" | Gap 3 |
| "Browser smoke tests are manual — easy to skip" | Out of scope (no automation path without ComfyUI running) |

If the project ever revisits ADR-0007 and upgrades to Vitest, Gaps 1 and 2
should be the first tests written. Gap 3 can be addressed independently with
a pure-Python schema check and no additional JS toolchain.

---

**Generated by**: /blueprint:derive-tests
**Analysis date**: 2026-05-21
**Commits analyzed**: 3 (2026-05-21 — 2026-05-21)
