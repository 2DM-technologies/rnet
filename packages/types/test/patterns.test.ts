import { describe, expect, test } from "bun:test";

import { rnetSchemas } from "../src/generated/schemas.ts";
import {
  RNET_RECORD_KINDS,
  RNET_ID_URI_PATTERN,
  UUIDV7,
  rnetUriPattern,
  type RnetRecordKind,
} from "../src/patterns.ts";

/**
 * The canonical schemas are the source of truth. These assert that the exported
 * constants reproduce them exactly, so a change to a schema pattern that is not
 * mirrored here fails rather than silently diverging.
 */
function collectPatterns(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) collectPatterns(item, found);
  } else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "pattern" && typeof value === "string") found.push(value);
      else collectPatterns(value, found);
    }
  }
  return found;
}

const schemaPatterns = [
  ...new Set(rnetSchemas.flatMap((schema) => collectPatterns(schema))),
];
const uuidUriPatterns = schemaPatterns.filter(
  (pattern) => pattern.startsWith("^rnet://") && pattern.includes(UUIDV7),
);

describe("record identity patterns", () => {
  test("every UUIDv7 URI schema pattern is reproducible from the exported patterns", () => {
    const reproducible = new Set<string>([RNET_ID_URI_PATTERN]);
    for (const kind of RNET_RECORD_KINDS)
      reproducible.add(rnetUriPattern(kind));
    // source.origins accepts either an artifact or the client that authored the object.
    reproducible.add(rnetUriPattern("origin", "client"));

    for (const pattern of uuidUriPatterns) {
      expect(reproducible).toContain(pattern);
    }
  });

  test("the canonical schemas actually carry UUIDv7 URIs", () => {
    // Guards the test above from passing vacuously if UUIDV7 ever stops matching.
    expect(uuidUriPatterns.length).toBeGreaterThanOrEqual(6);
    for (const kind of [
      "element",
      "object",
      "origin",
      "vibe",
    ] as RnetRecordKind[]) {
      expect(uuidUriPatterns).toContain(rnetUriPattern(kind));
    }
  });

  test("owner URIs require a canonical UUIDv7", () => {
    const owner = schemaPatterns.find((pattern) =>
      pattern.startsWith("^rnet://id/"),
    );
    expect(owner).toBeDefined();
    const ownerPattern = new RegExp(owner!);

    expect(
      ownerPattern.test("rnet://id/018f1f4e-7b3a-7cc1-8b7a-123456789abc"),
    ).toBe(true);
    expect(owner).toBe(RNET_ID_URI_PATTERN);
    expect(ownerPattern.test("rnet://id/noah")).toBe(false);
    expect(ownerPattern.test("rnet://id/018f1f4e-7b3a-4cc1-8b7a-123456789abc")).toBe(false);
  });

  test("rnetUriPattern matches real URIs and rejects UUIDv4", () => {
    const v7 = "018f1f4e-7b3a-7cc1-8b7a-123456789abc";
    const v4 = "018f1f4e-7b3a-4cc1-8b7a-123456789abc";
    expect(
      new RegExp(rnetUriPattern("object")).test(`rnet://object/${v7}`),
    ).toBe(true);
    expect(
      new RegExp(rnetUriPattern("object")).test(`rnet://object/${v4}`),
    ).toBe(false);
    expect(new RegExp(rnetUriPattern("object")).test(`rnet://vibe/${v7}`)).toBe(
      false,
    );
    expect(
      new RegExp(rnetUriPattern("origin", "client")).test(
        `rnet://client/${v7}`,
      ),
    ).toBe(true);
  });

  test("rnetUriPattern rejects an empty kind list", () => {
    expect(() => rnetUriPattern()).toThrow();
  });
});
