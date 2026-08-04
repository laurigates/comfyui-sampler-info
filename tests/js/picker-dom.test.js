// @vitest-environment jsdom
//
// DOM-level contract for the on-canvas picker. Complements picker-css.test.js,
// which gates the same scroll contract against the STYLESHEET SOURCE — that
// test exists because the bug regressed twice, and it checks the rules are
// written correctly. This file checks the rules actually resolve that way on a
// mounted picker, which is a different claim: a correct rule attached to the
// wrong element passes the source gate and fails here.
//
// The other suites here are pure helpers (corpus compile, pairing, ranking) and
// cannot see any of this.

import { beforeEach, describe, expect, it } from "vitest";
import { openPicker } from "../../src/index.ts";

const SAMPLERS = ["euler", "euler_ancestral", "dpmpp_2m", "ddim", "uni_pc"];

const samplerWidget = (value = "euler") => ({
  name: "sampler_name",
  value,
  options: { values: [...SAMPLERS] },
});

const node = (extra = []) => ({
  widgets: [
    { name: "scheduler", value: "karras", options: { values: ["normal", "karras"] } },
    ...extra,
  ],
  setDirtyCanvas() {},
});

beforeEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
  // jsdom implements no layout, so Element.scrollIntoView does not exist —
  // centerActiveRow() calls it on open. A no-op stub, not a behaviour change:
  // whether the active row is centred is a layout question this tier cannot
  // answer either way, and belongs to the real-browser tier.
  Element.prototype.scrollIntoView = () => {};
});

function open(w = samplerWidget(), n = node()) {
  openPicker(w, n);
  const dialog = document.getElementById("sampler-info-dialog");
  expect(dialog, "the picker dialog should be on screen").not.toBeNull();
  return dialog;
}

describe("the picker renders its options", () => {
  it("paints a row per combo value", () => {
    const dialog = open();
    expect(dialog.querySelectorAll(".si-row").length).toBeGreaterThanOrEqual(SAMPLERS.length);
  });

  it("marks exactly the widget's current value as current", () => {
    // .si-current is the "this is the value on the node" marker; .si-active is
    // the keyboard cursor. Assert unconditionally — an `if (found)` guard here
    // would pass silently if the class were ever renamed.
    const dialog = open(samplerWidget("dpmpp_2m"));
    const current = [...dialog.querySelectorAll(".si-row.si-current")];
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toMatch(/dpmpp_2m/);
  });

  it("titles itself for the widget it is editing", () => {
    const dialog = open();
    expect(dialog.querySelector(".si-title").textContent).toMatch(/sampler/i);
    expect(dialog.querySelector(".si-widgetname").textContent).toBe("(sampler_name)");
  });
});

describe("scroll ownership in the standalone modal", () => {
  it("scrolls in exactly one place — the option list", () => {
    // Standalone, the dialog gives the list a definite height, so the list
    // SHOULD be the scroller. (Mounted inline the opposite is required, which
    // is what the .si-picker--inline reset in picker-css.test.js gates.)
    const dialog = open();
    const scrollers = [dialog, ...dialog.querySelectorAll("*")]
      .filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowY))
      .map((el) => el.className.split(" ")[0]);
    expect(scrollers).toEqual(["si-list"]);
  });
});

describe("commit and dismissal", () => {
  it("commits the tapped value and closes", () => {
    const w = samplerWidget("euler");
    const dialog = open(w);

    const row = [...dialog.querySelectorAll(".si-row")].find((r) =>
      r.textContent.includes("dpmpp_2m"),
    );
    expect(row, "a dpmpp_2m row should be rendered").toBeTruthy();
    row.click();

    expect(w.value).toBe("dpmpp_2m");
    expect(document.getElementById("sampler-info-dialog")).toBeNull();
  });

  it("closes without committing when the close button is tapped", () => {
    const w = samplerWidget("euler");
    const dialog = open(w);
    dialog.querySelector(".si-close").click();

    expect(w.value).toBe("euler");
    expect(document.getElementById("sampler-info-dialog")).toBeNull();
  });

  it("closes without committing on a backdrop tap", () => {
    // pointerdown, not click: the synthetic click following the opening tap
    // would otherwise land on the just-mounted backdrop and close immediately.
    const w = samplerWidget("euler");
    open(w);
    const backdrop = document.getElementById("sampler-info-dialog-backdrop");
    expect(backdrop).not.toBeNull();
    backdrop.dispatchEvent(new Event("pointerdown", { bubbles: true }));

    expect(w.value).toBe("euler");
    expect(document.getElementById("sampler-info-dialog")).toBeNull();
  });

  it("opens only one picker at a time", () => {
    open();
    open();
    expect(document.querySelectorAll("#sampler-info-dialog")).toHaveLength(1);
  });
});
