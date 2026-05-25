# Screenshot generator

Containerized Playwright driver that produces the README's two PNGs:

| File | What it shows |
|---|---|
| `docs/picker.png` | Picker dialog with `dpm sde` typed — filtered rows + matched-char highlighting + badges |
| `docs/tooltip.png` | The pack's tooltip text rendered next to a mock widget (see "Tooltip approach" below) |

## Regenerating

From the repository root:

```sh
just screenshots
```

That builds `screenshots/Dockerfile` and runs the resulting image with
`-v $(pwd)/docs:/out` so the generated PNGs land in `docs/`. The first
build takes ~4 minutes (downloads CPU torch + Chromium); subsequent
builds rebuild in ~30s when only the capture script or workflow change.

## Pins

| Component | Pin | Notes |
|---|---|---|
| ComfyUI | `COMFYUI_REF=v0.22.0` (Dockerfile `ARG`) | The frontend bundle that ships with this release is the one being screenshotted. Bumping changes font rendering and is a deliberate act. |
| Playwright | `playwright@1.49.1` (`package.json`) | Playwright bundles a specific Chromium revision; pinning the package pins the browser. |
| Chromium flags | `--font-render-hinting=none` | Removes a common source of cross-host rendering drift. |
| Viewport | `1280x800` @ `deviceScaleFactor: 2` | Fixed in `capture.mjs`. |

The first-pass goal is "re-runs without source changes produce byte-
identical PNGs on the same host." Cross-host parity is not guaranteed
— rebuild on the same host that originally produced the committed
PNGs when you regenerate.

## Tooltip approach

The plan originally called for capturing LiteGraph's native canvas-
painted hover tooltip. In practice, driving that headlessly is
fragile: the hover state depends on canvas-local mouse coords, the
Vue layout shifts the canvas position, devicePixelRatio interacts
with the click target, and the tooltip is painted into the canvas
on the next frame rather than as a DOM element you can wait for.

So `capture.mjs` does this instead:

1. **Picker** — opens via direct `widget.onPointerDown(...)` call
   from `page.evaluate`, exercising the pack's real intercept code
   path. The dialog is a regular DOM element, so the screenshot is
   pixel-for-pixel what a user sees.
2. **Tooltip** — reads `widget.options.tooltip` (the exact string
   LiteGraph would paint) and renders it as an HTML overlay
   alongside a mock widget label. The text is identical to what
   the user sees on hover; the surrounding presentation is a
   neutral stand-in for ComfyUI's canvas chrome.

If you want a faithful canvas-painted version instead, the path is:
extend `capture.mjs` to send a `mousemove` event to `canvas#graph-canvas`
at the computed widget coords, wait for LiteGraph's hover timer
(~700ms), then screenshot the canvas. Expect to spend an hour
tuning the coord mapping for the current frontend version.

## Troubleshooting

### Picker doesn't open

`capture.mjs` invokes `widget.onPointerDown(...)` directly, so the
hook itself fires regardless of canvas coord drift. If the picker
dialog never appears, the most likely cause is the pack's intercept
not running:

- `_samplerInfoPointerPatched` never set → the script's
  `waitForFunction` for it times out. Inspect the page in a real
  browser to see why `enhanceNode` didn't patch:

  ```sh
  docker run --rm -it -p 8188:8188 --entrypoint bash \
      comfyui-sampler-info-screenshots
  # inside the container:
  /opt/screenshots/entrypoint.sh   # or just `python main.py --cpu --listen 0.0.0.0`
  ```

  Then open `http://localhost:8188/` in a real browser and check
  devtools for `[comfyui-sampler-info]` warnings.

- Hook name changed upstream — confirm with:

  ```sh
  grep -oE 'processWidgetClick\(e[^)]*\)\{[^}]{0,400}' \
    /opt/ComfyUI/web/extensions/comfyui-frontend-package/static/assets/api-*.js \
    | head -1
  ```

  If `onPointerDown` is no longer the hook the frontend calls,
  update the intercept in `web/js/sampler-info.js:enhanceNode()`
  first, then regenerate.

### "ComfyUI did not become ready" timeout

`entrypoint.sh` tails the last 200 lines of `/tmp/comfyui.log` when
the readiness probe fails. Common causes:

- A new ComfyUI release added a required runtime dependency not in
  `requirements.txt`. Bump `COMFYUI_REF` to a tagged release that
  matches what `pip install -r requirements.txt` actually pulls.
- A model is required at startup. This shouldn't happen with the
  default `--cpu` mode; if it does, surface the warning and consider
  disabling the relevant subsystem with a flag.

### Tooltip screenshot is blank

The HTML overlay reads `widget.options.tooltip`. If that's not set,
the pack's `refreshWidgetTooltip` either didn't run or returned
early (the additive rule: no corpus match → no tooltip write). For
the workflow this script loads, `sampler_name=dpmpp_2m` should
have an `exact` corpus entry — if it doesn't, the corpus is the
issue, not the screenshot script.

## Layout

| Path | Purpose |
|---|---|
| `Dockerfile` | Multi-stage build: ComfyUI + CPU torch → + Node 22 + Playwright + Chromium |
| `entrypoint.sh` | Launches ComfyUI, waits for `/system_stats`, runs `capture.mjs` |
| `capture.mjs` | Playwright driver (single-file ESM) — loads workflow, clicks widget, screenshots picker + tooltip |
| `workflow.json` | Single-`KSampler`-node workflow at a fixed position |
| `package.json` | Pins `playwright` (the only npm dependency) |
| `.dockerignore` | Keeps the build context lean — excludes `docs/`, `.git/`, `tests/`, etc. |
