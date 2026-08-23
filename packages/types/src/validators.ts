import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  grantSchema,
  ingestRecordSchema,
  mediaElementSchema,
  mediaObjectSchema,
  originArtifactSchema,
  rnetSchemas,
  trackPropertiesSchema,
  transactionPropertiesSchema,
  vibeSchema,
} from "./generated/schemas.ts";
import type {
  Grant,
  IngestRecord,
  MediaElement,
  MediaObject,
  OriginArtifact,
  TrackProperties,
  TransactionProperties,
  Vibe,
} from "./generated/types.ts";

export interface SchemaTypes {
  grant: Grant;
  "ingest-record": IngestRecord;
  "media-element": MediaElement;
  "media-object": MediaObject;
  "origin-artifact": OriginArtifact;
  track: TrackProperties;
  transaction: TransactionProperties;
  vibe: Vibe;
}

export type SchemaName = keyof SchemaTypes;

export interface ValidationIssue {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  message: string;
  params: Record<string, unknown>;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

const ajv = new Ajv2020({
  allErrors: true,
  allowUnionTypes: true,
  strict: true,
  validateFormats: true,
});
addFormats(ajv);

for (const schema of rnetSchemas) ajv.addSchema(schema);

function compiled<T>(id: string): ValidateFunction<T> {
  const validator = ajv.getSchema<T>(id);
  if (!validator) throw new Error(`Schema was not compiled: ${id}`);
  return validator;
}

function issues(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  return (errors ?? []).map((error) => ({
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
    keyword: error.keyword,
    message: error.message ?? "schema violation",
    params: error.params as Record<string, unknown>,
  }));
}

function result<T>(validator: ValidateFunction<T>, value: unknown): ValidationResult<T> {
  return validator(value)
    ? { ok: true, value }
    : { ok: false, issues: issues(validator.errors) };
}

export const validators = {
  grant: compiled<Grant>(grantSchema.$id),
  "ingest-record": compiled<IngestRecord>(ingestRecordSchema.$id),
  "media-element": compiled<MediaElement>(mediaElementSchema.$id),
  "media-object": compiled<MediaObject>(mediaObjectSchema.$id),
  "origin-artifact": compiled<OriginArtifact>(originArtifactSchema.$id),
  track: compiled<TrackProperties>(trackPropertiesSchema.$id),
  transaction: compiled<TransactionProperties>(transactionPropertiesSchema.$id),
  vibe: compiled<Vibe>(vibeSchema.$id),
} satisfies { [Name in SchemaName]: ValidateFunction<SchemaTypes[Name]> };

const registeredObjectTypes: Record<string, ValidateFunction> = {
  track: validators.track,
  transaction: validators.transaction,
};

export function validateSchema<Name extends SchemaName>(
  schema: Name,
  value: unknown,
): ValidationResult<SchemaTypes[Name]> {
  return result(validators[schema] as ValidateFunction<SchemaTypes[Name]>, value);
}

export function validateMediaObject(value: unknown): ValidationResult<MediaObject> {
  const core = result(validators["media-object"], value);
  if (!core.ok) return core;

  const vocabulary = registeredObjectTypes[core.value.type];
  if (!vocabulary) return core;

  const properties = core.value.source.properties;
  const typed = result(vocabulary, properties);
  if (typed.ok) return core;

  return {
    ok: false,
    issues: typed.issues.map((issue) => ({
      ...issue,
      instancePath: `/source/properties${issue.instancePath}`,
    })),
  };
}
