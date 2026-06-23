import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDeliveryReport } from "./report.js";
import type { ProjectBrief } from "./brief.js";
import type { VerificationReport } from "./verification.js";

const brief: ProjectBrief = {
  version: 1,
  sourceDocuments: {
    requirementsPath: "docs/requirements.md",
    uiPath: "docs/ui.md",
    apiPath: "docs/api.md"
  },
  stack: {
    packageManager: "npm",
    runtimes: ["Node.js", "TypeScript"],
    frameworks: ["React"],
    buildTools: ["Vite"],
    styling: [],
    testing: ["Vitest"],
    scripts: {
      check: "vitest run"
    },
    sourceDirectories: ["src"],
    configFiles: ["vite.config.ts"],
    notes: []
  },
  signals: {
    requirements: [],
    ui: [],
    api: []
  },
  designAssets: [
    {
      source: "ui-markdown-image",
      kind: "local",
      altText: "Dashboard mock",
      reference: "assets/dashboard.svg",
      resolvedPath: "docs/assets/dashboard.svg",
      exists: true,
      metadata: {
        width: "960",
        height: "640",
        viewBox: "0 0 960 640",
        title: "Dashboard mock",
        description: "Operational dashboard wireframe.",
        colors: ["#f8fafc", "#0f172a", "rgb(34, 197, 94)"],
        textSnippets: ["Release health", "Deploy confidence"]
      }
    }
  ],
  apiContracts: [
    {
      method: "GET",
      path: "/api/dashboard",
      sourceLine: 12,
      summary: "GET /api/dashboard"
    }
  ],
  apiDataModels: [
    {
      name: "dashboard",
      sourceLine: 20,
      fields: ["releaseHealth", "deployConfidence"],
      summary: "dashboard object"
    }
  ],
  apiErrorCases: [
    {
      sourceLine: 30,
      summary: "Dashboard endpoint unavailable: show stale values."
    }
  ],
  apiAuthRequirements: [
    {
      sourceLine: 34,
      summary: "Authorization: Bearer token is required."
    }
  ],
  invalidApiDataModels: [],
  userStories: ["As a release owner, I want dashboard health visible so that release risk is clear."],
  constraints: ["Keep the dashboard dense and operational."],
  acceptanceCriteria: ["Dashboard renders release health.", "Deploy confidence is visible."],
  openQuestions: ["Confirm empty state copy."],
  recommendedVerification: ["npm run check"]
};

const verification: VerificationReport = {
  startedAt: "2026-01-01T00:00:00.000Z",
  finishedAt: "2026-01-01T00:00:01.000Z",
  status: "passed",
  results: [
    {
      command: "npm run check",
      exitCode: 0,
      durationMs: 1000,
      stdout: "ok",
      stderr: ""
    }
  ]
};

test("formatDeliveryReport includes artifacts, stack, verification, and questions", () => {
  const report = formatDeliveryReport({
    brief,
    implementationPlanPath: ".devflow/artifacts/implementation-plan.md",
    projectBriefPath: ".devflow/artifacts/project-brief.json",
    taskPlanPath: ".devflow/artifacts/tasks.json",
    taskPlanMarkdownPath: ".devflow/artifacts/tasks.md",
    patchProposalsDir: ".devflow/artifacts/patch-proposals",
    executionLogPath: ".devflow/artifacts/execution-log.json",
    executionLog: {
      version: 1,
      entries: [
        {
          taskId: "T03-code-implementation",
          summary: "Apply dashboard source changes.",
          appliedAt: "2026-01-01T00:00:00.500Z",
          status: "applied",
          backupManifestPath: ".devflow/artifacts/backups/backup/manifest.json",
          operations: [
            {
              type: "replace",
              path: "src/App.tsx",
              status: "written",
              bytesWritten: 2048,
              replacements: 1,
              linesBefore: 80,
              linesAfter: 86,
              lineDelta: 6
            },
            {
              type: "delete",
              path: "src/ObsoletePanel.tsx",
              status: "deleted",
              bytesWritten: 0,
              linesBefore: 24,
              linesAfter: 0,
              lineDelta: -24
            }
          ]
        }
      ]
    },
    rollbackReportPath: ".devflow/artifacts/rollback-report.json",
    verificationReportPath: ".devflow/artifacts/verification-report.json",
    verification,
    visualReportPath: ".devflow/artifacts/visual/visual-report.json",
    visualReport: {
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:01.000Z",
      url: "http://127.0.0.1:5173",
      status: "passed",
      screenshots: [
        {
          viewport: { name: "desktop", width: 1440, height: 1000 },
          path: ".devflow/artifacts/visual/desktop.png",
          title: "OpsBoard",
          bodyCharacters: 100,
          analysis: {
            width: 1440,
            height: 1000,
            sampledPixels: 720000,
            distinctPixels: 180000,
            distinctPixelRatio: 0.25,
            blank: false
          }
        }
      ],
      layoutIssues: [],
      requiredText: [{ text: "OpsBoard", found: true }]
    }
  });

  assert.match(report, /Delivery Report/);
  assert.match(report, /Task plan/);
  assert.match(report, /Applied Changes/);
  assert.match(report, /User Stories/);
  assert.match(report, /release owner.*dashboard health visible/);
  assert.match(report, /Requirement Constraints/);
  assert.match(report, /dense and operational/);
  assert.match(report, /Acceptance Criteria/);
  assert.match(report, /Dashboard renders release health/);
  assert.match(report, /Acceptance Evidence/);
  assert.match(report, /AC1: Dashboard renders release health/);
  assert.match(report, /Evidence: Source-changing execution recorded 1 entry touching `src\/App\.tsx`, `src\/ObsoletePanel\.tsx`/);
  assert.match(report, /Evidence: Verification passed: `npm run check` exit 0/);
  assert.match(report, /Evidence: Visual verification passed: 1 screenshot\(s\), 1\/1 required text checks found/);
  assert.match(report, /Review: Resolve open questions before marking this criterion complete/);
  assert.match(report, /Design Assets/);
  assert.match(report, /assets\/dashboard\.svg/);
  assert.match(report, /Dimensions: 960x640/);
  assert.match(report, /ViewBox: 0 0 960 640/);
  assert.match(report, /Colors: #f8fafc, #0f172a, rgb\(34, 197, 94\)/);
  assert.match(report, /Text snippets: Release health; Deploy confidence/);
  assert.match(report, /API Contracts/);
  assert.match(report, /GET \/api\/dashboard/);
  assert.match(report, /API Data Models/);
  assert.match(report, /dashboard.*releaseHealth, deployConfidence/);
  assert.match(report, /API Error Cases/);
  assert.match(report, /Dashboard endpoint unavailable/);
  assert.match(report, /API Auth Requirements/);
  assert.match(report, /Bearer token is required/);
  assert.match(report, /T03-code-implementation: applied/);
  assert.match(report, /Files touched: `src\/App\.tsx`/);
  assert.match(report, /Written operations: 1/);
  assert.match(report, /Deleted operations: 1/);
  assert.match(report, /Backups recorded: 1/);
  assert.match(report, /replace `src\/App\.tsx`: written, 2048 bytes, 1 replacements, lines 80->86 \(\+6\)/);
  assert.match(report, /delete `src\/ObsoletePanel\.tsx`: deleted, 0 bytes, lines 24->0 \(-24\)/);
  assert.match(report, /Frameworks: React/);
  assert.match(report, /Status: passed/);
  assert.match(report, /desktop 1440x1000/);
  assert.match(report, /blank: no, distinct pixels: 25\.00%/);
  assert.match(report, /Layout issues: none/);
  assert.match(report, /Delivery Readiness/);
  assert.match(report, /Status: needs attention/);
  assert.match(report, /Evidence: 2 acceptance criteria recorded/);
  assert.match(report, /Attention: 1 open question\(s\) remain/);
  assert.match(report, /Confirm empty state copy/);
});
