"""Sampler info tooltips for ComfyUI.

Frontend-only pack: no Python nodes. Rewrites the `tooltip` on every
combo widget named `sampler_name` / `sampler` / `scheduler` to a
metadata-derived description (paper year, family, ODE order, what
it's good for, schedulers it pairs with).

LiteGraph surfaces the tooltip on desktop hover. comfyui-touch-tooltips
surfaces it on long-press.

Corpus lives in `web/data/samplers.json` + `web/data/schedulers.json`
so it can grow without code changes.

The TypeScript source in `src/` is compiled to ESM via `bun build` and
emitted to `web/dist/` (the corpus JSON is copied there too). ComfyUI
serves `WEB_DIRECTORY` as the extension root. See ADR-0010.
"""

WEB_DIRECTORY = "./web/dist"

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
