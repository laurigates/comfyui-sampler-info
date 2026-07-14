"""Validate the JSON corpus files (samplers.json, schedulers.json).

These tests ensure the corpus files are well-formed and follow the expected
schema so that the JavaScript extension can parse them at runtime.
"""

import json
from pathlib import Path

import pytest

CORPUS_DIR = Path(__file__).resolve().parent.parent / "web" / "data"
CORPUS_FILES = ["samplers.json", "schedulers.json"]

# Mirrors ALLOWED_SOURCE_KINDS in scripts/corpus_check.py. `source` records how
# a fact is known — see .claude/rules/corpus-ground-truth.md. Only
# `vendor-default` (a shipped ComfyUI workflow template) is machine-checkable;
# the rest are honest labels, and an honest "community" beats a
# confident-sounding sentence with no provenance.
ALLOWED_SOURCE_KINDS = {
    "vendor-default",
    "vendor-doc",
    "pack-provided",
    "community",
    "empirical",
    "paper",
}


def resolves(corpus, token):
    """Resolve a token the way lookup() in src/index.ts does: exact -> alias -> prefix."""
    import re

    if token in corpus.get("exact", {}):
        return True
    canonical = corpus.get("alias", {}).get(token)
    if canonical and canonical in corpus.get("exact", {}):
        return True
    return any(re.search(entry.get("match", ""), token) for entry in corpus.get("prefix", []))


@pytest.fixture(params=CORPUS_FILES)
def corpus(request):
    """Load and return a corpus dict for each JSON file."""
    path = CORPUS_DIR / request.param
    assert path.exists(), f"Corpus file missing: {path}"
    with open(path) as f:
        return json.load(f)


def test_corpus_is_dict(corpus):
    """Top-level value must be a dict."""
    assert isinstance(corpus, dict)


def test_corpus_has_exact_key(corpus):
    """Corpus must have an 'exact' key with a dict of entries."""
    assert "exact" in corpus
    assert isinstance(corpus["exact"], dict)


def test_exact_entries_have_summary(corpus):
    """Every exact entry should have at least a 'summary' field."""
    for token, entry in corpus["exact"].items():
        assert isinstance(entry, dict), f"exact[{token!r}] is not a dict"
        assert "summary" in entry, f"exact[{token!r}] missing 'summary'"


def test_exact_keys_have_no_whitespace(corpus):
    """Exact token keys must not have leading or trailing whitespace."""
    for token in corpus["exact"]:
        assert token == token.strip(), (
            f"exact key {token!r} has leading/trailing whitespace; "
            f"stripped form is {token.strip()!r}"
        )


def test_prefix_entries_have_match(corpus):
    """If 'prefix' exists, each entry must have a 'match' regex."""
    if "prefix" not in corpus:
        pytest.skip("No prefix section in corpus")
    assert isinstance(corpus["prefix"], list)
    for i, entry in enumerate(corpus["prefix"]):
        assert "match" in entry, f"prefix[{i}] missing 'match'"


def test_prefix_regexes_compile(corpus):
    """All prefix match patterns must be valid regexes."""
    import re

    if "prefix" not in corpus:
        pytest.skip("No prefix section in corpus")
    for i, entry in enumerate(corpus["prefix"]):
        pattern = entry.get("match", "")
        try:
            re.compile(pattern)
        except re.error as exc:
            pytest.fail(f"prefix[{i}].match = {pattern!r} is invalid regex: {exc}")


def test_json_files_are_valid():
    """All JSON files in web/data/ must parse without error."""
    for name in CORPUS_FILES:
        path = CORPUS_DIR / name
        with open(path) as f:
            json.load(f)  # Raises on invalid JSON


def test_pairs_with_tokens_exist_in_scheduler_corpus():
    """Every `pairs_with` token must be a real scheduler token.

    `pairs_with` is a cross-corpus reference: a sampler entry names the
    schedulers it suits, and those names must resolve against
    schedulers.json's `exact` keys. Nothing else checks this, so a typo'd or
    invented scheduler token would render as a dead recommendation in the
    tooltip and the picker's "Pairs with" line — and the UI is about to treat
    this link as load-bearing.
    """
    with open(CORPUS_DIR / "schedulers.json") as f:
        schedulers = json.load(f)
    with open(CORPUS_DIR / "samplers.json") as f:
        samplers = json.load(f)

    known = set(schedulers["exact"])
    unknown = []
    for token, entry in samplers.get("exact", {}).items():
        for sched in entry.get("pairs_with", []):
            if sched not in known:
                unknown.append(f"exact[{token}].pairs_with -> {sched!r}")
    for i, entry in enumerate(samplers.get("prefix", [])):
        for sched in entry.get("pairs_with", []):
            if sched not in known:
                unknown.append(f"prefix[{i}] ({entry.get('match')}).pairs_with -> {sched!r}")

    assert not unknown, "pairs_with references unknown scheduler tokens: " + ", ".join(unknown)


def test_source_kinds_are_allowed():
    """`source.kind` must be one of the recognized provenance labels.

    The point of `source` is that a script can act on it. An invented kind
    (`"blog"`, `"docs"`) reads as provenance but is checkable by nothing — the
    same false confidence as the prose hacks it replaces.
    """
    bad = []
    for name in [*CORPUS_FILES, "models.json"]:
        path = CORPUS_DIR / name
        if not path.exists():
            continue
        with open(path) as f:
            corpus = json.load(f)
        for token, entry in corpus.get("exact", {}).items():
            source = entry.get("source")
            if source is None:
                continue
            kind = source.get("kind")
            if kind not in ALLOWED_SOURCE_KINDS:
                bad.append(f"{name}: exact[{token}].source.kind = {kind!r}")
    assert not bad, "unrecognized source.kind values: " + ", ".join(bad)


def test_vendor_default_sources_cite_a_template():
    """`kind: vendor-default` is the one machine-checkable label — it must name its template.

    `corpus_check.py` re-verifies every such recipe against the template as
    ComfyUI actually ships it. A vendor-default with no `template` is a claim
    that opts out of the only check that can falsify it.
    """
    missing = []
    for name in [*CORPUS_FILES, "models.json"]:
        path = CORPUS_DIR / name
        if not path.exists():
            continue
        with open(path) as f:
            corpus = json.load(f)
        for token, entry in corpus.get("exact", {}).items():
            source = entry.get("source") or {}
            if source.get("kind") == "vendor-default" and not source.get("template"):
                missing.append(f"{name}: exact[{token}]")
    assert not missing, "source.kind=vendor-default without a template: " + ", ".join(missing)


def test_model_recipes_resolve_against_sampler_and_scheduler_corpora():
    """Every models.json recipe must name a sampler and scheduler we actually describe.

    models.json is the single home for each model family's vendor-default
    recipe (it used to be duplicated into both `euler.good_for` and
    `simple.good_for` — two copies, no source of truth, which is how the
    beta57 prose drifted). Same cross-corpus check as `pairs_with`: a recipe
    naming a token the corpus cannot resolve is a dead recommendation.
    """
    models_path = CORPUS_DIR / "models.json"
    if not models_path.exists():
        pytest.skip("no models.json yet")
    with open(models_path) as f:
        models = json.load(f)
    with open(CORPUS_DIR / "samplers.json") as f:
        samplers = json.load(f)
    with open(CORPUS_DIR / "schedulers.json") as f:
        schedulers = json.load(f)

    unknown = []
    for token, entry in models.get("exact", {}).items():
        recipe = entry.get("recipe") or {}
        sampler = recipe.get("sampler")
        scheduler = recipe.get("scheduler")
        if sampler is not None and not resolves(samplers, sampler):
            unknown.append(f"exact[{token}].recipe.sampler -> {sampler!r}")
        # Schedulers have no alias/prefix sections, so `exact` is the whole set.
        if scheduler is not None and scheduler not in schedulers.get("exact", {}):
            unknown.append(f"exact[{token}].recipe.scheduler -> {scheduler!r}")
    assert not unknown, "models.json recipes reference unknown tokens: " + ", ".join(unknown)


def test_vendor_default_recipes_are_complete():
    """A `vendor-default` recipe must be whole — it is checked against a real template.

    Only vendor-defaults are held to this. A `community` or `empirical` entry is
    allowed to leave `steps`/`cfg` null: krea2-raw ships no ComfyUI template, so
    inventing a step count to fill the field would be exactly the fabrication
    this schema exists to prevent. A null says "we don't know"; the label says
    how well we know the rest.

    The schedule may be named by `scheduler` (a token) OR by `scheduler_node`
    (a model-specific node like Flux2Scheduler, where no token exists) — but one
    of the two must be there, or the recipe names no schedule at all.
    """
    models_path = CORPUS_DIR / "models.json"
    if not models_path.exists():
        pytest.skip("no models.json yet")
    with open(models_path) as f:
        models = json.load(f)

    problems = []
    for token, entry in models.get("exact", {}).items():
        recipe = entry.get("recipe") or {}
        if not recipe.get("scheduler") and not recipe.get("scheduler_node"):
            problems.append(f"exact[{token}].recipe names neither a scheduler nor a scheduler_node")
        if (entry.get("source") or {}).get("kind") != "vendor-default":
            continue
        for field in ("sampler", "steps", "cfg"):
            if recipe.get(field) is None:
                problems.append(f"exact[{token}].recipe.{field} is null on a vendor-default")
    assert not problems, "models.json recipe problems: " + "; ".join(problems)
