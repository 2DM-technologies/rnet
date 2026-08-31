// Generated from schemas/0.1/**/*.json. Do not edit by hand.
import type { FromSchema } from "json-schema-to-ts";
import {
  grantSchema,
  ingestRecordSchema,
  mediaElementSchema,
  mediaObjectSchema,
  originArtifactSchema,
  trackPropertiesSchema,
  transactionPropertiesSchema,
  tweetPropertiesSchema,
  vibeSchema,
} from "./schemas.ts";

export type Grant = FromSchema<typeof grantSchema, { keepDefaultedPropertiesOptional: true }>;
export type IngestRecord = FromSchema<typeof ingestRecordSchema, { keepDefaultedPropertiesOptional: true }>;
export type MediaElement = FromSchema<typeof mediaElementSchema, { keepDefaultedPropertiesOptional: true }>;
export type MediaObject = FromSchema<typeof mediaObjectSchema, { keepDefaultedPropertiesOptional: true; references: [typeof ingestRecordSchema] }>;
export type OriginArtifact = FromSchema<typeof originArtifactSchema, { keepDefaultedPropertiesOptional: true }>;
export type TrackProperties = FromSchema<typeof trackPropertiesSchema, { keepDefaultedPropertiesOptional: true }>;
export type TransactionProperties = FromSchema<typeof transactionPropertiesSchema, { keepDefaultedPropertiesOptional: true }>;
export type TweetProperties = FromSchema<typeof tweetPropertiesSchema, { keepDefaultedPropertiesOptional: true }>;
export type Vibe = FromSchema<typeof vibeSchema, { keepDefaultedPropertiesOptional: true; references: [typeof grantSchema] }>;
