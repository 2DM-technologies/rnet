# rNet Protocol Specification

**Version 0.1-draft · The open protocol for Vibe-based Computing**

> Status: DRAFT. Nothing here is stable. Breaking changes will occur without apology until 1.0.

---

## 1. Overview

rNet defines a standardized interface between **media curated by users** and **AI-powered applications**. The protocol is deliberately small: it specifies the **nouns** (Media Elements, Media Objects, Origin Artifacts, Vibes), the **semantics** a store must honour when operating on them (§4), and the **conformance rules at the store's two edges** — the nouns and their conformance rules (§2), and what access control must mean (§3). It specifies no transport; how a store is reached is an implementation concern.

Everything else is product, not protocol:

| Concern | Status |
|---|---|
| Element / Object / Origin / Vibe definitions | **Protocol** (§2) |
| Grants & scopes — access-control semantics | **Protocol** (§3) |
| Source-block conformance — provenance & determinism disclosure | **Protocol** (§2.3) |
| Store semantics — identity, creation, access, push, pull | **Protocol** (§4) |
| How ingestion is implemented (skills, agents, parsers) | Implementation (reference: Rhizome ingestion runtime) |
| How machines (client applications) are built, registered, sandboxed, metered, billed | Implementation (reference: Rhizome dMachine SDK) |
| Identity issuance and authentication | Implementation (identity URIs are opaque; see §8) |

**The test for protocol membership:** would two independent store implementations that disagreed produce documents or behaviours with incompatible meaning? Machine manifests fail that test — a client built against one store's SDK simply doesn't run on another, which is a product gap, not a protocol breach. Copying a Vibe fails it too: it is Vibe creation plus adding object references, so no store needs to agree on a "fork" operation. Scope semantics pass it — a store that let a `write:user` grant touch `source` blocks would corrupt every client's trust model.

### 1.1 Design principles

1. **JSON-first, RDF-compatible.** Plain JSON with a published `@context` escape hatch. No triples required, ever.
2. **Provenance separation.** Source data, user edits, and model inferences live in separately named blocks. Source is canonical and immutable; inference is revisable, and some of it accumulates rather than being recomputed (§2.3).
3. **Never discard the original.** The bytes a user actually handed over — the bank export, the API response, the uploaded file — are stored as a content-addressed payload referenced by an immutable, UUID-identified OriginArtifact (§2.2), separate from media elements. Ingestion can always be re-run against ground truth.
4. **Namespaced extensibility.** Core fields are reserved; anyone may extend the top level of a core stored document via `x-{namespace}` keys without coordination. Embedded control records and property blocks remain closed unless their schema says otherwise.
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
      "amount": "-6.50",
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

The first two entries are store task output: re-running the task recomputes them, and each replaces only its own key. The third was written by a client holding `write:inferred`, under its own namespace, and carries `durable: true` — it records something learned rather than computed, so no re-run may replace it. A direct user write is keyed as `user/{user_uuid}:{task}`; the caller supplies only the bare task and the store assigns that prefix. `durable` defaults to false and is omitted where it does not apply.

When elements *do* attach to a transaction, they are files: an emailed receipt (one `document` element), a check image, the prose of a memo. Fields-versus-files (§2.1) is the membership rule.

| Block | Written by | Mutability |
|---|---|---|
| `source` | Ingestion runtimes only | Immutable after ingest. Re-ingestion creates a new revision, never edits in place. |
| `user` | The owner, via clients holding `write:user` | Freely mutable by owner. Revision-protected (§6.2). |
| `inferred` | Models, via push operations; clients and users holding `write:inferred` | **A map keyed by writer and task** — the store's analyses under its identifier (`rhizome:categorize`), a client's under its registered name (`rbudget:forecast`), and a user's under `user/{user_uuid}` (`user/018f…:correction`). Callers provide a bare task name; the store assigns the authenticated writer prefix. Writers are globally unique within a store, so keys cannot collide and there is no unprefixed case. Each entry carries its own `model`, `inferred_at`, optional `confidence`, and `properties`, so the metadata describes exactly one inference. **This block is memory scoped to the record.** Some entries are task output, recomputed from `source` whenever the task re-runs. Others accumulated — a user's correction, a pattern an agent noticed across several objects, an understanding built over a conversation — and re-running a task cannot reproduce them. Entries of the second kind set `durable: true`, and a push task MUST NOT replace a durable entry. A task can never set the flag on its own output — `durable` means *cannot be reproduced by re-running*, and task output is by definition what re-running produces — so only agent runs and user-driven writes may set it. Otherwise a re-run replaces only its own key. Consumers MUST treat entries as advisory. |
| `x-*` | Anyone, namespaced | Legal only at the top level of the core stored document. Consumers MUST ignore namespaces they don't understand. |

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
| `uri` | `rnet://object/{uuid}` — a store-minted UUIDv7. Objects, elements, and origins have record identity independent of any payload hash; objects may mutate under revision control, while element and origin records are immutable. Clients do not choose record identifiers. |
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
| `objects` | Ordered list of MediaObject URIs. A URI MAY appear more than once; each occurrence is a distinct placement. Stores MUST preserve this order, including repeated references, across paginated reads. |
| `inferred` | The Vibe-level inferred block — same task-keyed shape and rules as an object's (§2.3). Vibes carry no `source` block: they are authored, not ingested. The store's `summarize` task conventionally writes `summary` (the compact context pushed to models instead of the full object list) and `tags`. Derived indexes — embeddings, search structures — are built *from* Vibes by the store, never carried *in* them. |
| `pull` | How the Vibe acquires new objects: which sources feed it, on what policy (`append_new`, `replace`, `suggest_only`). |
| `grants` | The access-control list (§3). |

**Vibes contain object references, not copies.** Multiple placements of the same object, whether within one Vibe or across Vibes, see the same `source` and `user` blocks. Copying a Vibe is ordinary client work — create a Vibe, add the same object references — and needs no protocol operation.

---

## 3. Grants & Scopes

What access control MUST mean in any store. A store that implements these semantics can safely host clients it has never seen; once connected through a store's implementation-defined binding, a client can rely on the same authorization model everywhere.

### 3.1 Grants

A grant is `{subject, scope[]}` attached to a Vibe. Subjects are opaque strings with a namespace prefix:

| Subject form | Meaning |
|---|---|
| `id:{rnet-id}` | A user identity |
| `client:{name}` | An external application identity, registered with the store (registration mechanics are implementation-defined) |
| `public` | Anyone, including unauthenticated readers |
| `{x-namespace}:{...}` | Extension subject types (e.g., a store MAY resolve token- or credential-based subjects). Stores MUST deny grants whose subject namespace they do not understand. |

### 3.2 Scopes

| Scope | Permits | Required hard limits |
|---|---|---|
| `read` | Fetch the Vibe, its objects, their elements | **Never includes origin artifacts.** Origins are owner-only and not delegable by any scope — a raw export is strictly more revealing than the objects parsed from it. |
| `write:user` | Mutate `user` blocks of objects in the Vibe | MUST NOT touch `source`, `inferred`, `keys`, `type`, or `elements`. Revision-protected (§6.2). |
| `write:objects` | Atomically create objects and their new elements for the Vibe | Created records inherit the Vibe's owner. Created objects carry `source.ingest.method: "authored"` and an origin naming the creating client (`rnet://client/{uuid}`). `source` is immutable once written, as always. New element uploads MUST be committed with the object that first references them; the scope does not authorize detached element creation or attaching a pre-existing object. |
| `write:inferred` | Write `inferred` entries directly, without a server-mediated push | The caller supplies a bare task name and the store assigns the writer half: a client uses its registered name and a user uses `user/{user_uuid}`. No subject can write under another's namespace or the store's. Client/task output MUST NOT set `durable: true`; durable entries are reserved for user-driven or accumulated writes that cannot be reproduced by rerunning a task. |
| `push` | Invoke push operations (§4.3) on the Vibe | Writes land only in `inferred` blocks (object- and Vibe-level). |
| `pull` | Invoke a pull on the Vibe's already-configured sources | Cannot modify pull configuration and cannot read origins — both are owner-only, exercised through the store's own surfaces. This is the refresh button, nothing more. |

Scope semantics are **store-enforced, always** — never client-honor-system. Grants are set by the owner alone — no scope delegates the ability to grant (§8). The hard limits are: `write:user` cannot corrupt `source`; `write:objects` cannot import a pre-existing object from another Vibe; `push` cannot write `user`; no scope exposes origins; `pull` cannot rewrite pull configuration; revoked grants fail closed.

### 3.3 Owner supremacy

`owner` is a required, immutable field on every Vibe, MediaObject, MediaElement, and OriginArtifact. It is store-assigned from the authenticated user or, for a machine write, inherited from the Vibe authorizing that write. Ownership determines who may administer or tombstone a record; it is not a bearer capability and does not give a machine access. Machine access remains entirely a consequence of Vibe grants.

In v0.1 ownership cannot cross a Vibe boundary: every object added to a Vibe MUST share its owner, every element referenced by an object MUST share the object's owner, and every OriginArtifact referenced by an ingested object's `source.origins` MUST share the object's owner. Authored objects may instead cite their creating client as specified in §2.3. Sharing and cross-owner references remain deferred (§8).

The Vibe owner holds all scopes implicitly, can revoke any grant at any time, and revocation takes effect at next request. No grant survives owner deletion of the Vibe.

---

## 4. Store Semantics

What a store MUST do, independent of how it is reached. rNet does not specify a transport: a store may expose these semantics over HTTP, over an RPC protocol, or as a local library, and two stores that make different choices there still implement the same protocol. What follows is what they cannot differ on.

### 4.1 Identity and creation

**The store mints record identity.** Every `uri` is a store-assigned UUIDv7 (§2.3). A creation request MUST NOT carry `uri`, `owner`, or `rnet_schema`, and a store MUST reject supplied values rather than ignoring them — silently overwriting a client's identity claim hides a client bug that will surface later as missing data.

**Ownership is assigned, never asserted.** `owner` is set by the store at creation and is immutable. Records created under a delegated grant inherit the authorizing Vibe's owner. An object added to a Vibe MUST have the same `owner` as that Vibe; cross-owner references are rejected until sharing semantics exist (§8).

**Creation is rejected unless the `source` block conforms** to §2.3, including the registered type vocabulary for the object's `type` where one exists (§7).

**Element reachability is not implied by knowledge.** Reading an element requires that it be reachable through a Vibe the caller can read. Knowing a UUID or a `content_hash` grants nothing — identifiers are not capabilities.

### 4.2 Atomic creation

An object, any element records created with it, their ordered references, its provenance links, its initial revisions, and its Vibe membership **MUST commit together**. A failed creation leaves no reachable element record.

A store MAY stage content-addressed bytes before committing, since payloads are content-addressed and therefore idempotent to write. Unreferenced staged bytes are garbage-collected (§6.3).

This is what makes delegated authoring safe to reason about: a client holding `write:objects` cannot create a detached element, so there is no window in which an element exists without the object that justifies it.

### 4.3 Vibe–model interaction

The two modalities by which a Vibe engages a model. Both are asynchronous: a store accepts the request, returns a handle, and completes the work independently.

**Push** — send the Vibe, or a selection from it, to a model for analysis. The store assembles context (the Vibe's inferred summary plus the selected objects), invokes the target, and lands results in `inferred` blocks at the object and/or Vibe level, keyed under **the store's own writer namespace**. Push is how a Vibe *thinks about itself*, with or without any client attached. Push writes reach `inferred` and nothing else.

**Task names are store-defined.** `categorize` on one store need not exist on another; clients SHOULD discover a store's available tasks rather than assume a vocabulary. The operation's shape is protocol, its task list is local — the same split as skill identifiers in `source.ingest`.

**Pull** — ask a Vibe's already-configured sources for new objects. The store invokes its ingestion runtime, receives candidate MediaObjects, and applies the Vibe's pull policy (§2.4). Pull cannot modify pull configuration, and cannot read origins; both are owner-only.

**Dry run is a required gate, not a convenience.** A dry run returns candidates without committing them. Stores SHOULD require dry-run review for any ingestion that is not `reproducible: true` (§2.3) — freehand extraction is exactly the case a human should see before it becomes canonical `source` data.

### 4.4 Failure conditions

Stores differ on how failures are encoded; they MUST NOT differ on what constitutes one, or on what the caller is told.

| Condition | The caller MUST be able to determine |
|---|---|
| A `user` write carries a stale revision | That the write conflicted, and the current revision |
| A required scope is not held | That authorization failed, **and which scope was missing** |
| A document violates its schema | That validation failed, and where — a JSON Schema pointer into the offending document |
| A `source` block fails §2.3 | That the ingest record was non-conformant, and **which rule** it failed |

Naming the missing scope and the failing rule is the part that matters: a caller that only learns "denied" cannot correct itself, and a client author debugging against an unfamiliar store has nothing to go on.

---

## 5. Identity

- **Protocol records:** elements, origins, objects, and Vibes use UUIDv7 record URIs in their respective namespaces: `rnet://element/{uuid}`, `rnet://origin/{uuid}`, `rnet://object/{uuid}`, and `rnet://vibe/{uuid}`. A payload's `content_hash` is integrity and deduplication metadata, never record identity or authority.
- **Users:** `rnet://id/{opaque}` — issuance and authentication are implementation-defined (§8 punt). The identifier is opaque and stable: stores MUST NOT mint identity URIs from mutable, human-chosen strings. Display names, handles, and usernames are store features that travel *alongside* an identity, never *as* one — otherwise a rename silently repoints every grant and owner reference that quoted the old URI. The shape is chosen so decentralized identity mappings (DID methods, key-derived identities, account-abstraction schemes) can be added later as resolution methods without breaking any stored reference.
- **Clients:** applications acting on a user's behalf — `client:{name}` as a grant subject, `rnet://client/{uuid}` as the stable URI an authored object's `source.origins` points at (§2.3). Registration mechanics, manifests, sandboxing, and metering are implementation concerns; the protocol defines only the two identifier shapes, so a store whose clients are plugins or extensions rather than any particular product's notion of an app remains interoperable. Registration mechanics, manifests, budgets, and billing are implementation concerns (see: Rhizome dMachine SDK).
- **Ingestion sources:** recorded in `source.ingest` for attribution (§2.3). Provenance is attribution.

---

## 6. Record Lifecycle

### 6.1 Versioning
`rnet_schema` follows semver-lite: `0.x` may break; from `1.0`, additive-only within a major. Consumers MUST reject majors they don't understand and MUST ignore unknown top-level `x-*` fields, which makes namespaced document evolution non-breaking without opening embedded control records to accidental extension.

### 6.2 Revisions
`source` and `user` blocks carry monotonic revision counters (store-assigned). A write to `user` MUST name the revision it expects to replace, and the store MUST reject a stale revision — last-write-wins is not acceptable for user data. How that precondition is encoded is transport-specific.

`inferred` entries are versioned in the store's revision log like every other block, so superseded readings remain retrievable — which matters more than it would for pure task output, since accumulated entries cannot be recomputed. They carry no concurrency check: two runs of the same task are independent re-derivations rather than conflicting edits, so the later one wins. Task-keying already prevents the collision that would matter — distinct tasks write distinct keys and cannot clobber each other.

### 6.3 Deletion & the right to be forgotten
Only a record's owner may tombstone it. Deleting an element tombstones its UUID record. Objects referencing that record remain valid — meaning survives, payload access through that URI does not. The same semantics apply to origins: deletion tombstones the UUID record, derived objects remain valid, and the ability to re-run ingestion through that origin is lost — stores SHOULD warn before deleting an origin that live objects reference.

Payload deletion is reference-aware. A store MUST NOT delete physical bytes while any live element or origin record it serves still depends on them; shared payloads may be garbage-collected only after the last live record is gone. Tombstones are the one state in which a record's `bytes` need not resolve, and clients render an absence rather than attempting a fetch.

---

## 7. Registered Core Types (v0.1)

Initial property vocabularies (full JSON Schemas at `/schemas/0.1/types/`):

**`transaction`** — `amount` (signed base-10 decimal string, required), `currency` (ISO 4217, required), `posted_at`, `raw_description`. A string representation preserves exact monetary precision across JSON implementations. Keys: `fitid`. Typically zero elements (§2.1): every field here is queried on. Attached files — receipts, check images — are the element case.

**`track`** — `title`, `artist`, `album`, `duration_ms`, `released` — all fields, since all are queried on. Keys: `isrc` (the cross-service join key). Album art, if stored, is an `image` element. Normally zero elements: audio lives on the platform, so locators go in `keys` and identity/meaning in `source.properties`.

**`post`**, **`photo`**, **`note`**, **`contact`**, **`event`**, **`book`**, **`article`**, **`receipt`** — legal open-vocabulary names without a registered v0.1 properties schema. Their vocabularies can be registered as their ingestion paths ship.

**There is deliberately no `document` object type.** `document` is an element *kind* (§2.1) — it names consumption, not meaning. An object whose content is a document element takes the semantic type of what the document *is*: a `book`, an `article`, a `receipt`, a `contract`. Work-level facts (`title`, `author`) and artifact-level facts (`page_count`, `language`) live in those types' vocabularies. The rule generalizes: element kinds name consumption; object types name meaning; neither taxonomy may borrow from the other. (`dataset` failed this rule upward; `document`-as-type failed it downward.)

---

## 8. What v0.1 deliberately punts on

Recorded so the punts are decisions, not oversights:

1. **Decentralized identity.** Identity URIs are opaque, so DID methods and account-abstraction schemes can be layered on later as resolution methods; neither their syntax nor their trust model is specified here. One reference store first.
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

Operations, not routes: a store binds these to whatever transport it exposes.

```
 1. create an origin              ← chase_export_2026-08.qfx bytes
                                    (UUID origin record + content-addressed payload)
 2. create a Vibe                 ← {"title": "Brooklyn Spending", "pull": {...}}
 3. pull, dry run                 ← runtime loads the ingestion skill, parses,
                                    verifies invariants (counts, totals),
                                    returns 214 candidate transaction objects —
                                    zero elements, meaning in properties,
                                    ingest: {method: "parser", reproducible: true},
                                    source.origins → the stored origin UUID
 4. (review UI: "214 transactions, totals reconcile ✓") → user confirms
 5. pull, committed
 6. push                          ← task: "categorize"; results land under the
                                    store's writer key, e.g. rhizome:categorize
 7. client:rbudget is granted     ← ["read", "write:user", "push"]
 8. read the Vibe's objects       ← renders; user edits a category
    write the user block            (at the current revision) → sticky forever
 9. Monthly: steps 3-6 repeat via pull config; the Vibe stays alive.

Novel-format variant of step 3: unknown CSV dialect → runtime generates a parser,
records parser_hash under method `generated_parser`, and dry-run review is REQUIRED
before commit.
```

Time from raw export to a working personal budgeting client: one consent screen and a handful of operations. That is the demo, and the thesis.

---

*rNet is an open specification: what two strangers must agree on to share a store. The reference implementation is TypeScript on Bun; the protocol is JSON Schema; the second implementation is the point.*
