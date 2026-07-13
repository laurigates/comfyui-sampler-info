// Regression: the inline-mounted picker must NOT nest a scroll container.
//
// When comfyui-prompt-editor mounts the picker inline through the kit's
// field-provider registry, the host shell's `.cmp-body` is the single scroll
// region. A second scroll container on `.si-list` has no definite height in
// that parent chain, so it swallows the touch gesture with nothing to scroll
// and `overscroll-behavior: contain` stops the gesture chaining back out —
// the modal becomes unscrollable. Same bug as comfyui-prompt-editor d39feca
// (`.pe-wrap`); it has now regressed twice, hence this gate.
//
// JSDOM computes no layout, so the CSS source is the only place this contract
// is observable — assert on the rule blocks in the exported `CSS` constant.

import { describe, expect, test } from "vitest";

import { CSS } from "../../src/index.ts";

// Slice out `<selector> { ... }` from the stylesheet source. The declarations
// contain no nested braces, so a non-greedy match to the first `}` is exact.
function ruleBlock(css, selector) {
  const i = css.indexOf(`${selector} {`);
  if (i === -1) return null;
  const end = css.indexOf("}", i);
  return css.slice(i + selector.length + 1, end);
}

describe("inline picker CSS", () => {
  const base = ruleBlock(CSS, ".si-picker .si-list");
  const inline = ruleBlock(CSS, ".si-picker--inline .si-list");

  test("the modal path keeps its scroll container", () => {
    expect(base).not.toBeNull();
    expect(base).toMatch(/overflow-y:\s*auto/);
  });

  test("the inline path declares no scroll container", () => {
    expect(inline).not.toBeNull();
    expect(inline).not.toMatch(/overflow-y:\s*(auto|scroll)/);
    expect(inline).not.toMatch(/max-height/);
    expect(inline).not.toMatch(/overscroll-behavior:\s*contain/);
  });

  // Omitting the scroll declarations is NOT enough: the root carries both
  // classes, so the base `.si-picker .si-list` rule still matches an inline
  // mount. The reset only lands if this block actively overrides it — an
  // inline block that merely *lacks* `overflow-y: auto` would leave the base
  // rule in force and the bug alive, while still passing the test above.
  test("the inline path actively resets the base rule's scroll declarations", () => {
    expect(inline).toMatch(/overflow-y:\s*visible/);
    expect(inline).toMatch(/overscroll-behavior:\s*auto/);
  });

  test("the inline reset overrides the base rule (equal specificity → source order)", () => {
    expect(CSS.indexOf(".si-picker--inline .si-list {")).toBeGreaterThan(
      CSS.indexOf(".si-picker .si-list {"),
    );
  });
});
