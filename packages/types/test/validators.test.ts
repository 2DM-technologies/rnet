import { describe, expect, test } from "bun:test";

import {
  RNET_SCHEMA_VERSION,
  validateMediaObject,
  validateMediaObjectProperties,
  validateSchema,
} from "../src/index.ts";

const uuid = "018f1f4e-7b3a-7cc1-8b7a-123456789abc";
const originUuid = "018f1f4e-7b3a-7cc1-8b7a-123456789abd";
const clientUuid = "018f1f4e-7b3a-7cc1-8b7a-123456789abe";
const hash = `sha256:${"a".repeat(64)}`;
const owner = "rnet://id/0198f2a0-4d11-7a83-b5c6-1e9f0a2b3c4d";

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
    const tweet = {
      ...object,
      type: "tweet",
      elements: [{ uri: `rnet://element/${uuid}`, role: "content" }],
      keys: {
        x_tweet_id: "1234567890",
        x_author_id: "9876543210",
        canonical_url: "https://x.com/example/status/1234567890",
      },
      source: {
        ...object.source,
        properties: {
          published_at: "2026-08-21T12:00:00Z",
          author_handle: "example",
          author_name: "Example User",
          post_kind: "original",
          language: "en",
          entities: { urls: [] },
        },
      },
    };
    expect(validateMediaObject(tweet).ok).toBe(true);
    expect(
      validateMediaObject({
        ...tweet,
        source: { ...tweet.source, properties: { ...tweet.source.properties, text: "duplicate" } },
      }).ok,
    ).toBe(false);
    expect(
      validateMediaObject({
        ...tweet,
        source: { ...tweet.source, properties: { post_kind: "reply" } },
      }).ok,
    ).toBe(false);
  });

  test("validates an object type vocabulary without requiring a wire envelope", () => {
    expect(validateMediaObjectProperties("track", { artist: "Missing title" }).ok).toBe(false);
    expect(validateMediaObjectProperties("track", { title: "A track" }).ok).toBe(true);
    expect(
      validateMediaObjectProperties("tweet", {
        published_at: "2026-08-21T12:00:00Z",
        post_kind: "quote",
      }).ok,
    ).toBe(true);
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

  test("correlates provenance method with the origin namespace", () => {
    const authored = {
      rnet_schema: RNET_SCHEMA_VERSION,
      uri: `rnet://object/${uuid}`,
      owner,
      type: "note",
      elements: [],
      source: {
        ingest: { method: "authored", reproducible: false },
        origins: [`rnet://client/${clientUuid}`],
        properties: {},
      },
    };
    expect(validateSchema("media-object", authored).ok).toBe(true);
    expect(
      validateSchema("media-object", {
        ...authored,
        source: { ...authored.source, origins: [`rnet://origin/${originUuid}`] },
      }).ok,
    ).toBe(false);

    const parsed = {
      ...authored,
      source: {
        ...authored.source,
        ingest: { method: "parser", reproducible: true },
        origins: [`rnet://origin/${originUuid}`],
      },
    };
    expect(validateSchema("media-object", parsed).ok).toBe(true);
    expect(
      validateSchema("media-object", {
        ...parsed,
        source: { ...parsed.source, origins: [`rnet://client/${clientUuid}`] },
      }).ok,
    ).toBe(false);
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

  test("requires structured element associations and validates their context", () => {
    const object = {
      rnet_schema: RNET_SCHEMA_VERSION,
      uri: `rnet://object/${uuid}`,
      owner,
      type: "note",
      elements: [
        {
          uri: `rnet://element/${uuid}`,
          role: "content",
          alt: "Synthetic note body",
        },
      ],
      source: {
        ingest: { method: "authored", reproducible: false },
        origins: [`rnet://client/${clientUuid}`],
        properties: {},
      },
    };

    expect(validateSchema("media-object", object).ok).toBe(true);
    expect(
      validateSchema("media-object", {
        ...object,
        elements: [`rnet://element/${uuid}`],
      }).ok,
    ).toBe(false);
    expect(
      validateSchema("media-object", {
        ...object,
        elements: [{ uri: `rnet://element/${uuid}`, role: "thumbnail" }],
      }).ok,
    ).toBe(false);
    expect(
      validateSchema("media-object", {
        ...object,
        elements: [{ uri: `rnet://element/${uuid}`, caption: "not in the vocabulary" }],
      }).ok,
    ).toBe(false);
  });

  test("requires UUIDv7 user identities in owners and grant subjects", () => {
    expect(validateSchema("media-element", {
      rnet_schema: RNET_SCHEMA_VERSION,
      uri: `rnet://element/${uuid}`,
      owner: "rnet://id/alice",
      content_hash: hash,
      kind: "text",
      mime: "text/plain",
      bytes: "https://blob.example/element",
    }).ok).toBe(false);
    expect(validateSchema("grant", { subject: `id:${owner}`, scope: ["read"] }).ok).toBe(true);
    expect(validateSchema("grant", { subject: "id:rnet://id/alice", scope: ["read"] }).ok).toBe(
      false,
    );
    expect(validateSchema("grant", {
      subject: "id:rnet://id/018f1f4e-7b3a-4cc1-8b7a-123456789abc",
      scope: ["read"],
    }).ok).toBe(false);
  });
});
