// node_modules/@laurigates/comfy-modal-kit/dist/index.js
var KEY = Symbol.for("laurigates.comfyModalKit");
function getKit() {
  const g = globalThis;
  let kit = g[KEY];
  if (!kit) {
    kit = { fieldProviders: [], activeModal: null, pointerClaim: null };
    g[KEY] = kit;
  }
  return kit;
}
function registerFieldProvider(provider) {
  const list = getKit().fieldProviders;
  const i = list.findIndex((p) => p.id === provider.id);
  if (i >= 0) {
    list.splice(i, 1, provider);
  } else {
    list.push(provider);
  }
}
function ensureStyleOnce(id, css) {
  if (typeof document === "undefined")
    return;
  if (document.getElementById(id))
    return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = css;
  document.head.appendChild(s);
}
var STYLE_ID = "cmn-notify-style";
var CONTAINER_ID = "cmn-notify-container";
function defaultLife(severity) {
  switch (severity) {
    case "error":
      return 0;
    case "warn":
      return 8000;
    default:
      return 4000;
  }
}
function defaultCopyable(severity) {
  return severity === "error" || severity === "warn";
}
function notifyClipboardText(summary, detail) {
  return detail ? `${summary}
${detail}` : summary;
}
async function copyTextToClipboard(text) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    if (typeof document === "undefined")
      return false;
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
var CSS = `
.cmn-container {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(380px, calc(100vw - 24px));
    pointer-events: none;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}
.cmn-toast {
    pointer-events: auto;
    background: #1a1a1f;
    color: #e8e8ea;
    border: 1px solid #3a3a44;
    border-left-width: 4px;
    border-radius: 8px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.6);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
    line-height: 1.4;
    animation: cmn-in 0.16s ease-out;
}
@keyframes cmn-in {
    from { transform: translateY(-8px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
}
.cmn-toast.cmn-success { border-left-color: #4caf50; }
.cmn-toast.cmn-info    { border-left-color: #6ba6ff; }
.cmn-toast.cmn-warn    { border-left-color: #e0a83a; }
.cmn-toast.cmn-error   { border-left-color: #e0533a; }
.cmn-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}
.cmn-text {
    flex: 1;
    min-width: 0;
    word-break: break-word;
}
.cmn-summary { font-weight: 600; }
.cmn-detail  { color: #b8b8c0; margin-top: 2px; white-space: pre-wrap; }
.cmn-close {
    background: transparent;
    color: #aaa;
    border: none;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
}
.cmn-close:hover { color: #fff; }
.cmn-actions { display: flex; gap: 8px; }
.cmn-copy {
    background: #2a2a36;
    color: #d8d8e0;
    border: 1px solid #3a3a44;
    border-radius: 5px;
    /* Touch-first: comfortable tap target, 13px text. */
    min-height: 32px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.cmn-copy:hover  { background: #34343f; color: #fff; }
.cmn-copy.cmn-copied { background: #2f4a30; border-color: #4caf50; color: #cfe8d0; }
`;
function ensureContainer() {
  let c = document.getElementById(CONTAINER_ID);
  if (!c) {
    c = document.createElement("div");
    c.id = CONTAINER_ID;
    c.className = "cmn-container";
    document.body.appendChild(c);
  }
  return c;
}
function notify(opts) {
  const { severity, summary, detail } = opts;
  if (typeof document === "undefined" || !document.body) {
    console.info(`[notify] ${severity}: ${summary}${detail ? ` — ${detail}` : ""}`);
    return null;
  }
  ensureStyleOnce(STYLE_ID, CSS);
  const container = ensureContainer();
  const life = opts.life ?? defaultLife(severity);
  const copyable = opts.copyable ?? defaultCopyable(severity);
  const toast = document.createElement("div");
  toast.className = `cmn-toast cmn-${severity}`;
  toast.setAttribute("role", severity === "error" ? "alert" : "status");
  let timer;
  const close = () => {
    if (timer)
      clearTimeout(timer);
    toast.remove();
    if (container.childElementCount === 0)
      container.remove();
  };
  const row = document.createElement("div");
  row.className = "cmn-row";
  const text = document.createElement("div");
  text.className = "cmn-text";
  const summaryEl = document.createElement("div");
  summaryEl.className = "cmn-summary";
  summaryEl.textContent = summary;
  text.appendChild(summaryEl);
  if (detail) {
    const detailEl = document.createElement("div");
    detailEl.className = "cmn-detail";
    detailEl.textContent = detail;
    text.appendChild(detailEl);
  }
  const closeBtn = document.createElement("button");
  closeBtn.className = "cmn-close";
  closeBtn.type = "button";
  closeBtn.textContent = "×";
  closeBtn.title = "Dismiss";
  closeBtn.addEventListener("click", close);
  row.append(text, closeBtn);
  toast.appendChild(row);
  if (copyable) {
    const actions = document.createElement("div");
    actions.className = "cmn-actions";
    const copyBtn = document.createElement("button");
    copyBtn.className = "cmn-copy";
    copyBtn.type = "button";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", async () => {
      const ok = await copyTextToClipboard(notifyClipboardText(summary, detail));
      copyBtn.textContent = ok ? "Copied ✓" : "Copy failed";
      copyBtn.classList.toggle("cmn-copied", ok);
      setTimeout(() => {
        copyBtn.textContent = "Copy";
        copyBtn.classList.remove("cmn-copied");
      }, 1500);
    });
    actions.appendChild(copyBtn);
    toast.appendChild(actions);
  }
  container.appendChild(toast);
  if (life > 0) {
    timer = setTimeout(close, life);
  }
  return { close, el: toast };
}
var guardInstalled = false;
function setActiveModal(handle) {
  installPointerGuard();
  dismissActiveModal();
  getKit().activeModal = handle;
}
function dismissActiveModal() {
  const kit = getKit();
  const active = kit.activeModal;
  if (!active)
    return;
  kit.activeModal = null;
  try {
    active.close();
  } catch (e) {
    console.warn("[comfy-modal-kit] active modal close() threw", e);
  }
}
function isModalActive() {
  return getKit().activeModal !== null;
}
function patchWidgetPointer(widget, opener) {
  const original = widget.onPointerDown;
  function patched(pointer, node, canvas) {
    try {
      if (typeof original === "function") {
        const consumed = original.call(this, pointer, node, canvas);
        if (consumed)
          return consumed;
      }
      return opener(pointer, node, canvas);
    } catch (e) {
      console.warn("[comfy-modal-kit] patched onPointerDown threw", e);
      return false;
    }
  }
  widget.onPointerDown = patched;
  return {
    restore() {
      widget.onPointerDown = original;
    }
  };
}
function installPointerGuard() {
  if (guardInstalled)
    return;
  if (typeof window === "undefined")
    return;
  guardInstalled = true;
  window.addEventListener("pointerdown", pointerGuard, true);
}
function pointerGuard(e) {
  const active = getKit().activeModal;
  if (!active)
    return;
  const target = e.target;
  if (active.element && target && active.element.contains(target)) {
    return;
  }
  e.stopImmediatePropagation();
  dismissActiveModal();
}
function fuzzyScore(query, target) {
  if (!query)
    return { score: 0, matches: [] };
  if (!target)
    return null;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const matches = [];
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  let prevMatchIdx = -1;
  for (let ti = 0;ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) {
      consecutive = 0;
      continue;
    }
    let charScore = 1;
    if (ti === 0) {
      charScore += 5;
    } else {
      const prev = t[ti - 1];
      const orig = target[ti];
      if (prev === "_" || prev === "-" || prev === " " || prev === "." || prev === "/") {
        charScore += 4;
      } else if (prev !== undefined && prev >= "a" && prev <= "z" && orig !== undefined && orig >= "A" && orig <= "Z") {
        charScore += 3;
      }
    }
    if (ti === prevMatchIdx + 1) {
      consecutive++;
      charScore += consecutive * 2;
    } else {
      consecutive = 0;
    }
    score += charScore;
    matches.push(ti);
    prevMatchIdx = ti;
    qi++;
  }
  if (qi < q.length)
    return null;
  score -= target.length * 0.01;
  return { score, matches };
}
function fuzzyRank(query, fields, primaryWeight = 10) {
  if (!query)
    return { score: 0, primaryMatches: [] };
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!tokens.length)
    return { score: 0, primaryMatches: [] };
  const primary = fields[0] || "";
  const rest = fields.slice(1).filter((f) => Boolean(f));
  let totalScore = 0;
  const primaryMatchSet = new Set;
  for (const token of tokens) {
    const primaryResult = fuzzyScore(token, primary);
    let best = primaryResult ? {
      score: primaryResult.score * primaryWeight,
      matches: primaryResult.matches,
      onPrimary: true
    } : null;
    for (const field of rest) {
      const r = fuzzyScore(token, field);
      if (r && (!best || r.score > best.score)) {
        best = { score: r.score, matches: r.matches, onPrimary: false };
      }
    }
    if (!best)
      return null;
    totalScore += best.score;
    if (best.onPrimary) {
      for (const i of best.matches)
        primaryMatchSet.add(i);
    }
  }
  return {
    score: totalScore,
    primaryMatches: [...primaryMatchSet].sort((a, b) => a - b)
  };
}
function highlightMatches(target, matchIndices) {
  const frag = document.createDocumentFragment();
  if (!target)
    return frag;
  const set = new Set(matchIndices || []);
  if (!set.size) {
    frag.appendChild(document.createTextNode(target));
    return frag;
  }
  for (let i = 0;i < target.length; i++) {
    const ch = target[i];
    if (set.has(i)) {
      const m = document.createElement("span");
      m.className = "cmp-match";
      m.textContent = ch;
      frag.appendChild(m);
    } else {
      frag.appendChild(document.createTextNode(ch));
    }
  }
  return frag;
}

// src/index.ts
import { app } from "/scripts/app.js";
var EXT_NAME = "comfyui-sampler-info";
var DATA_BASE = `/extensions/${EXT_NAME}/data`;
var SAMPLER_WIDGET_NAMES = new Set(["sampler_name", "sampler"]);
var SCHEDULER_WIDGET_NAMES = new Set(["scheduler"]);
var STYLE_ID2 = "sampler-info-style";
var DIALOG_ID = "sampler-info-dialog";
var NAME_WEIGHT = 10;
var INLINE_ROW_CAP = 10;
var SAMPLERS = { exact: {}, prefix: [], alias: {} };
var SCHEDULERS = { exact: {}, prefix: [], alias: {} };
var CORPUS_LOADED = false;
async function loadCorpus() {
  try {
    const [s, sc] = await Promise.all([
      fetch(`${DATA_BASE}/samplers.json`, { cache: "no-cache" }).then((r) => r.json()),
      fetch(`${DATA_BASE}/schedulers.json`, { cache: "no-cache" }).then((r) => r.json())
    ]);
    SAMPLERS = compileCorpus(s);
    SCHEDULERS = compileCorpus(sc);
    CORPUS_LOADED = true;
  } catch (e) {
    console.warn(`[${EXT_NAME}] corpus load failed:`, e);
    notify({
      severity: "warn",
      summary: "Sampler-info corpus failed to load",
      detail: String(e)
    });
  }
}
function compileCorpus(raw) {
  const prefix = (raw?.prefix || []).map((p) => ({ ...p, re: safeRegex(p.match) })).filter((p) => p.re !== null);
  return { exact: raw?.exact || {}, prefix, alias: raw?.alias || {} };
}
function resolveAlias(canonical, target) {
  const note = `Alias of \`${canonical}\` — same algorithm, different naming scheme.`;
  return { ...target, notes: target.notes ? `${note} ${target.notes}` : note };
}
function safeRegex(pattern) {
  try {
    return new RegExp(pattern);
  } catch (e) {
    console.warn(`[${EXT_NAME}] bad regex in corpus: ${pattern}`, e);
    return null;
  }
}
function lookup(corpus, token) {
  if (!token || typeof token !== "string")
    return null;
  const exact = corpus.exact[token];
  if (exact)
    return exact;
  const canonical = corpus.alias[token];
  if (canonical) {
    const target = corpus.exact[canonical];
    if (target)
      return resolveAlias(canonical, target);
  }
  for (const p of corpus.prefix) {
    if (p.re.test(token))
      return p;
  }
  return null;
}
function formatSamplerTooltip(token, info) {
  const headerBits = [token];
  if (info.order !== undefined && info.order !== null)
    headerBits.push(`order ${info.order}`);
  if (info.type)
    headerBits.push(info.type);
  if (info.year)
    headerBits.push(`${info.year}`);
  if (info.family)
    headerBits.push(info.family);
  const lines = [headerBits.join(" · "), ""];
  if (info.summary)
    lines.push(info.summary);
  if (info.good_for)
    lines.push("", `Good for: ${info.good_for}`);
  if (Array.isArray(info.pairs_with) && info.pairs_with.length) {
    lines.push(`Pairs with: ${info.pairs_with.join(", ")}`);
  }
  if (info.supersedes_by)
    lines.push(`Largely superseded by: ${info.supersedes_by}`);
  if (info.notes)
    lines.push("", `Note: ${info.notes}`);
  return lines.join(`
`);
}
function formatSchedulerTooltip(token, info) {
  const headerBits = [token];
  if (info.year)
    headerBits.push(`${info.year}`);
  const lines = [headerBits.join(" · "), ""];
  if (info.summary)
    lines.push(info.summary);
  if (info.good_for)
    lines.push("", `Good for: ${info.good_for}`);
  if (info.notes)
    lines.push("", `Note: ${info.notes}`);
  return lines.join(`
`);
}
function isSchedulerName(name) {
  return typeof name === "string" && SCHEDULER_WIDGET_NAMES.has(name);
}
function isSchedulerWidget(widget) {
  return isSchedulerName(widget.name);
}
function widgetCorpus(widget) {
  return isSchedulerWidget(widget) ? SCHEDULERS : SAMPLERS;
}
function refreshWidgetTooltip(widget) {
  if (!CORPUS_LOADED)
    return;
  const fmt = isSchedulerWidget(widget) ? formatSchedulerTooltip : formatSamplerTooltip;
  const info = lookup(widgetCorpus(widget), widget.value);
  if (!info)
    return;
  const tip = fmt(String(widget.value), info);
  widget.options = widget.options || {};
  widget._samplerInfoOriginalTooltip ??= widget.options.tooltip;
  widget.options.tooltip = tip;
  widget.tooltip = tip;
}
var CSS2 = `
#${DIALOG_ID}-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 9998;
    backdrop-filter: blur(2px);
    touch-action: manipulation;
}
#${DIALOG_ID} {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 9999;
    width: min(720px, calc(100vw - 32px));
    max-height: min(80vh, 720px);
    touch-action: manipulation;
    display: flex;
    flex-direction: column;
    background: #1a1a1f;
    color: #e8e8ea;
    border: 1px solid #3a3a44;
    border-radius: 10px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 13px;
    overflow: hidden;
}
#${DIALOG_ID} .si-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid #2a2a32;
    background: #21212a;
    flex-shrink: 0;
}
#${DIALOG_ID} .si-title {
    flex: 1;
    font-weight: 600;
    color: #9ec6ff;
    font-size: 14px;
}
#${DIALOG_ID} .si-widgetname {
    color: #888;
    font-weight: 400;
    font-size: 12px;
    margin-left: 6px;
}
#${DIALOG_ID} .si-close {
    background: transparent;
    color: #aaa;
    border: 1px solid #3a3a44;
    border-radius: 4px;
    width: 36px;
    height: 36px;
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
    flex-shrink: 0;
}
#${DIALOG_ID} .si-close:hover {
    background: #2a2a32;
    color: #fff;
}
/* The picker body is scoped to .si-picker (not #dialog) so the same markup
   works mounted inline in the field editor and inside the on-canvas modal. */
.si-picker {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
    color: #e8e8ea;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 13px;
}
.si-picker .si-searchrow {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid #2a2a32;
    flex-shrink: 0;
}
.si-picker .si-search {
    flex: 1;
    background: #12121a;
    border: 1px solid #3a3a44;
    border-radius: 4px;
    color: #e8e8ea;
    padding: 8px 12px;
    /* 16px on the input prevents iOS auto-zoom-on-focus. */
    font-size: 16px;
    font-family: inherit;
    outline: none;
    min-width: 0;
}
.si-picker .si-search:focus {
    border-color: #6ba6ff;
}
.si-picker .si-count {
    color: #888;
    font-size: 12px;
    white-space: nowrap;
}
.si-picker .si-list {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 4px 0;
    min-height: 0;
}
.si-picker .si-row {
    padding: 8px 14px;
    cursor: pointer;
    border-left: 3px solid transparent;
    border-bottom: 1px solid #22222a;
}
.si-picker .si-row:last-child {
    border-bottom: none;
}
.si-picker .si-row:hover,
.si-picker .si-row.si-active {
    background: #2a2a36;
    border-left-color: #6ba6ff;
}
.si-picker .si-row.si-current {
    background: #1f2a1f;
    border-left-color: #6bff8e;
}
.si-picker .si-row.si-current.si-active {
    background: #243524;
}
.si-picker .si-row-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 3px;
}
.si-picker .si-name {
    font-weight: 600;
    color: #e8e8ea;
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 13px;
}
.si-picker .si-row.si-current .si-name::after {
    content: " · current";
    color: #6bff8e;
    font-weight: 400;
    font-family: system-ui, sans-serif;
    font-size: 11px;
}
/* Matched characters — the kit's highlightMatches() wraps them in
   <span class="cmp-match">. Style that class here so the highlight renders
   whether the list is inline or in the modal. */
.si-picker .cmp-match {
    color: #ffd866;
    font-weight: 700;
    text-shadow: 0 0 1px rgba(255, 216, 102, 0.5);
}
.si-picker .si-badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10.5px;
    line-height: 1.5;
    background: #2a2a36;
    color: #b8b8c0;
    font-family: system-ui, sans-serif;
    border: 1px solid #3a3a44;
}
.si-picker .si-badge-year { color: #d8c878; border-color: #4a3e2a; }
.si-picker .si-badge-family { color: #c8a8ff; border-color: #3a2e4a; }
.si-picker .si-badge-order { color: #9ec6ff; border-color: #2a3a4a; }
.si-picker .si-badge-type { color: #b8c8a8; border-color: #2e3a2a; }
.si-picker .si-summary {
    color: #b8b8c0;
    font-size: 12px;
    line-height: 1.4;
}
.si-picker .si-meta {
    color: #888;
    font-size: 11px;
    margin-top: 3px;
    line-height: 1.4;
}
.si-picker .si-meta strong { color: #aaa; font-weight: 600; }
.si-picker .si-nodata {
    color: #888;
    font-size: 12px;
    font-style: italic;
}
.si-picker .si-empty {
    padding: 40px 14px;
    text-align: center;
    color: #777;
    font-style: italic;
}
/* Inline mount (comfy-modal-kit field provider): the host shell's .cmp-body is
   the single scroll region. Mounted inline the parent chain has no definite
   height, so .si-list's flex:1 + min-height:0 never resolve — it would capture
   the touch gesture with nothing to scroll, and overscroll-behavior:contain
   would stop the gesture chaining back out to .cmp-body. Same bug as the
   .pe-wrap nested scroller fixed in comfyui-prompt-editor d39feca. The list is
   therefore a plain block that grows to its content height (row capping, not
   scrolling, keeps it short — see INLINE_ROW_CAP).

   NOTE ON SPECIFICITY: .si-picker--inline .si-list ties with the base
   .si-picker .si-list (0,2,0), so this block MUST stay after it in the
   stylesheet — source order is what makes it win. Don't reorder. */
.si-picker--inline .si-list {
    flex: none;
    min-height: auto;
    overflow-y: visible;
    -webkit-overflow-scrolling: auto;
    overscroll-behavior: auto;
}
.si-picker--inline .si-more {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 14px;
    color: #888;
    font-size: 12px;
}
.si-picker--inline .si-showall {
    background: #2a2a36;
    color: #b8b8c0;
    border: 1px solid #3a3a44;
    border-radius: 4px;
    padding: 6px 12px;
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
}
.si-picker--inline .si-showall:hover {
    background: #34343f;
    color: #fff;
}
#${DIALOG_ID} .si-footer {
    padding: 8px 14px;
    border-top: 1px solid #2a2a32;
    color: #777;
    font-size: 11px;
    background: #1f1f26;
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
}
#${DIALOG_ID} kbd {
    background: #2a2a36;
    border: 1px solid #3a3a44;
    border-bottom-width: 2px;
    border-radius: 3px;
    padding: 1px 5px;
    font-family: ui-monospace, monospace;
    font-size: 10px;
    color: #b8b8c0;
}
`;
function resolveComboValues(rawValues, widget, node) {
  let values = rawValues;
  if (typeof rawValues === "function") {
    try {
      values = rawValues(widget, node);
    } catch (e) {
      console.warn(`[${EXT_NAME}] values function threw`, e);
      values = [];
    }
  }
  return Array.isArray(values) ? values : [];
}
function buildNameEl(value, matches) {
  const el = document.createElement("span");
  el.className = "si-name";
  el.appendChild(highlightMatches(value, matches));
  return el;
}
function buildRowEl(value, info, isCurrent, nameMatches) {
  const row = document.createElement("div");
  row.className = `si-row${isCurrent ? " si-current" : ""}`;
  row.dataset.value = value;
  const head = document.createElement("div");
  head.className = "si-row-head";
  head.appendChild(buildNameEl(value, nameMatches));
  if (info) {
    if (info.order !== undefined && info.order !== null) {
      const b = document.createElement("span");
      b.className = "si-badge si-badge-order";
      b.textContent = `ord ${info.order}`;
      head.appendChild(b);
    }
    if (info.type) {
      const b = document.createElement("span");
      b.className = "si-badge si-badge-type";
      b.textContent = info.type;
      head.appendChild(b);
    }
    if (info.year) {
      const b = document.createElement("span");
      b.className = "si-badge si-badge-year";
      b.textContent = String(info.year);
      head.appendChild(b);
    }
    if (info.family) {
      const b = document.createElement("span");
      b.className = "si-badge si-badge-family";
      b.textContent = info.family;
      head.appendChild(b);
    }
  }
  row.appendChild(head);
  if (info?.summary) {
    const sum = document.createElement("div");
    sum.className = "si-summary";
    sum.textContent = info.summary;
    row.appendChild(sum);
  }
  const metaBits = [];
  if (info?.good_for)
    metaBits.push(["Good for", info.good_for]);
  if (info?.pairs_with?.length)
    metaBits.push(["Pairs with", info.pairs_with.join(", ")]);
  if (info?.supersedes_by)
    metaBits.push(["Largely superseded by", info.supersedes_by]);
  if (metaBits.length) {
    const meta = document.createElement("div");
    meta.className = "si-meta";
    meta.append(...metaBits.flatMap(([label, val], i) => {
      const lbl = document.createElement("strong");
      lbl.textContent = `${label}: `;
      const sep = i > 0 ? document.createTextNode(" · ") : null;
      const txt = document.createTextNode(val);
      return sep ? [sep, lbl, txt] : [lbl, txt];
    }));
    row.appendChild(meta);
  }
  if (!info) {
    const nd = document.createElement("div");
    nd.className = "si-nodata";
    nd.textContent = "(no metadata for this option yet)";
    row.appendChild(nd);
  }
  return row;
}
function rankFields(value, info) {
  return [
    value,
    info?.family,
    info?.summary,
    info?.good_for,
    info?.type,
    info?.year != null ? String(info.year) : null,
    info?.supersedes_by
  ];
}
function createPickerBody(opts) {
  const { values, corpus, initialValue, isScheduler, inline = false, onCommit } = opts;
  let selectedValue = initialValue;
  let visibleRows = [];
  let activeIndex = -1;
  let showAll = false;
  let lastQuery = "";
  const root = document.createElement("div");
  root.className = inline ? "si-picker si-picker--inline" : "si-picker";
  const searchRow = document.createElement("div");
  searchRow.className = "si-searchrow";
  const searchEl = document.createElement("input");
  searchEl.className = "si-search";
  searchEl.type = "text";
  searchEl.placeholder = isScheduler ? "Fuzzy filter (e.g. 'kar', 'beta')…" : "Fuzzy filter (e.g. 'dpms', 'dpm sde', '2m')…";
  searchEl.spellcheck = false;
  searchEl.autocomplete = "off";
  const countEl = document.createElement("div");
  countEl.className = "si-count";
  searchRow.appendChild(searchEl);
  searchRow.appendChild(countEl);
  root.appendChild(searchRow);
  const listEl = document.createElement("div");
  listEl.className = "si-list";
  root.appendChild(listEl);
  function commitOrSelect(value) {
    if (onCommit) {
      onCommit(value);
      return;
    }
    selectedValue = value;
    renderRows();
  }
  function setActiveRow(rowEl) {
    visibleRows.forEach((r, i) => {
      if (r === rowEl) {
        r.classList.add("si-active");
        activeIndex = i;
      } else {
        r.classList.remove("si-active");
      }
    });
  }
  function moveActive(delta) {
    if (!visibleRows.length)
      return;
    let i = activeIndex + delta;
    if (i < 0)
      i = visibleRows.length - 1;
    if (i >= visibleRows.length)
      i = 0;
    visibleRows.forEach((r, j) => {
      r.classList.toggle("si-active", j === i);
    });
    activeIndex = i;
    visibleRows[i].scrollIntoView({ block: "nearest" });
  }
  function renderRows() {
    const query = searchEl.value.trim();
    const hasFilter = !!query;
    const ranked = [];
    for (const value of values) {
      const info = lookup(corpus, value);
      if (!hasFilter) {
        ranked.push({ value, info, score: 0, nameMatches: [] });
        continue;
      }
      const r = fuzzyRank(query, rankFields(value, info), NAME_WEIGHT);
      if (r)
        ranked.push({ value, info, score: r.score, nameMatches: r.primaryMatches });
    }
    if (hasFilter)
      ranked.sort((a, b) => b.score - a.score);
    if (inline && !hasFilter) {
      const cur = ranked.findIndex((r) => r.value === selectedValue);
      if (cur >= INLINE_ROW_CAP)
        ranked.unshift(...ranked.splice(cur, 1));
    }
    const capped = inline && !showAll && ranked.length > INLINE_ROW_CAP;
    const display = capped ? ranked.slice(0, INLINE_ROW_CAP) : ranked;
    listEl.innerHTML = "";
    visibleRows = [];
    let activeAssigned = false;
    let shown = 0;
    for (const { value, info, nameMatches } of display) {
      const row = buildRowEl(value, info, value === selectedValue, nameMatches);
      row.addEventListener("click", () => commitOrSelect(value));
      row.addEventListener("mouseenter", () => setActiveRow(row));
      listEl.appendChild(row);
      visibleRows.push(row);
      if (!activeAssigned) {
        if (hasFilter && shown === 0) {
          row.classList.add("si-active");
          activeIndex = 0;
          activeAssigned = true;
        } else if (!hasFilter && value === selectedValue) {
          row.classList.add("si-active");
          activeIndex = shown;
          activeAssigned = true;
        }
      }
      shown++;
    }
    if (!shown) {
      const empty = document.createElement("div");
      empty.className = "si-empty";
      empty.textContent = "No matches.";
      listEl.appendChild(empty);
      activeIndex = -1;
    } else if (!activeAssigned) {
      visibleRows[0].classList.add("si-active");
      activeIndex = 0;
    }
    if (capped) {
      const more = document.createElement("div");
      more.className = "si-more";
      const label = document.createElement("span");
      label.textContent = `… ${ranked.length - shown} more`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "si-showall";
      btn.textContent = "Show all";
      btn.addEventListener("click", () => {
        showAll = true;
        renderRows();
      });
      more.appendChild(label);
      more.appendChild(btn);
      listEl.appendChild(more);
    }
    countEl.textContent = `${ranked.length} / ${values.length}`;
  }
  function onSearchInput() {
    const query = searchEl.value.trim();
    if (query !== lastQuery) {
      lastQuery = query;
      showAll = false;
    }
    renderRows();
  }
  function onKeydown(e) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveActive(1);
        return;
      case "ArrowUp":
        e.preventDefault();
        moveActive(-1);
        return;
      case "PageDown":
        e.preventDefault();
        moveActive(8);
        return;
      case "PageUp":
        e.preventDefault();
        moveActive(-8);
        return;
      case "Enter": {
        e.preventDefault();
        const row = visibleRows[activeIndex];
        if (row?.dataset.value !== undefined)
          commitOrSelect(row.dataset.value);
        return;
      }
    }
    if (document.activeElement === searchEl)
      return;
    if (e.key === "Backspace") {
      e.preventDefault();
      searchEl.focus();
      const pos = searchEl.selectionStart ?? searchEl.value.length;
      if (pos > 0) {
        searchEl.value = searchEl.value.slice(0, pos - 1) + searchEl.value.slice(pos);
        searchEl.setSelectionRange(pos - 1, pos - 1);
        onSearchInput();
      }
      return;
    }
    const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (isPrintable) {
      e.preventDefault();
      searchEl.focus();
      const pos = searchEl.selectionStart ?? searchEl.value.length;
      searchEl.value = searchEl.value.slice(0, pos) + e.key + searchEl.value.slice(pos);
      searchEl.setSelectionRange(pos + 1, pos + 1);
      onSearchInput();
    }
  }
  searchEl.addEventListener("input", onSearchInput);
  root.addEventListener("keydown", onKeydown);
  renderRows();
  return {
    el: root,
    searchEl,
    getValue: () => selectedValue,
    focus: () => searchEl.focus(),
    destroy: () => {
      root.removeEventListener("keydown", onKeydown);
      searchEl.removeEventListener("input", onSearchInput);
      root.remove();
    }
  };
}
function centerActiveRow(listEl) {
  const active = listEl.querySelector(".si-row.si-active");
  active?.scrollIntoView({ block: "center" });
}
function commitWidgetValue(widget, node, value) {
  widget.value = value;
  try {
    widget.callback?.call(widget, value, app.canvas, node);
  } catch (e) {
    console.warn(`[${EXT_NAME}] widget callback threw`, e);
  }
  try {
    refreshWidgetTooltip(widget);
  } catch (e) {
    console.warn(`[${EXT_NAME}] tooltip refresh failed after commit`, e);
  }
  node?.setDirtyCanvas?.(true, true);
  app.graph?.setDirtyCanvas?.(true, true);
}
function openPicker(widget, node) {
  ensureStyleOnce(STYLE_ID2, CSS2);
  const values = resolveComboValues(widget.options?.values, widget, app.canvas?.current_node);
  if (!values.length)
    return;
  const isScheduler = isSchedulerWidget(widget);
  const backdrop = document.createElement("div");
  backdrop.id = `${DIALOG_ID}-backdrop`;
  backdrop.addEventListener("pointerdown", () => dismissActiveModal());
  const dialog = document.createElement("div");
  dialog.id = DIALOG_ID;
  const header = document.createElement("div");
  header.className = "si-header";
  const title = document.createElement("div");
  title.className = "si-title";
  title.textContent = isScheduler ? "Choose scheduler" : "Choose sampler";
  const widgetName = document.createElement("span");
  widgetName.className = "si-widgetname";
  widgetName.textContent = `(${widget.name})`;
  title.appendChild(widgetName);
  const closeBtn = document.createElement("button");
  closeBtn.className = "si-close";
  closeBtn.textContent = "×";
  closeBtn.title = "Close (Esc)";
  closeBtn.addEventListener("click", () => dismissActiveModal());
  header.appendChild(title);
  header.appendChild(closeBtn);
  dialog.appendChild(header);
  const body = createPickerBody({
    values,
    corpus: widgetCorpus(widget),
    initialValue: String(widget.value),
    isScheduler,
    onCommit: (value) => {
      dismissActiveModal();
      commitWidgetValue(widget, node, value);
    }
  });
  dialog.appendChild(body.el);
  dialog.addEventListener("click", (e) => {
    e.stopPropagation();
    const t = e.target;
    if (t.tagName !== "INPUT" && t.tagName !== "BUTTON" && !t.closest?.(".si-row")) {
      body.searchEl.focus();
    }
  });
  const footer = document.createElement("div");
  footer.className = "si-footer";
  const hintL = document.createElement("div");
  hintL.innerHTML = "<kbd>↑</kbd> <kbd>↓</kbd> navigate · <kbd>Enter</kbd> select · <kbd>Esc</kbd> close";
  const hintR = document.createElement("div");
  hintR.textContent = "Fuzzy: chars in order · Space = AND";
  footer.appendChild(hintL);
  footer.appendChild(hintR);
  dialog.appendChild(footer);
  function closePicker() {
    document.removeEventListener("keydown", onEscape, true);
    body.destroy();
    backdrop.remove();
    dialog.remove();
  }
  function onEscape(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      dismissActiveModal();
    }
  }
  document.body.appendChild(backdrop);
  document.body.appendChild(dialog);
  document.addEventListener("keydown", onEscape, true);
  setActiveModal({ id: EXT_NAME, element: dialog, close: closePicker });
  centerActiveRow(body.el);
  body.focus();
}
registerFieldProvider({
  id: "sampler-info:combo",
  priority: 10,
  match: (widget) => typeof widget?.name === "string" && (SAMPLER_WIDGET_NAMES.has(widget.name) || SCHEDULER_WIDGET_NAMES.has(widget.name)),
  create: ({ widget, node, initialValue }) => {
    ensureStyleOnce(STYLE_ID2, CSS2);
    const isScheduler = isSchedulerName(widget?.name);
    const values = resolveComboValues(widget?.options?.values, widget, node);
    const initialStr = String(initialValue ?? widget?.value ?? "");
    const body = createPickerBody({
      values,
      corpus: isScheduler ? SCHEDULERS : SAMPLERS,
      initialValue: initialStr,
      isScheduler,
      inline: true
    });
    return {
      el: body.el,
      getValue: () => body.getValue(),
      hasChanged: () => body.getValue() !== initialStr,
      focus: () => body.focus(),
      destroy: () => body.destroy()
    };
  }
});
function enhanceNode(node) {
  if (!node?.widgets)
    return;
  for (const widget of node.widgets) {
    const w = widget;
    const matches = SAMPLER_WIDGET_NAMES.has(w.name) || SCHEDULER_WIDGET_NAMES.has(w.name);
    if (!matches)
      continue;
    if (!w._samplerInfoPatched) {
      w._samplerInfoPatched = true;
      refreshWidgetTooltip(w);
      const origCb = w.callback;
      w.callback = function(value, ...rest) {
        const r = origCb ? origCb.call(this, value, ...rest) : undefined;
        try {
          refreshWidgetTooltip(w);
        } catch (e) {
          console.warn(`[${EXT_NAME}] tooltip refresh failed`, e);
        }
        return r;
      };
    } else {
      refreshWidgetTooltip(w);
    }
    if (!w._samplerInfoPointerPatched) {
      w._samplerInfoPointerPatched = true;
      patchWidgetPointer(w, (_pointer, ownerNode) => {
        if (isModalActive())
          return false;
        openPicker(w, ownerNode || node);
        return true;
      });
    }
  }
}
function refreshAllNodes() {
  const graph = app?.graph;
  const nodes = graph?._nodes;
  if (!nodes)
    return;
  for (const node of nodes)
    enhanceNode(node);
}
app.registerExtension({
  name: "comfy.sampler-info",
  async setup() {
    await loadCorpus();
    refreshAllNodes();
  },
  async nodeCreated(node) {
    enhanceNode(node);
  },
  async loadedGraphNode(node) {
    enhanceNode(node);
  }
});
export {
  safeRegex,
  lookup,
  compileCorpus,
  CSS2 as CSS
};
