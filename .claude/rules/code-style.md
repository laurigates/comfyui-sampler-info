---
paths:
  - "src/**/*.ts"
---

# Code Style

> **Note (2026-06-06):** ADR-0010 moved the extension from vanilla JS to
> TypeScript. The naming conventions, section-divider, guard-flag, and
> optional-chaining patterns below still apply — but the source is now
> `src/index.ts` (compiled to `web/dist/index.js` via `bun build`), not a
> hand-served single JS file. The "no bundler / no transpilation /
> relative `../../../scripts/app.js` import" parts are superseded: the
> runtime import is the absolute `/scripts/app.js` form, kept unbundled by
> `--external '/scripts/*'`.

Patterns extracted from the implementation in `src/index.ts`.


## Source

- **Commit**: 60a3d1c (2026-05-21); migrated to TS per ADR-0010 (2026-06-06)
- **Type**: feat
- **Confidence**: Medium (explicit in code structure; limited commit history)


## Rule

All extension logic lives in a single module (`src/index.ts`), compiled to
one browser-ESM file (`web/dist/index.js`). The runtime ComfyUI import uses
the absolute served-path form (`import { app } from "/scripts/app.js"`),
kept unbundled at build time.


## Naming Conventions

| Kind | Convention | Example |
|------|-----------|---------|
| Module-level constants | `UPPER_SNAKE_CASE` | `EXT_NAME`, `DATA_BASE`, `DIALOG_ID` |
| Functions | `camelCase` | `loadCorpus()`, `buildRowEl()`, `enhanceNode()` |
| Widget-patch guard flags | `_samplerInfo<PurposePascalCase>` | `_samplerInfoPatched`, `_samplerInfoPointerPatched` |
| CSS class prefix | `si-` (BEM-like, kebab) | `.si-row`, `.si-badge-year`, `.si-active` |


## Do

```js
// Module-level constants — uppercase
const EXT_NAME = "comfyui-sampler-info";
const DATA_BASE = `/extensions/${EXT_NAME}/data`;
const SAMPLER_WIDGET_NAMES = new Set(["sampler_name", "sampler"]);

// Section dividers for logical grouping
// ============================================================
// Corpus loading
// ============================================================

// Guard flags on widget objects to prevent double-patching
if (!w._samplerInfoPatched) {
    w._samplerInfoPatched = true;
    // patch logic...
}

// Optional chaining throughout — never assume properties exist
const graph = app?.graph;
if (!graph?._nodes) return;
```


## Don't

```js
// Don't use bundler-style imports or npm packages
import _ from 'lodash';               // no — no node_modules
import { ref } from 'vue';            // no — don't import from comfyui_frontend_package

// Don't use var
var corpus = {};                       // no — use const/let

// Don't mix CSS into separate files; keep the CSS constant inline in the JS file
// (the injected <style> tag approach)
```


## CSS Embedded in JS

CSS is stored in the `CSS` template-literal constant and injected via `ensureStyle()` → `document.createElement("style")`. All selectors are scoped to `#${DIALOG_ID}` to avoid polluting the global ComfyUI stylesheet.


## File Structure Order

1. Imports
2. Module-level constants (`EXT_NAME`, IDs, widget-name Sets)
3. Mutable module state (`SAMPLERS`, `SCHEDULERS`, `CORPUS_LOADED`, `PICKER_STATE`)
4. Section blocks separated by `// ===...===` dividers:
   - Corpus loading
   - Option A (tooltip rewrite)
   - Option B (picker dialog) — CSS constant, then DOM-builder functions, then state/event logic
   - Fuzzy search
   - Wiring (`enhanceNode`, `refreshAllNodes`, `app.registerExtension`)


## Supersedes

None

---

*Derived from git history via /blueprint:derive-rules*
