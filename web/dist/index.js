// src/index.ts
import { app } from "/scripts/app.js";
var EXT_NAME = "comfyui-sampler-info";
var DATA_BASE = `/extensions/${EXT_NAME}/data`;
var SAMPLER_WIDGET_NAMES = new Set(["sampler_name", "sampler"]);
var SCHEDULER_WIDGET_NAMES = new Set(["scheduler"]);
var STYLE_ID = "sampler-info-style";
var DIALOG_ID = "sampler-info-dialog";
var SAMPLERS = { exact: {}, prefix: [] };
var SCHEDULERS = { exact: {}, prefix: [] };
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
  }
}
function compileCorpus(raw) {
  const prefix = (raw?.prefix || []).map((p) => ({ ...p, re: safeRegex(p.match) })).filter((p) => p.re !== null);
  return { exact: raw?.exact || {}, prefix };
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
function isSchedulerWidget(widget) {
  return SCHEDULER_WIDGET_NAMES.has(widget.name);
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
var CSS = `
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
#${DIALOG_ID} .si-searchrow {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid #2a2a32;
    flex-shrink: 0;
}
#${DIALOG_ID} .si-search {
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
#${DIALOG_ID} .si-search:focus {
    border-color: #6ba6ff;
}
#${DIALOG_ID} .si-count {
    color: #888;
    font-size: 12px;
    white-space: nowrap;
}
#${DIALOG_ID} .si-list {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 4px 0;
}
#${DIALOG_ID} .si-row {
    padding: 8px 14px;
    cursor: pointer;
    border-left: 3px solid transparent;
    border-bottom: 1px solid #22222a;
}
#${DIALOG_ID} .si-row:last-child {
    border-bottom: none;
}
#${DIALOG_ID} .si-row:hover,
#${DIALOG_ID} .si-row.si-active {
    background: #2a2a36;
    border-left-color: #6ba6ff;
}
#${DIALOG_ID} .si-row.si-current {
    background: #1f2a1f;
    border-left-color: #6bff8e;
}
#${DIALOG_ID} .si-row.si-current.si-active {
    background: #243524;
}
#${DIALOG_ID} .si-row-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 3px;
}
#${DIALOG_ID} .si-name {
    font-weight: 600;
    color: #e8e8ea;
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 13px;
}
#${DIALOG_ID} .si-row.si-current .si-name::after {
    content: " · current";
    color: #6bff8e;
    font-weight: 400;
    font-family: system-ui, sans-serif;
    font-size: 11px;
}
#${DIALOG_ID} .si-match {
    color: #ffd866;
    font-weight: 700;
    text-shadow: 0 0 1px rgba(255, 216, 102, 0.5);
}
#${DIALOG_ID} .si-badge {
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
#${DIALOG_ID} .si-badge-year { color: #d8c878; border-color: #4a3e2a; }
#${DIALOG_ID} .si-badge-family { color: #c8a8ff; border-color: #3a2e4a; }
#${DIALOG_ID} .si-badge-order { color: #9ec6ff; border-color: #2a3a4a; }
#${DIALOG_ID} .si-badge-type { color: #b8c8a8; border-color: #2e3a2a; }
#${DIALOG_ID} .si-summary {
    color: #b8b8c0;
    font-size: 12px;
    line-height: 1.4;
}
#${DIALOG_ID} .si-meta {
    color: #888;
    font-size: 11px;
    margin-top: 3px;
    line-height: 1.4;
}
#${DIALOG_ID} .si-meta strong { color: #aaa; font-weight: 600; }
#${DIALOG_ID} .si-nodata {
    color: #888;
    font-size: 12px;
    font-style: italic;
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
#${DIALOG_ID} .si-empty {
    padding: 40px 14px;
    text-align: center;
    color: #777;
    font-style: italic;
}
`;
function ensureStyle() {
  if (document.getElementById(STYLE_ID))
    return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
function dismissPicker() {
  document.getElementById(DIALOG_ID)?.remove();
  document.getElementById(`${DIALOG_ID}-backdrop`)?.remove();
  document.removeEventListener("keydown", onPickerKeydown, true);
  PICKER_STATE = null;
}
var PICKER_STATE = null;
function getWidgetValues(widget) {
  const raw = widget.options?.values;
  let values = raw;
  if (typeof raw === "function") {
    try {
      values = raw(widget, app.canvas?.current_node);
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
  if (!matches?.length) {
    el.textContent = value;
    return el;
  }
  const matchSet = new Set(matches);
  for (let i = 0;i < value.length; i++) {
    if (matchSet.has(i)) {
      const m = document.createElement("span");
      m.className = "si-match";
      m.textContent = value[i];
      el.appendChild(m);
    } else {
      el.appendChild(document.createTextNode(value[i]));
    }
  }
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
function fuzzyScore(query, target) {
  if (!query)
    return { score: 0, matches: [] };
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
      const cur = target[ti];
      if (prev === "_" || prev === "-" || prev === " " || prev === "." || prev === "/") {
        charScore += 4;
      } else if (prev >= "a" && prev <= "z" && cur >= "A" && cur <= "Z") {
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
function fuzzyRank(value, info, query) {
  if (!query)
    return { score: 0, nameMatches: [] };
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!tokens.length)
    return { score: 0, nameMatches: [] };
  let totalScore = 0;
  const nameMatchSet = new Set;
  const metaFields = info ? [
    info.family,
    info.summary,
    info.good_for,
    info.type,
    info.year != null ? String(info.year) : null,
    info.supersedes_by
  ].filter(Boolean) : [];
  for (const token of tokens) {
    const nameResult = fuzzyScore(token, value);
    let best = nameResult ? { score: nameResult.score * 10, matches: nameResult.matches, onName: true } : null;
    for (const field of metaFields) {
      const r = fuzzyScore(token, field);
      if (r && (!best || r.score > best.score)) {
        best = { score: r.score, matches: r.matches, onName: false };
      }
    }
    if (!best)
      return null;
    totalScore += best.score;
    if (best.onName) {
      for (const i of best.matches)
        nameMatchSet.add(i);
    }
  }
  return { score: totalScore, nameMatches: [...nameMatchSet].sort((a, b) => a - b) };
}
function renderRows() {
  if (!PICKER_STATE)
    return;
  const { listEl, countEl, values, corpus, currentValue, searchEl } = PICKER_STATE;
  const query = searchEl.value.trim();
  const hasFilter = !!query;
  const ranked = [];
  for (const value of values) {
    const info = lookup(corpus, value);
    if (!hasFilter) {
      ranked.push({ value, info, score: 0, nameMatches: [] });
      continue;
    }
    const r = fuzzyRank(value, info, query);
    if (r)
      ranked.push({ value, info, score: r.score, nameMatches: r.nameMatches });
  }
  if (hasFilter)
    ranked.sort((a, b) => b.score - a.score);
  listEl.innerHTML = "";
  PICKER_STATE.visibleRows = [];
  let activeAssigned = false;
  let shown = 0;
  for (const { value, info, nameMatches } of ranked) {
    const row = buildRowEl(value, info, value === currentValue, nameMatches);
    row.addEventListener("click", () => selectAndClose(value));
    row.addEventListener("mouseenter", () => setActiveRow(row));
    listEl.appendChild(row);
    PICKER_STATE.visibleRows.push(row);
    if (!activeAssigned) {
      if (hasFilter && shown === 0) {
        row.classList.add("si-active");
        PICKER_STATE.activeIndex = 0;
        activeAssigned = true;
      } else if (!hasFilter && value === currentValue) {
        row.classList.add("si-active");
        PICKER_STATE.activeIndex = shown;
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
    PICKER_STATE.activeIndex = -1;
  } else if (!activeAssigned) {
    PICKER_STATE.visibleRows[0].classList.add("si-active");
    PICKER_STATE.activeIndex = 0;
  }
  countEl.textContent = `${shown} / ${values.length}`;
}
function setActiveRow(rowEl) {
  if (!PICKER_STATE)
    return;
  PICKER_STATE.visibleRows.forEach((r, i) => {
    if (r === rowEl) {
      r.classList.add("si-active");
      if (PICKER_STATE)
        PICKER_STATE.activeIndex = i;
    } else {
      r.classList.remove("si-active");
    }
  });
}
function moveActive(delta) {
  if (!PICKER_STATE)
    return;
  const rows = PICKER_STATE.visibleRows;
  if (!rows.length)
    return;
  let i = PICKER_STATE.activeIndex + delta;
  if (i < 0)
    i = rows.length - 1;
  if (i >= rows.length)
    i = 0;
  rows.forEach((r, j) => {
    r.classList.toggle("si-active", j === i);
  });
  PICKER_STATE.activeIndex = i;
  rows[i].scrollIntoView({ block: "nearest" });
}
function selectAndClose(value) {
  if (!PICKER_STATE)
    return;
  const { widget, node } = PICKER_STATE;
  dismissPicker();
  widget.value = value;
  try {
    widget.callback?.call(widget, value, app.canvas, node);
  } catch (e) {
    console.warn(`[${EXT_NAME}] widget callback threw`, e);
  }
  try {
    refreshWidgetTooltip(widget);
  } catch (_e) {}
  node?.setDirtyCanvas?.(true, true);
  app.graph?.setDirtyCanvas?.(true, true);
}
function onPickerKeydown(e) {
  if (!PICKER_STATE)
    return;
  switch (e.key) {
    case "Escape":
      e.preventDefault();
      e.stopPropagation();
      dismissPicker();
      return;
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
      const i = PICKER_STATE.activeIndex;
      const row = PICKER_STATE.visibleRows[i];
      if (row?.dataset.value !== undefined)
        selectAndClose(row.dataset.value);
      return;
    }
  }
  if (document.activeElement === PICKER_STATE.searchEl)
    return;
  const el = PICKER_STATE.searchEl;
  if (e.key === "Backspace") {
    e.preventDefault();
    el.focus();
    const pos = el.selectionStart ?? el.value.length;
    if (pos > 0) {
      el.value = el.value.slice(0, pos - 1) + el.value.slice(pos);
      el.setSelectionRange(pos - 1, pos - 1);
      renderRows();
    }
    return;
  }
  const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
  if (isPrintable) {
    e.preventDefault();
    el.focus();
    const pos = el.selectionStart ?? el.value.length;
    el.value = el.value.slice(0, pos) + e.key + el.value.slice(pos);
    el.setSelectionRange(pos + 1, pos + 1);
    renderRows();
  }
}
function openPicker(widget, node) {
  ensureStyle();
  dismissPicker();
  const values = getWidgetValues(widget);
  if (!values.length)
    return;
  const corpus = widgetCorpus(widget);
  const isScheduler = isSchedulerWidget(widget);
  const backdrop = document.createElement("div");
  backdrop.id = `${DIALOG_ID}-backdrop`;
  backdrop.addEventListener("pointerdown", dismissPicker);
  const dialog = document.createElement("div");
  dialog.id = DIALOG_ID;
  dialog.addEventListener("click", (e) => {
    e.stopPropagation();
    const t = e.target;
    if (t.tagName !== "INPUT" && t.tagName !== "BUTTON" && !t.closest?.(".si-row")) {
      PICKER_STATE?.searchEl?.focus();
    }
  });
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
  closeBtn.addEventListener("click", dismissPicker);
  header.appendChild(title);
  header.appendChild(closeBtn);
  dialog.appendChild(header);
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
  dialog.appendChild(searchRow);
  const listEl = document.createElement("div");
  listEl.className = "si-list";
  dialog.appendChild(listEl);
  const footer = document.createElement("div");
  footer.className = "si-footer";
  const hintL = document.createElement("div");
  hintL.innerHTML = "<kbd>↑</kbd> <kbd>↓</kbd> navigate · <kbd>Enter</kbd> select · <kbd>Esc</kbd> close";
  const hintR = document.createElement("div");
  hintR.textContent = "Fuzzy: chars in order · Space = AND";
  footer.appendChild(hintL);
  footer.appendChild(hintR);
  dialog.appendChild(footer);
  document.body.appendChild(backdrop);
  document.body.appendChild(dialog);
  PICKER_STATE = {
    widget,
    node,
    values,
    corpus,
    currentValue: String(widget.value),
    listEl,
    countEl,
    searchEl,
    visibleRows: [],
    activeIndex: -1
  };
  searchEl.addEventListener("input", renderRows);
  document.addEventListener("keydown", onPickerKeydown, true);
  renderRows();
  const activeRow = PICKER_STATE.visibleRows[PICKER_STATE.activeIndex];
  if (activeRow)
    activeRow.scrollIntoView({ block: "center" });
  searchEl.focus();
}
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
      const origDown = w.onPointerDown;
      w.onPointerDown = function(pointer, ownerNode, canvas) {
        if (typeof origDown === "function") {
          const consumed = origDown.call(this, pointer, ownerNode, canvas);
          if (consumed)
            return consumed;
        }
        openPicker(w, ownerNode || node);
        return true;
      };
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
  fuzzyScore,
  fuzzyRank,
  compileCorpus
};
