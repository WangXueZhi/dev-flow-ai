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
