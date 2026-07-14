#!/usr/bin/env python3
"""Compare the corpus against ComfyUI ground truth. Runs LOCALLY, stdlib only.

Consumes the JSON `corpus_probe.py` emitted on a ComfyUI host and this pack's
`web/data/*.json`, and prints a structured report (=== SECTION === / KEY=VALUE
/ STATUS=) so the verdict is two lines to read rather than a page to re-derive.

Three checks, one per way the corpus has actually gone wrong:

  COVERAGE      tokens the install offers that the corpus describes nowhere.
                Those render as "(no metadata for this option yet)" in the UI.
                Krea 2 was invisible for exactly this reason — nothing asked.
  RECIPES       every models.json entry citing `source.template` is re-checked
                against the template as shipped. If upstream changes the
                template, this FAILS — which is the entire point of citing it.
  BEHAVIOUR     the measured band table, printed beside any corpus prose that
                makes a step-allocation claim, so the author checks rather than
                recalls. This is what would have caught the beta57 error.

Deliberately stdlib-only: this pack is frontend-only and adds no Python
runtime dependency (see `.claude/rules/dependencies.md`). All the numbers were
already computed by the probe on the host; here we only bin and compare them.

    python3 scripts/corpus_check.py tmp/ground-truth.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "web" / "data"

# How many coverage gaps to spell out individually before rolling the rest into
# one line. Every gap still counts as a failure — only the listing is capped.
GAP_LIST_LIMIT = 12

# Prose that asserts *where a schedule spends its steps*. Any entry matching
# this is making a measurable claim, so the report puts the measurement next to
# it. The corpus said beta57 "spends steps in the mid-range"; it does not.
BEHAVIOUR_CLAIM = re.compile(
    r"\b(concentrat|spend|front-load|weighted toward|allocat|takes steps|"
    r"low-noise|mid-noise|high-noise|extremes)",
    re.IGNORECASE,
)

ALLOWED_SOURCE_KINDS = (
    "vendor-default",  # a shipped ComfyUI workflow template — machine-checkable
    "vendor-doc",  # docs.comfy.org, the model card
    "pack-provided",  # ships with a custom-node pack (RES4LYF, ...)
    "community",  # a blog, Civitai, Reddit — honestly labelled as such
    "empirical",  # our own testing
    "paper",  # the originating paper
)


def load(name: str) -> dict[str, Any]:
    path = DATA_DIR / name
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def describes(corpus: dict[str, Any], token: str) -> bool:
    """Resolve a token exactly as the extension does: exact -> alias -> prefix.

    Mirrors `lookup()` in src/index.ts:242. Anything this returns False for is
    a token the UI has no metadata to show.
    """
    if token in (corpus.get("exact") or {}):
        return True
    canonical = (corpus.get("alias") or {}).get(token)
    if canonical and canonical in (corpus.get("exact") or {}):
        return True
    for entry in corpus.get("prefix") or []:
        try:
            if re.search(entry.get("match", ""), token):
                return True
        except re.error:
            continue
    return False


def ignored(corpus: dict[str, Any], token: str) -> bool:
    """Is this token declared a non-token in the corpus's `_meta.coverage_ignore`?

    Some widgets offer sentinels that are not samplers at all — bjornulf's
    "ALL SAMPLERS" fan-out marker, RES4LYF's "none" opt-out. They have no
    metadata to write, so an entry in `coverage_ignore` (a list of regexes)
    excuses them explicitly. Excusing them in the corpus rather than in this
    script keeps the decision reviewable in the diff.
    """
    for pattern in (corpus.get("_meta") or {}).get("coverage_ignore") or []:
        try:
            if re.search(pattern, token):
                return True
        except re.error:
            continue
    return False


def check_coverage(report: Report, probe: dict[str, Any], corpora: dict[str, dict]) -> None:
    report.section("COVERAGE")
    undescribed_total = 0
    for kind, corpus_name in (("samplers", "samplers.json"), ("schedulers", "schedulers.json")):
        offered = probe["tokens"].get(kind, {})
        corpus = corpora[corpus_name]
        candidates = [t for t in offered if not ignored(corpus, t)]
        undescribed = sorted(t for t in candidates if not describes(corpus, t))
        report.kv(f"{kind}_offered", len(offered))
        report.kv(f"{kind}_ignored", len(offered) - len(candidates))
        report.kv(f"{kind}_described", len(candidates) - len(undescribed))
        report.kv(f"{kind}_undescribed", len(undescribed))
        for token in undescribed[:GAP_LIST_LIMIT]:
            providers = {o["module"] for o in offered[token]["offered_by"]}
            report.fail(
                f"{kind}: install offers {token!r} "
                f"({offered[token]['provider']}, from {', '.join(sorted(providers))}) "
                f"but {corpus_name} describes it nowhere"
            )
        # Every gap counts as a failure; only the *listing* is capped, and the
        # cap says so out loud. A silently truncated list reads as "that's all
        # of them" — the exact illusion this check exists to destroy.
        if len(undescribed) > GAP_LIST_LIMIT:
            extra = undescribed[GAP_LIST_LIMIT:]
            report.fail(
                f"{kind}: + {len(extra)} more undescribed tokens (listing capped at "
                f"{GAP_LIST_LIMIT}): {', '.join(extra)}"
            )
        undescribed_total += len(undescribed)

        # The reverse direction is informational, not a failure: a corpus token
        # this install does not offer may simply belong to a pack we have not
        # installed (WanVideoWrapper, HunyuanVideoWrapper).
        orphans = sorted(t for t in (corpus.get("exact") or {}) if t not in offered)
        report.kv(f"{kind}_not_offered_here", len(orphans))
        if orphans:
            report.note(f"{kind}: described but not offered by this install: {', '.join(orphans)}")
    report.kv("undescribed_total", undescribed_total)


def check_recipes(report: Report, probe: dict[str, Any], models: dict[str, Any]) -> None:
    report.section("RECIPES")
    if not models:
        report.note("no models.json — nothing to verify")
        report.kv("checked", 0)
        return

    # A template can contain more than one KSampler; a recipe matches if ANY row
    # from that template agrees on all four fields.
    rows_by_template: dict[str, list[dict[str, Any]]] = {}
    for row in probe.get("templates", []):
        rows_by_template.setdefault(row["template"], []).append(row)

    checked = 0
    for token, entry in (models.get("exact") or {}).items():
        source = entry.get("source") or {}
        template = source.get("template")
        if not template:
            report.note(
                f"{token}: source.kind={source.get('kind', '?')!r}, no template to verify against"
            )
            continue
        checked += 1
        rows = rows_by_template.get(template)
        if not rows:
            report.fail(
                f"{token}: cites template {template!r}, but the install ships no such template "
                f"with a sampler in it (renamed or removed upstream?)"
            )
            continue
        recipe = entry.get("recipe") or {}
        if any(matches(recipe, row) for row in rows):
            report.ok(f"{token}: {fmt(recipe)} matches {template}")
        else:
            actual = "; ".join(fmt(row) for row in rows)
            report.fail(f"{token}: corpus says {fmt(recipe)} but {template} ships {actual}")
    report.kv("checked", checked)


def matches(recipe: dict[str, Any], row: dict[str, Any]) -> bool:
    return all(
        recipe.get(field) == row.get(field) for field in ("sampler", "scheduler", "steps", "cfg")
    )


def fmt(recipe: dict[str, Any]) -> str:
    return (
        f"{recipe.get('sampler')}/{recipe.get('scheduler')}"
        f"/{recipe.get('steps')} steps/CFG {recipe.get('cfg')}"
    )


def check_sources(report: Report, corpora: dict[str, dict]) -> None:
    report.section("SOURCES")
    counts: dict[str, int] = {}
    for name, corpus in corpora.items():
        for token, entry in (corpus.get("exact") or {}).items():
            source = entry.get("source")
            if not source:
                continue
            kind = source.get("kind")
            counts[kind] = counts.get(kind, 0) + 1
            if kind not in ALLOWED_SOURCE_KINDS:
                report.fail(
                    f"{name}: {token}: source.kind={kind!r} is not one of {ALLOWED_SOURCE_KINDS}"
                )
            if kind == "vendor-default" and not source.get("template"):
                report.fail(f"{name}: {token}: source.kind=vendor-default requires a template")
    for kind in ALLOWED_SOURCE_KINDS:
        report.kv(f"kind_{kind.replace('-', '_')}", counts.get(kind, 0))


def check_behaviour(report: Report, probe: dict[str, Any], schedulers: dict[str, Any]) -> None:
    """Print the measured allocation beside every prose claim about it.

    This check never fails on its own — it cannot know whether the prose and the
    numbers agree, only a human can. What it does is make it impossible to write
    the claim without the measurement in front of you.
    """
    report.section("BEHAVIOUR")
    measured = probe.get("schedulers", {})
    claims = 0
    for token, entry in (schedulers.get("exact") or {}).items():
        prose = " ".join(str(entry.get(f, "")) for f in ("summary", "good_for", "notes"))
        if not BEHAVIOUR_CLAIM.search(prose):
            continue
        claims += 1
        if token not in measured:
            report.note(
                f"{token}: makes a step-allocation claim, but this install does not offer it"
            )
            continue
        report.note(f"{token}: {band_table(measured[token])}")
    report.kv("claims", claims)
    baseline = measured.get("simple")
    if baseline:
        report.note(f"simple (baseline): {band_table(baseline)}")


def band_table(entry: dict[str, Any]) -> str:
    parts = []
    for steps, m in sorted(entry.get("measured", {}).items(), key=lambda kv: int(kv[0])):
        bands = m.get("bands")
        if not bands:
            continue
        parts.append(f"@{steps}: high={bands['high']} mid={bands['mid']} low={bands['low']}")
    return "  ".join(parts)


class Report:
    """Structured output: sections, KEY=VALUE facts, and a single STATUS verdict."""

    def __init__(self) -> None:
        self.failures: list[str] = []

    def section(self, name: str) -> None:
        print(f"\n=== {name} ===")

    def kv(self, key: str, value: Any) -> None:
        print(f"{key}={value}")

    def ok(self, message: str) -> None:
        print(f"OK   {message}")

    def note(self, message: str) -> None:
        print(f"NOTE {message}")

    def fail(self, message: str) -> None:
        self.failures.append(message)
        print(f"FAIL {message}")

    def verdict(self) -> int:
        self.section("SUMMARY")
        self.kv("failures", len(self.failures))
        self.kv("STATUS", "FAIL" if self.failures else "PASS")
        return 1 if self.failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ground_truth", help="JSON emitted by corpus_probe.py")
    args = parser.parse_args()

    path = Path(args.ground_truth)
    if not path.exists():
        print(f"missing ground truth: {path}", file=sys.stderr)
        print("run `just corpus-check` — it regenerates it from the ComfyUI host", file=sys.stderr)
        return 2
    probe = json.loads(path.read_text())

    corpora = {name: load(name) for name in ("samplers.json", "schedulers.json")}
    models = load("models.json")

    report = Report()
    print("=== PROBE ===")
    for key, value in (probe.get("_probe") or {}).items():
        report.kv(key, value)
    report.kv("templates_with_sampler", len(probe.get("templates", [])))

    check_coverage(report, probe, corpora)
    check_recipes(report, probe, models)
    check_sources(report, {**corpora, "models.json": models})
    check_behaviour(report, probe, corpora["schedulers.json"])
    return report.verdict()


if __name__ == "__main__":
    sys.exit(main())
