import { describe, expect, test } from "bun:test";

import fixturesJson from "../fixtures/manifest.json" with { type: "json" };
import { runFixture, runFixtures, type ConformanceFixture } from "../src/index.ts";

const fixtures = fixturesJson as ConformanceFixture[];

describe("rNet 0.1 conformance fixtures", () => {
  for (const fixture of fixtures) {
    test(fixture.name, () => {
      expect(runFixture(fixture).passed).toBe(true);
    });
  }

  test("the complete suite is green", () => {
    const summary = runFixtures(fixtures);
    expect(summary.failed).toBe(0);
    expect(summary.passed).toBe(fixtures.length);
  });

  test("accepted documents survive a JSON round-trip", () => {
    for (const fixture of fixtures.filter((candidate) => candidate.valid)) {
      const roundTripped = JSON.parse(JSON.stringify(fixture.document));
      expect(runFixture({ ...fixture, document: roundTripped }).passed).toBe(true);
    }
  });
});
