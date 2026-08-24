# rNet

rNet is an open protocol for connecting user-curated media to AI-powered applications. It specifies a **data model** and its **semantics** — the nouns, their conformance rules, and what access control must mean. It deliberately does not specify a transport: how a store exposes these objects over HTTP, gRPC, or a local library is an implementation concern.

This repository contains the canonical protocol specification, JSON Schemas, and generated TypeScript types and validators.

The source-of-truth order is:

1. [`spec/rnet-spec-v0.1.md`](./spec/rnet-spec-v0.1.md) for protocol semantics.
2. [`schemas/0.1/`](./schemas/0.1/) for document shapes.
3. Generated package sources for convenient consumption; never edit them by hand.

## Development

Requires [Bun](https://bun.sh/). Published TypeScript entry points require Node.js 22.18 or newer when run directly with Node.

```sh
bun install
bun run codegen
bun run check
```

`bun run codegen:check` verifies that committed generated sources match the canonical schemas. `bun test` runs the validator tests, including the document fixtures in [`packages/types/test/fixtures/`](./packages/types/test/fixtures/) that assert the accept/reject rules in the spec.

## Packages

- `@rnet/types` — isomorphic TypeScript types and AJV-backed JSON Schema validators.

## License

Apache-2.0.
