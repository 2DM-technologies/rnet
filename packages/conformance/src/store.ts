import {
  validateMediaObject,
  validateSchema,
  type MediaObject,
  type OriginArtifact,
  type Vibe,
} from "@rnet/types";

export interface StoreConformanceOptions {
  target: string;
  ownerToken: string;
  otherOwnerToken: string;
  clientToken: string;
  fetch?: FetchLike;
  payloadFetch?: FetchLike;
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface StoreCheck {
  name: string;
  status: "passed" | "failed" | "skipped";
  passed: boolean;
  detail?: string;
}

export interface StoreConformanceResult {
  passed: number;
  failed: number;
  skipped: number;
  checks: StoreCheck[];
}

const EXPECTED_CHECKS = [
  "owner can create a Vibe",
  "created Vibe conforms to its schema",
  "read grant is enforced positively",
  "owner can upload an origin",
  "origin metadata conforms to its schema",
  "owner can create and attach a grounded object",
  "created object conforms to its schema",
  "store mints the object UUID",
  "object creation rejects client-supplied identity fields",
  "write:objects cannot create a detached element",
  "atomic creation rejects an unresolved upload descriptor",
  "write:objects atomically creates an object and its element",
  "atomically created object conforms to its schema",
  "atomically created element is readable through its Vibe",
  "element payload URL resolves to the committed bytes",
  "read grant reaches objects through Vibe membership",
  "write:user can update only the user block",
  "stale user writes fail with revision_conflict",
  "write:user cannot write source",
  "no grant exposes origins",
  "write:inferred cannot spoof another namespace",
  "client task output cannot mark itself durable",
  "direct user inference uses the user UUID namespace",
  "second owner can create a Vibe",
  "second owner can upload an origin",
  "second owner can upload an element",
  "second owner can create an object",
  "cross-owner element references are rejected",
  "cross-owner origin references are rejected",
  "cross-owner object attachment is rejected",
  "write:objects cannot attach a pre-existing object",
  "owner can create an ordered object batch",
  "Vibe object expansion preserves batch order",
  "owner can revoke grants",
  "revocation fails closed on the next request",
  "suite completed without transport failure",
] as const;

export async function runStoreConformance(
  options: StoreConformanceOptions,
): Promise<StoreConformanceResult> {
  const fetcher: FetchLike = options.fetch ?? globalThis.fetch.bind(globalThis);
  const payloadFetcher: FetchLike = options.payloadFetch ?? globalThis.fetch.bind(globalThis);
  const base = `${options.target.replace(/\/$/, "")}/rnet/v0`;
  const checks: StoreCheck[] = [];
  let vibeId: string | undefined;
  let otherVibeId: string | undefined;

  const check = (name: (typeof EXPECTED_CHECKS)[number], condition: boolean, detail?: string) => {
    checks.push({
      name,
      status: condition ? "passed" : "failed",
      passed: condition,
      ...(detail ? { detail } : {}),
    });
  };
  const ownerHeaders = { Authorization: `Bearer ${options.ownerToken}` };
  const otherOwnerHeaders = { Authorization: `Bearer ${options.otherOwnerToken}` };
  const clientHeaders = { Authorization: `Bearer ${options.clientToken}` };
  const json = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    return fetcher(`${base}${path}`, { ...init, headers });
  };
  const createObjects = async (
    headers: Record<string, string>,
    metadata: unknown,
    uploads: Record<string, { bytes: string; mime: string }> = {},
  ) => {
    const form = new FormData();
    form.set("metadata", JSON.stringify(metadata));
    for (const [name, upload] of Object.entries(uploads)) {
      form.set(name, new Blob([upload.bytes], { type: upload.mime }), name);
    }
    return fetcher(`${base}/objects`, { method: "POST", headers, body: form });
  };

  try {
    const create = await json("/vibes", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        title: `rNet conformance ${new Date().toISOString()}`,
        grants: [
          {
            subject: "client:rbudget",
            scope: ["read", "write:user", "write:objects", "write:inferred"],
          },
        ],
      }),
    });
    check("owner can create a Vibe", create.status === 201, `status ${create.status}`);
    if (!create.ok) return summarize(checks);
    const vibe = (await create.json()) as Vibe;
    const vibeValidation = validateSchema("vibe", vibe);
    check("created Vibe conforms to its schema", vibeValidation.ok, validationDetail(vibeValidation));
    vibeId = vibe.uri.split("/").at(-1);
    if (!vibeId) return summarize(checks);

    const grantedRead = await json(`/vibes/${vibeId}`, { headers: clientHeaders });
    check("read grant is enforced positively", grantedRead.status === 200, `status ${grantedRead.status}`);

    const originBytes = new TextEncoder().encode(`synthetic-rnet-conformance-${vibeId}`);
    const originResponse = await fetcher(`${base}/origins`, {
      method: "POST",
      headers: {
        ...ownerHeaders,
        "Content-Type": "application/octet-stream",
        "X-Rnet-Label": "synthetic-conformance.bin",
      },
      body: originBytes,
    });
    check("owner can upload an origin", [200, 201].includes(originResponse.status), `status ${originResponse.status}`);
    if (!originResponse.ok) return summarize(checks);
    const origin = (await originResponse.json()) as OriginArtifact;
    const originValidation = validateSchema("origin-artifact", origin);
    check("origin metadata conforms to its schema", originValidation.ok, validationDetail(originValidation));

    const objectResponse = await createObjects(ownerHeaders, {
      vibe: vibe.uri,
      objects: [
        {
          type: "transaction",
          elements: [],
          source: {
            ingest: { method: "parser", reproducible: true },
            origins: [origin.uri],
            properties: {
              amount: "-1.00",
              currency: "USD",
              raw_description: "SYNTHETIC CONFORMANCE",
            },
          },
          "x-rnet-conformance": { synthetic: true },
        },
      ],
    });
    check("owner can create and attach a grounded object", objectResponse.status === 201, `status ${objectResponse.status}`);
    if (!objectResponse.ok) return summarize(checks);
    const createdObject = ((await objectResponse.json()) as { mediaObjects: MediaObject[] }).mediaObjects[0];
    const objectValidation = validateMediaObject(createdObject);
    check("created object conforms to its schema", objectValidation.ok, validationDetail(objectValidation));
    const objectId = createdObject?.uri.split("/").at(-1);
    const createdObjectUri = createdObject?.uri;
    check(
      "store mints the object UUID",
      Boolean(
        createdObjectUri &&
          /^rnet:\/\/object\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
            createdObjectUri,
          ),
      ),
      createdObjectUri ?? "object missing from response",
    );
    if (!createdObject || !objectId) return summarize(checks);

    const suppliedIdentity = await createObjects(clientHeaders, {
      vibe: vibe.uri,
      objects: [
        {
          rnet_schema: "0.1",
          uri: "rnet://object/018f1f4e-7b3a-7cc1-8b7a-123456789abc",
          owner: vibe.owner,
          type: "note",
          properties: {},
        },
      ],
    });
    check(
      "object creation rejects client-supplied identity fields",
      suppliedIdentity.status === 422,
      `status ${suppliedIdentity.status}`,
    );

    const detachedElement = await fetcher(`${base}/elements`, {
      method: "POST",
      headers: { ...clientHeaders, "Content-Type": "text/plain", "X-Rnet-Kind": "text" },
      body: "detached client payload",
    });
    check("write:objects cannot create a detached element", detachedElement.status === 403, `status ${detachedElement.status}`);

    const missingUpload = await createObjects(clientHeaders, {
      vibe: vibe.uri,
      objects: [
        {
          type: "note",
          elements: [{ upload: "missing", kind: "text", mime: "text/plain" }],
          properties: { title: "Missing upload" },
        },
      ],
    });
    check("atomic creation rejects an unresolved upload descriptor", missingUpload.status === 422, `status ${missingUpload.status}`);

    const authoredPayload = "atomic client payload";
    const authoredResponse = await createObjects(
      clientHeaders,
      {
        vibe: vibe.uri,
        objects: [
          {
            type: "note",
            elements: [{ upload: "body", kind: "text", mime: "text/plain" }],
            properties: { title: "Atomic conformance note" },
          },
        ],
      },
      { body: { bytes: authoredPayload, mime: "text/plain" } },
    );
    check("write:objects atomically creates an object and its element", authoredResponse.status === 201, `status ${authoredResponse.status}`);
    if (authoredResponse.ok) {
      const authoredObject = ((await authoredResponse.json()) as { mediaObjects: MediaObject[] }).mediaObjects[0];
      const authoredValidation = validateMediaObject(authoredObject);
      check("atomically created object conforms to its schema", authoredValidation.ok, validationDetail(authoredValidation));
      const elementId = authoredObject?.elements[0]?.split("/").at(-1);
      const elementResponse = elementId ? await json(`/elements/${elementId}`, { headers: clientHeaders }) : undefined;
      check(
        "atomically created element is readable through its Vibe",
        elementResponse?.status === 200,
        elementResponse ? `status ${elementResponse.status}` : "object returned no element",
      );
      if (elementResponse?.ok) {
        const element = (await elementResponse.json()) as { bytes?: string; content_hash?: string };
        const payloadResponse = element.bytes ? await payloadFetcher(element.bytes) : undefined;
        const payload = payloadResponse?.ok ? new Uint8Array(await payloadResponse.arrayBuffer()) : undefined;
        const expectedHash = await sha256(new TextEncoder().encode(authoredPayload));
        check(
          "element payload URL resolves to the committed bytes",
          payloadResponse?.ok === true &&
            new TextDecoder().decode(payload) === authoredPayload &&
            element.content_hash === expectedHash,
          payloadResponse ? `status ${payloadResponse.status}` : "element returned no payload URL",
        );
      }
    }

    const clientObject = await json(`/objects/${objectId}`, { headers: clientHeaders });
    check("read grant reaches objects through Vibe membership", clientObject.status === 200, `status ${clientObject.status}`);
    const initialEtag = clientObject.headers.get("ETag") ?? "0";

    const userWrite = await json(`/objects/${objectId}/user`, {
      method: "PATCH",
      headers: { ...clientHeaders, "If-Match": initialEtag },
      body: JSON.stringify({ properties: { reviewed: true } }),
    });
    check("write:user can update only the user block", userWrite.status === 200, `status ${userWrite.status}`);

    const staleWrite = await json(`/objects/${objectId}/user`, {
      method: "PATCH",
      headers: { ...clientHeaders, "If-Match": initialEtag },
      body: JSON.stringify({ properties: { reviewed: false } }),
    });
    check("stale user writes fail with revision_conflict", await hasProblem(staleWrite, 409, "revision_conflict"));

    const sourceWrite = await json(`/objects/${objectId}/user`, {
      method: "PATCH",
      headers: { ...clientHeaders, "If-Match": userWrite.headers.get("ETag") ?? "1" },
      body: JSON.stringify({ properties: {}, source: { properties: { corrupted: true } } }),
    });
    check("write:user cannot write source", sourceWrite.status === 422, `status ${sourceWrite.status}`);

    const originLeak = await json(`/origins/${origin.uri.split("/").at(-1)}`, { headers: clientHeaders });
    check("no grant exposes origins", originLeak.status === 403, `status ${originLeak.status}`);

    const namespaceSpoof = await json(`/objects/${objectId}/inferred`, {
      method: "PUT",
      headers: clientHeaders,
      body: JSON.stringify({ task: "rhizome:spoof", entry: { model: "conformance/test", properties: {} } }),
    });
    check("write:inferred cannot spoof another namespace", namespaceSpoof.status === 403, `status ${namespaceSpoof.status}`);

    const durableTask = await json(`/objects/${objectId}/inferred`, {
      method: "PUT",
      headers: clientHeaders,
      body: JSON.stringify({ task: "forecast", entry: { model: "conformance/test", durable: true, properties: {} } }),
    });
    check("client task output cannot mark itself durable", durableTask.status === 422, `status ${durableTask.status}`);

    const userInference = await json(`/objects/${objectId}/inferred`, {
      method: "PUT",
      headers: ownerHeaders,
      body: JSON.stringify({
        task: "correction",
        entry: { model: "user/direct", durable: true, properties: { corrected: true } },
      }),
    });
    const userInferenceBody = userInference.ok ? ((await userInference.json()) as MediaObject) : undefined;
    const userUuid = vibe.owner.split("/").at(-1);
    check(
      "direct user inference uses the user UUID namespace",
      userInference.status === 200 && Boolean(userInferenceBody?.inferred?.[`user/${userUuid}:correction`]),
      `status ${userInference.status}`,
    );

    const otherVibeResponse = await json("/vibes", {
      method: "POST",
      headers: otherOwnerHeaders,
      body: JSON.stringify({ title: "Other owner conformance" }),
    });
    check("second owner can create a Vibe", otherVibeResponse.status === 201, `status ${otherVibeResponse.status}`);
    if (!otherVibeResponse.ok) return summarize(checks);
    const otherVibe = (await otherVibeResponse.json()) as Vibe;
    otherVibeId = otherVibe.uri.split("/").at(-1);

    const otherOriginResponse = await fetcher(`${base}/origins`, {
      method: "POST",
      headers: { ...otherOwnerHeaders, "Content-Type": "text/plain" },
      body: "other owner origin",
    });
    check("second owner can upload an origin", otherOriginResponse.status === 201, `status ${otherOriginResponse.status}`);
    if (!otherOriginResponse.ok) return summarize(checks);
    const otherOrigin = (await otherOriginResponse.json()) as OriginArtifact;

    const otherElementResponse = await fetcher(`${base}/elements`, {
      method: "POST",
      headers: { ...otherOwnerHeaders, "Content-Type": "text/plain", "X-Rnet-Kind": "text" },
      body: "other owner element",
    });
    check("second owner can upload an element", otherElementResponse.status === 201, `status ${otherElementResponse.status}`);
    if (!otherElementResponse.ok) return summarize(checks);
    const otherElement = (await otherElementResponse.json()) as { uri: string };

    const otherObjectResponse = await createObjects(otherOwnerHeaders, {
      vibe: otherVibe.uri,
      objects: [
        {
          type: "note",
          elements: [],
          source: {
            ingest: { method: "parser", reproducible: true },
            origins: [otherOrigin.uri],
            properties: { title: "Other owner's object" },
          },
        },
      ],
    });
    check("second owner can create an object", otherObjectResponse.status === 201, `status ${otherObjectResponse.status}`);
    if (!otherObjectResponse.ok) return summarize(checks);
    const otherObject = ((await otherObjectResponse.json()) as { mediaObjects: MediaObject[] }).mediaObjects[0];
    if (!otherObject) return summarize(checks);

    const crossElement = await createObjects(ownerHeaders, {
      vibe: vibe.uri,
      objects: [
        {
          type: "note",
          elements: [otherElement.uri],
          source: {
            ingest: { method: "parser", reproducible: true },
            origins: [origin.uri],
            properties: {},
          },
        },
      ],
    });
    check("cross-owner element references are rejected", crossElement.status === 403, `status ${crossElement.status}`);

    const crossOrigin = await createObjects(ownerHeaders, {
      vibe: vibe.uri,
      objects: [
        {
          type: "note",
          elements: [],
          source: {
            ingest: { method: "parser", reproducible: true },
            origins: [otherOrigin.uri],
            properties: {},
          },
        },
      ],
    });
    check("cross-owner origin references are rejected", crossOrigin.status === 403, `status ${crossOrigin.status}`);

    const crossObject = await json(`/vibes/${vibeId}/objects`, {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({ objects: [otherObject.uri] }),
    });
    check("cross-owner object attachment is rejected", crossObject.status === 403, `status ${crossObject.status}`);

    const clientAttach = await json(`/vibes/${vibeId}/objects`, {
      method: "POST",
      headers: clientHeaders,
      body: JSON.stringify({ objects: [createdObject.uri] }),
    });
    check("write:objects cannot attach a pre-existing object", clientAttach.status === 403, `status ${clientAttach.status}`);

    const batchResponse = await createObjects(ownerHeaders, {
      vibe: vibe.uri,
      objects: ["first", "second"].map((title) => ({
        type: "note",
        elements: [],
        source: {
          ingest: { method: "parser", reproducible: true },
          origins: [origin.uri],
          properties: { title },
        },
      })),
    });
    check("owner can create an ordered object batch", batchResponse.status === 201, `status ${batchResponse.status}`);
    if (batchResponse.ok) {
      const batch = ((await batchResponse.json()) as { mediaObjects: MediaObject[] }).mediaObjects;
      const expanded = await json(`/vibes/${vibeId}/objects?expand=full`, { headers: ownerHeaders });
      const expandedObjects = expanded.ok
        ? ((await expanded.json()) as { mediaObjects: MediaObject[] }).mediaObjects
        : [];
      check(
        "Vibe object expansion preserves batch order",
        expanded.status === 200 &&
          expandedObjects.slice(-2).map((item) => item.uri).join(",") ===
            batch.map((item) => item.uri).join(","),
        `status ${expanded.status}`,
      );
    }

    const revoke = await json(`/vibes/${vibeId}`, {
      method: "PATCH",
      headers: ownerHeaders,
      body: JSON.stringify({ grants: [] }),
    });
    check("owner can revoke grants", revoke.status === 200, `status ${revoke.status}`);
    const revokedRead = await json(`/vibes/${vibeId}`, { headers: clientHeaders });
    check("revocation fails closed on the next request", revokedRead.status === 403, `status ${revokedRead.status}`);
    check("suite completed without transport failure", true);
  } catch (error) {
    checks.push({
      name: "suite completed without transport failure",
      status: "failed",
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await Promise.all(
      [
        vibeId ? fetcher(`${base}/vibes/${vibeId}`, { method: "DELETE", headers: ownerHeaders }) : undefined,
        otherVibeId
          ? fetcher(`${base}/vibes/${otherVibeId}`, { method: "DELETE", headers: otherOwnerHeaders })
          : undefined,
      ].map((request) => request?.catch(() => undefined)),
    );
  }

  return summarize(checks);
}

function summarize(checks: StoreCheck[]): StoreConformanceResult {
  const recorded = new Map(checks.map((item) => [item.name, item]));
  const ordered = EXPECTED_CHECKS.map(
    (name): StoreCheck =>
      recorded.get(name) ?? {
        name,
        status: "skipped",
        passed: false,
        detail: "an earlier prerequisite failed",
      },
  );
  return {
    passed: ordered.filter((item) => item.status === "passed").length,
    failed: ordered.filter((item) => item.status === "failed").length,
    skipped: ordered.filter((item) => item.status === "skipped").length,
    checks: ordered,
  };
}

function validationDetail(result: { ok: boolean; issues?: unknown }): string | undefined {
  return result.ok ? undefined : JSON.stringify(result.issues);
}

async function hasProblem(response: Response, status: number, code: string): Promise<boolean> {
  if (response.status !== status) return false;
  const body = (await response.json().catch(() => ({}))) as { code?: string };
  return body.code === code;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return `sha256:${Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}
