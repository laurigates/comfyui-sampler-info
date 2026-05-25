// Smoke test — verifies the Vitest harness is wired up correctly.
// Wave 3 will add the real fuzzy-scorer and corpus-helper tests
// (TRP-001 Gap 1 + Gap 2). This file is the known-green baseline.

import { expect, test } from "vitest";

test("vitest harness wired", () => {
  expect(1).toBe(1);
});
