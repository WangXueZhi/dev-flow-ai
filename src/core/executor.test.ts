import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProjectBrief } from "./brief.js";
import { buildDryRunPrompt, buildPatchSetPrompt, createDryRunProposal, formatDryRunProposal } from "./executor.js";
import type { ImplementationTask } from "./tasks.js";
import type { ImplementationUnit } from "./tasks.js";

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
    configFiles: [],
    notes: []
  },
  signals: {
    requirements: [],
    ui: [],
    api: []
  },
  designAssets: [],
  uiStateChecklist: [
    {
      kind: "state",
      sourceLine: 12,
      summary: "Loading state uses skeleton cards."
    }
  ],
  apiContracts: [],
  apiDataModels: [],
  apiErrorCases: [],
  apiAuthRequirements: [],
  invalidApiDataModels: [],
  userStories: [],
  constraints: [],
  acceptanceCriteria: [],
  deliveryRisks: [
    {
      level: "high",
      source: "requirements",
      sourceLine: 6,
      summary: "Requirement contains an unresolved placeholder: TODO confirm checkout states.",
      recommendation: "Resolve the placeholder before source-changing execution."
    }
  ],
  openQuestions: [],
  recommendedVerification: ["npm run check"]
};

const task: ImplementationTask = {
  id: "T03-code-implementation",
  phase: "Implementation",
  title: "Implement the planned frontend changes",
  objective: "Apply source changes.",
  mode: "ai-assisted",
  risk: "high",
  dependsOn: ["T02-implementation-map"],
  inputs: [".devflow/artifacts/project-brief.json"],
  expectedOutputs: ["Updated source files"],
  acceptanceCriteria: ["Behavior is implemented."],
  verification: ["npm run check"]
};

const unit: ImplementationUnit = {
  id: "U18",
  kind: "api-endpoint",
  title: "GET /api/release/summary",
  source: "docs/api.md:7",
  details: ["Map this endpoint to data fetching states.", "GET /api/release/summary"]
};

test("createDryRunProposal creates reviewable proposal without source changes", () => {
  const proposal = createDryRunProposal(task, brief);
  const markdown = formatDryRunProposal(proposal);

  assert.equal(proposal.taskId, "T03-code-implementation");
  assert.ok(proposal.suggestedFiles.includes("src/App.tsx"));
  assert.ok(proposal.targetProfile.componentCandidates.includes("src/main.tsx"));
  assert.ok(proposal.targetProfile.testCandidates.includes("src/**/*.test.tsx"));
  assert.match(markdown, /No source files have been changed/);
  assert.match(markdown, /Stack Targeting/);
  assert.match(markdown, /UI Checklist/);
  assert.match(markdown, /Loading state uses skeleton cards/);
  assert.match(markdown, /Delivery Risks/);
  assert.match(markdown, /\[high\] requirements:6/);
  assert.match(markdown, /Resolve or explicitly accept 1 high delivery risk/);
  assert.match(markdown, /npm run check/);
  assert.match(markdown, /Review this proposal/);
});

test("createDryRunProposal can target an implementation unit", () => {
  const proposal = createDryRunProposal(task, brief, unit);
  const markdown = formatDryRunProposal(proposal);

  assert.equal(proposal.targetUnit?.id, "U18");
  assert.ok(proposal.suggestedFiles.includes("src/lib/api.ts"));
  assert.ok(proposal.suggestedFiles.includes("package.json"));
  assert.match(proposal.summary, /scoped to U18/);
  assert.match(markdown, /Target Unit/);
  assert.match(markdown, /Data candidates/);
  assert.match(markdown, /GET \/api\/release\/summary/);
});

test("buildDryRunPrompt includes task and project brief context", () => {
  const prompt = buildDryRunPrompt(task, brief);

  assert.match(prompt, /T03-code-implementation/);
  assert.match(prompt, /UI checklist coverage/);
  assert.match(prompt, /Delivery risks and mitigations/);
  assert.match(prompt, /Repository Target Profile/);
  assert.match(prompt, /Project Brief/);
  assert.match(prompt, /docs\/requirements\.md/);
  assert.match(prompt, /npm run check/);
});

test("buildDryRunPrompt includes target implementation unit context", () => {
  const prompt = buildDryRunPrompt(task, brief, unit);

  assert.match(prompt, /Target Implementation Unit/);
  assert.match(prompt, /Repository Target Profile/);
  assert.match(prompt, /U18/);
  assert.match(prompt, /GET \/api\/release\/summary/);
});

test("buildDryRunPrompt can include sampled repository source context", () => {
  const prompt = buildDryRunPrompt(task, brief, unit, {
    rootDir: "/workspace/app",
    entries: [
      {
        kind: "file",
        path: "src/App.tsx",
        sizeBytes: 42,
        content: "export function App() { return null; }\n",
        truncated: false
      }
    ],
    omitted: [],
    limits: {
      maxEntries: 14,
      maxFileBytes: 12_000,
      maxTotalBytes: 48_000,
      maxDirectoryEntries: 30
    }
  });

  assert.match(prompt, /Existing Repository Source Context/);
  assert.match(prompt, /src\/App\.tsx/);
  assert.match(prompt, /export function App/);
});

test("buildPatchSetPrompt asks for strict JSON patch sets", () => {
  const prompt = buildPatchSetPrompt(task, brief);

  assert.match(prompt, /PatchSet schema example/);
  assert.match(prompt, /Return JSON only/);
  assert.match(prompt, /Respect deliveryRisks and uiStateChecklist/);
  assert.match(prompt, /Do not guess through high delivery risks/);
  assert.match(prompt, /Use at most 50 operations/);
  assert.match(prompt, /"type": "delete"/);
  assert.match(prompt, /write", "replace", or "delete"/);
  assert.match(prompt, /T03-code-implementation/);
  assert.match(prompt, /src\/example\.ts/);
});

test("buildPatchSetPrompt can target an implementation unit", () => {
  const prompt = buildPatchSetPrompt(task, brief, unit);

  assert.match(prompt, /Target Implementation Unit/);
  assert.match(prompt, /U18/);
});

test("buildPatchSetPrompt can include sampled repository source context", () => {
  const prompt = buildPatchSetPrompt(task, brief, unit, {
    rootDir: "/workspace/app",
    entries: [
      {
        kind: "directory",
        path: "src/components/",
        entries: ["Dashboard.tsx", "StatusPill.tsx"],
        truncated: false
      }
    ],
    omitted: ["src/**/*.test.tsx (glob not expanded)"],
    limits: {
      maxEntries: 14,
      maxFileBytes: 12_000,
      maxTotalBytes: 48_000,
      maxDirectoryEntries: 30
    }
  });

  assert.match(prompt, /Existing Repository Source Context/);
  assert.match(prompt, /Dashboard\.tsx/);
  assert.match(prompt, /Omitted Candidates/);
});
