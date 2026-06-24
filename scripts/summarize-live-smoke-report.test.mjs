import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  formatInvalidLiveSmokeSummary,
  formatLiveSmokeSummary,
  formatMissingLiveSmokeSummary,
  writeLiveSmokeSummary
} from "./summarize-live-smoke-report.mjs";

const report = {
  version: 1,
  generatedAt: "2026-01-01T00:00:02.000Z",
  startedAt: "2026-01-01T00:00:01.000Z",
  finishedAt: "2026-01-01T00:00:02.000Z",
  status: "passed",
  required: true,
  apiKeyEnvName: "DEVFLOW_AI_API_KEY",
  provider: {
    mode: "live",
    ready: true,
    apiKeyEnvName: "DEVFLOW_AI_API_KEY",
    liveApiKeyEnvName: "DEVFLOW_AI_API_KEY",
    fixtureOverridesLive: false,
    baseUrl: "https://api.example.com/v1",
    baseUrlSource: "env",
    chatCompletionsUrl: "https://api.example.com/v1/chat/completions",
    model: "example-model",
    modelSource: "env"
  },
  responseExcerpt: "Smoke request reached the model.",
  message: "AI provider smoke passed with DEVFLOW_AI_API_KEY."
};

test("formatLiveSmokeSummary renders sanitized provider evidence", () => {
  const summary = formatLiveSmokeSummary(report, ".devflow/artifacts/live-provider-smoke.json");

  assert.match(summary, /### DevFlow Live Provider Smoke/);
  assert.match(summary, /Report: `\.devflow\/artifacts\/live-provider-smoke\.json`/);
  assert.match(summary, /Status: \*\*passed\*\*/);
  assert.match(summary, /Required gate: yes/);
  assert.match(summary, /Provider: `live`/);
  assert.match(summary, /Model: `example-model`/);
  assert.match(summary, /Endpoint: `https:\/\/api\.example\.com\/v1\/chat\/completions`/);
  assert.match(summary, /Key source: `DEVFLOW_AI_API_KEY`/);
  assert.match(summary, /Message: AI provider smoke passed with DEVFLOW_AI_API_KEY\./);
  assert.match(summary, /Response excerpt: Smoke request reached the model\./);
  assert.doesNotMatch(summary, /sk-/);
});

test("formatMissingLiveSmokeSummary renders a missing report notice", () => {
  assert.equal(
    formatMissingLiveSmokeSummary(".devflow/artifacts/live-provider-smoke.json"),
    "### DevFlow Live Provider Smoke\n\nLive provider smoke report not found at `.devflow/artifacts/live-provider-smoke.json`."
  );
});

test("formatInvalidLiveSmokeSummary renders parse and shape errors", () => {
  const summary = formatInvalidLiveSmokeSummary(".devflow/artifacts/live-provider-smoke.json", "Unexpected end of JSON input");

  assert.match(summary, /Status: \*\*invalid\*\*/);
  assert.match(summary, /Unexpected end of JSON input/);
});

test("writeLiveSmokeSummary appends a formatted report", () => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-live-smoke-summary-"));

  try {
    const reportPath = join(workspace, "live-provider-smoke.json");
    const summaryPath = join(workspace, "summary.md");
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const result = writeLiveSmokeSummary({ reportPath, summaryPath });
    const summary = readFileSync(summaryPath, "utf8");

    assert.equal(result, "written");
    assert.match(summary, /### DevFlow Live Provider Smoke/);
    assert.match(summary, /Status: \*\*passed\*\*/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("writeLiveSmokeSummary appends missing and invalid summaries without failing", () => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-live-smoke-summary-"));

  try {
    const missingPath = join(workspace, "missing.json");
    const invalidPath = join(workspace, "invalid.json");
    const summaryPath = join(workspace, "summary.md");
    writeFileSync(invalidPath, "{", "utf8");

    assert.equal(writeLiveSmokeSummary({ reportPath: missingPath, summaryPath }), "missing");
    assert.equal(writeLiveSmokeSummary({ reportPath: invalidPath, summaryPath }), "invalid");

    const summary = readFileSync(summaryPath, "utf8");
    assert.match(summary, /not found/);
    assert.match(summary, /Status: \*\*invalid\*\*/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
