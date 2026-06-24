import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateExternalReleaseStatus,
  formatExternalReleaseStatusReport
} from "./release-external-status.mjs";

const baseInput = {
  packageName: "dev-flow-ai",
  releaseTag: "v0.1.0",
  repository: "WangXueZhi/dev-flow-ai",
  generatedAt: "2026-01-01T00:00:00.000Z"
};

test("evaluateExternalReleaseStatus passes when npm, release, and secrets are ready", () => {
  const report = evaluateExternalReleaseStatus({
    ...baseInput,
    npmWhoami: commandOk("devflow-maintainer\n"),
    npmView: commandOk(JSON.stringify({ name: "dev-flow-ai", version: "0.1.0", description: "DevFlow" })),
    githubReleases: commandOk(JSON.stringify([
      {
        tag_name: "v0.1.0",
        draft: false,
        published_at: "2026-01-01T00:00:00Z",
        html_url: "https://github.com/WangXueZhi/dev-flow-ai/releases/tag/v0.1.0"
      }
    ])),
    githubSecrets: commandOk(JSON.stringify({
      total_count: 2,
      secrets: [{ name: "NPM_TOKEN" }, { name: "DEVFLOW_AI_API_KEY" }]
    }))
  });
  const summary = formatExternalReleaseStatusReport(report);

  assert.equal(report.passed, true);
  assert.deepEqual(report.checks.map((check) => check.status), ["passed", "passed", "passed", "passed"]);
  assert.match(summary, /PASS npm authentication/);
  assert.match(summary, /External release status passed/);
});

test("evaluateExternalReleaseStatus reports publish blockers without exposing secrets", () => {
  const report = evaluateExternalReleaseStatus({
    ...baseInput,
    npmWhoami: commandFailed("npm error code ENEEDAUTH\nnpm error need auth"),
    npmView: commandFailed(
      "npm error code E404",
      JSON.stringify({
        error: {
          code: "E404",
          summary: "Not Found - GET https://registry.npmjs.org/dev-flow-ai - Not found"
        }
      })
    ),
    githubReleases: commandOk(JSON.stringify([
      {
        tag_name: "v0.1.0",
        draft: true,
        published_at: null,
        html_url: "https://github.com/WangXueZhi/dev-flow-ai/releases/tag/untagged-preview"
      }
    ])),
    githubSecrets: commandOk(JSON.stringify({ total_count: 0, secrets: [] }))
  });
  const summary = formatExternalReleaseStatusReport(report);

  assert.equal(report.passed, false);
  assert.deepEqual(report.checks.map((check) => check.status), ["failed", "failed", "failed", "failed"]);
  assert.match(summary, /FAIL npm authentication: npm whoami failed: npm error code ENEEDAUTH/);
  assert.match(summary, /FAIL npm package published: dev-flow-ai is not published on npm/);
  assert.match(summary, /FAIL GitHub Release published: v0\.1\.0 is still a draft/);
  assert.match(summary, /FAIL GitHub Actions release secrets: missing NPM_TOKEN, DEVFLOW_AI_API_KEY or OPENAI_API_KEY/);
  assert.doesNotMatch(summary, /secret value/i);
  assert.equal(report.nextActions.length, 4);
});

function commandOk(stdout) {
  return {
    exitCode: 0,
    stdout,
    stderr: ""
  };
}

function commandFailed(stderr, stdout = "") {
  return {
    exitCode: 1,
    stdout,
    stderr
  };
}
