import {
  RNET_SCHEMA_VERSION,
  validateMediaObject,
  validateSchema,
  type MediaObject,
  type OriginArtifact,
  type Vibe,
} from "@rnet/types";

export interface StoreConformanceOptions {
  target: string;
  ownerToken: string;
  clientToken: string;
  fetch?: FetchLike;
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface StoreCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface StoreConformanceResult {
  passed: number;
  failed: number;
  checks: StoreCheck[];
}

export async function runStoreConformance(options: StoreConformanceOptions): Promise<StoreConformanceResult> {
  const fetcher: FetchLike = options.fetch ?? globalThis.fetch.bind(globalThis);
  const base = `${options.target.replace(/\/$/, "")}/rnet/v0`;
  const checks: StoreCheck[] = [];
  let vibeId: string | undefined;

  const check = (name: string, condition: boolean, detail?: string) => {
    checks.push({ name, passed: condition, ...(detail ? { detail } : {}) });
  };
  const ownerHeaders = { Authorization: `Bearer ${options.ownerToken}` };
  const clientHeaders = { Authorization: `Bearer ${options.clientToken}` };
  const json = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    return fetcher(`${base}${path}`, { ...init, headers });
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
            scope: ["read", "write:user", "write:inferred"],
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

    const object: MediaObject = {
      rnet_schema: RNET_SCHEMA_VERSION,
      uri: `rnet://object/${vibeId}`,
      owner: vibe.owner,
      type: "transaction",
      elements: [],
      source: {
        ingest: { method: "parser", reproducible: true },
        origins: [origin.uri],
        properties: { amount: -1, currency: "USD", raw_description: "SYNTHETIC CONFORMANCE" },
      },
      "x-rnet-conformance": { synthetic: true },
    };
    const objectResponse = await json("/objects", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({ vibe: vibe.uri, objects: [object] }),
    });
    check("owner can create and attach a grounded object", objectResponse.status === 201, `status ${objectResponse.status}`);
    if (!objectResponse.ok) return summarize(checks);
    const createdObject = ((await objectResponse.json()) as { mediaObjects: MediaObject[] })
      .mediaObjects[0];
    const objectValidation = validateMediaObject(createdObject);
    check("created object and registered vocabulary conform", objectValidation.ok, validationDetail(objectValidation));

    const clientObject = await json(`/objects/${vibeId}`, { headers: clientHeaders });
    check("read grant reaches objects through Vibe membership", clientObject.status === 200, `status ${clientObject.status}`);
    const initialEtag = clientObject.headers.get("ETag") ?? "0";

    const userWrite = await json(`/objects/${vibeId}/user`, {
      method: "PATCH",
      headers: { ...clientHeaders, "If-Match": initialEtag },
      body: JSON.stringify({ properties: { reviewed: true } }),
    });
    check("write:user can update only the user block", userWrite.status === 200, `status ${userWrite.status}`);

    const staleWrite = await json(`/objects/${vibeId}/user`, {
      method: "PATCH",
      headers: { ...clientHeaders, "If-Match": initialEtag },
      body: JSON.stringify({ properties: { reviewed: false } }),
    });
    check("stale user writes fail with revision_conflict", await hasProblem(staleWrite, 409, "revision_conflict"));

    const sourceWrite = await json(`/objects/${vibeId}/user`, {
      method: "PATCH",
      headers: { ...clientHeaders, "If-Match": userWrite.headers.get("ETag") ?? "1" },
      body: JSON.stringify({ properties: {}, source: { properties: { amount: 0 } } }),
    });
    check("write:user cannot write source", sourceWrite.status === 422, `status ${sourceWrite.status}`);

    const originLeak = await json(`/origins/${origin.uri.split("/").at(-1)}`, { headers: clientHeaders });
    check("no grant exposes origins", originLeak.status === 403, `status ${originLeak.status}`);

    const namespaceSpoof = await json(`/objects/${vibeId}/inferred`, {
      method: "PUT",
      headers: clientHeaders,
      body: JSON.stringify({
        task: "rhizome:spoof",
        entry: { model: "conformance/test", properties: {} },
      }),
    });
    check("write:inferred cannot spoof another namespace", namespaceSpoof.status === 403, `status ${namespaceSpoof.status}`);

    const revoke = await json(`/vibes/${vibeId}`, {
      method: "PATCH",
      headers: ownerHeaders,
      body: JSON.stringify({ grants: [] }),
    });
    check("owner can revoke grants", revoke.status === 200, `status ${revoke.status}`);
    const revokedRead = await json(`/vibes/${vibeId}`, { headers: clientHeaders });
    check("revocation fails closed on the next request", revokedRead.status === 403, `status ${revokedRead.status}`);
  } catch (error) {
    checks.push({
      name: "suite completed without transport failure",
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (vibeId) {
      await fetcher(`${base}/vibes/${vibeId}`, { method: "DELETE", headers: ownerHeaders }).catch(() => undefined);
    }
  }

  return summarize(checks);
}

function summarize(checks: StoreCheck[]): StoreConformanceResult {
  const passed = checks.filter((item) => item.passed).length;
  return { passed, failed: checks.length - passed, checks };
}

function validationDetail(result: { ok: boolean; issues?: unknown }): string | undefined {
  return result.ok ? undefined : JSON.stringify(result.issues);
}

async function hasProblem(response: Response, status: number, code: string): Promise<boolean> {
  if (response.status !== status) return false;
  const body = (await response.json().catch(() => ({}))) as { code?: string };
  return body.code === code;
}
