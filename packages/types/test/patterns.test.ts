import { describe, expect, test } from "bun:test";

import { rnetSchemas } from "../src/generated/schemas.ts";
import {
  RNET_RECORD_KINDS,
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
const uuidBearing = schemaPatterns.filter((pattern) =>
  pattern.includes(UUIDV7),
);

describe("record identity patterns", () => {
  test("every UUID-bearing schema pattern is reproducible from rnetUriPattern", () => {
    const reproducible = new Set<string>();
    for (const kind of RNET_RECORD_KINDS)
      reproducible.add(rnetUriPattern(kind));
    // source.origins accepts either an artifact or the client that authored the object.
    reproducible.add(rnetUriPattern("origin", "client"));

    for (const pattern of uuidBearing) {
      expect(reproducible).toContain(pattern);
    }
  });

  test("the canonical schemas actually carry UUIDv7 URIs", () => {
    // Guards the test above from passing vacuously if UUIDV7 ever stops matching.
    expect(uuidBearing.length).toBeGreaterThanOrEqual(5);
    for (const kind of [
      "element",
      "object",
      "origin",
      "vibe",
    ] as RnetRecordKind[]) {
      expect(uuidBearing).toContain(rnetUriPattern(kind));
    }
  });

  test("owner URIs permit a UUID without requiring one", () => {
    const owner = schemaPatterns.find((pattern) =>
      pattern.startsWith("^rnet://id/"),
    );
    expect(owner).toBeDefined();
    const ownerPattern = new RegExp(owner!);

    // Rhizome mints UUID owners, so the shape has to be accepted.
    expect(
      ownerPattern.test("rnet://id/018f1f4e-7b3a-7cc1-8b7a-123456789abc"),
    ).toBe(true);

    // But the protocol must not mandate it: identity issuance is out of protocol
    // (spec §5), so requiring a UUIDv7 here would make one store's choice binding
    // on every other implementation.
    expect(owner).not.toContain(UUIDV7);
    expect(ownerPattern.test("rnet://id/noah")).toBe(true);
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
