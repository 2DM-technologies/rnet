# rNet Protocol Specification

**Version 0.1-draft · The open protocol for Vibe-based Computing**

> Status: DRAFT. Nothing here is stable. Breaking changes will occur without apology until 1.0.

---

## 1. Overview

rNet defines a standardized interface between **media curated by users** and **AI-powered applications**. The protocol is deliberately small: it specifies the **nouns** (Media Elements, Media Objects, Origin Artifacts, Vibes), the **store operations** on them, and the **conformance rules at the store's two edges** — the nouns and their conformance rules (§2), and what access control must mean (§3).

Everything else is product, not protocol:

| Concern | Status |
|---|---|
| Element / Object / Origin / Vibe definitions | **Protocol** (§2) |
| Grants & scopes — access-control semantics | **Protocol** (§3) |
| Source-block conformance — provenance & determinism disclosure | **Protocol** (§2.3) |
| Store API — CRUD, push, pull | **Protocol** (§5) |
| How ingestion is implemented (skills, agents, parsers) | Implementation (reference: Rhizome ingestion runtime) |
| How machines (client applications) are built, registered, sandboxed, metered, billed | Implementation (reference: Rhizome dMachine SDK) |
| Identity issuance and authentication | Implementation (URI shapes are DID-compatible; see §8) |

**The test for protocol membership:** would two independent store implementations that disagreed on this fail to interoperate? Machine manifests fail that test — a client built against one store's SDK simply doesn't run on another, which is a product gap, not a protocol breach. Copying a Vibe fails it too: it is `POST /vibes` plus `POST /vibes/{id}/objects`, so no store needs to agree on a "fork" operation for the two to interoperate. Scope semantics pass it — a store that let a `write:user` grant touch `source` blocks would corrupt every client's trust model.

### 1.1 Design principles

1. **JSON-first, RDF-compatible.** Plain JSON with a published `@context` escape hatch. No triples required, ever.
2. **Provenance separation.** Source data, user edits, and model inferences live in separately named blocks. Source is canonical and immutable; inference is revisable, and some of it accumulates rather than being recomputed (§2.3).
3. **Never discard the original.** The bytes a user actually handed over — the bank export, the API response, the uploaded file — are stored as a content-addressed payload referenced by an immutable, UUID-identified OriginArtifact (§2.2), separate from media elements. Ingestion can always be re-run against ground truth.
4. **Namespaced extensibility.** Core fields are reserved; anyone may extend via `x-{namespace}:*` keys without coordination.
5. **Global identity.** Every object has a globally unique URI. External global keys (ISRC, ISBN, FITID) are first-class join keys.
6. **Determinism is disclosed, not assumed.** Every ingested object declares how reproducibly it was produced. Consumers price the trust.
7. **Intelligence at read time.** Semantic understanding is inferred by models, not encoded by authors. The schema is a dumb, honest container — never a knowledge representation.

---

## 2. Core Objects

### 2.1 MediaElement

The atomic unit of content. Five kinds, forming a **closed set** under one rule: **an element kind exists iff a human consumes that thing directly.** Kinds track consumption, not genres, formats, or domains. Expansiveness lives at the object layer (§2.3), which is an open vocabulary.

| Kind | Consumption | Examples |
|---|---|---|
| `text` | read | plain text, markdown, code |
| `image` | see | png, jpeg, webp |
| `audio` | hear | mp3, wav |
| `video` | watch | mp4, webm |
| `document` | render | pdf, docx, epub, html — internally structured, human-authored artifacts consumed as wholes |

New kinds are added only by protocol revision, only when a genuinely novel mode of direct human consumption emerges.

**What is deliberately not a kind: datasets.** A CSV, JSON export, OFX file, or ICS calendar is not media — nobody *experiences* a spreadsheet of transactions; a machine parses it into things humans experience. A dataset is a **foreign serialization of a list of MediaObjects**: the rows in a bank export were always transaction objects, frozen in someone else's format. Ingestion is *deserialization* (§2.3); the raw file is preserved as an origin artifact (§2.2), a provenance concern, not a media one.

**Fields are values; elements are files.** A field is a value you would put in a database column — a transaction's description, a track's title, an event's location. An element is a byte payload with a MIME type that must be fetched to be rendered — a photo, an audio file, a PDF, the prose body of a note.

The test: **if you would query on it, it is a field; if you would open it, it is an element.** You sort tracks by title, filter transactions by merchant, join on ISRC — queries over values. Nobody sorts by note body.

This is why the `text` kind exists: it is for *prose*, not strings. A note's body is a `text` element; a track's title is a property. Length is not the axis — a one-line caption is still the object's content rather than a fact about it, so it is an element regardless of how much someone typed.

Objects whose meaning is entirely factual carry **zero elements** — the pure meaning-object is a normal citizen, not a degenerate case.

```json
{
  "rnet_schema": "0.1",
  "kind": "text",
  "uri": "rnet://element/0198f2a1-92c4-7f31-a620-6c28af35e824",
  "owner": "rnet://id/0198f2a0-4d11-7a83-b5c6-1e9f0a2b3c4d",
  "content_hash": "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "mime": "text/plain",
  "bytes": "https://blobs.example.com/9f86d08...",
  "byte_size": 34,
  "created_at": "2026-08-14T09:12:00Z"
}
```

| Field | Type | Req | Notes |
|---|---|---|---|
| `rnet_schema` | string | ✓ | Protocol version this record was written under. |
| `kind` | enum | ✓ | One of the five above. |
| `uri` | string (URI) | ✓ | `rnet://element/{uuid}` — a UUIDv7 identifying this immutable element record. |
| `owner` | string (URI) | ✓ | Immutable `rnet://id/{opaque}` identity assigned by the store at creation. |
| `content_hash` | string | ✓ | SHA-256 of the payload, formatted `sha256:{hash}`. This identifies bytes, not the element record. |
| `mime` | string | ✓ | IANA media type. `mime` is truth; `kind` is the consumption hint. |
| `bytes` | string (URL) | ✓ | Retrievable payload location. The returned bytes MUST hash to `content_hash`. |
| `byte_size` | integer | — | |
| `created_at` | ISO 8601 | — | |

**Every element's bytes are reachable.** `bytes` is required and always resolves. rNet does not model media it cannot serve: content locked inside a platform is not an element with a missing payload, it is a **reference** — recorded in the owning object's `keys` (e.g. `isrc`, `spotify_uri`, `apple_music_id`) so clients can hand off to whatever player the user has. A `track` is therefore normally a zero-element object: identity and meaning in `source.properties`, locators in `keys`.

**Record identity and payload identity are separate.** A MediaElement is an immutable UUID-identified record: a payload plus its contextual metadata. Its payload is content-addressed by `content_hash`. Multiple element records MAY therefore carry the same `content_hash` while differing in context or metadata; physical payload storage MAY deduplicate them. Neither an element UUID nor a content hash is an authorization capability.

### 2.2 OriginArtifact

The provenance namespace. An origin artifact is an immutable, UUID-identified record around a content-addressed payload. It is **ontologically inert**: it is not media, has no `kind`, never appears in a Vibe's objects, and is never consumed by a model as content. It exists purely as ground truth — the raw bank export, the platform data dump, the uploaded file *as uploaded* — so that ingestion can always be re-run against original bytes.

```json
{
  "rnet_schema": "0.1",
  "uri": "rnet://origin/0198f2a1-a09b-76aa-95d8-fc5b55b41fd2",
  "owner": "rnet://id/0198f2a0-4d11-7a83-b5c6-1e9f0a2b3c4d",
  "content_hash": "sha256:3c4f1a57d9137a75d2196dcd52f6e57fca1be3b9c089ade9ea1314013fe65dc7",
  "mime": "application/x-ofx",
  "bytes": "https://blobs.example.com/3c4f1a...",
  "byte_size": 184223,
  "label": "chase_export_2026-08.qfx",
  "uploaded_at": "2026-08-15T22:04:00Z"
}
```

| Field | Req | Notes |
|---|---|---|
| `rnet_schema` | ✓ | Protocol version this record was written under. |
| `uri` | ✓ | `rnet://origin/{uuid}` — a UUIDv7 identifying this immutable provenance record. |
| `owner` | ✓ | Immutable `rnet://id/{opaque}` identity assigned by the store at creation. |
| `content_hash` | ✓ | SHA-256 of the payload, formatted `sha256:{hash}`. This identifies bytes, not the origin record. |
| `mime` | ✓ | |
| `bytes` | ✓ | Retrievable payload location. The returned bytes MUST hash to `content_hash`. |
| `label` | — | Human-readable name (e.g. original filename). |

Elements and origins are honestly separated at the record layer: **elements** are media to be experienced; **origins** are evidence to be referenced. A PDF a user reads is an element; a QFX export a machine parses is an origin. When one payload is genuinely both — rare, but legal — element and origin records MAY share its `content_hash`. Repeated uploads or captures of identical origin bytes MAY also produce distinct OriginArtifacts because ownership, label, and upload time describe the provenance event rather than the payload. Physical payload deduplication is an implementation detail.

### 2.3 MediaObject

The core unit of meaning: properties plus zero or more MediaElements, carrying **three property blocks** with different mutation rights. The example is a transaction — a pure meaning-object, zero elements, meaning entirely in fields:

```json
{
  "rnet_schema": "0.1",
  "uri": "rnet://object/0198f2a1-7c3d-7e4b-9f21-3a5c8d0e1b47",
  "owner": "rnet://id/0198f2a0-4d11-7a83-b5c6-1e9f0a2b3c4d",
  "type": "transaction",
  "elements": [],
  "keys": {
    "fitid": "20260814-443-889201",
    "account_hash": "sha256:77ab2c..."
  },

  "source": {
    "ingest": {
      "method": "parser",
      "skill": "simplefin@0.1.0",
      "model": "claude-sonnet-4-6",
      "parser_hash": null,
      "reproducible": true
    },
    "origins": ["rnet://origin/0198f2a1-a09b-76aa-95d8-fc5b55b41fd2"],
    "retrieved_at": "2026-08-15T22:04:11Z",
    "properties": {
      "amount": -6.50,
      "currency": "USD",
      "posted_at": "2026-08-14",
      "raw_description": "COFFEE SHOP #443 BROOKLYN NY"
    }
  },

  "user": {
    "properties": {
      "note": "meeting w/ Dana",
      "category": "coffee"
    },
    "updated_at": "2026-08-15T23:10:00Z"
  },

  "inferred": {
    "rbudget:categorize": {
      "model": "gpt-5",
      "inferred_at": "2026-08-15T22:04:30Z",
      "confidence": 0.86,
      "properties": { "category": "food_and_drink.coffee", "recurring": false }
    },
    "rbudget:merchant": {
      "model": "gpt-5-mini",
      "inferred_at": "2026-08-16T09:00:00Z",
      "confidence": 0.94,
      "properties": { "name": "Coffee Shop #443", "chain": false }
    },
    "rbudget:correction": {
      "model": "gpt-5.6-sol",
      "inferred_at": "2026-08-18T14:22:00Z",
      "durable": true,
      "properties": {
        "note": "recurring charge is a sublet, not rent",
        "learned_from": "user correction"
      }
    }
  },

  "x-plaid": { "pending": false }
}
```

The first two entries are store task output: re-running the task recomputes them, and each replaces only its own key. The third was written by a client holding `write:inferred`, under its own namespace, and carries `durable: true` — it records something learned rather than computed, so no re-run may replace it. `durable` defaults to false and is omitted where it does not apply.

When elements *do* attach to a transaction, they are files: an emailed receipt (one `document` element), a check image, the prose of a memo. Fields-versus-files (§2.1) is the membership rule.

| Block | Written by | Mutability |
|---|---|---|
| `source` | Ingestion runtimes only | Immutable after ingest. Re-ingestion creates a new revision, never edits in place. |
| `user` | The owner, via clients holding `write:user` | Freely mutable by owner. Revision-protected (§6.2). |
| `inferred` | Models, via push operations; clients holding `write:inferred` | **A map keyed by writer and task** — the store's analyses under its identifier (`rhizome:categorize`), a client's under its registered name (`rbudget:forecast`). Writers are globally unique within a store, so keys cannot collide and there is no unprefixed case. Each entry carries its own `model`, `inferred_at`, optional `confidence`, and `properties`, so the metadata describes exactly one inference. **This block is memory scoped to the record.** Some entries are task output, recomputed from `source` whenever the task re-runs. Others accumulated — a user's correction, a pattern an agent noticed across several objects, an understanding built over a conversation — and re-running a task cannot reproduce them. Entries of the second kind set `durable: true`, and a push task MUST NOT replace a durable entry. A task can never set the flag on its own output — `durable` means *cannot be reproduced by re-running*, and task output is by definition what re-running produces — so only agent runs and user-driven writes may set it. Otherwise a re-run replaces only its own key. Consumers MUST treat entries as advisory. |
| `x-*` | Anyone, namespaced | Consumers MUST ignore namespaces they don't understand. |

**The `source` block.** Written at creation, immutable afterward, and structurally required to ground itself — every object points at what it came from, with no exceptions. Ingestion is one way an object comes to be; authoring in a client is another.

| Field | Req | Notes |
|---|---|---|
| `origins` | ✓ | What this object was derived from — **at least one, always.** Two kinds of grounding: an origin artifact (`rnet://origin/{uuid}`, §2.2) for ingested objects, or a client (`rnet://client/{uuid}`) for objects authored directly in an application. A filename string is not provenance. For ingested objects this makes "re-run ingestion against ground truth" a real operation in every store, forever; for authored ones it records who made the thing. |
| `properties` | ✓ | Facts the source format defines. Validated against the registered type vocabulary (§7) when one exists. |
| `ingest` | ✓ | How the object was produced — the determinism disclosure, below. |
| `retrieved_at` | — | |

The `ingest` record declares provenance so consumers can price trust; the protocol guarantees the disclosure, not the trustworthiness:

| Field | Req | Notes |
|---|---|---|
| `method` | ✓ | Named for what did the work: `parser` (a committed, versioned parser ran), `generated_parser` (an agent wrote a one-off parser, which ran), `agent` (a model read the origin and produced objects directly, writing no parser — the case where code is impossible, such as a photographed receipt or a scanned statement), or `authored` (a person created the object in a client; nothing was parsed). Determinism runs **`parser` > `generated_parser` > `agent`** — generated code is hash-pinned and re-runnable, freehand extraction is not. `authored` sits outside the ladder. `method` describes *how*; `origins` describes *from what*. Every object has both. |
| `reproducible` | ✓ | Whether re-running the same method against `source.origins` yields identical output (modulo timestamps). MUST be `false` for `agent`. |
| `skill` | — | Corpus skill identity + semver, when one guided the run. |
| `model` | — | Model identity, when a model participated in parsing. |
| `parser_hash` | — | Content hash of the parser, REQUIRED when method is `generated_parser`: regeneration is a new parser, new provenance. |

Skill and parser identifiers are meaningful within the store that produced them; a receiving store learns *how* an object was made without being able to re-run another store's runtime. Consumers MAY gate on this record — a financial client can demand `reproducible: true`; a moodboard accepts anything.

**Ingestion is deserialization.** A runtime recognizes the collection of MediaObjects already latent in an origin's foreign format and re-expresses it natively. How that recognition happens — committed parsers, agents, or code an agent writes on the spot — is implementation, not protocol.

| Field | Notes |
|---|---|
| `rnet_schema` | Protocol version this document was written under. Required on every stored document — origins, elements, objects, and Vibes alike — so each is self-describing and a future migration can run incrementally. Documents carry **no `$schema` field**: a validator is pointed at a schema by the application through a registry keyed on `$id`, and storing a hosting URL alongside a version pin would duplicate the same fact in two forms that can disagree. |
| `uri` | `rnet://object/{uuid}` — a UUIDv7. Objects, elements, and origins have record identity independent of any payload hash; objects may mutate under revision control, while element and origin records are immutable. |
| `owner` | Immutable `rnet://id/{opaque}` identity assigned by the store at creation. Ownership governs administration, not delegated access. |
| `type` | Open vocabulary with registered core types (§7). Unregistered types are legal. |
| `elements` | Ordered list of MediaElement URIs. MAY be empty. |
| `keys` | External global identifiers for cross-service joins: `isrc`, `isbn`, `fitid`, `url`, `ean`, etc. |

### 2.4 Vibe

A dynamic, owned collection of MediaObjects, plus the state that makes it living: its pull configuration and its inferred block.

```json
{
  "rnet_schema": "0.1",
  "uri": "rnet://vibe/0198f2a1-8b1e-7c92-a034-5d7e2f9a0c13",
  "title": "Brooklyn Spending",
  "owner": "rnet://id/0198f2a0-4d11-7a83-b5c6-1e9f0a2b3c4d",
  "objects": ["rnet://object/0198f2a1-7c3d-7e4b-9f21-3a5c8d0e1b47", "..."],
  "created_at": "2026-08-15T22:00:00Z",

  "inferred": {
    "rhizome:summarize": {
      "model": "gpt-5",
      "inferred_at": "2026-08-15T22:05:00Z",
      "properties": {
        "summary": "Daily-life spending centered on north Brooklyn; heavy coffee ritual; groceries biweekly; rent dominates monthly cycle.",
        "tags": ["personal-finance", "brooklyn", "routine"]
      }
    }
  },

  "pull": {
    "enabled": true,
    "sources": ["skill:ofx@^0.3"],
    "policy": "append_new",
    "last_pulled_at": "2026-08-15T22:04:00Z"
  },

  "grants": [
    { "subject": "client:rbudget", "scope": ["read", "write:user", "push"] }
  ],

  "x-rhizome": {}
}
```

| Field | Notes |
|---|---|
| `rnet_schema` | Protocol version this document conforms to. Required. |
| `owner` | An `rnet://id/` URI. Identity issuance is out of protocol (§8); the URI shape is stable. |
| `objects` | Ordered list of MediaObject URIs. A URI appears at most once in a Vibe. Stores MUST preserve this order, including across paginated reads. |
| `inferred` | The Vibe-level inferred block — same task-keyed shape and rules as an object's (§2.3). Vibes carry no `source` block: they are authored, not ingested. The store's `summarize` task conventionally writes `summary` (the compact context pushed to models instead of the full object list) and `tags`. Derived indexes — embeddings, search structures — are built *from* Vibes by the store, never carried *in* them. |
| `pull` | How the Vibe acquires new objects: which sources feed it, on what policy (`append_new`, `replace`, `suggest_only`). |
| `grants` | The access-control list (§3). |

**Vibes contain object references, not copies.** Two Vibes referencing the same object see the same `source` and `user` blocks. Copying a Vibe is ordinary client work — create a Vibe, add the same object references — and needs no protocol operation.

---

## 3. Grants & Scopes

What access control MUST mean in any store. A store that implements these semantics can safely host clients it has never seen; a client written against these semantics can couple to any conformant store.

### 3.1 Grants

A grant is `{subject, scope[]}` attached to a Vibe. Subjects are opaque strings with a namespace prefix:

| Subject form | Meaning |
|---|---|
| `id:{rnet-id}` | A user identity |
| `client:{name}` | An external application identity, registered with the store (registration mechanics are implementation-defined) |
| `public` | Anyone, including unauthenticated readers |
| `{x-namespace}:{...}` | Extension subject types (e.g., a store MAY resolve token- or credential-based subjects). Stores MUST deny grants whose subject namespace they do not understand. |

### 3.2 Scopes

| Scope | Permits | Hard limits (conformance-tested) |
|---|---|---|
| `read` | Fetch the Vibe, its objects, their elements | **Never includes origin artifacts.** Origins are owner-only and not delegable by any scope — a raw export is strictly more revealing than the objects parsed from it. |
| `write:user` | Mutate `user` blocks of objects in the Vibe | MUST NOT touch `source`, `inferred`, `keys`, `type`, or `elements`. Revision-protected (§6.2). |
| `write:objects` | Create objects and elements for the Vibe | Created records inherit the Vibe's owner. Created objects carry `source.ingest.method: "authored"` and an origin naming the creating client (`rnet://client/{uuid}`). `source` is immutable once written, as always. The scope does not authorize attaching a pre-existing object from another Vibe, even when both Vibes share an owner. |
| `write:inferred` | Write `inferred` entries directly, without a server-mediated push | The writer half of the key MUST be the subject's own registered name, store-enforced — no subject can write under another's namespace or the store's. |
| `push` | Invoke push operations (§4.3) on the Vibe | Writes land only in `inferred` blocks (object- and Vibe-level). |
| `pull` | Invoke a pull on the Vibe's already-configured sources | Cannot modify pull configuration and cannot read origins — both are owner-only, exercised through the store's own surfaces. This is the refresh button, nothing more. |

Scope semantics are **store-enforced, always** — never client-honor-system. Grants are set by the owner alone — no scope delegates the ability to grant (§8). The conformance suite's tests are: `write:user` cannot corrupt `source`; `write:objects` cannot import a pre-existing object from another Vibe; `push` cannot write `user`; no scope exposes origins; `pull` cannot rewrite pull configuration; revoked grants fail closed.

### 3.3 Owner supremacy

`owner` is a required, immutable field on every Vibe, MediaObject, MediaElement, and OriginArtifact. It is store-assigned from the authenticated user or, for a machine write, inherited from the Vibe authorizing that write. Ownership determines who may administer or tombstone a record; it is not a bearer capability and does not give a machine access. Machine access remains entirely a consequence of Vibe grants.

In v0.1 ownership cannot cross a Vibe boundary: every object added to a Vibe MUST share its owner, every element referenced by an object MUST share the object's owner, and every OriginArtifact referenced by an ingested object's `source.origins` MUST share the object's owner. Authored objects may instead cite their creating client as specified in §2.3. Sharing and cross-owner references remain deferred (§8).

The Vibe owner holds all scopes implicitly, can revoke any grant at any time, and revocation takes effect at next request. No grant survives owner deletion of the Vibe.

---

## 4. Store API

Base URL: `https://{host}/rnet/v0`. Auth: bearer credential bound to an `id:` or `client:` subject; issuance is implementation-defined. All bodies `application/json`.

### 4.1 Vibes

| Method | Path | Scope | Description |
|---|---|---|---|
| `POST` | `/vibes` | (owner) | Create a Vibe. Body: `{title, pull?, grants?}` |
| `GET` | `/vibes/{id}` | `read` | Fetch Vibe (metadata + object URIs, paginated in stored order) |
| `GET` | `/vibes/{id}/objects?expand=full` | `read` | Fetch with objects expanded, preserving stored order |
| `PATCH` | `/vibes/{id}` | (owner) | Title, pull config, grants |
| `DELETE` | `/vibes/{id}` | (owner) | Delete Vibe (objects survive if referenced elsewhere; orphans GC'd) |
| `POST` | `/vibes/{id}/objects` | (owner) or `write:objects` | Add object refs, appending in request order. Every added object MUST have the same `owner` as the Vibe. A `write:objects` subject may attach only an object it created for this Vibe; reusing an existing same-owner object is owner-only. |
| `DELETE` | `/vibes/{id}/objects` | (owner) | Remove refs (never deletes underlying objects) |

### 4.2 Objects, Elements & Origins

| Method | Path | Scope | Description |
|---|---|---|---|
| `POST` | `/objects` | (owner) or `write:objects` | Create MediaObject(s). Batch-first. Returns `{mediaObjects: MediaObject[]}`. The store assigns immutable `owner`; it MUST ignore or reject a conflicting client-supplied value. A subject holding `write:objects` must name the authorizing Vibe and may create only `authored` objects owned by that Vibe's owner, grounded in its own `rnet://client/` origin. Ingested objects come from the pull pipeline. Rejected unless the `source` block conforms (§2.3). |
| `GET` | `/objects/{id}` | `read` | Fetch object |
| `PATCH` | `/objects/{id}/user` | `write:user` | Mutate `user` block only. `source` is never PATCHable. |
| `PUT` | `/objects/{id}/inferred` | `push` or `write:inferred` | Write an `inferred` entry. The two scopes differ in *whose* namespace may be written: `push` lands results under the store's writer prefix; `write:inferred` lets a subject write under its own registered name and nothing else. |
| `POST` | `/elements` | (owner) or `write:objects` | Create an immutable element record and upload its payload. The store assigns immutable `owner` and returns it with a UUID URI plus `content_hash`. A non-owner upload MUST name the Vibe whose `write:objects` grant authorizes it; the element inherits that Vibe's owner and the subject may attach it only in that Vibe. |
| `GET` | `/elements/{id}` | `read` | Fetch element metadata and a retrievable payload URL. The element must be reachable through a Vibe the caller can read; knowing its UUID or `content_hash` grants nothing. |
| `POST` | `/origins` | (owner) | Create an immutable origin record and upload its raw source payload. The record owner is the authenticated user. Returns `owner`, a UUID URI, and `content_hash`. |
| `GET` | `/origins/{id}` | (owner) | Fetch origin artifact metadata and a retrievable payload URL. |

### 4.3 Push & Pull

The two modalities of Vibe–model interaction.

**`POST /vibes/{id}/push`** (scope: `push`) — Send the Vibe (or a selection) to a model for analysis.

```json
{
  "target": "model:claude-sonnet-4-6",
  "selection": { "type": ["transaction"], "since": "2026-07-01" },
  "task": "categorize",
  "write_back": "inferred"
}
```

The store assembles context (the Vibe's inferred summary + selected objects), invokes the target, and — if `write_back` is set — lands results in inferred blocks at the object and/or Vibe level, keyed under the store's own writer namespace. Push is how a Vibe *thinks about itself*, with or without any client attached.

**Task names are store-defined.** `categorize` on one store need not exist on another; clients should discover available tasks rather than assume a vocabulary. The operation's shape is protocol, its task list is local — the same split as skill identifiers in `source.ingest`.

**`POST /vibes/{id}/pull`** (scope: `pull`) — Ask configured sources for new objects.

```json
{
  "sources": ["skill:ofx@^0.3"],
  "mode": "append_new",
  "dry_run": false
}
```

Invoke the ingestion runtime, receive candidate MediaObjects, apply the pull policy. With `dry_run: true`, candidates are returned but not committed — the substrate for suggest/review UX, and the gate stores SHOULD require for ingestion that is not `reproducible: true`.

Both return an `operation_id`; long-running ops are polled at `GET /operations/{id}`.

### 4.4 Errors

RFC 9457 problem+json. Notable codes: `409 revision_conflict` (stale `user` write), `403 grant_missing` (scope not held, with the missing scope named), `422 schema_violation` (with JSON Schema pointer), `422 ingest_nonconformant` (`source` block fails §2.3, with the failing rule identified).

---

## 5. Identity

- **Protocol records:** elements, origins, objects, and Vibes use UUIDv7 record URIs in their respective namespaces: `rnet://element/{uuid}`, `rnet://origin/{uuid}`, `rnet://object/{uuid}`, and `rnet://vibe/{uuid}`. A payload's `content_hash` is integrity and deduplication metadata, never record identity or authority.
- **Users:** `rnet://id/{opaque}` — issuance and authentication are implementation-defined (§8 punt). The identifier is opaque and stable: stores MUST NOT mint identity URIs from mutable, human-chosen strings. Display names, handles, and usernames are store features that travel *alongside* an identity, never *as* one — otherwise a rename silently repoints every grant and owner reference that quoted the old URI. The shape is chosen so decentralized identity mappings (DID methods, key-derived identities, account-abstraction schemes) can be added later as resolution methods without breaking any stored reference.
- **Clients:** applications acting on a user's behalf — `client:{name}` as a grant subject, `rnet://client/{uuid}` as the stable URI an authored object's `source.origins` points at (§2.3). Registration mechanics, manifests, sandboxing, and metering are implementation concerns; the protocol defines only the two identifier shapes, so a store whose clients are plugins or extensions rather than any particular product's notion of an app remains interoperable. Registration mechanics, manifests, budgets, and billing are implementation concerns (see: Rhizome dMachine SDK).
- **Ingestion sources:** recorded in `source.ingest` for attribution (§2.3). Provenance is attribution.

---

## 6. Semantics

### 6.1 Versioning
`rnet_schema` follows semver-lite: `0.x` may break; from `1.0`, additive-only within a major. Consumers MUST reject majors they don't understand and MUST ignore unknown fields — which, with `x-*` namespacing, makes most evolution non-breaking.

### 6.2 Revisions
`source` and `user` blocks carry monotonic revision counters (store-assigned). Writes to `user` require the current revision (`If-Match`) — last-write-wins is not acceptable for user data.

`inferred` entries are versioned in the store's revision log like every other block, so superseded readings remain retrievable — which matters more than it would for pure task output, since accumulated entries cannot be recomputed. They carry no concurrency check: two runs of the same task are independent re-derivations rather than conflicting edits, so the later one wins. Task-keying already prevents the collision that would matter — distinct tasks write distinct keys and cannot clobber each other.

### 6.3 Deletion & the right to be forgotten
Only a record's owner may tombstone it. Deleting an element tombstones its UUID record. Objects referencing that record remain valid — meaning survives, payload access through that URI does not. The same semantics apply to origins: deletion tombstones the UUID record, derived objects remain valid, and the ability to re-run ingestion through that origin is lost — stores SHOULD warn before deleting an origin that live objects reference.

Payload deletion is reference-aware. A store MUST NOT delete physical bytes while any live element or origin record it serves still depends on them; shared payloads may be garbage-collected only after the last live record is gone. Tombstones are the one state in which a record's `bytes` need not resolve, and clients render an absence rather than attempting a fetch.

---

## 7. Registered Core Types (v0.1)

Initial property vocabularies (all optional beyond what's shown; full JSON Schemas at `/schemas/0.1/types/`):

**`transaction`** — `amount` (signed decimal, required), `currency` (ISO 4217, required), `posted_at`, `raw_description`. Keys: `fitid`. Typically zero elements (§2.1): every field here is queried on. Attached files — receipts, check images — are the element case.

**`track`** — `title`, `artist`, `album`, `duration_ms`, `released` — all fields, since all are queried on. Keys: `isrc` (the cross-service join key). Album art, if stored, is an `image` element. Normally zero elements: audio lives on the platform, so locators go in `keys` and identity/meaning in `source.properties`.

**`post`**, **`photo`**, **`note`**, **`contact`**, **`event`**, **`book`**, **`article`**, **`receipt`** — reserved with minimal vocabularies; fleshed out as their ingestion paths ship.

**There is deliberately no `document` object type.** `document` is an element *kind* (§2.1) — it names consumption, not meaning. An object whose content is a document element takes the semantic type of what the document *is*: a `book`, an `article`, a `receipt`, a `contract`. Work-level facts (`title`, `author`) and artifact-level facts (`page_count`, `language`) live in those types' vocabularies. The rule generalizes: element kinds name consumption; object types name meaning; neither taxonomy may borrow from the other. (`dataset` failed this rule upward; `document`-as-type failed it downward.)

---

## 8. What v0.1 deliberately punts on

Recorded so the punts are decisions, not oversights:

1. **Decentralized identity.** URI shapes are DID- and account-abstraction-compatible; the trust model isn't specified. One reference store first.
2. **End-to-end encryption of elements.** At-rest and in-flight encryption are implementation duties; E2EE pods are a 0.x milestone, not 0.1.
3. **Inter-store federation.** The wire protocol between stores isn't specified. Federation waits for a second implementer.
4. **A query language.** `selection` filters are deliberately primitive. No SPARQL. If a real need emerges, it will be JSON-native.
5. **Client/application machinery.** Manifests, registration UX, metering, budgets, billing, sandboxing, and app generation are implementation concerns. The protocol's guarantee to clients is §3 Grants & Scopes, nothing more.
6. **Delegation and sharing.** Grants are owner-set; no scope confers the ability to grant. Sharing arrives when a second identity and a real sharing use case exist — specifying re-granting, escalation limits, and revocation cascades before then would be guessing. The grant subject namespace (`id:`, `client:`, `public`, `x-*`) already accommodates whatever it turns out to be.
7. **Export.** Serializing a Vibe back to a foreign format is a client capability, not a store operation, until something actually re-imports it. When it returns it must round-trip `source` properties losslessly.
8. **Remote and platform-locked media.** Every element's bytes are reachable (§2.1). Content that lives inside a platform is referenced through `keys`, not modelled as an element with a missing payload. If a store ever needs to represent unreachable media, that is an extension, not a redesign.
9. **Skill format standardization.** Ingestion skills are a runtime concern (their conformance obligations are the `source` block rules in §2.3). Promotion into the protocol is deferred until ecosystem pressure exists.

---

## Appendix A: End-to-end example — a budgeting client

```
 1. POST /origins                     ← chase_export_2026-08.qfx bytes
                                        (UUID origin record + content-addressed payload)
 2. POST /vibes                       ← {"title": "Brooklyn Spending", "pull": {...}}
 3. POST /vibes/{id}/pull             ← runtime loads the ingestion skill, parses,
      {dry_run: true}                   verifies invariants (counts, totals),
                                        returns 214 candidate transaction objects —
                                        zero elements, meaning in properties,
                                        ingest: {method: "parser", reproducible: true},
                                        source.origins → the stored origin UUID
 4. (review UI: "214 transactions, totals reconcile ✓") → user confirms
 5. POST /vibes/{id}/pull             ← committed
      {dry_run: false}
 6. POST /vibes/{id}/push             ← task: "categorize"; results land under the
                                        store's writer key, e.g. rhizome:categorize
 7. client:rbudget is granted         ← ["read", "write:user", "push"]
 8. GET /vibes/{id}/objects           ← renders; user edits a category
    PATCH /objects/{id}/user            (If-Match: user_rev) → sticky forever
 9. Monthly: steps 3–6 repeat via pull config; the Vibe stays alive.

Novel-format variant of step 3: unknown CSV dialect → runtime generates a parser,
records parser_hash under method `generated_parser`, and dry-run review is REQUIRED
before commit.
```

Time from raw export to a working personal budgeting client: one consent screen and two API calls. That is the demo, and the thesis.

---

*rNet is an open specification: what two strangers must agree on to share a store. The reference implementation is TypeScript on Bun; the protocol is JSON Schema; the second implementation is the point.*
