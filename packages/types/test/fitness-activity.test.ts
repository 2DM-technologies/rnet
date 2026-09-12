import { describe, expect, test } from "bun:test";

import {
  type FitnessActivityProperties,
  validateMediaObject,
  validateMediaObjectProperties,
  validateSchema,
  validators,
} from "../src/index.ts";

const minimal: FitnessActivityProperties = { sport: "run", started_local: "2026-09-12T06:30:00" };
const split = {
  index: 1,
  target_distance_m: 1609.344,
  distance_m: 1609.344,
  duration_s: 492,
  timing_basis: "elapsed" as const,
  distance_basis: "recorded" as const,
  method: "linear_interpolation",
  provenance: "tcx:Trackpoint.DistanceMeters/Time",
};
const object = (properties: unknown) => ({
  rnet_schema: "0.1",
  uri: "rnet://object/018f1f4e-7b3a-7cc1-8b7a-123456789abc",
  owner: "rnet://id/0198f2a0-4d11-7a83-b5c6-1e9f0a2b3c4d",
  type: "fitness_activity",
  elements: [],
  source: {
    ingest: { method: "parser", reproducible: true },
    origins: ["rnet://origin/018f1f4e-7b3a-7cc1-8b7a-123456789abd"],
    properties,
  },
});

describe("registered activity vocabulary", () => {
  test("uses generated public types and validators with both start representations", () => {
    const instant: FitnessActivityProperties = { sport: "walk", started_at: "2026-09-12T06:30:00-04:00" };
    expect(validators.fitness_activity(minimal)).toBe(true);
    expect(validateSchema("fitness_activity", instant).ok).toBe(true);
    expect(validateSchema("fitness_activity", { sport: "run", started_at: "2026-09-12T06:30:00-00:00" }).ok).toBe(true);
    expect(validateMediaObject(object(minimal)).ok).toBe(true);
    expect(validateMediaObjectProperties("fitness_activity", { sport: "run" }).ok).toBe(false);
    expect(validateMediaObjectProperties("fitness_activity", { started_at: instant.started_at }).ok).toBe(false);
  });

  test("preserves unknown metrics and open source extensions for non-Strava activities", () => {
    const activity: FitnessActivityProperties = {
      ...minimal,
      sport: "workout",
      title: "Indoor session",
      timer_time_s: 0,
      device: { brand: "synthetic-provider", session: "synthetic-session" },
    };
    expect(validateSchema("fitness_activity", activity).ok).toBe(true);
    expect(validateMediaObject(object(activity)).ok).toBe(true);
    expect(validateSchema("fitness_activity", { ...activity, distance_m: null }).ok).toBe(false);
  });

  test.each([
    "2026-09-12T06:30:00Z",
    "2026-09-12T06:30:00-04:00",
    "2026-09-12",
    "2026-02-29T06:30:00",
    "1900-02-29T06:30:00",
    "2026-04-31T06:30:00",
    "2026-13-01T06:30:00",
    "2026-09-12T24:00:00",
    "2026-09-12T06:60:00",
  ])("rejects invalid or zoned local timestamps: %s", (started_local) => {
    expect(validateSchema("fitness_activity", { sport: "run", started_local }).ok).toBe(false);
  });

  test.each(["2024-02-29T00:00:00", "2000-02-29T23:59:59.123", "2026-04-30T06:30:00"])(
    "accepts valid local calendar values: %s",
    (started_local) => expect(validateSchema("fitness_activity", { sport: "run", started_local }).ok).toBe(true),
  );

  test.each(["2026-09-12T06:30:00", "2026-02-31T06:30:00Z"])(
    "rejects invalid or unzoned instants: %s",
    (started_at) => expect(validateSchema("fitness_activity", { sport: "run", started_at }).ok).toBe(false),
  );

  test.each(["distance_m", "elapsed_time_s", "timer_time_s", "moving_time_s", "elevation_gain_m"])(
    "rejects negative, string, and non-finite %s values",
    (field) => {
      for (const value of [-1, "10", Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(validateSchema("fitness_activity", { ...minimal, [field]: value }).ok).toBe(false);
      }
    },
  );

  test("keeps recorded laps distinct from computed full and partial distance splits", () => {
    const activity: FitnessActivityProperties = {
      ...minimal,
      laps: [{ index: 1, distance_m: 1000, duration_s: 301, timing_basis: "timer", provenance: "fit:lap" }],
      splits: [split, { ...split, index: 2, distance_m: 200, duration_s: 62 }],
    };
    expect(validateSchema("fitness_activity", activity).ok).toBe(true);
    expect(validateSchema("fitness_activity", { ...minimal, laps: [{ index: 1, duration_s: 20, timing_basis: "timer", provenance: "manual" }] }).ok).toBe(true);
    expect(validateSchema("fitness_activity", { ...minimal, laps: [{ index: 1, timing_basis: "timer", provenance: "fit" }] }).ok).toBe(false);
  });

  test.each([
    { timing_basis: "unknown" },
    { distance_basis: "guessed" },
    { target_distance_m: 0 },
    { distance_m: 0 },
    { duration_s: -1 },
    { index: 0 },
    { index: 1.5 },
    { method: "" },
    { provenance: "" },
    { average_pace: 492 },
  ])("rejects malformed calculated split records: %j", (invalid) => {
    expect(validateSchema("fitness_activity", { ...minimal, splits: [{ ...split, ...invalid }] }).ok).toBe(false);
  });

  test("requires calculation evidence, closes nested records, and bounds arrays", () => {
    for (const field of ["duration_s", "timing_basis", "distance_basis", "method", "provenance"]) {
      const incomplete: Record<string, unknown> = { ...split };
      delete incomplete[field];
      expect(validateSchema("fitness_activity", { ...minimal, splits: [incomplete] }).ok).toBe(false);
    }
    expect(validateSchema("fitness_activity", { ...minimal, laps: [{ index: 1, distance_m: 1000, duration_s: 300, timing_basis: "elapsed", provenance: "tcx", method: "invented" }] }).ok).toBe(false);
    expect(validateSchema("fitness_activity", { ...minimal, splits: Array.from({ length: 1001 }, (_, i) => ({ ...split, index: i + 1 })) }).ok).toBe(false);
    expect(validateSchema("fitness_activity", { ...minimal, laps: Array.from({ length: 1001 }, (_, i) => ({ index: i + 1, duration_s: 1, timing_basis: "timer", provenance: "fit" })) }).ok).toBe(false);
  });

  test("enforces the vocabulary on full objects with useful source property paths", () => {
    const invalid = validateMediaObject(object({ ...minimal, splits: [{ ...split, duration_s: -1 }] }));
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.issues.some((issue) => issue.instancePath === "/source/properties/splits/0/duration_s")).toBe(true);
    const activity = {
      ...object(minimal),
      user: { properties: { official_chip_time_s: 12345 } },
      inferred: { "running:summary": { model: "test/model", properties: { fatigue: "unknown" } } },
    };
    expect(validateMediaObject(activity).ok).toBe(true);
  });
});
