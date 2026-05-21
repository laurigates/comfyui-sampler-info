# Error Handling

Patterns for graceful degradation in the ComfyUI frontend context — where failures must not crash the host application.


## Source

- **Commit**: 60a3d1c (2026-05-21)
- **Type**: feat
- **Confidence**: Medium (consistent pattern throughout the ~900-line JS file)


## Rule

All potentially-failing operations are wrapped in try/catch with `console.warn` prefixed by `[${EXT_NAME}]`. Functions use early-return null guards rather than nested conditionals. Optional chaining (`?.`) is used throughout for DOM and API property access.


## Examples


### Do

```js
// Prefix all warnings with the extension name so they're filterable in devtools
function safeRegex(pattern) {
    try {
        return new RegExp(pattern);
    } catch (e) {
        console.warn(`[${EXT_NAME}] bad regex in corpus: ${pattern}`, e);
        return null;
    }
}

// Early return null guards — keep the happy path unindented
function lookup(corpus, token) {
    if (!token || typeof token !== "string") return null;
    if (corpus.exact[token]) return corpus.exact[token];
    for (const p of corpus.prefix) {
        if (p.re.test(token)) return p;
    }
    return null;
}

// Guard flag prevents double-patching in case enhanceNode is called twice
if (!w._samplerInfoPatched) {
    w._samplerInfoPatched = true;
    // patch...
}

// Optional chaining for host API properties that may not exist
const graph = app?.graph;
if (!graph?._nodes) return;

// Wrap extension logic inside existing callbacks so errors don't break the original
w.callback = function (value, ...rest) {
    const r = origCb ? origCb.call(this, value, ...rest) : undefined;
    try {
        refreshWidgetTooltip(w);
    } catch (e) {
        console.warn(`[${EXT_NAME}] tooltip refresh failed`, e);
    }
    return r;
};
```


### Don't

```js
// Don't let errors propagate uncaught — they crash the ComfyUI console with noise
w.callback = function (value) {
    refreshWidgetTooltip(w);   // throws uncaught if corpus not loaded → bad UX
};

// Don't use console.error for expected / non-fatal degradation
console.error("corpus not loaded");   // use console.warn instead

// Don't skip the extension-name prefix — makes filtering impossible
console.warn("bad regex", e);   // prefer `[comfyui-sampler-info] bad regex`
```


## Additive Degradation

When the corpus has no entry for a token, the function returns `null` and the caller returns early — leaving the widget's existing tooltip unchanged. This is the "additive rule" and must be preserved in all code paths touching `widget.options.tooltip`.

```js
function refreshWidgetTooltip(widget) {
    if (!CORPUS_LOADED) return;           // guard: corpus not ready yet
    const info = lookup(widgetCorpus(widget), widget.value);
    if (!info) return;                    // guard: no corpus match — leave tooltip alone
    // ...write tooltip only when we have real data
}
```


## Supersedes

None

---

*Derived from git history via /blueprint:derive-rules*
