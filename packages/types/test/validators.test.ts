import { describe, expect, test } from "bun:test";

import {
  RNET_SCHEMA_VERSION,
  validateMediaObject,
  validateMediaObjectProperties,
  validateSchema,
} from "../src/index.ts";

const uuid = "018f1f4e-7b3a-7cc1-8b7a-123456789abc";
const originUuid = "018f1f4e-7b3a-7cc1-8b7a-123456789abd";
const hash = `sha256:${"a".repeat(64)}`;
const owner = "rnet://id/user-1";

describe("canonical schema behavior", () => {
  test("enforces generated parser provenance", () => {
    expect(validateSchema("ingest-record", { method: "generated_parser", reproducible: true }).ok).toBe(false);
    expect(validateSchema("ingest-record", { method: "generated_parser", reproducible: true, parser_hash: hash }).ok).toBe(true);
  });

  test("enforces agent reproducibility", () => {
    expect(validateSchema("ingest-record", { method: "agent", reproducible: true }).ok).toBe(false);
    expect(validateSchema("ingest-record", { method: "agent", reproducible: false }).ok).toBe(true);
  });

  test("enforces registered object vocabularies", () => {
    const object = {
      rnet_schema: RNET_SCHEMA_VERSION,
      uri: `rnet://object/${uuid}`,
      owner,
      type: "track",
      elements: [],
      source: {
        ingest: { method: "parser", reproducible: true },
        origins: [`rnet://origin/${originUuid}`],
        properties: { artist: "Missing title" },
      },
    };

    expect(validateSchema("media-object", object).ok).toBe(true);
    expect(validateMediaObject(object).ok).toBe(false);
    const transaction = {
      ...object,
      type: "transaction",
      source: { ...object.source, properties: { amount: "-4.50" } },
    };
    expect(validateMediaObject(transaction).ok).toBe(false);
    expect(
      validateMediaObject({
        ...transaction,
        source: { ...transaction.source, properties: { amount: "-4.50", currency: "USD" } },
      }).ok,
    ).toBe(true);
  });

  test("validates an object type vocabulary without requiring a wire envelope", () => {
    expect(validateMediaObjectProperties("track", { artist: "Missing title" }).ok).toBe(false);
    expect(validateMediaObjectProperties("track", { title: "A track" }).ok).toBe(true);
    expect(validateMediaObjectProperties("custom", { anything: true }).ok).toBe(true);

    const invalid = validateMediaObjectProperties(
      "transaction",
      { amount: "-4.50" },
      "/objects/0/properties",
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.issues[0]?.instancePath.startsWith("/objects/0/properties")).toBe(true);
    }
  });

  test("separates UUID record identity from payload identity", () => {
    const element = {
      rnet_schema: RNET_SCHEMA_VERSION,
      uri: `rnet://element/${uuid}`,
      owner,
      content_hash: hash,
      kind: "text",
      mime: "text/plain",
      bytes: "https://blob.example/element",
    };
    expect(validateSchema("media-element", element).ok).toBe(true);
    expect(validateSchema("media-element", { ...element, uri: `rnet://element/${hash}` }).ok).toBe(false);
    expect(validateSchema("media-element", { ...element, owner: undefined }).ok).toBe(false);
  });
});
