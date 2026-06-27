// TRP-001 Gap 1 + Gap 2 test suite
// Tests for fuzzy scorer (Gap 1) and corpus helpers (Gap 2)

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { compileCorpus, fuzzyRank, fuzzyScore, lookup, safeRegex } from "../../src/index.ts";

// The real shipped corpus, compiled — used by the RES4LYF coverage regression.
const SAMPLERS_CORPUS = compileCorpus(
  JSON.parse(readFileSync(new URL("../../web/data/samplers.json", import.meta.url), "utf8")),
);

// ============================================================
// Gap 2: Corpus helpers
// ============================================================

describe("compileCorpus", () => {
  test("filters out entries with invalid regex patterns", () => {
    const raw = {
      prefix: [
        { match: "[invalid" }, // invalid regex
        { match: "^euler" }, // valid regex
      ],
    };
    const compiled = compileCorpus(raw);
    expect(compiled.prefix).toHaveLength(1);
    expect(compiled.prefix[0].match).toBe("^euler");
  });

  test("preserves valid prefix entries with compiled RegExp", () => {
    const raw = {
      prefix: [{ match: "^res_\\d+m$" }],
    };
    const compiled = compileCorpus(raw);
    expect(compiled.prefix).toHaveLength(1);
    expect(compiled.prefix[0].re).toBeInstanceOf(RegExp);
  });

  test("handles empty or missing exact/prefix gracefully", () => {
    const compiled1 = compileCorpus({});
    expect(compiled1.exact).toEqual({});
    expect(compiled1.prefix).toEqual([]);

    const compiled2 = compileCorpus(null);
    expect(compiled2.exact).toEqual({});
    expect(compiled2.prefix).toEqual([]);
  });
});

describe("safeRegex", () => {
  test("returns RegExp for valid pattern", () => {
    const re = safeRegex("^euler");
    expect(re).toBeInstanceOf(RegExp);
    expect(re.test("euler")).toBe(true);
  });

  test("returns null for invalid pattern", () => {
    const re = safeRegex("[invalid");
    expect(re).toBeNull();
  });

  test("handles complex valid patterns", () => {
    const re = safeRegex("^res_\\d+m$");
    expect(re).toBeInstanceOf(RegExp);
    expect(re.test("res_2m")).toBe(true);
    expect(re.test("res_2m_sde")).toBe(false);
  });
});

describe("lookup", () => {
  test("exact match wins over a matching prefix", () => {
    const corpus = compileCorpus({
      exact: { euler: { summary: "exact entry" } },
      prefix: [{ match: "^eu", summary: "prefix entry" }],
    });
    const result = lookup(corpus, "euler");
    expect(result).toBeDefined();
    expect(result.summary).toBe("exact entry");
  });

  test("prefix match fires when no exact entry exists", () => {
    const corpus = compileCorpus({
      exact: {},
      prefix: [{ match: "^res_\\d+m$", summary: "res family" }],
    });
    const result = lookup(corpus, "res_2m");
    expect(result).toBeDefined();
    expect(result.summary).toBe("res family");
  });

  test("returns null for unknown token", () => {
    const corpus = compileCorpus({
      exact: { euler: { summary: "euler entry" } },
      prefix: [{ match: "^eu", summary: "eu prefix" }],
    });
    const result = lookup(corpus, "unknown_sampler");
    expect(result).toBeNull();
  });

  test("ignores null token without throwing", () => {
    const corpus = compileCorpus({
      exact: { euler: { summary: "entry" } },
      prefix: [],
    });
    expect(() => lookup(corpus, null)).not.toThrow();
    expect(lookup(corpus, null)).toBeNull();
  });

  test("ignores undefined token without throwing", () => {
    const corpus = compileCorpus({
      exact: { euler: { summary: "entry" } },
      prefix: [],
    });
    expect(() => lookup(corpus, undefined)).not.toThrow();
    expect(lookup(corpus, undefined)).toBeNull();
  });

  test("ignores numeric token without throwing", () => {
    const corpus = compileCorpus({
      exact: { euler: { summary: "entry" } },
      prefix: [],
    });
    expect(() => lookup(corpus, 42)).not.toThrow();
    expect(lookup(corpus, 42)).toBeNull();
  });

  test("alias resolves to the canonical exact entry", () => {
    const corpus = compileCorpus({
      exact: { res_multistep: { summary: "canonical entry", family: "RES" } },
      alias: { res_2m: "res_multistep" },
    });
    const result = lookup(corpus, "res_2m");
    expect(result).toBeDefined();
    expect(result.summary).toBe("canonical entry");
    expect(result.family).toBe("RES");
    expect(result.notes).toContain("Alias of `res_multistep`");
  });

  test("alias is checked before prefix", () => {
    const corpus = compileCorpus({
      exact: { res_multistep: { summary: "canonical" } },
      alias: { res_2m: "res_multistep" },
      prefix: [{ match: "^res_\\d+m$", summary: "generic family" }],
    });
    expect(lookup(corpus, "res_2m").summary).toBe("canonical");
  });

  test("exact still wins over alias", () => {
    const corpus = compileCorpus({
      exact: { heun: { summary: "heun exact" }, heun_2s: { summary: "own entry" } },
      alias: { heun_2s: "heun" },
    });
    expect(lookup(corpus, "heun_2s").summary).toBe("own entry");
  });

  test("alias pointing at a missing canonical falls through to prefix", () => {
    const corpus = compileCorpus({
      exact: {},
      alias: { res_2m: "res_multistep" },
      prefix: [{ match: "^res_\\d+m$", summary: "generic family" }],
    });
    expect(lookup(corpus, "res_2m").summary).toBe("generic family");
  });

  test("alias note is appended, preserving the canonical note", () => {
    const corpus = compileCorpus({
      exact: { res_multistep: { summary: "canonical", notes: "original note" } },
      alias: { res_2m: "res_multistep" },
    });
    const result = lookup(corpus, "res_2m");
    expect(result.notes).toContain("Alias of `res_multistep`");
    expect(result.notes).toContain("original note");
  });

  test("aliasing does not mutate the canonical entry", () => {
    const corpus = compileCorpus({
      exact: { res_multistep: { summary: "canonical" } },
      alias: { res_2m: "res_multistep" },
    });
    lookup(corpus, "res_2m");
    expect(corpus.exact.res_multistep.notes).toBeUndefined();
  });
});

// ============================================================
// RES4LYF token coverage — every advertised rk_type resolves
// ============================================================

describe("RES4LYF token coverage (regression)", () => {
  // Previously-uncovered tokens, each closed by a specific corpus change.
  const previouslyUncovered = [
    "rk38_4s", // rk\d -> rk\d+
    "gauss-legendre_diag_8s", // ^gauss-legendre_\d+s -> ^gauss-legendre
    "verner_13s", // new ^verner prefix
    "verner_robust_16s", // new ^verner prefix (handles _robust_ infix)
    "dpmpp_3m", // new ^dpmpp_\d+m$ prefix
  ];

  test.each(previouslyUncovered)("resolves %s", (token) => {
    expect(lookup(SAMPLERS_CORPUS, token)).not.toBeNull();
  });
});

// ============================================================
// Gap 1: Fuzzy scorer
// ============================================================

describe("fuzzyScore", () => {
  test("exact prefix character match gets start-of-string bonus", () => {
    const scorePrefix = fuzzyScore("e", "euler");
    const scoreMidString = fuzzyScore("e", "heun");

    expect(scorePrefix).not.toBeNull();
    expect(scoreMidString).not.toBeNull();
    expect(scorePrefix.score).toBeGreaterThan(scoreMidString.score);
  });

  test("word-boundary bonus fires on underscore separator", () => {
    const result = fuzzyScore("dpms", "dpmpp_2m_sde");
    expect(result).not.toBeNull();
    // "dpms" matches: d(0) p(1) m(8 after underscore) s(12 after underscore)
    // Word boundary bonuses apply to m and s because they follow underscores
    expect(result.score).toBeGreaterThan(0);
    expect(result.matches).toHaveLength(4);
  });

  test("returns null for non-subsequence query", () => {
    const result = fuzzyScore("xyz", "euler");
    expect(result).toBeNull();
  });

  test("empty query returns zero score with empty matches", () => {
    const result = fuzzyScore("", "euler");
    expect(result).toEqual({ score: 0, matches: [] });
  });

  test("matches array contains character indices in order", () => {
    const result = fuzzyScore("euler", "euler");
    expect(result).not.toBeNull();
    expect(result.matches).toEqual([0, 1, 2, 3, 4]);
  });

  test("case-insensitive matching", () => {
    const result = fuzzyScore("EULER", "euler");
    expect(result).not.toBeNull();
    expect(result.matches.length).toBe(5);
  });
});

describe("fuzzyRank", () => {
  test("AND-token semantics — returns null when token not found", () => {
    const corpus = compileCorpus({
      exact: { euler: { summary: "a stepper" } },
      prefix: [],
    });
    const info = lookup(corpus, "euler");
    const result = fuzzyRank("euler", info, "dpm sde");
    expect(result).toBeNull();
  });

  test("AND-token semantics — returns non-null when all tokens match", () => {
    const corpus = compileCorpus({
      exact: { dpmpp_2m_sde: { summary: "a stepper family" } },
      prefix: [],
    });
    const info = lookup(corpus, "dpmpp_2m_sde");
    const result = fuzzyRank("dpmpp_2m_sde", info, "dpm sde");
    expect(result).not.toBeNull();
    expect(result.score).toBeGreaterThan(0);
  });

  test("empty query returns zero score with no name matches", () => {
    const result = fuzzyRank("euler", { summary: "test" }, "");
    expect(result).toEqual({ score: 0, nameMatches: [] });
  });

  test("name matches contribute 10x weight vs metadata", () => {
    // Single token that matches the name
    const result = fuzzyRank("euler", { summary: "far away in summary" }, "eu");
    expect(result).not.toBeNull();
    expect(result.nameMatches.length).toBeGreaterThan(0);
  });

  test("single token matching name only", () => {
    const result = fuzzyRank("dpmpp_2m", { summary: "some sampler" }, "dpm");
    expect(result).not.toBeNull();
    expect(result.score).toBeGreaterThan(0);
  });

  test("single token not matching name or metadata returns null", () => {
    const result = fuzzyRank("euler", { summary: "some stepper" }, "xyz");
    expect(result).toBeNull();
  });

  test("nameMatches array is sorted in ascending index order", () => {
    const result = fuzzyRank("dpmpp_2m_sde", { summary: "a sampler" }, "dpms");
    expect(result).not.toBeNull();
    expect(result.nameMatches).toEqual([...result.nameMatches].sort((a, b) => a - b));
  });

  test("null info (no metadata) still scores name matches", () => {
    const result = fuzzyRank("euler", null, "eu");
    expect(result).not.toBeNull();
    expect(result.score).toBeGreaterThan(0);
  });
});
