import {
  dismissActiveModal,
  fuzzyRank,
  highlightMatches,
  isModalActive,
  type PointerPatchableWidget,
  patchWidgetPointer,
  registerFieldProvider,
  setActiveModal,
} from "@laurigates/comfy-modal-kit";
import { app } from "/scripts/app.js";

// The package's `ComfyApp` type is the only widget/graph type it exports at
// the module root — `LGraphNode`, `LGraphCanvas`, and the widget interfaces
// are declared internally but not re-exported, so they cannot be imported.
// We model the small surface this pack touches with local interfaces instead
// (the code-split plan's "local interface extension — narrower blast radius"
// approach). `ComfyApp` types the imported `app` via the shim in
// `comfyui-shims.d.ts`.

// Minimal structural types for the LiteGraph objects this pack reaches into.
// Only the members actually used here are modelled; everything else is left
// off deliberately so the seam stays narrow. Named `SamplerNode` (not
// `LGraphNode`) to avoid colliding with the package's own un-exported
// `LGraphNode` at the `registerExtension` lifecycle-hook seam — the hooks
// receive the package node, which we cast to this structural shape.
interface SamplerNode {
  widgets?: PatchedWidget[];
  setDirtyCanvas?: (fg: boolean, bg: boolean) => void;
}

type SamplerCanvas = unknown;

// Three additive integrations, all keyed off combo widgets named
// sampler_name / sampler / scheduler:
//
// Option A: rewrite widget.options.tooltip so the corpus-defined description
// (year, family, ODE order, summary, good_for, pairs_with) surfaces on hover
// (desktop) and long-press (comfyui-touch-tooltips).
//
// Option B: intercept the on-canvas widget click via the shared
// comfy-modal-kit `patchWidgetPointer` coordinator and open an HTML modal
// picker with a search/filter input and per-row metadata.
//
// Option C: register a comfy-modal-kit *field provider* so consumers of the
// shared registry (notably comfyui-prompt-editor) mount the same corpus-
// annotated fuzzy list inline, in place of the built-in <select>. See
// ADR-0011 (adopting the kit's field-provider registry + click coordinator)
// and kit ADR-0001. Additive — if no corpus match, rows render bare names.

const EXT_NAME = "comfyui-sampler-info";
const DATA_BASE = `/extensions/${EXT_NAME}/data`;
const SAMPLER_WIDGET_NAMES = new Set(["sampler_name", "sampler"]);
const SCHEDULER_WIDGET_NAMES = new Set(["scheduler"]);
const STYLE_ID = "sampler-info-style";
const DIALOG_ID = "sampler-info-dialog";
// The primary field (the option name) is weighted this much heavier than the
// metadata fields when ranking, so a hit on the name beats a hit on a summary.
const NAME_WEIGHT = 10;

// ============================================================
// Types
// ============================================================

interface SamplerInfo {
  year?: number | null;
  family?: string;
  order?: number | string;
  type?: string;
  summary?: string;
  good_for?: string;
  pairs_with?: string[];
  supersedes_by?: string;
  notes?: string;
  match?: string;
  re?: RegExp;
}

interface RawCorpus {
  exact?: Record<string, SamplerInfo>;
  prefix?: SamplerInfo[];
  // Maps a token to the canonical token whose entry it reuses (DRY) —
  // e.g. RES4LYF's `res_2m` -> core `res_multistep`. Same algorithm,
  // different naming scheme.
  alias?: Record<string, string>;
}

interface Corpus {
  exact: Record<string, SamplerInfo>;
  // Compiled prefix entries always carry a non-null `re`.
  prefix: (SamplerInfo & { re: RegExp })[];
  alias: Record<string, string>;
}

// A combo widget plus the custom props this pack hangs off it. The package's
// widget types are not exported, so we model the members used here directly.
// `onPointerDown` and the private guard flags are not part of the public widget
// surface — they are this pack's intercept seam.
interface WidgetOptions {
  tooltip?: string;
  values?: string[] | ((widget: PatchedWidget, node: unknown) => unknown);
}

interface PatchedWidget {
  name: string;
  value: unknown;
  tooltip?: string;
  options?: WidgetOptions;
  callback?: (value: unknown, ...rest: unknown[]) => unknown;
  onPointerDown?: (
    pointer: unknown,
    node: SamplerNode,
    canvas: SamplerCanvas,
  ) => boolean | undefined;
  _samplerInfoPatched?: boolean;
  _samplerInfoPointerPatched?: boolean;
  _samplerInfoOriginalTooltip?: string;
}

let SAMPLERS: Corpus = { exact: {}, prefix: [], alias: {} };
let SCHEDULERS: Corpus = { exact: {}, prefix: [], alias: {} };
let CORPUS_LOADED = false;

// ============================================================
// Corpus loading
// ============================================================

async function loadCorpus(): Promise<void> {
  try {
    const [s, sc] = await Promise.all([
      fetch(`${DATA_BASE}/samplers.json`, { cache: "no-cache" }).then((r) => r.json()),
      fetch(`${DATA_BASE}/schedulers.json`, { cache: "no-cache" }).then((r) => r.json()),
    ]);
    SAMPLERS = compileCorpus(s);
    SCHEDULERS = compileCorpus(sc);
    CORPUS_LOADED = true;
  } catch (e) {
    console.warn(`[${EXT_NAME}] corpus load failed:`, e);
  }
}

export function compileCorpus(raw: RawCorpus | null | undefined): Corpus {
  const prefix = (raw?.prefix || [])
    .map((p) => ({ ...p, re: safeRegex(p.match) }))
    .filter((p): p is SamplerInfo & { re: RegExp } => p.re !== null);
  return { exact: raw?.exact || {}, prefix, alias: raw?.alias || {} };
}

// Build the SamplerInfo returned for an alias hit: the canonical entry's
// data, plus a note explaining the equivalence. The canonical entry is
// never mutated — aliases are a read-time view over it.
function resolveAlias(canonical: string, target: SamplerInfo): SamplerInfo {
  const note = `Alias of \`${canonical}\` — same algorithm, different naming scheme.`;
  return { ...target, notes: target.notes ? `${note} ${target.notes}` : note };
}

export function safeRegex(pattern: string | undefined): RegExp | null {
  try {
    return new RegExp(pattern as string);
  } catch (e) {
    console.warn(`[${EXT_NAME}] bad regex in corpus: ${pattern}`, e);
    return null;
  }
}

export function lookup(corpus: Corpus, token: unknown): SamplerInfo | null {
  if (!token || typeof token !== "string") return null;
  const exact = corpus.exact[token];
  if (exact) return exact;
  // Alias resolution sits between exact and prefix: a wrapper-specific token
  // (e.g. RES4LYF `res_2m`) reuses an existing canonical entry rather than
  // duplicating its description.
  const canonical = corpus.alias[token];
  if (canonical) {
    const target = corpus.exact[canonical];
    if (target) return resolveAlias(canonical, target);
  }
  for (const p of corpus.prefix) {
    if (p.re.test(token)) return p;
  }
  return null;
}

// ============================================================
// Option A: tooltip rewrite
// ============================================================

function formatSamplerTooltip(token: string, info: SamplerInfo): string {
  const headerBits = [token];
  if (info.order !== undefined && info.order !== null) headerBits.push(`order ${info.order}`);
  if (info.type) headerBits.push(info.type);
  if (info.year) headerBits.push(`${info.year}`);
  if (info.family) headerBits.push(info.family);
  const lines = [headerBits.join(" · "), ""];
  if (info.summary) lines.push(info.summary);
  if (info.good_for) lines.push("", `Good for: ${info.good_for}`);
  if (Array.isArray(info.pairs_with) && info.pairs_with.length) {
    lines.push(`Pairs with: ${info.pairs_with.join(", ")}`);
  }
  if (info.supersedes_by) lines.push(`Largely superseded by: ${info.supersedes_by}`);
  if (info.notes) lines.push("", `Note: ${info.notes}`);
  return lines.join("\n");
}

function formatSchedulerTooltip(token: string, info: SamplerInfo): string {
  const headerBits = [token];
  if (info.year) headerBits.push(`${info.year}`);
  const lines = [headerBits.join(" · "), ""];
  if (info.summary) lines.push(info.summary);
  if (info.good_for) lines.push("", `Good for: ${info.good_for}`);
  if (info.notes) lines.push("", `Note: ${info.notes}`);
  return lines.join("\n");
}

function isSchedulerName(name: string | undefined): boolean {
  return typeof name === "string" && SCHEDULER_WIDGET_NAMES.has(name);
}

function isSchedulerWidget(widget: PatchedWidget): boolean {
  return isSchedulerName(widget.name);
}

function widgetCorpus(widget: PatchedWidget): Corpus {
  return isSchedulerWidget(widget) ? SCHEDULERS : SAMPLERS;
}

function refreshWidgetTooltip(widget: PatchedWidget): void {
  if (!CORPUS_LOADED) return;
  const fmt = isSchedulerWidget(widget) ? formatSchedulerTooltip : formatSamplerTooltip;
  const info = lookup(widgetCorpus(widget), widget.value);
  if (!info) return;
  const tip = fmt(String(widget.value), info);
  widget.options = widget.options || {};
  widget._samplerInfoOriginalTooltip ??= widget.options.tooltip;
  widget.options.tooltip = tip;
  widget.tooltip = tip;
}

// ============================================================
// Option B/C: picker body (shared inline control)
// ============================================================

const CSS = `
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

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

// The combo choices for a widget. `options.values` can be a static array or a
// function `(widget, node) => string[]` (LiteGraph's dynamic-combo form).
function resolveComboValues(rawValues: unknown, widget: unknown, node: unknown): string[] {
  let values: unknown = rawValues;
  if (typeof rawValues === "function") {
    try {
      values = (rawValues as (w: unknown, n: unknown) => unknown)(widget, node);
    } catch (e) {
      console.warn(`[${EXT_NAME}] values function threw`, e);
      values = [];
    }
  }
  return Array.isArray(values) ? (values as string[]) : [];
}

function buildNameEl(value: string, matches: number[] | null | undefined): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = "si-name";
  // Reuse the kit's highlightMatches (spans matched chars in .cmp-match,
  // escapes the rest). Handles a null/empty index list as plain text.
  el.appendChild(highlightMatches(value, matches));
  return el;
}

function buildRowEl(
  value: string,
  info: SamplerInfo | null,
  isCurrent: boolean,
  nameMatches: number[],
): HTMLDivElement {
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

  const metaBits: [string, string][] = [];
  if (info?.good_for) metaBits.push(["Good for", info.good_for]);
  if (info?.pairs_with?.length) metaBits.push(["Pairs with", info.pairs_with.join(", ")]);
  if (info?.supersedes_by) metaBits.push(["Largely superseded by", info.supersedes_by]);
  if (metaBits.length) {
    const meta = document.createElement("div");
    meta.className = "si-meta";
    meta.append(
      ...metaBits.flatMap(([label, val], i) => {
        const lbl = document.createElement("strong");
        lbl.textContent = `${label}: `;
        const sep = i > 0 ? document.createTextNode(" · ") : null;
        const txt = document.createTextNode(val);
        return sep ? [sep, lbl, txt] : [lbl, txt];
      }),
    );
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

// The fields fed to the kit's fuzzyRank, primary field (the name) first. The
// kit weights the primary field NAME_WEIGHT× and splits the query into
// space-separated AND-tokens, so a hit on the name beats a hit on the summary
// and `dpm sde` requires both tokens somewhere on the row.
function rankFields(value: string, info: SamplerInfo | null): (string | null | undefined)[] {
  return [
    value,
    info?.family,
    info?.summary,
    info?.good_for,
    info?.type,
    info?.year != null ? String(info.year) : null,
    info?.supersedes_by,
  ];
}

interface PickerBody {
  el: HTMLDivElement;
  searchEl: HTMLInputElement;
  getValue(): string;
  focus(): void;
  destroy(): void;
}

// The shared inner control: a search input + a corpus-annotated fuzzy list.
// Instance-based (no module singleton) so the field editor can mount several,
// and its lifecycle is caller-driven. The on-canvas modal wraps this with a
// self-committing chrome; the field-provider path returns it as a live control
// the editor commits on save (ADR-0011, kit ADR-0001).
function createPickerBody(opts: {
  values: string[];
  corpus: Corpus;
  initialValue: string;
  isScheduler: boolean;
  // Modal path: commit + close on selection. Inline path omits this — a
  // selection just marks the row current; the editor commits on save.
  onCommit?: (value: string) => void;
}): PickerBody {
  const { values, corpus, initialValue, isScheduler, onCommit } = opts;
  let selectedValue = initialValue;
  let visibleRows: HTMLElement[] = [];
  let activeIndex = -1;

  const root = document.createElement("div");
  root.className = "si-picker";

  const searchRow = document.createElement("div");
  searchRow.className = "si-searchrow";
  const searchEl = document.createElement("input");
  searchEl.className = "si-search";
  searchEl.type = "text";
  searchEl.placeholder = isScheduler
    ? "Fuzzy filter (e.g. 'kar', 'beta')…"
    : "Fuzzy filter (e.g. 'dpms', 'dpm sde', '2m')…";
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

  function commitOrSelect(value: string): void {
    if (onCommit) {
      onCommit(value);
      return;
    }
    selectedValue = value;
    renderRows();
  }

  function setActiveRow(rowEl: HTMLElement): void {
    visibleRows.forEach((r, i) => {
      if (r === rowEl) {
        r.classList.add("si-active");
        activeIndex = i;
      } else {
        r.classList.remove("si-active");
      }
    });
  }

  function moveActive(delta: number): void {
    if (!visibleRows.length) return;
    let i = activeIndex + delta;
    if (i < 0) i = visibleRows.length - 1;
    if (i >= visibleRows.length) i = 0;
    visibleRows.forEach((r, j) => {
      r.classList.toggle("si-active", j === i);
    });
    activeIndex = i;
    (visibleRows[i] as HTMLElement).scrollIntoView({ block: "nearest" });
  }

  function renderRows(): void {
    const query = searchEl.value.trim();
    const hasFilter = !!query;

    const ranked: {
      value: string;
      info: SamplerInfo | null;
      score: number;
      nameMatches: number[];
    }[] = [];
    for (const value of values) {
      const info = lookup(corpus, value);
      if (!hasFilter) {
        ranked.push({ value, info, score: 0, nameMatches: [] });
        continue;
      }
      const r = fuzzyRank(query, rankFields(value, info), NAME_WEIGHT);
      if (r) ranked.push({ value, info, score: r.score, nameMatches: r.primaryMatches });
    }
    // With a filter, best match at the top; without, preserve list order
    // (users remember "the third option in the family").
    if (hasFilter) ranked.sort((a, b) => b.score - a.score);

    listEl.innerHTML = "";
    visibleRows = [];
    let activeAssigned = false;
    let shown = 0;
    for (const { value, info, nameMatches } of ranked) {
      const row = buildRowEl(value, info, value === selectedValue, nameMatches);
      row.addEventListener("click", () => commitOrSelect(value));
      row.addEventListener("mouseenter", () => setActiveRow(row));
      listEl.appendChild(row);
      visibleRows.push(row);
      // Active row: with a filter, the top-scored; without, the current
      // value (so Enter is a no-op confirm).
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
      (visibleRows[0] as HTMLElement).classList.add("si-active");
      activeIndex = 0;
    }
    countEl.textContent = `${shown} / ${values.length}`;
  }

  function onKeydown(e: KeyboardEvent): void {
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
        if (row?.dataset.value !== undefined) commitOrSelect(row.dataset.value);
        return;
      }
    }

    // Route printable chars + Backspace into the search input even when focus
    // has drifted off it (e.g. a click on the body whitespace).
    if (document.activeElement === searchEl) return;
    if (e.key === "Backspace") {
      e.preventDefault();
      searchEl.focus();
      const pos = searchEl.selectionStart ?? searchEl.value.length;
      if (pos > 0) {
        searchEl.value = searchEl.value.slice(0, pos - 1) + searchEl.value.slice(pos);
        searchEl.setSelectionRange(pos - 1, pos - 1);
        renderRows();
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
      renderRows();
    }
  }

  searchEl.addEventListener("input", renderRows);
  root.addEventListener("keydown", onKeydown);

  renderRows();

  return {
    el: root,
    searchEl,
    getValue: () => selectedValue,
    focus: () => searchEl.focus(),
    destroy: () => {
      root.removeEventListener("keydown", onKeydown);
      searchEl.removeEventListener("input", renderRows);
      root.remove();
    },
  };
}

// Center the active row (the current value) so the list opens with the
// existing selection mid-viewport, not at the top — long lists (110+
// samplers) would otherwise hide the selection far below the fold.
function centerActiveRow(listEl: HTMLElement): void {
  const active = listEl.querySelector<HTMLElement>(".si-row.si-active");
  active?.scrollIntoView({ block: "center" });
}

// ============================================================
// Option B: on-canvas modal picker
// ============================================================

function commitWidgetValue(widget: PatchedWidget, node: SamplerNode | null, value: string): void {
  widget.value = value;
  try {
    widget.callback?.call(widget, value, app.canvas, node);
  } catch (e) {
    console.warn(`[${EXT_NAME}] widget callback threw`, e);
  }
  try {
    refreshWidgetTooltip(widget);
  } catch (_e) {
    /* ignored */
  }
  node?.setDirtyCanvas?.(true, true);
  app.graph?.setDirtyCanvas?.(true, true);
}

function openPicker(widget: PatchedWidget, node: SamplerNode | null): void {
  ensureStyle();
  const values = resolveComboValues(widget.options?.values, widget, app.canvas?.current_node);
  if (!values.length) return;
  const isScheduler = isSchedulerWidget(widget);

  const backdrop = document.createElement("div");
  backdrop.id = `${DIALOG_ID}-backdrop`;
  // Use pointerdown, not click — on touch the synthetic click that follows
  // the opening tap (touchend → ~300ms → click) lands on the just-mounted
  // full-viewport backdrop and would immediately re-close the picker.
  // Pointerdown isn't synthesized post-touchend, so it stays inert until
  // the user actually taps outside again.
  backdrop.addEventListener("pointerdown", () => dismissActiveModal());

  const dialog = document.createElement("div");
  dialog.id = DIALOG_ID;

  // Header
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
    },
  });
  dialog.appendChild(body.el);
  // Clicking dialog whitespace refocuses the search so type-to-filter keeps
  // working (the picker body listens for keydown on its own root).
  dialog.addEventListener("click", (e) => {
    e.stopPropagation();
    const t = e.target as HTMLElement;
    if (t.tagName !== "INPUT" && t.tagName !== "BUTTON" && !t.closest?.(".si-row")) {
      body.searchEl.focus();
    }
  });

  // Footer
  const footer = document.createElement("div");
  footer.className = "si-footer";
  const hintL = document.createElement("div");
  hintL.innerHTML =
    "<kbd>↑</kbd> <kbd>↓</kbd> navigate · <kbd>Enter</kbd> select · <kbd>Esc</kbd> close";
  const hintR = document.createElement("div");
  hintR.textContent = "Fuzzy: chars in order · Space = AND";
  footer.appendChild(hintL);
  footer.appendChild(hintR);
  dialog.appendChild(footer);

  function closePicker(): void {
    document.removeEventListener("keydown", onEscape, true);
    body.destroy();
    backdrop.remove();
    dialog.remove();
  }

  function onEscape(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      dismissActiveModal();
    }
  }

  document.body.appendChild(backdrop);
  document.body.appendChild(dialog);
  document.addEventListener("keydown", onEscape, true);

  // Register as the single active modal (kit coordinator) — dismisses any
  // sibling pack's modal first, and lets gesture packs see isModalActive().
  setActiveModal({ id: EXT_NAME, element: dialog, close: closePicker });

  centerActiveRow(body.el);
  body.focus();
}

// ============================================================
// Option C: comfy-modal-kit field provider
// ============================================================

// Register the corpus-annotated fuzzy list as a cross-pack field provider so
// consumers of the shared registry (comfyui-prompt-editor) mount it inline in
// place of the built-in <select>. Additive: consumers that don't resolve a
// provider fall back to their native control; if this pack isn't installed it
// never registers. See ADR-0011 and kit ADR-0001.
registerFieldProvider({
  id: EXT_NAME,
  priority: 10,
  match: (widget) =>
    typeof widget?.name === "string" &&
    (SAMPLER_WIDGET_NAMES.has(widget.name) || SCHEDULER_WIDGET_NAMES.has(widget.name)),
  create: ({ widget, node, initialValue }) => {
    ensureStyle();
    const isScheduler = isSchedulerName(widget?.name);
    const values = resolveComboValues(widget?.options?.values, widget, node);
    const initialStr = String(initialValue ?? widget?.value ?? "");
    const body = createPickerBody({
      values,
      corpus: isScheduler ? SCHEDULERS : SAMPLERS,
      initialValue: initialStr,
      isScheduler,
    });
    return {
      el: body.el,
      getValue: () => body.getValue(),
      hasChanged: () => body.getValue() !== initialStr,
      focus: () => body.focus(),
      destroy: () => body.destroy(),
    };
  },
});

// ============================================================
// Wiring
// ============================================================

function enhanceNode(node: SamplerNode): void {
  if (!node?.widgets) return;
  for (const widget of node.widgets) {
    const w = widget as PatchedWidget;
    const matches = SAMPLER_WIDGET_NAMES.has(w.name) || SCHEDULER_WIDGET_NAMES.has(w.name);
    if (!matches) continue;

    // Option A: tooltip refresh
    if (!w._samplerInfoPatched) {
      w._samplerInfoPatched = true;
      refreshWidgetTooltip(w);
      const origCb = w.callback;
      w.callback = function (this: PatchedWidget, value: unknown, ...rest: unknown[]) {
        const r = origCb
          ? (origCb as (...a: unknown[]) => unknown).call(this, value, ...rest)
          : undefined;
        try {
          refreshWidgetTooltip(w);
        } catch (e) {
          console.warn(`[${EXT_NAME}] tooltip refresh failed`, e);
        }
        return r;
      } as typeof w.callback;
    } else {
      refreshWidgetTooltip(w);
    }

    // Option B: click intercept via the kit's chain-then-consume coordinator.
    // patchWidgetPointer chains the original handler, honors its consumed
    // return, and falls back to the native control on error. The isModalActive
    // guard keeps us from stacking a second modal.
    if (!w._samplerInfoPointerPatched) {
      w._samplerInfoPointerPatched = true;
      patchWidgetPointer(w as unknown as PointerPatchableWidget, (_pointer, ownerNode) => {
        if (isModalActive()) return false;
        openPicker(w, (ownerNode as SamplerNode) || node);
        return true;
      });
    }
  }
}

function refreshAllNodes(): void {
  const graph = app?.graph;
  const nodes = (graph as { _nodes?: unknown[] } | undefined)?._nodes;
  if (!nodes) return;
  for (const node of nodes) enhanceNode(node as SamplerNode);
}

// The lifecycle-hook node params are the package's own `LGraphNode`; cast each
// to the structural `SamplerNode` this pack operates on (only `.widgets` and
// `.setDirtyCanvas` are touched). Params are left un-annotated so they infer
// from `ComfyExtension` and the registration type-checks against the package.
app.registerExtension({
  name: "comfy.sampler-info",
  async setup() {
    await loadCorpus();
    refreshAllNodes();
  },
  async nodeCreated(node) {
    enhanceNode(node as unknown as SamplerNode);
  },
  async loadedGraphNode(node) {
    enhanceNode(node as unknown as SamplerNode);
  },
});
