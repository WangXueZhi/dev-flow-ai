import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { CliError } from "../core/errors.js";
import type { DeliveryManifest } from "../core/report.js";
import { runStatus } from "./status.js";

const manifest: DeliveryManifest = {
  version: 1,
  generatedAt: "2026-01-01T00:00:00.000Z",
  artifactsDir: ".devflow/artifacts",
  status: {
    readiness: "needs attention",
    verification: "passed",
    visual: "not-run",
    sourceChanges: "applied"
  },
  sourceDocuments: {
    requirementsPath: "docs/requirements.md",
    uiPath: "docs/ui.md",
    apiPath: "docs/api.md"
  },
  artifacts: [
    {
      id: "delivery-report",
      label: "Delivery report",
      kind: "markdown",
      path: ".devflow/artifacts/delivery-report.md",
      status: "present",
      required: true,
      role: "Human-readable delivery report."
    },
    {
      id: "delivery-manifest",
      label: "Delivery manifest",
      kind: "json",
      path: ".devflow/artifacts/delivery-manifest.json",
      status: "present",
      required: true,
      role: "Machine-readable delivery manifest."
    },
    {
      id: "verification-report",
      label: "Verification report",
      kind: "json",
      path: ".devflow/artifacts/verification-report.json",
      status: "present",
      required: true,
      role: "Verification command results."
    },
    {
      id: "visual-report",
      label: "Visual report",
      kind: "json",
      path: ".devflow/artifacts/visual/visual-report.json",
      status: "not-applicable",
      required: false,
      role: "Visual checks."
    },
    {
      id: "prompt-artifacts",
      label: "Prompt artifacts",
      kind: "directory",
      path: ".devflow/artifacts/prompts",
      status: "present",
      required: false,
      role: "Saved AI prompt artifacts for local review.",
      count: 2
    },
    {
      id: "source-context-summary",
      label: "Source context summary",
      kind: "json",
      path: ".devflow/artifacts/source-context-summary.json",
      status: "present",
      required: false,
      role: "Path-level source context sampling summary."
    }
  ],
  counts: {
    acceptanceCriteria: 3,
    openQuestions: 1,
    deliveryRisks: 2,
    highDeliveryRisks: 1,
    appliedEntries: 1,
    appliedOperations: 2,
    touchedFiles: 2,
    verificationCommands: 1,
    visualScreenshots: 0,
    visualLayoutIssues: 0,
    visualRequiredText: 0
  },
  evidence: {
    acceptanceCriteria: [],
    verificationCommands: [{ command: "npm run check", exitCode: 0, durationMs: 1000 }],
    visualScreenshots: [],
    visualRequiredText: [],
    appliedChanges: {
      entries: 1,
      touchedFiles: ["src/App.jsx", "src/styles.css"],
      operations: {
        total: 2,
        written: 2,
        deleted: 0,
        unchanged: 0
      },
      lineDelta: 10,
      backupManifestPaths: [".devflow/artifacts/backups/backup/manifest.json"]
    },
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
          maxFileBytes: 12_000,
          maxTotalBytes: 48_000,
          maxDirectoryEntries: 30
        }
      }
    ],
    deliveryRisks: [
      {
        level: "high",
        source: "requirements",
        sourceLine: 12,
        summary: "Acceptance criterion needs review.",
        recommendation: "Confirm the criterion before release."
      }
    ],
    openQuestions: ["Confirm empty state copy."]
  }
};

test("runStatus prints a readable delivery manifest summary", async (t) => {
  const workspace = createWorkspace(t);
  const output = await captureStatusOutput(workspace, {});

  assert.match(output, /DevFlow delivery status/);
  assert.match(output, /Readiness: needs attention/);
  assert.match(output, /Verification: passed/);
  assert.match(output, /Visual: not-run/);
  assert.match(output, /Delivery risks: 2 \(1 high\)/);
  assert.match(output, /Delivery report: \.devflow\/artifacts\/delivery-report\.md \(present\)/);
  assert.match(output, /Prompt artifacts: \.devflow\/artifacts\/prompts \(present\)/);
  assert.match(output, /Source context summary: \.devflow\/artifacts\/source-context-summary\.json \(present\)/);
  assert.match(output, /Source context sampling/);
  assert.match(output, /Runs recorded: 1/);
  assert.match(output, /Latest run: dry-run T03-code-implementation, unit U07 \[frontend-route\] Route path \/dashboard/);
  assert.match(output, /Sampled: src\/App\.jsx \(file\)/);
  assert.match(output, /Omitted candidates: 1/);
  assert.match(output, /\[high\] requirements:12: Acceptance criterion needs review/);
  assert.match(output, /Confirm empty state copy/);
});

test("runStatus prints raw manifest JSON", async (t) => {
  const workspace = createWorkspace(t);
  const output = await captureStatusOutput(workspace, { json: "true" });
  const parsed = JSON.parse(output) as DeliveryManifest;

  assert.equal(parsed.status.readiness, "needs attention");
  assert.equal(parsed.counts.touchedFiles, 2);
});

test("runStatus can fail CI gates when readiness needs attention", async (t) => {
  const workspace = createWorkspace(t);

  await assert.rejects(() => captureStatusOutput(workspace, { "fail-on-attention": "true" }), (error) => {
    assert.ok(error instanceof CliError);
    assert.equal(error.exitCode, 1);
    assert.match(error.message, /readiness is needs attention/);
    return true;
  });
});

test("runStatus can fail CI gates when verification failed", async (t) => {
  const failedManifest: DeliveryManifest = {
    ...manifest,
    status: {
      ...manifest.status,
      verification: "failed"
    }
  };
  const workspace = createWorkspace(t, failedManifest);

  await assert.rejects(() => captureStatusOutput(workspace, { "fail-on-failed-verification": "true" }), (error) => {
    assert.ok(error instanceof CliError);
    assert.equal(error.exitCode, 1);
    assert.match(error.message, /verification status is failed/);
    return true;
  });
});

test("runStatus prints verification failure excerpts", async (t) => {
  const failedManifest: DeliveryManifest = {
    ...manifest,
    status: {
      ...manifest.status,
      verification: "failed"
    },
    evidence: {
      ...manifest.evidence,
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
      ]
    }
  };
  const workspace = createWorkspace(t, failedManifest);
  const output = await captureStatusOutput(workspace, {});

  assert.match(output, /Verification failures/);
  assert.match(output, /`npm run check`: exit 1/);
  assert.match(output, /Build failed Missing export/);
  assert.match(output, /Output excerpt was truncated/);
});

test("runStatus reports a missing manifest", async (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-status-missing-"));
  const originalCwd = process.cwd();

  t.after(() => {
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  });

  process.chdir(workspace);

  await assert.rejects(() => runStatus({}), (error) => {
    assert.ok(error instanceof CliError);
    assert.match(error.message, /Run dev-flow deliver or dev-flow report first/);
    return true;
  });
});

function createWorkspace(t: TestContext, deliveryManifest: DeliveryManifest = manifest): string {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-status-"));
  const originalCwd = process.cwd();

  t.after(() => {
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  });

  mkdirSync(join(workspace, ".devflow", "artifacts"), { recursive: true });
  writeFileSync(
    join(workspace, ".devflow", "artifacts", "delivery-manifest.json"),
    `${JSON.stringify(deliveryManifest, null, 2)}\n`,
    "utf8"
  );

  return workspace;
}

async function captureStatusOutput(workspace: string, flags: Record<string, string | undefined>): Promise<string> {
  const originalCwd = process.cwd();
  const originalLog = console.log;
  const lines: string[] = [];

  console.log = (value?: unknown) => {
    lines.push(String(value ?? ""));
  };

  try {
    process.chdir(workspace);
    await runStatus(flags);
  } finally {
    console.log = originalLog;
    process.chdir(originalCwd);
  }

  return lines.join("\n");
}
