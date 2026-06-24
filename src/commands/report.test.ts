import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runReport } from "./report.js";

test("runReport can suppress stale visual reports", async (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-report-"));
  const originalCwd = process.cwd();
  const originalLog = console.log;

  t.after(() => {
    console.log = originalLog;
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  });

  console.log = () => undefined;
  process.chdir(workspace);
  mkdirSync(".devflow/artifacts/visual", { recursive: true });
  mkdirSync(".devflow/artifacts/prompts/dry-run", { recursive: true });
  writeFileSync(".devflow/artifacts/prompts/plan.prompt.md", "Planner prompt\n", "utf8");
  writeFileSync(".devflow/artifacts/prompts/dry-run/T03-code-implementation.prompt.md", "Dry-run prompt\n", "utf8");
  writeFileSync(
    ".devflow/artifacts/task-changelog.md",
    `# Task Changelog

## Review Handoff

- Execution log: \`.devflow/artifacts/execution-log.json\`
- Verification report: \`.devflow/artifacts/verification-report.json\`
- Delivery report: \`.devflow/artifacts/delivery-report.md\`
- Reviewer notes:
  - Reviewer should check generated copy before merge.

<!-- devflow-verification-summary:start -->
## Verification Summary

- Status: passed
- Report: \`.devflow/artifacts/verification-report.json\`
- Finished at: 2026-01-01T00:00:01.000Z
- Commands passed: 1/1
- Commands:
  - \`npm run check\`: exit 0, 1000ms
<!-- devflow-verification-summary:end -->
`,
    "utf8"
  );
  writeFileSync(
    ".devflow/artifacts/source-context-summary.json",
    `${JSON.stringify(
      {
        version: 1,
        entries: [
          {
            generatedAt: "2026-01-01T00:00:00.000Z",
            mode: "dry-run",
            taskId: "T03-code-implementation",
            entries: [{ kind: "file", path: "src/App.tsx", sizeBytes: 42, truncated: false }],
            omitted: [],
            limits: {
              maxEntries: 14,
              maxFileBytes: 12_000,
              maxTotalBytes: 48_000,
              maxDirectoryEntries: 30
            }
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  writeFileSync(
    ".devflow/artifacts/visual/visual-report.json",
    `${JSON.stringify(
      {
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: "2026-01-01T00:00:01.000Z",
        url: "http://127.0.0.1:5173",
        status: "passed",
        screenshots: [
          {
            viewport: { name: "desktop", width: 1440, height: 1000 },
            path: ".devflow/artifacts/visual/desktop.png",
            title: "Stale Preview",
            bodyCharacters: 100,
            analysis: {
              width: 1440,
              height: 1000,
              sampledPixels: 720000,
              distinctPixels: 100000,
              distinctPixelRatio: 0.1389,
              blank: false
            }
          }
        ],
        layoutIssues: [],
        requiredText: [{ text: "Stale Preview", found: true }]
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  await runReport({ "visual-report": "none" });

  const report = readFileSync(".devflow/artifacts/delivery-report.md", "utf8");
  assert.match(report, /Visual verification has not been run yet/);
  assert.match(report, /Prompt artifacts: `\.devflow\/artifacts\/prompts`/);
  assert.match(report, /Reviewer should check generated copy before merge/);
  assert.match(report, /Latest changelog verification/);
  assert.match(report, /Source Context Sampling/);
  assert.match(report, /`src\/App\.tsx` \(file\)/);
  assert.doesNotMatch(report, /Stale Preview/);

  const manifest = JSON.parse(readFileSync(".devflow/artifacts/delivery-manifest.json", "utf8")) as {
    status: { visual: string };
    counts: { reviewerNotes: number };
    artifacts: Array<{ id: string; status: string; count?: number }>;
    evidence: { taskChangelog?: { reviewHandoff: { reviewerNotes: string[] } } };
  };
  assert.equal(manifest.status.visual, "not-run");
  assert.equal(manifest.counts.reviewerNotes, 1);
  assert.equal(manifest.evidence.taskChangelog?.reviewHandoff.reviewerNotes[0], "Reviewer should check generated copy before merge.");
  assert.equal(manifest.artifacts.find((artifact) => artifact.id === "visual-report")?.status, "not-applicable");
  assert.equal(manifest.artifacts.find((artifact) => artifact.id === "task-changelog")?.status, "present");
  assert.equal(manifest.artifacts.find((artifact) => artifact.id === "prompt-artifacts")?.status, "present");
  assert.equal(manifest.artifacts.find((artifact) => artifact.id === "prompt-artifacts")?.count, 2);
  assert.equal(manifest.artifacts.find((artifact) => artifact.id === "source-context-summary")?.status, "present");
  assert.doesNotMatch(JSON.stringify(manifest), /Stale Preview/);
});
