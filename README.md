# rNet

rNet is an open protocol for connecting user-curated media to AI-powered applications. This repository contains the canonical protocol specification, JSON Schemas, generated TypeScript types and validators, and the conformance suite.

The source-of-truth order is:

1. [`spec/rnet-spec-v0.1.md`](./spec/rnet-spec-v0.1.md) for protocol semantics.
2. [`schemas/0.1/`](./schemas/0.1/) for document shapes.
3. Generated package sources for convenient consumption; never edit them by hand.

## Development

Requires [Bun](https://bun.sh/).

```sh
bun install
bun run codegen
bun run check
```

`bun run codegen:check` verifies that committed generated sources match the canonical schemas. `bun run conformance` runs the schema fixture suite.

Run the HTTP conformance suite against a store with:

```sh
bun run packages/conformance/src/cli.ts run \
  --target http://localhost:3000 \
  --owner-token dev:user \
  --client-token dev:client:rbudget
```

## Packages

- `@rnet/types` — isomorphic TypeScript types and AJV-backed JSON Schema validators.
- `@rnet/conformance` — isomorphic conformance helpers, fixtures, and a separate CLI entry point.

## License

Apache-2.0.
