import { describe, expect, test } from "bun:test";

import fixturesJson from "./fixtures/manifest.json" with { type: "json" };
import { validateMediaObject, validateSchema, type SchemaName } from "../src/index.ts";

interface Fixture {
  name: string;
  schema: SchemaName;
  valid: boolean;
  document: unknown;
}

const fixtures = fixturesJson as Fixture[];

function accepts({ schema, document }: Pick<Fixture, "schema" | "document">) {
  return schema === "media-object"
    ? validateMediaObject(document)
    : validateSchema(schema, document);
}

describe("rNet 0.1 document fixtures", () => {
  for (const fixture of fixtures) {
    test(fixture.name, () => {
      const validation = accepts(fixture);
      if (fixture.valid && !validation.ok) {
        expect(validation.issues).toEqual([]);
      }
      expect(validation.ok).toBe(fixture.valid);
    });
  }

  test("accepted documents survive a JSON round-trip", () => {
    for (const fixture of fixtures.filter((candidate) => candidate.valid)) {
      const document = JSON.parse(JSON.stringify(fixture.document)) as unknown;
      expect(accepts({ schema: fixture.schema, document }).ok).toBe(true);
    }
  });
});
