import {
  validateMediaObject,
  validateSchema,
  type SchemaName,
  type ValidationIssue,
} from "@rnet/types";

export interface ConformanceFixture {
  name: string;
  schema: SchemaName;
  valid: boolean;
  document: unknown;
}

export interface FixtureResult {
  name: string;
  expected: "accept" | "reject";
  actual: "accept" | "reject";
  passed: boolean;
  issues: ValidationIssue[];
}

export interface FixtureSummary {
  passed: number;
  failed: number;
  results: FixtureResult[];
}

export function runFixture(fixture: ConformanceFixture): FixtureResult {
  const validation =
    fixture.schema === "media-object"
      ? validateMediaObject(fixture.document)
      : validateSchema(fixture.schema, fixture.document);
  const accepted = validation.ok;

  return {
    name: fixture.name,
    expected: fixture.valid ? "accept" : "reject",
    actual: accepted ? "accept" : "reject",
    passed: accepted === fixture.valid,
    issues: validation.ok ? [] : validation.issues,
  };
}

export function runFixtures(fixtures: readonly ConformanceFixture[]): FixtureSummary {
  const results = fixtures.map(runFixture);
  const passed = results.filter((result) => result.passed).length;
  return { passed, failed: results.length - passed, results };
}

export * from "./store.ts";
