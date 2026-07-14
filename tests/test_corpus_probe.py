"""Regression tests for the ground-truth probe's template parser.

The probe itself needs a ComfyUI host (torch, a live `/object_info`), so it
cannot run in CI. Its *parser* is pure and can — and must, because the parser is
where the trap lives: in the templates that matter most (`image_krea2_turbo_t2i`,
`flux1_krea_dev`) the `KSampler` is nested under `definitions.subgraphs[].nodes`,
not in top-level `nodes`. A top-level-only scan returns nothing and reads as "no
sampler configured", so the template — the vendor's own default recipe, a Tier-2
source that outranks any blog — looks silent when it is in fact authoritative.
That misreading is exactly what let a blog's `er_sde` claim stand unchallenged.

These tests pin the parser against fixtures with the real shapes.
"""

import importlib.util
import json
from pathlib import Path

import pytest

PROBE_PATH = Path(__file__).resolve().parent.parent / "scripts" / "corpus_probe.py"

# Real KSampler widget vector from `image_krea2_turbo_t2i.json`. The order is
# positional and unnamed: [seed, control_after_generate, steps, cfg,
# sampler_name, scheduler, denoise].
KREA2_WIDGETS = [735915477938686, "randomize", 8, 1, "euler", "simple", 1]

SAMPLER_TOKENS = {"euler", "dpmpp_2m", "er_sde"}


@pytest.fixture(scope="module")
def probe():
    """Import corpus_probe.py directly — scripts/ is not a package."""
    spec = importlib.util.spec_from_file_location("corpus_probe", PROBE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def write(tmp_path, name, doc):
    path = tmp_path / name
    path.write_text(json.dumps(doc))
    return path


def test_finds_ksampler_nested_in_a_subgraph(probe, tmp_path):
    """THE regression: a KSampler that exists only inside definitions.subgraphs."""
    write(
        tmp_path,
        "image_krea2_turbo_t2i.json",
        {
            "nodes": [{"type": "CheckpointLoaderSimple", "widgets_values": ["krea2.safetensors"]}],
            "definitions": {
                "subgraphs": [
                    {
                        "name": "Text to Image (Krea-2 Turbo)",
                        "nodes": [{"type": "KSampler", "widgets_values": KREA2_WIDGETS}],
                    }
                ]
            },
        },
    )
    rows = probe.probe_templates(tmp_path, SAMPLER_TOKENS)
    assert len(rows) == 1
    row = rows[0]
    assert row["sampler"] == "euler"
    assert row["scheduler"] == "simple"
    assert row["steps"] == 8
    assert row["cfg"] == 1
    assert row["container"].startswith("definitions.subgraphs")


def test_finds_ksampler_at_top_level(probe, tmp_path):
    write(
        tmp_path,
        "plain.json",
        {
            "nodes": [
                {
                    "type": "KSampler",
                    "widgets_values": [42, "fixed", 20, 3.5, "dpmpp_2m", "karras", 1],
                }
            ]
        },
    )
    rows = probe.probe_templates(tmp_path, SAMPLER_TOKENS)
    assert [(r["sampler"], r["scheduler"], r["steps"], r["cfg"]) for r in rows] == [
        ("dpmpp_2m", "karras", 20, 3.5)
    ]
    assert rows[0]["container"] == "nodes"


def test_ignores_templates_with_no_sampler(probe, tmp_path):
    write(
        tmp_path,
        "upscale.json",
        {"nodes": [{"type": "ImageScale", "widgets_values": ["nearest"]}]},
    )
    assert probe.probe_templates(tmp_path, SAMPLER_TOKENS) == []


def test_survives_templates_of_unexpected_shape(probe, tmp_path):
    """A malformed or differently-shaped template must not kill the whole run.

    The templates directory is a grab-bag of formats. One `.get()` against a
    list where a dict was assumed took down an entire probe run — and a probe
    that dies produces no report, which reads exactly like a clean one.
    """
    write(tmp_path, "a_list.json", ["not", "a", "graph"])
    write(tmp_path, "definitions_is_a_list.json", {"nodes": [], "definitions": []})
    write(tmp_path, "nodes_is_null.json", {"nodes": None})
    (tmp_path / "not_json.json").write_text("{ this is not json")
    good = write(
        tmp_path,
        "zz_good.json",
        {"nodes": [{"type": "KSampler", "widgets_values": KREA2_WIDGETS}]},
    )
    assert good.exists()

    rows = probe.probe_templates(tmp_path, SAMPLER_TOKENS)
    assert [r["template"] for r in rows] == ["zz_good.json"]


def test_band_allocation_splits_on_fraction_of_sigma_max(probe):
    """Bands are fractions of sigma_max — the unit every prose claim implicitly uses."""
    assert probe.band_of(1.0) == "high"
    assert probe.band_of(0.6) == "high"
    assert probe.band_of(0.5) == "mid"
    assert probe.band_of(0.11) == "mid"
    assert probe.band_of(0.1) == "low"
    assert probe.band_of(0.0) == "low"
