# Testing Requirements

## Syntax Validation

Run before every commit:

```sh
# JavaScript syntax check
node --check web/js/sampler-info.js

# JSON corpus validation
python -c "import json; [json.load(open(f)) for f in ['web/data/samplers.json','web/data/schedulers.json']]"
```

## Live Smoke Matrix

After non-trivial picker changes, verify in browser:

| Widget | Expected |
|--------|----------|
| `KSampler.sampler_name` | Picker opens; rows have full metadata + badges |
| `KSampler.scheduler` | Picker opens; rows have scheduler corpus |
| `WanVideoSampler.scheduler` | Picker opens; rows are bare names (no corpus match — additive ok) |
| `easy kSampler.sampler_name` | Picker opens (generic widget name detection) |

Keyboard navigation: Up, Down, PgUp, PgDn, Enter, Esc; type anywhere to filter; Backspace from anywhere.

## Server Reachability

```sh
curl -s -o /dev/null -w "%{http_code}\n" \
  http://127.0.0.1:8188/extensions/comfyui-sampler-info/js/sampler-info.js
# Expected: 200
```

## Tooltip Path (Option A)

- Verify `widget.options.tooltip` is set after widget value change when corpus has a match.
- Verify tooltip is **not** overwritten when corpus returns `null` (Wan / Hunyuan / LTX widgets).

## Corpus Accuracy

- Do not add speculative data. Mark uncertain years as `null`; uncertain summaries with `"notes": "verify"`.
- Lookup order: `exact` wins over `prefix`. Within `prefix`, first match wins (put more-specific patterns earlier).

## Debugging

If the picker stops opening:
1. Check browser devtools console for `comfyui-sampler-info` warnings.
2. Verify the `onPointerDown` hook still exists in the frontend bundle:

```sh
grep -oE 'processWidgetClick\(e[^)]*\)\{[^}]{0,400}' \
  .venv/lib/python3.10/site-packages/comfyui_frontend_package/static/assets/api-*.js \
  | head -1
```
