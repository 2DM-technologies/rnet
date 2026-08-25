/**
 * Record identity patterns.
 *
 * Plan §9: element, origin, object, Vibe, and client record URIs use UUIDv7 in
 * canonical hyphenated form. That body appears in five distinct patterns across
 * seven sites in the canonical schemas, so it is stated once here and verified
 * against those schemas in `test/patterns.test.ts` — the JSON stays the source of
 * truth, and this constant cannot drift from it without a test failing.
 *
 * User identity URIs and protocol record URIs both use canonical UUIDv7 bodies.
 */
export const UUIDV7 = "[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

/** A canonical user identity URI. */
export const RNET_ID_URI_PATTERN = `^rnet://id/${UUIDV7}$`;

/** A bare UUIDv7, anchored — for a path segment or an identifier field. */
export const UUIDV7_PATTERN = `^${UUIDV7}$`;

/** A bare task name supplied before the store adds its authenticated writer prefix. */
export const TASK = "[a-z][a-z0-9_]*";
export const TASK_PATTERN = `^${TASK}$`;

/** Record kinds whose URIs carry a store-minted UUIDv7. */
export const RNET_RECORD_KINDS = ["client", "element", "object", "origin", "vibe"] as const;

export type RnetRecordKind = (typeof RNET_RECORD_KINDS)[number];

/**
 * The anchored pattern for an `rnet://{kind}/{uuidv7}` URI. Pass more than one kind
 * for an alternation, as `source.origins` does with origin and client.
 */
export function rnetUriPattern(...kinds: readonly RnetRecordKind[]): string {
  if (!kinds.length) throw new Error("rnetUriPattern requires at least one record kind");
  const kind = kinds.length === 1 ? kinds[0] : `(${kinds.join("|")})`;
  return `^rnet://${kind}/${UUIDV7}$`;
}
