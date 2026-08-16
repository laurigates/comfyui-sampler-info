"""Every template the corpus cites must still exist in the shipped template set.

This closes a hole that `test_vendor_default_sources_cite_a_template` cannot
see. That test asserts a `source.template` *string* is present — it has no way
to know the file behind the string is gone, so it stayed green through the
whole failure it was written to guard.

What actually happened: `sd15` was cited to `default.json` on 2026-08-04. Two
days later Comfy-Org/workflow_templates#1088 moved `templates/default.json` to
`archived/default.json`. The citation went dead, the pytest suite stayed green,
and the only thing that noticed was the RECIPES section of `just corpus-check`
— which needs a live ComfyUI host with torch and so runs on a maintainer's GPU
box, not in CI. Between the two, nothing here would ever have caught it.

Scope, deliberately: **existence only**. Re-checking the recipe's widget values
against the template needs the live install's sampler-token set (that is what
`corpus_probe.py` fetches from `/object_info` to tell a sampler widget from any
other combo), so the value half stays with `just corpus-check`. Existence is
the half that broke, and it is the half that needs no GPU.

Note that this pins provenance to *the version resolved in uv.lock*, not to
whatever a given user has installed. That is the intended behaviour: when
Renovate bumps the templates package and upstream has archived or renamed a
template we cite, this test goes red on the bump — which is the signal.
"""

import json
from pathlib import Path

import comfyui_workflow_templates_json

CORPUS_DIR = Path(__file__).resolve().parent.parent / "web" / "data"
CORPUS_FILES = ["samplers.json", "schedulers.json", "models.json"]

TEMPLATES_DIR = Path(comfyui_workflow_templates_json.__file__).resolve().parent / "templates"


def cited_templates():
    """Every (corpus, token, template) triple naming a template, across all corpora."""
    for name in CORPUS_FILES:
        path = CORPUS_DIR / name
        if not path.exists():
            continue
        with open(path) as f:
            corpus = json.load(f)
        for token, entry in (corpus.get("exact") or {}).items():
            template = (entry.get("source") or {}).get("template")
            if template:
                yield name, token, template


def test_the_shipped_template_set_is_actually_present():
    """Guard the guard: an empty template set would make the test below vacuous.

    If the package layout changes and `templates/` resolves to nothing, every
    `.glob` below returns empty and the real assertion reports *everything* as
    missing — loud, so that direction is safe. The dangerous direction is the
    corpus citing nothing, which is why `test_every_cited_template_exists`
    asserts a non-zero citation count too.
    """
    assert TEMPLATES_DIR.is_dir(), f"templates dir not found at {TEMPLATES_DIR}"
    assert len(list(TEMPLATES_DIR.glob("*.json"))) > 100, (
        f"only {len(list(TEMPLATES_DIR.glob('*.json')))} templates found — "
        f"the package layout probably moved, and this gate is not looking at the real set"
    )


def test_every_cited_template_exists():
    """A `source.template` that names a file the package no longer ships is a dead citation."""
    shipped = {path.name for path in TEMPLATES_DIR.glob("*.json")}
    cited = list(cited_templates())

    # Two-sided: `assert not missing` is vacuously true when the corpus cites
    # no templates at all — which is precisely what deleting the `source`
    # blocks (rather than fixing them) would look like.
    assert cited, "no corpus entry cites a template; this gate is asserting nothing"

    missing = [
        f"{name}: exact[{token}].source.template = {template!r}"
        for name, token, template in cited
        if template not in shipped
    ]
    assert not missing, (
        "cited templates are not in the shipped template set (archived or renamed "
        "upstream — re-derive the recipe, or relabel the source): " + ", ".join(missing)
    )
