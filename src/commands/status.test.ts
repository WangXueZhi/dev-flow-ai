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
    visualRequiredText: 0,
    designTokens: 1,
    reviewerNotes: 2
  },
  evidence: {
    acceptanceCriteria: [],
    verificationCommands: [{ command: "npm run check", exitCode: 0, durationMs: 1000 }],
    visualScreenshots: [],
    visualRequiredText: [],
    designTokens: [
      {
        category: "color",
        sourceLine: 22,
        name: "Primary color",
        value: "#2563eb",
        summary: "Primary color: #2563eb"
      }
    ],
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
  assert.match(output, /Design tokens: 1/);
  assert.match(output, /Delivery report: \.devflow\/artifacts\/delivery-report\.md \(present\)/);
  assert.match(output, /Prompt artifacts: \.devflow\/artifacts\/prompts \(present\)/);
  assert.match(output, /Source context summary: \.devflow\/artifacts\/source-context-summary\.json \(present\)/);
  assert.match(output, /Reviewer notes/);
  assert.match(output, /Reviewer should check generated copy before merge/);
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
  assert.equal(parsed.counts.designTokens, 1);
});

test("runStatus includes live provider smoke evidence when a smoke report exists", async (t) => {
  const workspace = createWorkspace(t);
  writeFileSync(
    join(workspace, ".devflow", "artifacts", "live-provider-smoke.json"),
    `${JSON.stringify(
      {
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
        responseExcerpt: "ok",
        message: "AI provider smoke passed with DEVFLOW_AI_API_KEY."
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  const output = await captureStatusOutput(workspace, {});

  assert.match(output, /AI provider smoke/);
  assert.match(output, /Report: \.devflow\/artifacts\/live-provider-smoke\.json/);
  assert.match(output, /Status: passed/);
  assert.match(output, /Required: yes/);
  assert.match(output, /Provider: live, model example-model, endpoint https:\/\/api\.example\.com\/v1\/chat\/completions/);
  assert.match(output, /Key source: DEVFLOW_AI_API_KEY/);
  assert.match(output, /Message: AI provider smoke passed with DEVFLOW_AI_API_KEY\./);
});

test("runStatus can read a smoke report from DEVFLOW_LIVE_SMOKE_REPORT", async (t) => {
  const workspace = createWorkspace(t);
  const customReportPath = join(workspace, ".devflow", "artifacts", "release", "live-provider-smoke.json");

  mkdirSync(join(workspace, ".devflow", "artifacts", "release"), { recursive: true });
  writeFileSync(
    customReportPath,
    `${JSON.stringify({
      version: 1,
      generatedAt: "2026-01-01T00:00:02.000Z",
      startedAt: "2026-01-01T00:00:01.000Z",
      finishedAt: "2026-01-01T00:00:02.000Z",
      status: "skipped",
      required: false,
      provider: {
        mode: "fallback",
        ready: false,
        fixtureOverridesLive: false,
        baseUrl: "https://api.openai.com/v1",
        baseUrlSource: "default",
        chatCompletionsUrl: "https://api.openai.com/v1/chat/completions",
        model: "gpt-4.1",
        modelSource: "default"
      },
      message: "AI provider smoke skipped: set DEVFLOW_AI_API_KEY or OPENAI_API_KEY to run against a real provider."
    })}\n`,
    "utf8"
  );
  const output = await captureStatusOutput(workspace, {}, { DEVFLOW_LIVE_SMOKE_REPORT: customReportPath });

  assert.match(output, new RegExp(`Report: ${escapeRegExp(customReportPath)}`));
  assert.match(output, /Status: skipped/);
  assert.match(output, /Required: no/);
  assert.match(output, /Key source: none/);
});

test("runStatus reports invalid live provider smoke evidence", async (t) => {
  const workspace = createWorkspace(t);

  writeFileSync(join(workspace, ".devflow", "artifacts", "live-provider-smoke.json"), "{", "utf8");
  const output = await captureStatusOutput(workspace, {});

  assert.match(output, /AI provider smoke/);
  assert.match(output, /Report: \.devflow\/artifacts\/live-provider-smoke\.json \(invalid\)/);
  assert.match(output, /Error:/);
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
      ]
    }
  };
  const workspace = createWorkspace(t, failedManifest);
  const output = await captureStatusOutput(workspace, {});

  assert.match(output, /Verification failures/);
  assert.match(output, /`npm run check`: exit 1/);
  assert.match(output, /Build failed Missing export/);
  assert.match(output, /Suggested follow-up: Fix missing imports, exports, or module paths/);
  assert.match(output, /Next action: Inspect the first unresolved module/);
  assert.match(output, /Related artifact: Full verification report \(\.devflow\/artifacts\/verification-report\.json\)/);
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

async function captureStatusOutput(
  workspace: string,
  flags: Record<string, string | undefined>,
  env: NodeJS.ProcessEnv = {}
): Promise<string> {
  const originalCwd = process.cwd();
  const originalLog = console.log;
  const lines: string[] = [];

  console.log = (value?: unknown) => {
    lines.push(String(value ?? ""));
  };

  try {
    process.chdir(workspace);
    await runStatus(flags, env);
  } finally {
    console.log = originalLog;
    process.chdir(originalCwd);
  }

  return lines.join("\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
