// Sampler↔scheduler pairing affinity.
//
// `pairs_with` exists ONLY on sampler entries, so affinity is one symmetric
// predicate resolved through `lookup()` (exact -> alias -> prefix). These tests
// pin the two directions, the fail-soft contract (no `pairs_with` ⇒ no badge,
// no reordering), the browse-mode boost, and — the regression that matters most
// — that the sibling's value is read from the host's LIVE bus, never from the
// node's stale committed value.

import { describe, expect, test } from "vitest";

import { compileCorpus, pairsWith, rankOptions, readSiblingValue } from "../../src/index.ts";

const SAMPLERS = compileCorpus({
  exact: {
    dpmpp_2m: { summary: "dpmpp_2m", pairs_with: ["karras", "exponential"] },
    euler: { summary: "euler", pairs_with: ["normal", "simple"] },
    // No pairs_with — the additive contract's control case.
    ddim: { summary: "ddim" },
  },
  alias: { res_2m: "res_multistep" },
  prefix: [{ match: "^res_\\d+s", summary: "RES single-step", pairs_with: ["beta57", "normal"] }],
});

const SCHEDULERS = compileCorpus({
  exact: { karras: {}, exponential: {}, normal: {}, simple: {}, beta57: {} },
});

describe("pairsWith", () => {
  test("resolves a sampler's declared scheduler", () => {
    expect(pairsWith(SAMPLERS, "dpmpp_2m", "karras")).toBe(true);
    expect(pairsWith(SAMPLERS, "dpmpp_2m", "normal")).toBe(false);
  });

  test("is symmetric — the same predicate answers both pickers", () => {
    // Scheduler picker: sibling is the sampler, option is the scheduler.
    expect(pairsWith(SAMPLERS, "euler", "simple")).toBe(true);
    // Sampler picker: option is the sampler, sibling is the scheduler.
    expect(pairsWith(SAMPLERS, "euler", "karras")).toBe(false);
    expect(pairsWith(SAMPLERS, "dpmpp_2m", "karras")).toBe(true);
  });

  test("a prefix-family token resolves through lookup()", () => {
    // `res_2s` has no exact entry — it hits the ^res_\d+s prefix family, whose
    // pairs_with is what the badge must come from. This is why no reverse index
    // or scheduler-side pairs_with list can exist: only lookup() knows.
    expect(pairsWith(SAMPLERS, "res_2s", "beta57")).toBe(true);
    expect(pairsWith(SAMPLERS, "res_2s", "karras")).toBe(false);
  });

  test("no pairs_with on the entry ⇒ false (fail-soft, no badge)", () => {
    expect(pairsWith(SAMPLERS, "ddim", "karras")).toBe(false);
  });

  test("an unknown or absent sampler token ⇒ false", () => {
    expect(pairsWith(SAMPLERS, "not_a_sampler", "karras")).toBe(false);
    expect(pairsWith(SAMPLERS, null, "karras")).toBe(false);
  });

  test("an absent scheduler token ⇒ false", () => {
    expect(pairsWith(SAMPLERS, "dpmpp_2m", null)).toBe(false);
    expect(pairsWith(SAMPLERS, "dpmpp_2m", "")).toBe(false);
  });
});

describe("readSiblingValue", () => {
  const names = ["sampler_name", "sampler"];
  // What the node holds — in the inline host this is the COMMITTED value, i.e.
  // whatever the sampler was before the modal opened.
  const staleNode = { widgets: [{ name: "sampler_name", value: "ddim" }] };

  test("prefers the host's live value over the node's committed one", () => {
    const value = readSiblingValue({
      names,
      node: staleNode,
      getSiblingValue: (n) => (n === "sampler_name" ? "dpmpp_2m" : undefined),
    });
    expect(value).toBe("dpmpp_2m");
    expect(value).not.toBe("ddim"); // the stale node value must never win
  });

  test("tries every candidate widget name (a node may say `sampler`)", () => {
    const value = readSiblingValue({
      names,
      node: null,
      getSiblingValue: (n) => (n === "sampler" ? "euler" : undefined),
    });
    expect(value).toBe("euler");
  });

  test("falls back to the node when the host supplies no live bus", () => {
    // An older comfyui-prompt-editor, or the standalone modal path — there only
    // one widget is being edited, so the node's value IS the live one.
    expect(readSiblingValue({ names, node: staleNode })).toBe("ddim");
  });

  test("returns null when neither source has a value", () => {
    expect(readSiblingValue({ names, node: { widgets: [] } })).toBeNull();
    expect(readSiblingValue({ names, node: null })).toBeNull();
  });
});

describe("rankOptions browse-mode boost", () => {
  const schedulerValues = ["normal", "simple", "karras", "exponential", "beta57"];

  function browse(sibling, selectedValue = "normal") {
    return rankOptions({
      values: schedulerValues,
      corpus: SCHEDULERS,
      samplers: SAMPLERS,
      isScheduler: true,
      sibling,
      query: "",
      selectedValue,
    }).map((r) => r.value);
  }

  test("paired options sort above unpaired, current value first", () => {
    // dpmpp_2m pairs with karras + exponential; current value is `normal`.
    expect(browse("dpmpp_2m")).toEqual(["normal", "karras", "exponential", "simple", "beta57"]);
  });

  test("paired options keep their native relative order", () => {
    expect(browse("dpmpp_2m", "beta57").slice(1, 3)).toEqual(["karras", "exponential"]);
  });

  test("no sibling ⇒ native order, exactly as before the feature", () => {
    expect(browse(null)).toEqual(schedulerValues);
  });

  test("a sampler with no pairs_with ⇒ native order (additive contract)", () => {
    expect(browse("ddim")).toEqual(schedulerValues);
  });

  test("marks the paired options for the badge", () => {
    const ranked = rankOptions({
      values: schedulerValues,
      corpus: SCHEDULERS,
      samplers: SAMPLERS,
      isScheduler: true,
      sibling: "dpmpp_2m",
      query: "",
      selectedValue: "normal",
    });
    const paired = ranked.filter((r) => r.paired).map((r) => r.value);
    expect(paired.sort()).toEqual(["exponential", "karras"]);
  });
});

describe("rankOptions with a query", () => {
  const schedulerValues = ["normal", "simple", "karras", "exponential", "beta57"];

  test("typed search is ranked by relevance, never reordered by pairing", () => {
    // `simple` is NOT paired with dpmpp_2m, but it is the only name matching
    // the query — pairing must not push karras/exponential above it.
    const ranked = rankOptions({
      values: schedulerValues,
      corpus: SCHEDULERS,
      samplers: SAMPLERS,
      isScheduler: true,
      sibling: "dpmpp_2m",
      query: "simple",
      selectedValue: "normal",
    });
    expect(ranked[0].value).toBe("simple");
    expect(ranked[0].paired).toBe(false);
  });

  test("the badge survives a query even though the order does not", () => {
    const ranked = rankOptions({
      values: schedulerValues,
      corpus: SCHEDULERS,
      samplers: SAMPLERS,
      isScheduler: true,
      sibling: "dpmpp_2m",
      query: "karras",
      selectedValue: "normal",
    });
    expect(ranked[0].value).toBe("karras");
    expect(ranked[0].paired).toBe(true);
  });

  test("searching a scheduler name in the SAMPLER picker surfaces its partners", () => {
    // rankFields feeds pairs_with to the ranker, so `karras` finds dpmpp_2m
    // even though the word appears nowhere in its prose.
    const ranked = rankOptions({
      values: ["euler", "ddim", "dpmpp_2m"],
      corpus: SAMPLERS,
      samplers: SAMPLERS,
      isScheduler: false,
      sibling: null,
      query: "karras",
      selectedValue: "euler",
    });
    expect(ranked.map((r) => r.value)).toContain("dpmpp_2m");
  });
});
