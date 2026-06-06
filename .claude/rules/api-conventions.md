---
paths:
  - "src/**/*.ts"
---

# ComfyUI API Conventions

How this extension wires into the ComfyUI frontend — `app.registerExtension`, widget hooks, and corpus fetch pattern.


## Source

- **Commit**: 60a3d1c (2026-05-21)
- **Type**: feat
- **Confidence**: High (the entire architecture is built around these APIs; explicit in CLAUDE.md hard rules)


## Rule

Use only the documented `app.registerExtension` API and `widget.*` hooks. Never import from `comfyui_frontend_package` internal modules — the pack must work against any compatible frontend version.


## Extension Registration

```js
app.registerExtension({
    name: "comfy.sampler-info",        // namespaced: "comfy.<pack-name>"
    async setup() {
        await loadCorpus();
        refreshAllNodes();
    },
    async nodeCreated(node) {
        enhanceNode(node);
    },
    async loadedGraphNode(node) {
        enhanceNode(node);
    },
});
```

Always handle all three lifecycle hooks (`setup`, `nodeCreated`, `loadedGraphNode`) so the extension applies to existing graph nodes on load as well as freshly created ones.


## Widget Detection

Detect target widgets **by `widget.name`**, not by node type (see ADR-0008). This makes the extension generic — it works on `KSampler.sampler_name`, `easy kSampler.sampler_name`, and any other node that happens to expose a widget with that name.

```js
// Do — name-based detection
const SAMPLER_WIDGET_NAMES = new Set(["sampler_name", "sampler"]);
const SCHEDULER_WIDGET_NAMES = new Set(["scheduler"]);

function enhanceNode(node) {
    if (!node?.widgets) return;
    for (const w of node.widgets) {
        const matches =
            SAMPLER_WIDGET_NAMES.has(w.name) || SCHEDULER_WIDGET_NAMES.has(w.name);
        if (!matches) continue;
        // enhance...
    }
}

// Don't — node-type-based detection
if (node.type === "KSampler") { ... }   // too narrow; misses custom nodes
```


## Widget Patching Pattern

Wrap existing widget callbacks rather than replacing them. Always chain to the original:

```js
// Save and chain original callback
const origCb = w.callback;
w.callback = function (value, ...rest) {
    const r = origCb ? origCb.call(this, value, ...rest) : undefined;
    // extension logic...
    return r;
};

// Same for onPointerDown — return truthy only when consuming the event
const origDown = w.onPointerDown;
w.onPointerDown = function (pointer, ownerNode, canvas) {
    if (typeof origDown === "function") {
        const consumed = origDown.call(this, pointer, ownerNode, canvas);
        if (consumed) return consumed;
    }
    openPicker(w, ownerNode || node);
    return true;   // consume — prevents native dropdown
};
```


## Touch-Friendly Modal Dismiss

When opening a full-viewport overlay from a touch-originated `onPointerDown`, wire backdrop dismiss to **`pointerdown`**, not `click`. The synthesized `click` event that follows `touchend` (~300 ms later on iOS Safari) lands on the topmost element under the original tap coordinates — which is the just-mounted backdrop — and would immediately re-close the overlay.

```js
// Do — pointerdown is not re-synthesized after touchend
backdrop.addEventListener("pointerdown", dismissPicker);

// Don't — synthesized click after the opening tap dismisses immediately
backdrop.addEventListener("click", dismissPicker);   // BUG on touch
```

Desktop is unaffected because real mouse `click` doesn't fire across mismatched `mousedown`/`mouseup` targets (the canvas mousedown, the backdrop mouseup → no click on either).

Also set `touch-action: manipulation` on backdrop and dialog to suppress iOS double-tap zoom inside the modal:

```css
#dialog-backdrop, #dialog {
    touch-action: manipulation;
}
```

**Source**: commit `4249353` (2026-05-22) — `fix(picker): use pointerdown not click for backdrop dismiss`.


## Corpus Data Fetch

Static JSON is fetched via the known extension URL path, not bundled into the JS:

```js
const EXT_NAME = "comfyui-sampler-info";
const DATA_BASE = `/extensions/${EXT_NAME}/data`;

// Always use { cache: "no-cache" } during dev — avoids stale corpus on hard-refresh
fetch(`${DATA_BASE}/samplers.json`, { cache: "no-cache" })
```

**Important**: `EXT_NAME` must match the directory name of the pack as installed in ComfyUI's `custom_nodes/` folder. If the directory name ever changes, update `EXT_NAME` — the URL segment is derived from it.


## Corpus Lookup Order

```
exact[token]  →  first matching prefix[]  →  null
```

Always use `exact` before `prefix`. Within `prefix`, first match wins — place more-specific patterns earlier in the array.


## Supersedes

None

---

*Derived from git history via /blueprint:derive-rules*
