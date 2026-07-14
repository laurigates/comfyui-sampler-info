#!/usr/bin/env python
"""Emit ComfyUI ground truth as JSON on stdout. Runs ON a ComfyUI host.

This is the Tier-1 half of the corpus ground-truth methodology (see
`.claude/rules/corpus-ground-truth.md` and the
`comfyui-plugin:comfy-corpus-validation` skill). It knows nothing about this
pack's corpus — it only reports what the install actually is:

  tokens      which sampler/scheduler tokens the install offers, which node
              classes offer them, and whether the token comes from ComfyUI
              core or was injected by a custom-node pack.
  schedulers  the measured sigma curve of every registered scheduler, plus
              how its steps land across the low/mid/high noise bands. This is
              the section that catches an invented claim about what a schedule
              *does* — the `beta57` prose in #72 said it spends steps in the
              mid-range; measurement showed the exact opposite.
  templates   the KSampler recipe (sampler/scheduler/steps/cfg) in every
              shipped workflow template. The vendor's template IS the vendor's
              default recipe — a Tier-2 source that outranks any blog.

It must run under the host's ComfyUI venv (torch/scipy/numpy live there), so
it is deliberately kept out of this pack's own dependency set — the pack is
frontend-only and takes no Python runtime deps. `corpus_check.py` is the
stdlib-only local half that consumes this output.

    python corpus_probe.py --comfy-root /path/to/ComfyUI > ground-truth.json
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import inspect
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

# Mirrors SAMPLER_WIDGET_NAMES / SCHEDULER_WIDGET_NAMES in src/index.ts — the
# widget names the extension attaches to. A token is only interesting to the
# corpus if it can appear in one of these widgets.
SAMPLER_WIDGET_NAMES = ("sampler_name", "sampler")
SCHEDULER_WIDGET_NAMES = ("scheduler",)

# Noise bands as a fraction of sigma_max. A step is attributed to the band its
# starting sigma falls in. Coarse on purpose: the point is the shape of the
# allocation, not a precise integral.
BANDS = (("high", 0.5, 1.01), ("mid", 0.1, 0.5), ("low", -1.0, 0.1))

# Step counts to measure each scheduler at. Low, typical, and generous — a
# schedule's character can differ between an 8-step distilled run and a 30-step
# one, and a claim written from the 20-step case only is a claim half-checked.
STEP_COUNTS = (8, 20, 30)


def band_of(fraction: float) -> str:
    for name, lo, hi in BANDS:
        if lo < fraction <= hi:
            return name
    return "low"


def probe_templates(templates_dir: Path, sampler_tokens: set[str]) -> list[dict[str, Any]]:
    """Extract the KSampler recipe from every shipped workflow template.

    Two things make this less trivial than it looks, and both bit us:

    - The KSampler is often NOT a top-level node. In `image_krea2_turbo_t2i`
      and `flux1_krea_dev` it lives under `definitions.subgraphs[].nodes`; a
      top-level-only scan finds nothing and reads as "no sampler configured"
      when the template is in fact authoritative.
    - `widgets_values` is a positional list with no names. Rather than hardcode
      an index, locate the sampler token by *value* (it must be a known sampler
      token) and read the rest relative to it: the scheduler is the next string,
      and steps/cfg are the two numbers immediately before.
    """
    rows: list[dict[str, Any]] = []
    for path in sorted(templates_dir.glob("*.json")):
        try:
            doc = json.loads(path.read_text())
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        if not isinstance(doc, dict):
            continue
        for node, container in iter_nodes(doc):
            recipe = recipe_from_widgets(node.get("widgets_values"), sampler_tokens)
            if recipe is None:
                continue
            rows.append(
                {
                    "template": path.name,
                    "node_type": node.get("type"),
                    "container": container,
                    **recipe,
                }
            )
    return rows


def iter_nodes(doc: dict[str, Any]):
    """Yield (node, container) over top-level nodes AND subgraph-nested nodes.

    Every container is type-guarded rather than assumed: the templates
    directory is a grab-bag of graph formats (workflow, API, media manifests),
    and a single `.get()` on the wrong shape kills the whole probe run.
    """
    nodes = doc.get("nodes")
    for node in nodes if isinstance(nodes, list) else []:
        if isinstance(node, dict):
            yield node, "nodes"
    definitions = doc.get("definitions")
    if not isinstance(definitions, dict):
        return
    subgraphs = definitions.get("subgraphs")
    for subgraph in subgraphs if isinstance(subgraphs, list) else []:
        if not isinstance(subgraph, dict):
            continue
        name = subgraph.get("name") or subgraph.get("id") or "?"
        sub_nodes = subgraph.get("nodes")
        for node in sub_nodes if isinstance(sub_nodes, list) else []:
            if isinstance(node, dict):
                yield node, f"definitions.subgraphs[{name}]"


def recipe_from_widgets(widgets: Any, sampler_tokens: set[str]) -> dict[str, Any] | None:
    """Read {sampler, scheduler, steps, cfg} out of a positional widget vector."""
    if not isinstance(widgets, list):
        return None
    idx = next(
        (i for i, v in enumerate(widgets) if isinstance(v, str) and v in sampler_tokens),
        None,
    )
    if idx is None:
        return None
    after = widgets[idx + 1 :]
    scheduler = next((v for v in after if isinstance(v, str)), None)
    numbers = [v for v in widgets[:idx] if isinstance(v, (int, float)) and not isinstance(v, bool)]
    steps, cfg = (numbers[-2], numbers[-1]) if len(numbers) >= 2 else (None, None)
    return {"sampler": widgets[idx], "scheduler": scheduler, "steps": steps, "cfg": cfg}


def probe_tokens(object_info: dict[str, Any], core: dict[str, set[str]]) -> dict[str, Any]:
    """Which tokens the live install offers, from which node classes, and who provides them.

    The provider split falls straight out of a diff: any token a node offers
    that ComfyUI core's own `SAMPLER_NAMES` / `SCHEDULER_HANDLERS` do not
    contain was injected by a custom-node pack. That is how "beta57 ships with
    RES4LYF, not core" becomes a measured fact rather than a remembered one.
    """
    out: dict[str, dict[str, Any]] = {"samplers": {}, "schedulers": {}}
    for class_name, spec in object_info.items():
        if not isinstance(spec, dict):
            continue
        module = spec.get("python_module", "?")
        inputs = spec.get("input") or {}
        for section in ("required", "optional"):
            for widget, definition in (inputs.get(section) or {}).items():
                if widget in SAMPLER_WIDGET_NAMES:
                    kind = "samplers"
                elif widget in SCHEDULER_WIDGET_NAMES:
                    kind = "schedulers"
                else:
                    continue
                options = definition[0] if isinstance(definition, list) and definition else None
                if not isinstance(options, list):
                    continue
                for token in options:
                    if not isinstance(token, str):
                        continue
                    entry = out[kind].setdefault(
                        token,
                        {
                            "provider": "core" if token in core[kind] else "custom",
                            "offered_by": [],
                        },
                    )
                    entry["offered_by"].append({"node": class_name, "module": module})
    for kind in out:
        for entry in out[kind].values():
            entry["offered_by"].sort(key=lambda o: o["node"])
    return out


def probe_schedulers(samplers_mod: Any, model_sampling: Any) -> dict[str, Any]:
    """Measure every registered scheduler: the sigma curve and its band allocation.

    Measured against a plain `ModelSamplingDiscrete()` so every scheduler is
    compared on the same footing. The absolute sigmas are model-dependent; the
    *relative* allocation — which is what corpus prose actually claims — is not.
    """
    out: dict[str, Any] = {}
    for name, handler in sorted(samplers_mod.SCHEDULER_HANDLERS.items()):
        measured: dict[str, Any] = {}
        for steps in STEP_COUNTS:
            try:
                sigmas = [
                    float(s) for s in samplers_mod.calculate_sigmas(model_sampling, name, steps)
                ]
            except Exception as exc:  # a scheduler may reject a step count
                measured[str(steps)] = {"error": f"{type(exc).__name__}: {exc}"}
                continue
            sigma_max = max(sigmas) or 1.0
            bands = {band: 0 for band, _, _ in BANDS}
            # Attribute each step (an interval) to the band of its starting
            # sigma. The trailing 0.0 terminator is an endpoint, not a step.
            for sigma in sigmas[:-1]:
                bands[band_of(sigma / sigma_max)] += 1
            measured[str(steps)] = {
                "sigmas": [round(s, 4) for s in sigmas],
                "sigma_max": round(sigma_max, 4),
                "bands": bands,
            }
        out[name] = {
            "provider": "core" if name in CORE_SCHEDULERS else "custom",
            "use_ms": bool(getattr(handler, "use_ms", True)),
            "measured": measured,
        }
    return out


CORE_SCHEDULERS: set[str] = set()


def load_core_baseline(comfy_root: Path) -> tuple[Any, dict[str, set[str]]]:
    """Import comfy.samplers BEFORE custom nodes, so the core token set is the real one."""
    sys.path.insert(0, str(comfy_root))
    os.chdir(comfy_root)
    import comfy.samplers as samplers_mod

    core = {
        "samplers": set(samplers_mod.SAMPLER_NAMES),
        "schedulers": set(samplers_mod.SCHEDULER_HANDLERS),
    }
    CORE_SCHEDULERS.update(core["schedulers"])
    return samplers_mod, core


def load_custom_nodes() -> None:
    """Run ComfyUI's own custom-node init so pack-registered handlers exist.

    Custom packs register schedulers by mutating `comfy.samplers.SCHEDULER_HANDLERS`
    at import time (RES4LYF: `beta57 = beta_scheduler(alpha=0.5, beta=0.7)`).
    Loading a pack in isolation does not work — ComfyUI's loader wants a live
    PromptServer — so we do exactly what the server does and init them all.
    """
    import nodes
    from server import PromptServer

    PromptServer(asyncio.new_event_loop())
    result = nodes.init_extra_nodes(init_custom_nodes=True)
    if inspect.isawaitable(result):
        asyncio.run(result)


def fetch_object_info(url: str) -> dict[str, Any]:
    with urllib.request.urlopen(f"{url.rstrip('/')}/object_info", timeout=60) as response:
        return json.loads(response.read())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--comfy-root", default="/mnt/sabrent/comfyui-workspace/ComfyUI")
    parser.add_argument(
        "--server",
        default="http://127.0.0.1:8188",
        help="Live ComfyUI URL, for the /object_info token list.",
    )
    parser.add_argument(
        "--templates-dir",
        default=None,
        help="Defaults to the comfyui_workflow_templates_json package in the venv.",
    )
    args = parser.parse_args()

    comfy_root = Path(args.comfy_root).resolve()
    if not (comfy_root / "comfy" / "samplers.py").exists():
        print(f"not a ComfyUI root: {comfy_root}", file=sys.stderr)
        return 2

    # ComfyUI and half the custom-node ecosystem print banners to stdout on
    # import. stdout is our JSON channel, so everything they say is diverted to
    # stderr for the whole probing phase — otherwise the output is unparseable.
    with contextlib.redirect_stdout(sys.stderr):
        # Order matters: core baseline first, custom nodes second. Reversed, the
        # "core" set would already contain the pack-injected tokens and the
        # provider split — the whole provenance signal — would silently vanish.
        samplers_mod, core = load_core_baseline(comfy_root)
        load_custom_nodes()

        try:
            object_info = fetch_object_info(args.server)
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            print(f"could not reach {args.server}: {exc}", file=sys.stderr)
            print("start ComfyUI — the token list comes from /object_info", file=sys.stderr)
            return 3

        tokens = probe_tokens(object_info, core)

        import comfy.model_sampling as model_sampling_mod

        schedulers = probe_schedulers(samplers_mod, model_sampling_mod.ModelSamplingDiscrete())

        if args.templates_dir:
            templates_dir = Path(args.templates_dir)
        else:
            import comfyui_workflow_templates_json as templates_pkg

            templates_dir = Path(templates_pkg.__file__).parent / "templates"

        templates = probe_templates(templates_dir, set(tokens["samplers"]))

    json.dump(
        {
            "_probe": {
                "comfy_root": str(comfy_root),
                "server": args.server,
                "templates_dir": str(templates_dir),
                "bands": {name: [lo, hi] for name, lo, hi in BANDS},
                "step_counts": list(STEP_COUNTS),
            },
            "tokens": tokens,
            "schedulers": schedulers,
            "templates": templates,
        },
        sys.stdout,
        indent=2,
    )
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
