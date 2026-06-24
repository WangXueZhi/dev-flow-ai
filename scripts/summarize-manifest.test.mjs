import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  formatDevFlowSummary,
  formatMissingManifestSummary,
  writeDevFlowSummary
} from "./summarize-manifest.mjs";

const manifest = {
  status: {
    readiness: "needs attention",
    verification: "passed",
    visual: "not-run",
    sourceChanges: "applied"
  },
  counts: {
    acceptanceCriteria: 3,
    openQuestions: 1,
    deliveryRisks: 2,
    highDeliveryRisks: 1,
    designTokens: 1,
    touchedFiles: 2,
    reviewerNotes: 2
  },
  artifacts: [
    {
      id: "delivery-report",
      label: "Delivery report",
      path: ".devflow/artifacts/delivery-report.md",
      status: "present"
    },
    {
      id: "delivery-manifest",
      label: "Delivery manifest",
      path: ".devflow/artifacts/delivery-manifest.json",
      status: "present"
    },
    {
      id: "verification-report",
      label: "Verification report",
      path: ".devflow/artifacts/verification-report.json",
      status: "present"
    },
    {
      id: "visual-report",
      label: "Visual report",
      path: ".devflow/artifacts/visual/visual-report.json",
      status: "not-applicable"
    },
    {
      id: "prompt-artifacts",
      label: "Prompt artifacts",
      path: ".devflow/artifacts/prompts",
      status: "present"
    },
    {
      id: "source-context-summary",
      label: "Source context summary",
      path: ".devflow/artifacts/source-context-summary.json",
      status: "present"
    }
  ],
  evidence: {
    verificationCommands: [
      {
        command: "npm run check",
        exitCode: 1,
        durationMs: 1000,
        remediation: "Fix missing imports, exports, or module paths, then rerun the failing verification command.",
        remediationPlan: {
          category: "imports",
          summary: "Fix missing imports, exports, or module paths, then rerun the failing verification command.",
          nextActions: [
            "Inspect the first unresolved module, export, or import path in the failure output.",
            "Update the owning module export or correct the consumer import path.",
            "Rerun `npm run check` after the targeted fix."
          ],
          artifactReferences: [
            {
              label: "Full verification report",
              path: ".devflow/artifacts/verification-report.json"
            }
          ]
        },
        outputExcerpt: {
          stderr: "Build failed\nMissing export",
          truncatedStderr: true
        }
      }
    ],
    deliveryRisks: [
      {
        level: "high",
        source: "requirements",
        sourceLine: 12,
        summary: "Acceptance criterion needs review."
      }
    ],
    sourceContext: [
      {
        generatedAt: "2026-01-01T00:00:00.250Z",
        mode: "dry-run",
        taskId: "T03-code-implementation",
        unit: {
          id: "U07",
          kind: "frontend-route",
          title: "Route path /dashboard"
        },
        entries: [
          { kind: "file", path: "src/App.jsx", sizeBytes: 2048, truncated: false },
          { kind: "missing", path: "src/pages/Dashboard.jsx" }
        ],
        omitted: ["src/legacy.jsx (entry limit reached)"],
        limits: {
          maxEntries: 14,
          maxFileBytes: 12000,
          maxTotalBytes: 48000,
          maxDirectoryEntries: 30
        }
      }
    ],
    taskChangelog: {
      reviewHandoff: {
        executionLogPath: ".devflow/artifacts/execution-log.json",
        verificationReportPath: ".devflow/artifacts/verification-report.json",
        deliveryReportPath: ".devflow/artifacts/delivery-report.md",
        reviewerNotes: [
          "Review the operation list before merging or continuing source-changing work.",
          "Reviewer should check generated copy before merge."
        ]
      },
      verificationSummary: {
        status: "passed",
        reportPath: ".devflow/artifacts/verification-report.json",
        finishedAt: "2026-01-01T00:00:01.000Z",
        commandsPassed: "1/1",
        commands: ["npm run check: exit 0, 1000ms"]
      }
    },
    openQuestions: ["Confirm empty state copy."]
  }
};

test("formatDevFlowSummary renders delivery status markdown", () => {
  const summary = formatDevFlowSummary(manifest);

  assert.match(summary, /### DevFlow Delivery/);
  assert.match(summary, /Readiness: \*\*needs attention\*\*/);
  assert.match(summary, /Verification: \*\*passed\*\*/);
  assert.match(summary, /Delivery risks: 2 \(1 high\)/);
  assert.match(summary, /Design tokens: 1/);
  assert.match(summary, /Delivery report: `\.devflow\/artifacts\/delivery-report\.md` \(present\)/);
  assert.match(summary, /Prompt artifacts: `\.devflow\/artifacts\/prompts` \(present\)/);
  assert.match(summary, /Source context summary: `\.devflow\/artifacts\/source-context-summary\.json` \(present\)/);
  assert.match(summary, /Source context sampling/);
  assert.match(summary, /Runs recorded: 1/);
  assert.match(summary, /Latest run: `dry-run` `T03-code-implementation`, unit `U07` \[frontend-route\] Route path \/dashboard/);
  assert.match(summary, /`src\/App\.jsx` \(file\)/);
  assert.match(summary, /Omitted candidates: 1/);
  assert.match(summary, /Reviewer notes/);
  assert.match(summary, /Reviewer should check generated copy before merge/);
  assert.match(summary, /Verification failures/);
  assert.match(summary, /`npm run check`: exit 1/);
  assert.match(summary, /Build failed Missing export/);
  assert.match(summary, /Suggested follow-up: Fix missing imports, exports, or module paths/);
  assert.match(summary, /Next action: Inspect the first unresolved module/);
  assert.match(summary, /Related artifact: Full verification report \(\.devflow\/artifacts\/verification-report\.json\)/);
  assert.match(summary, /Output excerpt was truncated/);
  assert.match(summary, /\[high\] requirements:12: Acceptance criterion needs review/);
  assert.match(summary, /Confirm empty state copy/);
});

test("formatMissingManifestSummary renders a missing manifest notice", () => {
  assert.equal(
    formatMissingManifestSummary(".devflow/artifacts/delivery-manifest.json"),
    "### DevFlow Delivery\n\nDelivery manifest not found at `.devflow/artifacts/delivery-manifest.json`."
  );
});

test("writeDevFlowSummary appends the formatted summary", () => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-summary-"));

  try {
    const manifestPath = join(workspace, "delivery-manifest.json");
    const summaryPath = join(workspace, "summary.md");
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const result = writeDevFlowSummary({ manifestPath, summaryPath });
    const summary = readFileSync(summaryPath, "utf8");

    assert.equal(result, "written");
    assert.match(summary, /### DevFlow Delivery/);
    assert.match(summary, /Source changes: \*\*applied\*\*/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
