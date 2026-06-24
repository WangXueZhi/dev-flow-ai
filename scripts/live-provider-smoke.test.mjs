import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const scriptPath = resolve("scripts/live-provider-smoke.mjs");

test("live provider smoke writes a skipped report when no key is configured", (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-live-smoke-report-"));
  const reportPath = join(workspace, "live-provider-smoke.json");

  t.after(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  const result = runSmoke(reportPath, {});

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Live provider smoke skipped/);

  const report = readReport(reportPath);

  assert.equal(report.status, "skipped");
  assert.equal(report.required, false);
  assert.equal(report.apiKeyEnvName, undefined);
  assert.equal(report.provider.mode, "fallback");
  assert.equal(report.provider.ready, false);
  assert.match(report.message, /set DEVFLOW_AI_API_KEY or OPENAI_API_KEY/);
});

test("live provider smoke writes a failed report when required credentials are missing", (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-live-smoke-required-report-"));
  const reportPath = join(workspace, "nested", "live-provider-smoke.json");

  t.after(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  mkdirSync(join(workspace, "nested"), { recursive: true });

  const result = runSmoke(reportPath, {
    DEVFLOW_REQUIRE_LIVE_SMOKE: "true"
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /DEVFLOW_REQUIRE_LIVE_SMOKE=true was set/);

  const report = readReport(reportPath);

  assert.equal(report.status, "failed");
  assert.equal(report.required, true);
  assert.equal(report.apiKeyEnvName, undefined);
  assert.equal(report.provider.mode, "fallback");
  assert.match(report.message, /DEVFLOW_REQUIRE_LIVE_SMOKE=true was set/);
  assert.doesNotMatch(JSON.stringify(report), /test-secret/);
});

function runSmoke(reportPath, extraEnv) {
  const env = {
    ...process.env,
    DEVFLOW_LIVE_SMOKE_REPORT: reportPath,
    ...extraEnv
  };

  delete env.DEVFLOW_AI_API_KEY;
  delete env.OPENAI_API_KEY;
  delete env.DEVFLOW_AI_FIXTURE_PATH;
  delete env.DEVFLOW_AI_BASE_URL;
  delete env.DEVFLOW_AI_MODEL;

  return spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env
  });
}

function readReport(reportPath) {
  return JSON.parse(readFileSync(reportPath, "utf8"));
}
