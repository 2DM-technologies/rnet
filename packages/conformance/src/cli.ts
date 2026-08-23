#!/usr/bin/env node

import fixturesJson from "../fixtures/manifest.json" with { type: "json" };
import { runFixtures, runStoreConformance, type ConformanceFixture } from "./index.ts";

function printUsage(): void {
  console.error("Usage:\n  rnet-conformance fixtures\n  rnet-conformance run --target <url> --owner-token <token> --client-token <token>");
}

const command = process.argv[2];
if (command === "run") {
  const target = flag("--target");
  const ownerToken = flag("--owner-token");
  const clientToken = flag("--client-token");
  if (!target || !ownerToken || !clientToken) {
    printUsage();
    process.exitCode = 2;
  } else {
    const summary = await runStoreConformance({ target, ownerToken, clientToken });
    for (const check of summary.checks) {
      console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
    }
    console.log(`\n${summary.passed} passed, ${summary.failed} failed`);
    if (summary.failed) process.exitCode = 1;
  }
} else if (command !== "fixtures") {
  printUsage();
  process.exitCode = 2;
} else {
  const summary = runFixtures(fixturesJson as ConformanceFixture[]);
  for (const result of summary.results) {
    const mark = result.passed ? "PASS" : "FAIL";
    console.log(`${mark} ${result.name} (expected ${result.expected}, got ${result.actual})`);
    if (!result.passed) {
      for (const issue of result.issues) {
        console.log(`  ${issue.instancePath || "/"}: ${issue.message}`);
      }
    }
  }
  console.log(`\n${summary.passed} passed, ${summary.failed} failed`);
  if (summary.failed) process.exitCode = 1;
}

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
