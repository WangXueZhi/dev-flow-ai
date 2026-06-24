import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const scriptPath = resolve("scripts/verify-live-smoke-report.mjs");

test("verify live smoke report accepts a skipped optional report", (t) => {
  const workspace = createWorkspace(t);
  const reportPath = writeReport(workspace, "live-provider-smoke.json", createReport({ status: "skipped" }));

  const result = runVerifier(reportPath);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /status=skipped required=false provider=fallback/);
});

test("verify live smoke report rejects failed reports", (t) => {
  const workspace = createWorkspace(t);
  const reportPath = writeReport(
    workspace,
    "live-provider-smoke.json",
    createReport({ status: "failed", required: true, message: "Missing live provider key." })
  );

  const result = runVerifier(reportPath);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /status is failed/);
});

test("verify live smoke report requires passed status for release gates", (t) => {
  const workspace = createWorkspace(t);
  const reportPath = writeReport(workspace, "live-provider-smoke.json", createReport({ status: "skipped" }));

  const result = runVerifier(reportPath, ["--require-passed"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must have status passed/);
  assert.match(result.stderr, /required=true/);
});

test("verify live smoke report accepts a required passed report", (t) => {
  const workspace = createWorkspace(t);
  const reportPath = writeReport(
    workspace,
    "live-provider-smoke.json",
    createReport({
      status: "passed",
      required: true,
      apiKeyEnvName: "DEVFLOW_AI_API_KEY",
      provider: {
        mode: "live",
        ready: true,
        fixtureOverridesLive: false
      },
      message: "Live provider smoke passed with DEVFLOW_AI_API_KEY."
    })
  );

  const result = runVerifier(reportPath, ["--require-passed"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /status=passed required=true provider=live/);
});

test("verify live smoke report rejects incomplete diagnostics", (t) => {
  const workspace = createWorkspace(t);
  const reportPath = writeReport(workspace, "live-provider-smoke.json", {
    version: 1,
    status: "passed",
    required: true,
    message: "No provider diagnostics."
  });

  const result = runVerifier(reportPath, ["--require-passed"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Expected generatedAt/);
  assert.match(result.stderr, /Expected provider diagnostics/);
});

test("verify live smoke report rejects fixture-backed passed reports", (t) => {
  const workspace = createWorkspace(t);
  const reportPath = writeReport(
    workspace,
    "live-provider-smoke.json",
    createReport({
      status: "passed",
      required: true,
      apiKeyEnvName: "DEVFLOW_AI_API_KEY",
      provider: {
        mode: "fixture",
        ready: true,
        fixtureOverridesLive: true
      },
      message: "Fixture response was used."
    })
  );

  const result = runVerifier(reportPath, ["--require-passed"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /provider\.mode=live/);
  assert.match(result.stderr, /fixtureOverridesLive=false/);
});

function createWorkspace(t) {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-live-smoke-verify-"));

  t.after(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  return workspace;
}

function writeReport(workspace, name, report) {
  const reportPath = join(workspace, name);

  mkdirSync(workspace, { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return reportPath;
}

function createReport(overrides = {}) {
  const now = new Date("2026-06-24T04:00:00.000Z").toISOString();

  return {
    version: 1,
    generatedAt: now,
    startedAt: now,
    finishedAt: now,
    status: "skipped",
    required: false,
    provider: {
      mode: "fallback",
      ready: false,
      fixtureOverridesLive: false
    },
    message: "Live provider smoke skipped.",
    ...overrides
  };
}

function runVerifier(reportPath, extraArgs = []) {
  return spawnSync(process.execPath, [scriptPath, reportPath, ...extraArgs], {
    encoding: "utf8"
  });
}
