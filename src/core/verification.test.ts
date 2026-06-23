import assert from "node:assert/strict";
import { test } from "node:test";
import { runVerificationCommands } from "./verification.js";

test("runVerificationCommands records successful command output", async () => {
  const report = await runVerificationCommands(["node -e \"console.log('ok')\""]);

  assert.equal(report.status, "passed");
  assert.equal(report.results.length, 1);
  assert.equal(report.results[0]?.exitCode, 0);
  assert.match(report.results[0]?.stdout ?? "", /ok/);
});

test("runVerificationCommands records bounded failure output excerpts", async () => {
  const report = await runVerificationCommands([
    "node -e \"for (let i = 0; i < 20; i += 1) console.error('line ' + i); process.exit(1)\""
  ]);
  const excerpt = report.results[0]?.outputExcerpt;

  assert.equal(report.status, "failed");
  assert.equal(report.results[0]?.exitCode, 1);
  assert.ok(excerpt);
  assert.match(excerpt.stderr ?? "", /line 19/);
  assert.doesNotMatch(excerpt.stderr ?? "", /line 0/);
  assert.equal(excerpt.truncatedStderr, true);
});
