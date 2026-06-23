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
    touchedFiles: 2
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
    }
  ],
  evidence: {
    verificationCommands: [
      {
        command: "npm run check",
        exitCode: 1,
        durationMs: 1000,
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
    openQuestions: ["Confirm empty state copy."]
  }
};

test("formatDevFlowSummary renders delivery status markdown", () => {
  const summary = formatDevFlowSummary(manifest);

  assert.match(summary, /### DevFlow Delivery/);
  assert.match(summary, /Readiness: \*\*needs attention\*\*/);
  assert.match(summary, /Verification: \*\*passed\*\*/);
  assert.match(summary, /Delivery risks: 2 \(1 high\)/);
  assert.match(summary, /Delivery report: `\.devflow\/artifacts\/delivery-report\.md` \(present\)/);
  assert.match(summary, /Verification failures/);
  assert.match(summary, /`npm run check`: exit 1/);
  assert.match(summary, /Build failed Missing export/);
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
