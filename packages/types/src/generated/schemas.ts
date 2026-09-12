// Generated from schemas/0.1/**/*.json. Do not edit by hand.

export const grantSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rnet.network/schemas/0.1/grant.json",
  "title": "Grant",
  "description": "The read-edge conformance unit: {subject, scope[]} attached to a Vibe. Scope semantics are store-enforced, always — never client-honor-system. Grants are owner-set; delegation is not specified. Stores MUST deny grants whose subject namespace they do not understand.",
  "type": "object",
  "required": [
    "subject",
    "scope"
  ],
  "properties": {
    "subject": {
      "type": "string",
      "description": "Namespaced subject: id:rnet://id/{uuidv7} (a user), client:{name} (a registered application), public (anyone), or {x-namespace}:{...} (extension subject types).",
      "pattern": "^(id:rnet://id/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|client:[a-z0-9][a-z0-9._-]*|public|x-[a-z0-9-]+:.+)$"
    },
    "scope": {
      "type": "array",
      "minItems": 1,
      "uniqueItems": true,
      "items": {
        "enum": [
          "read",
          "write:user",
          "write:objects",
          "write:inferred",
          "push",
          "pull"
        ]
      },
      "description": "read: fetch Vibe/objects/elements — never origins, which are owner-only. write:user: mutate user blocks only. write:objects: create authored objects. write:inferred: write inferred entries directly, under a subject-namespaced task key. push: invoke push. pull: invoke a pull on already-configured sources. Grants are set by the owner alone — no scope delegates the ability to grant."
    }
  },
  "additionalProperties": false
} as const;

export const ingestRecordSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rnet.network/schemas/0.1/ingest-record.json",
  "title": "IngestRecord",
  "description": "How an object came to be — the determinism disclosure. Consumers MAY gate on this record; the protocol guarantees the disclosure, not the trustworthiness.",
  "type": "object",
  "required": [
    "method",
    "reproducible"
  ],
  "properties": {
    "method": {
      "description": "How this object was produced, named for what did the work. parser: a committed, versioned parser ran. generated_parser: an agent wrote a one-off parser, which ran — parser_hash pins it. agent: an agent extracted directly, writing no parser. authored: a person created the object in a client; nothing was parsed. Determinism runs parser > generated_parser > agent — generated code is hash-pinned and re-runnable, while freehand extraction is not. authored sits outside the ladder: nothing was derived.",
      "enum": [
        "parser",
        "generated_parser",
        "agent",
        "authored"
      ]
    },
    "skill": {
      "description": "Skill identity + semver, when a corpus skill guided the run.",
      "type": [
        "string",
        "null"
      ],
      "pattern": "^[a-z0-9][a-z0-9._-]*@\\d+\\.\\d+\\.\\d+([-+][0-9A-Za-z.-]+)?$"
    },
    "model": {
      "description": "Model identity, when a model participated in parsing.",
      "type": [
        "string",
        "null"
      ],
      "minLength": 1
    },
    "parser_hash": {
      "description": "Content hash of generated parser code. Regeneration is a new parser, new provenance.",
      "type": [
        "string",
        "null"
      ],
      "pattern": "^sha256:[a-f0-9]{64}$"
    },
    "reproducible": {
      "description": "Whether re-running the same method against source.origins yields identical output (modulo timestamps).",
      "type": "boolean"
    }
  },
  "allOf": [
    {
      "description": "parser_hash is REQUIRED when an agent generated the parser.",
      "if": {
        "required": [
          "method"
        ],
        "properties": {
          "method": {
            "const": "generated_parser"
          }
        }
      },
      "then": {
        "required": [
          "parser_hash"
        ],
        "properties": {
          "parser_hash": {
            "type": "string"
          }
        }
      }
    },
    {
      "description": "Freehand agent extraction is never reproducible.",
      "if": {
        "required": [
          "method"
        ],
        "properties": {
          "method": {
            "const": "agent"
          }
        }
      },
      "then": {
        "properties": {
          "reproducible": {
            "const": false
          }
        }
      }
    }
  ],
  "additionalProperties": false
} as const;

export const mediaElementSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rnet.network/schemas/0.1/media-element.json",
  "title": "MediaElement",
  "description": "A UUIDv7-identified atomic content record: an owner, a content-addressed payload, and contextual metadata, all immutable, plus an inferred block that is the record's only mutable part. Five kinds, closed set: an element kind exists iff a human consumes that thing directly. Every live element resolves — bytes is required; platform-locked content is referenced via the owning object's keys, never modelled as an element with a missing payload.",
  "type": "object",
  "required": [
    "rnet_schema",
    "kind",
    "uri",
    "owner",
    "content_hash",
    "mime",
    "bytes"
  ],
  "properties": {
    "rnet_schema": {
      "const": "0.1",
      "description": "Protocol version this element record was written under."
    },
    "kind": {
      "description": "Consumption strategy. Closed set — new kinds only by protocol revision.",
      "enum": [
        "text",
        "image",
        "audio",
        "video",
        "document"
      ]
    },
    "uri": {
      "type": "string",
      "description": "Immutable UUIDv7 record identity, independent of payload identity.",
      "pattern": "^rnet://element/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    },
    "owner": {
      "type": "string",
      "description": "Immutable owner identity assigned by the store at creation.",
      "pattern": "^rnet://id/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    },
    "content_hash": {
      "type": "string",
      "description": "SHA-256 identity of the payload bytes; not record identity or authority.",
      "pattern": "^sha256:[a-f0-9]{64}$"
    },
    "mime": {
      "type": "string",
      "description": "IANA media type. mime is truth; kind is the consumption hint.",
      "pattern": "^[a-z]+/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*$"
    },
    "bytes": {
      "type": "string",
      "description": "Retrievable payload location. Returned bytes must hash to content_hash.",
      "format": "uri"
    },
    "byte_size": {
      "type": "integer",
      "minimum": 0
    },
    "alt": {
      "type": "string",
      "description": "Human-authored description of the payload, written at creation and immutable. Describes the bytes, so it lives here rather than on any one object's reference."
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "inferred": {
      "type": "object",
      "description": "A map keyed by writer and task: every key is {writer}:{task}. The element's memory: descriptions and analyses of its payload, derived once because the payload never changes. A re-run replaces only its own key, and never a durable entry. Consumers MUST treat entries as advisory.",
      "propertyNames": {
        "pattern": "^[a-z][a-z0-9._-]*:[a-z][a-z0-9_]*$"
      },
      "additionalProperties": {
        "type": "object",
        "required": [
          "model",
          "properties"
        ],
        "properties": {
          "model": {
            "type": "string",
            "minLength": 1
          },
          "inferred_at": {
            "type": "string",
            "format": "date-time"
          },
          "durable": {
            "type": "boolean",
            "default": false,
            "description": "When true, a push task MUST NOT replace this entry. Durable entries hold understanding that accumulated rather than being computed from source — a pattern an agent noticed across several objects. A task can never set this on its own output: durable means 'cannot be reproduced by re-running', and task output is by definition what re-running produces. Only agent runs may set it."
          },
          "properties": {
            "type": "object"
          },
          "confidence": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          }
        },
        "additionalProperties": false
      }
    }
  },
  "patternProperties": {
    "^x-[a-z0-9-]+$": {
      "description": "Namespaced extensions. Consumers MUST ignore namespaces they don't understand."
    }
  },
  "additionalProperties": false
} as const;

export const mediaObjectSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rnet.network/schemas/0.1/media-object.json",
  "title": "MediaObject",
  "description": "The core unit of meaning: properties plus zero or more MediaElements, carrying three property blocks with different mutation rights. Fields are values, elements are files — if you would query on it, it is a field; if you would open it, it is an element. Pure meaning-objects legitimately carry zero elements.",
  "type": "object",
  "required": [
    "rnet_schema",
    "uri",
    "owner",
    "type",
    "elements",
    "source"
  ],
  "properties": {
    "rnet_schema": {
      "const": "0.1",
      "description": "Protocol version this document conforms to."
    },
    "uri": {
      "type": "string",
      "description": "UUIDv7-identified record.",
      "pattern": "^rnet://object/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    },
    "owner": {
      "type": "string",
      "description": "Immutable owner identity assigned by the store at creation. Ownership governs administration, not delegated access.",
      "pattern": "^rnet://id/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    },
    "type": {
      "type": "string",
      "description": "Open vocabulary. The registered core vocabulary currently includes activity, transaction, track, and tweet; unregistered types such as post, photo, note, contact, event, book, article, and receipt remain legal.",
      "minLength": 1,
      "maxLength": 128,
      "pattern": "^[a-z][a-z0-9_.-]*$"
    },
    "elements": {
      "type": "array",
      "description": "Ordered MediaElement associations. MAY be empty. Role describes this association rather than the immutable element record; a description of the payload is the element's own alt.",
      "items": {
        "type": "object",
        "required": [
          "uri"
        ],
        "properties": {
          "uri": {
            "type": "string",
            "pattern": "^rnet://element/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
          },
          "role": {
            "enum": [
              "title",
              "content",
              "preview"
            ]
          }
        },
        "additionalProperties": false
      }
    },
    "keys": {
      "type": "object",
      "description": "External global identifiers for cross-service joins: isrc, isbn, fitid, url, ean, etc.",
      "additionalProperties": {
        "type": "string",
        "maxLength": 512
      }
    },
    "source": {
      "type": "object",
      "description": "Written by ingestion runtimes only. Immutable after ingest — re-ingestion creates a new revision, never edits in place.",
      "required": [
        "ingest",
        "origins",
        "properties"
      ],
      "properties": {
        "ingest": {
          "$ref": "https://rnet.network/schemas/0.1/ingest-record.json"
        },
        "origins": {
          "type": "array",
          "minItems": 1,
          "description": "What this object was derived from — at least one, always. Either an origin artifact (rnet://origin/{uuid}) for ingested objects, or a client (rnet://client/{uuid}) for objects authored directly in an application. A filename string is not provenance.",
          "items": {
            "type": "string",
            "pattern": "^rnet://(origin|client)/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
          }
        },
        "retrieved_at": {
          "type": "string",
          "format": "date-time"
        },
        "properties": {
          "type": "object",
          "description": "Facts the source format defines. Validated against the registered type vocabulary when one exists."
        }
      },
      "allOf": [
        {
          "if": {
            "type": "object",
            "required": [
              "ingest"
            ],
            "properties": {
              "ingest": {
                "type": "object",
                "required": [
                  "method"
                ],
                "properties": {
                  "method": {
                    "const": "authored"
                  }
                }
              }
            }
          },
          "then": {
            "type": "object",
            "properties": {
              "origins": {
                "type": "array",
                "items": {
                  "type": "string",
                  "pattern": "^rnet://client/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
                }
              }
            }
          },
          "else": {
            "type": "object",
            "properties": {
              "origins": {
                "type": "array",
                "items": {
                  "type": "string",
                  "pattern": "^rnet://origin/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
                }
              }
            }
          }
        }
      ],
      "additionalProperties": false
    },
    "user": {
      "type": "object",
      "description": "Written by the owner via clients holding write:user. Freely mutable by authorized writers; every accepted write is retained in history and the latest committed revision is current.",
      "required": [
        "properties"
      ],
      "properties": {
        "properties": {
          "type": "object"
        },
        "updated_at": {
          "type": "string",
          "format": "date-time"
        }
      },
      "additionalProperties": false
    },
    "inferred": {
      "type": "object",
      "description": "A map keyed by writer and task: every key is {writer}:{task}. Memory scoped to this record — some entries are task output recomputed from source, others accumulated from agent observation and cannot be re-derived. A re-run replaces only its own key, and never a durable entry. Consumers MUST treat entries as advisory.",
      "propertyNames": {
        "pattern": "^[a-z][a-z0-9._-]*:[a-z][a-z0-9_]*$"
      },
      "additionalProperties": {
        "type": "object",
        "required": [
          "model",
          "properties"
        ],
        "properties": {
          "model": {
            "type": "string",
            "minLength": 1
          },
          "inferred_at": {
            "type": "string",
            "format": "date-time"
          },
          "durable": {
            "type": "boolean",
            "default": false,
            "description": "When true, a push task MUST NOT replace this entry. Durable entries hold understanding that accumulated rather than being computed from source — a pattern an agent noticed across several objects. A task can never set this on its own output: durable means 'cannot be reproduced by re-running', and task output is by definition what re-running produces. Only agent runs may set it."
          },
          "properties": {
            "type": "object"
          },
          "confidence": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          }
        },
        "additionalProperties": false
      }
    }
  },
  "patternProperties": {
    "^x-[a-z0-9-]+$": {
      "description": "Namespaced extensions. Consumers MUST ignore namespaces they don't understand."
    }
  },
  "additionalProperties": false
} as const;

export const originArtifactSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rnet.network/schemas/0.1/origin-artifact.json",
  "title": "OriginArtifact",
  "description": "An immutable, UUIDv7-identified provenance record around a content-addressed payload. Ontologically inert: not media, has no kind, never appears in a Vibe's objects, never consumed by a model as content. Exists purely as ground truth so ingestion can always be re-run against original bytes.",
  "type": "object",
  "required": [
    "rnet_schema",
    "uri",
    "owner",
    "content_hash",
    "mime",
    "bytes"
  ],
  "properties": {
    "rnet_schema": {
      "const": "0.1",
      "description": "Protocol version this origin record was written under."
    },
    "uri": {
      "type": "string",
      "description": "Immutable UUIDv7 provenance-record identity, independent of payload identity.",
      "pattern": "^rnet://origin/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    },
    "owner": {
      "type": "string",
      "description": "Immutable owner identity assigned by the store at creation.",
      "pattern": "^rnet://id/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    },
    "content_hash": {
      "type": "string",
      "description": "SHA-256 identity of the payload bytes; not record identity or authority.",
      "pattern": "^sha256:[a-f0-9]{64}$"
    },
    "mime": {
      "type": "string",
      "pattern": "^[a-z]+/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*$"
    },
    "bytes": {
      "type": "string",
      "description": "Retrievable payload location. Returned bytes must hash to content_hash.",
      "format": "uri"
    },
    "byte_size": {
      "type": "integer",
      "minimum": 0
    },
    "label": {
      "type": "string",
      "description": "Human-readable name, e.g. the original filename.",
      "maxLength": 512
    },
    "uploaded_at": {
      "type": "string",
      "format": "date-time"
    }
  },
  "patternProperties": {
    "^x-[a-z0-9-]+$": {
      "description": "Namespaced extensions."
    }
  },
  "additionalProperties": false
} as const;

export const activityPropertiesSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rnet.network/schemas/0.1/types/activity.json",
  "title": "activity — source.properties vocabulary",
  "description": "Registered core type for one recorded physical exercise session. Provider-neutral source facts; normally zero elements. External identifiers, such as strava_activity_id, belong in keys. Official owner-entered race results belong in user.properties.",
  "type": "object",
  "required": [
    "sport"
  ],
  "anyOf": [
    {
      "required": [
        "started_at"
      ],
      "properties": {
        "started_at": {}
      }
    },
    {
      "required": [
        "started_local"
      ],
      "properties": {
        "started_local": {}
      }
    }
  ],
  "properties": {
    "sport": {
      "type": "string",
      "minLength": 1,
      "maxLength": 64,
      "description": "Provider-neutral sport name. Producers use run, ride, walk, swim, or workout for those sports; other nonempty names remain legal."
    },
    "title": {
      "type": "string",
      "maxLength": 1024
    },
    "started_at": {
      "type": "string",
      "format": "date-time",
      "not": {
        "pattern": "-00:00$"
      },
      "description": "Known start instant, with a UTC offset or Z. Do not assign an offset to an unzoned source time; RFC3339 unknown-offset -00:00 is not a known instant."
    },
    "started_local": {
      "type": "string",
      "pattern": "^(?:(?:[0-9]{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])|(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)|02-(?:0[1-9]|1[0-9]|2[0-8])))|(?:(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:[02468][048]|[13579][26])00)-02-29))T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\\.[0-9]+)?$",
      "maxLength": 64,
      "description": "Calendar-valid local start time without a zone or offset. Preserve an unknown time zone rather than interpreting this as UTC. If also carrying started_at, both MUST describe the same start."
    },
    "timezone": {
      "type": "string",
      "minLength": 1,
      "maxLength": 128,
      "description": "Source-provided time zone name, preferably an IANA identifier. Omit when unknown; a name alone does not disambiguate an instant."
    },
    "distance_m": {
      "type": "number",
      "minimum": 0,
      "description": "Total distance in meters. Omit unavailable measurements, including manually entered or indoor sessions without a distance."
    },
    "elapsed_time_s": {
      "type": "number",
      "minimum": 0,
      "description": "Wall-clock duration in seconds, including pauses."
    },
    "timer_time_s": {
      "type": "number",
      "minimum": 0,
      "description": "Duration in seconds while the recording timer was running, excluding explicit timer pauses."
    },
    "moving_time_s": {
      "type": "number",
      "minimum": 0,
      "description": "Duration in seconds classified as moving by the source. Do not infer from timestamp differences."
    },
    "elevation_gain_m": {
      "type": "number",
      "minimum": 0,
      "description": "Cumulative positive elevation gain in meters."
    },
    "workout_type": {
      "type": "string",
      "minLength": 1,
      "maxLength": 128,
      "description": "Explicit source-provided session classification, for example race or workout. A title is not evidence of a race or an official result."
    },
    "laps": {
      "type": "array",
      "maxItems": 1000,
      "description": "Recorded source/device laps in order, never relabeled as uniform-distance splits. Unavailable lap measurements are omitted. Each lap carries at least distance or duration.",
      "items": {
        "type": "object",
        "required": [
          "index",
          "timing_basis",
          "provenance"
        ],
        "anyOf": [
          {
            "required": [
              "distance_m"
            ],
            "properties": {
              "distance_m": {}
            }
          },
          {
            "required": [
              "duration_s"
            ],
            "properties": {
              "duration_s": {}
            }
          }
        ],
        "properties": {
          "index": {
            "type": "integer",
            "minimum": 1,
            "description": "One-based source or calculated sequence index, in activity order."
          },
          "distance_m": {
            "type": "number",
            "minimum": 0,
            "description": "Actual segment distance in meters."
          },
          "duration_s": {
            "type": "number",
            "minimum": 0,
            "description": "Segment duration in seconds, with the stated timing_basis."
          },
          "timing_basis": {
            "type": "string",
            "enum": [
              "elapsed",
              "timer",
              "moving"
            ],
            "description": "Elapsed includes pauses; timer counts running device timer intervals; moving requires explicit movement evidence. Timestamp differences alone are elapsed."
          },
          "distance_basis": {
            "type": "string",
            "enum": [
              "recorded",
              "gps"
            ],
            "description": "Recorded is a source/device distance measurement. GPS is calculated from geographic samples."
          },
          "provenance": {
            "type": "string",
            "minLength": 1,
            "maxLength": 256,
            "description": "Source format or measurement origin, such as tcx, fit, gpx, or manual. Source-specific file bindings may be carried in open activity properties."
          }
        },
        "additionalProperties": false
      }
    },
    "splits": {
      "type": "array",
      "maxItems": 1000,
      "description": "Calculated distance splits in sequence order, including a final partial segment. Calculation and measurement bases are explicit. This is not an average pace copied into each mile.",
      "items": {
        "type": "object",
        "required": [
          "index",
          "target_distance_m",
          "distance_m",
          "duration_s",
          "timing_basis",
          "distance_basis",
          "method",
          "provenance"
        ],
        "properties": {
          "index": {
            "type": "integer",
            "minimum": 1,
            "description": "One-based source or calculated sequence index, in activity order."
          },
          "distance_m": {
            "type": "number",
            "description": "Actual segment distance in meters.",
            "exclusiveMinimum": 0
          },
          "duration_s": {
            "type": "number",
            "minimum": 0,
            "description": "Segment duration in seconds, with the stated timing_basis."
          },
          "timing_basis": {
            "type": "string",
            "enum": [
              "elapsed",
              "timer",
              "moving"
            ],
            "description": "Elapsed includes pauses; timer counts running device timer intervals; moving requires explicit movement evidence. Timestamp differences alone are elapsed."
          },
          "distance_basis": {
            "type": "string",
            "enum": [
              "recorded",
              "gps"
            ],
            "description": "Recorded is a source/device distance measurement. GPS is calculated from geographic samples."
          },
          "provenance": {
            "type": "string",
            "minLength": 1,
            "maxLength": 256,
            "description": "Source format or measurement origin, such as tcx, fit, gpx, or manual. Source-specific file bindings may be carried in open activity properties."
          },
          "target_distance_m": {
            "type": "number",
            "exclusiveMinimum": 0,
            "description": "Nominal complete split distance in meters, e.g. 1609.344 for a mile. A final partial split retains its actual distance_m."
          },
          "method": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128,
            "description": "Deterministic calculation method, e.g. linear_interpolation. Producers MUST document its boundary rule; source processing and official race results may differ."
          }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": true,
  "$comment": "The vocabulary defines the floor, not the ceiling. Missing measurements are absent, never zero placeholders. Raw sensor streams remain in origins. Laps/splits are bounded closed records; producers retain their provenance and must not claim unsupported timing or distance bases."
} as const;

export const trackPropertiesSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rnet.network/schemas/0.1/types/track.json",
  "title": "track — source.properties vocabulary",
  "description": "Registered core type. Validates source.properties for objects with type \"track\". Normally a ZERO-element object: audio lives inside a streaming platform, so it is referenced through the object's keys (isrc as the cross-service join key; spotify_uri, apple_music_id, etc. as handoff locators) rather than modelled as an element. Identity and meaning live here in properties — title, artist, and album are fields because they are queried on. Album art, if stored, is an image element.",
  "type": "object",
  "required": [
    "title"
  ],
  "properties": {
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 512
    },
    "artist": {
      "type": "string",
      "maxLength": 512
    },
    "album": {
      "type": "string",
      "maxLength": 512
    },
    "duration_ms": {
      "type": "integer",
      "minimum": 0
    },
    "released": {
      "type": "string",
      "description": "Release date, as precise as the source knows it: YYYY, YYYY-MM, or YYYY-MM-DD.",
      "pattern": "^\\d{4}(-\\d{2}(-\\d{2})?)?$"
    }
  },
  "additionalProperties": true,
  "$comment": "Streaming exports carry service-specific fields (play counts, added_at, playlist position). Service-specific data belongs in x-{service} extensions on the object; genuinely track-intrinsic extras may ride here."
} as const;

export const transactionPropertiesSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rnet.network/schemas/0.1/types/transaction.json",
  "title": "transaction — source.properties vocabulary",
  "description": "Registered core type. Validates source.properties for objects with type \"transaction\". Typically zero elements (fields are facts); authored attachments — memos, receipts — are the element case. Recommended keys: fitid (OFX transaction id), account_hash.",
  "type": "object",
  "required": [
    "amount",
    "currency"
  ],
  "properties": {
    "amount": {
      "type": "string",
      "description": "Signed base-10 decimal string. Negative = outflow, positive = inflow, per OFX convention. Strings preserve exact monetary precision across implementations.",
      "pattern": "^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$"
    },
    "currency": {
      "type": "string",
      "description": "ISO 4217 alpha code.",
      "pattern": "^[A-Z]{3}$"
    },
    "posted_at": {
      "type": "string",
      "description": "Date the transaction posted.",
      "format": "date"
    },
    "raw_description": {
      "type": "string",
      "description": "The descriptor string as the source format carries it — a fact about the transaction, not authored content.",
      "maxLength": 1024
    }
  },
  "additionalProperties": true,
  "$comment": "additionalProperties stays open: source formats carry fields beyond the core vocabulary (check numbers, MCC codes, pending flags). The vocabulary defines the floor, not the ceiling."
} as const;

export const tweetPropertiesSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rnet.network/schemas/0.1/types/tweet.json",
  "title": "tweet — source.properties vocabulary",
  "description": "Registered core type. Validates source.properties for objects with type \"tweet\". Exact post text is a text/plain MediaElement and is deliberately not duplicated here. Stable provider identifiers and the canonical post URL belong in keys.",
  "type": "object",
  "required": [
    "published_at",
    "post_kind"
  ],
  "properties": {
    "text": false,
    "full_text": false,
    "published_at": {
      "type": "string",
      "format": "date-time",
      "description": "The source publication timestamp."
    },
    "author_handle": {
      "type": "string",
      "minLength": 1,
      "maxLength": 64
    },
    "author_name": {
      "type": "string",
      "maxLength": 256
    },
    "post_kind": {
      "type": "string",
      "enum": [
        "original",
        "quote"
      ],
      "description": "The eligible authored-post form represented by this object. Replies and bare reposts are not tweet candidates."
    },
    "conversation_id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 128
    },
    "referenced_post_ids": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 128
      },
      "uniqueItems": true
    },
    "language": {
      "type": "string",
      "minLength": 1,
      "maxLength": 35
    },
    "possibly_sensitive": {
      "type": "boolean"
    },
    "edit_history_ids": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 128
      },
      "uniqueItems": true
    },
    "entities": {
      "type": "object",
      "description": "Structured source entities such as URLs, mentions, hashtags, cashtags, and annotations. Text offsets and source URLs remain facts; this block does not rewrite the text element.",
      "additionalProperties": true
    }
  },
  "additionalProperties": true,
  "$comment": "The vocabulary defines stable cross-import facts and stays open for source-specific metadata. text and full_text are forbidden so the exact post payload remains single-sourced in its text element. Volatile engagement metrics must not participate in semantic identity."
} as const;

export const vibeSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rnet.network/schemas/0.1/vibe.json",
  "title": "Vibe",
  "description": "A dynamic, owned collection of MediaObjects, plus the state that makes it living: its pull configuration and its inferred block. Vibes contain object references, not copies. Vibes carry no source block — they are authored, not ingested; the omission is the ontology.",
  "type": "object",
  "required": [
    "rnet_schema",
    "uri",
    "title",
    "owner",
    "objects"
  ],
  "properties": {
    "rnet_schema": {
      "description": "Protocol version this document conforms to. Required, present from commit one.",
      "const": "0.1"
    },
    "uri": {
      "type": "string",
      "pattern": "^rnet://vibe/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256
    },
    "owner": {
      "type": "string",
      "description": "A stable rnet://id/{uuidv7} identity URI. Identity issuance and authentication are implementation-defined.",
      "pattern": "^rnet://id/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    },
    "objects": {
      "type": "array",
      "description": "Ordered MediaObject URIs — references, not copies. A URI may appear more than once; each occurrence is a distinct placement. Stores preserve this order, including duplicates, across paginated reads.",
      "items": {
        "type": "string",
        "pattern": "^rnet://object/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
      }
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "pull": {
      "type": "object",
      "description": "How the Vibe acquires new objects.",
      "required": [
        "enabled"
      ],
      "properties": {
        "enabled": {
          "type": "boolean"
        },
        "sources": {
          "type": "array",
          "description": "Source identifiers, implementation-scoped (e.g. \"skill:ofx@^0.3\").",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "policy": {
          "enum": [
            "append_new",
            "replace",
            "suggest_only"
          ]
        },
        "last_pulled_at": {
          "type": "string",
          "format": "date-time"
        }
      },
      "additionalProperties": false
    },
    "grants": {
      "type": "array",
      "items": {
        "$ref": "https://rnet.network/schemas/0.1/grant.json"
      }
    },
    "inferred": {
      "type": "object",
      "description": "A map keyed by writer and task: every key is {writer}:{task}. Memory scoped to this record — some entries are task output recomputed from source, others accumulated from agent observation and cannot be re-derived. A re-run replaces only its own key, and never a durable entry. Consumers MUST treat entries as advisory. The store's summarize task conventionally writes summary and tags.",
      "propertyNames": {
        "pattern": "^[a-z][a-z0-9._-]*:[a-z][a-z0-9_]*$"
      },
      "additionalProperties": {
        "type": "object",
        "required": [
          "model",
          "properties"
        ],
        "properties": {
          "model": {
            "type": "string",
            "minLength": 1
          },
          "inferred_at": {
            "type": "string",
            "format": "date-time"
          },
          "durable": {
            "type": "boolean",
            "default": false,
            "description": "When true, a push task MUST NOT replace this entry. Durable entries hold understanding that accumulated rather than being computed from source — a pattern an agent noticed across several objects — and re-running a task cannot reproduce them. Only agent runs may set this; a task may never mark its own output durable, or refresh stops working."
          },
          "properties": {
            "type": "object"
          },
          "confidence": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          }
        },
        "additionalProperties": false
      }
    }
  },
  "patternProperties": {
    "^x-[a-z0-9-]+$": {
      "description": "Namespaced extensions. Consumers MUST ignore namespaces they don't understand."
    }
  },
  "additionalProperties": false
} as const;

export const rnetSchemas = [
  grantSchema,
  ingestRecordSchema,
  mediaElementSchema,
  mediaObjectSchema,
  originArtifactSchema,
  activityPropertiesSchema,
  trackPropertiesSchema,
  transactionPropertiesSchema,
  tweetPropertiesSchema,
  vibeSchema,
] as const;
