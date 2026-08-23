# JSON Schema → Zod spike

Tested `json-schema-to-zod` 2.8.1 against the eight canonical JSON Schema 2020-12 documents on 2026-08-21.

The generated validators were not faithful enough to ship:

- Both `ingest-record.json` `if`/`then` conditions became `z.any()`, so a generated parser did not require `parser_hash` and an agent could claim `reproducible: true`.
- The external `$ref` from `media-object.json` to `ingest-record.json` became `z.any()`.
- `propertyNames` on inferred maps was dropped, so unprefixed task keys were accepted.
- The `patternProperties` plus `additionalProperties: false` case was translated into custom refinement code, but retaining it would not recover the lost conditions and references above.

M0 therefore takes the implementation plan's fidelity fallback: AJV executes the canonical schemas directly, `ajv-formats` enables format assertions, and `json-schema-to-ts` derives static types from generated `as const` schema modules. The generated modules are committed and checked for drift in CI.
