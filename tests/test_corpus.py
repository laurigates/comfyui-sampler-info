"""Validate the JSON corpus files (samplers.json, schedulers.json).

These tests ensure the corpus files are well-formed and follow the expected
schema so that the JavaScript extension can parse them at runtime.
"""

import json
from pathlib import Path

import pytest

CORPUS_DIR = Path(__file__).resolve().parent.parent / "web" / "data"
CORPUS_FILES = ["samplers.json", "schedulers.json"]


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
