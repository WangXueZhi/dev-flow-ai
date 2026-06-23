import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProjectBrief } from "./brief.js";
import { createTaskPlan, formatTaskPlanMarkdown } from "./tasks.js";

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
    requirements: [
      "As an operator, I want to filter orders by status so that I can focus the queue.",
      "Use existing table components.",
      "As a user, I want to filter orders."
    ],
    ui: ["Orders table has empty and loading states."],
    api: ["GET /orders"]
  },
  designAssets: [
    {
      source: "ui-markdown-image",
      kind: "local",
      altText: "Orders table wireframe",
      reference: "assets/orders.svg",
      resolvedPath: "docs/assets/orders.svg",
      exists: true,
      metadata: {
        width: "960",
        height: "640",
        viewBox: "0 0 960 640",
        title: "Orders table wireframe",
        description: "Wireframe with filters and table rows.",
        textSnippets: ["Orders", "Status filter", "Empty state"]
      }
    }
  ],
  apiContracts: [
    {
      method: "GET",
      path: "/orders",
      sourceLine: 4,
      summary: "GET /orders"
    }
  ],
  apiDataModels: [
    {
      name: "order",
      sourceLine: 8,
      fields: ["id", "status"],
      summary: "order object"
    }
  ],
  apiErrorCases: [
    {
      sourceLine: 14,
      summary: "Orders endpoint unavailable: show stale results and retry."
    }
  ],
  apiAuthRequirements: [
    {
      sourceLine: 18,
      summary: "Authorization: Bearer token is required."
    }
  ],
  invalidApiDataModels: [],
  userStories: ["As an operator, I want to filter orders by status so that I can focus the queue."],
  constraints: ["Use existing table components."],
  acceptanceCriteria: ["Orders can be filtered by status."],
  openQuestions: ["Confirm default filter."],
  recommendedVerification: ["npm run check"]
};

test("createTaskPlan generates executable delivery phases", () => {
  const taskPlan = createTaskPlan(brief, "# Implementation Plan", {
    projectBriefPath: ".devflow/artifacts/project-brief.json",
    implementationPlanPath: ".devflow/artifacts/implementation-plan.md"
  });

  assert.equal(taskPlan.version, 1);
  assert.ok(taskPlan.implementationUnits.length >= 5);
  assert.ok(taskPlan.implementationUnits.some((unit) => unit.kind === "api-endpoint" && unit.title === "GET /orders"));
  assert.ok(taskPlan.implementationUnits.some((unit) => unit.kind === "api-model" && unit.title === "order"));
  assert.ok(taskPlan.implementationUnits.some((unit) => unit.kind === "api-error" && unit.title.includes("unavailable")));
  assert.ok(taskPlan.implementationUnits.some((unit) => unit.kind === "api-auth" && unit.title.includes("Bearer")));
  assert.ok(taskPlan.implementationUnits.some((unit) => unit.kind === "design-asset"));
  assert.ok(taskPlan.implementationUnits.some((unit) => unit.kind === "requirement" && unit.title.includes("filter orders")));
  assert.ok(taskPlan.implementationUnits.some((unit) => unit.kind === "constraint" && unit.title.includes("existing table")));
  assert.equal(taskPlan.implementationUnits.filter((unit) => unit.title === "Use existing table components.").length, 1);
  assert.equal(
    taskPlan.implementationUnits.filter((unit) => unit.title === "As an operator, I want to filter orders by status so that I can focus the queue.").length,
    1
  );
  assert.equal(taskPlan.tasks.length, 5);
  assert.equal(taskPlan.tasks[2]?.id, "T03-code-implementation");
  assert.deepEqual(taskPlan.tasks[2]?.verification, ["npm run check"]);
  assert.equal(taskPlan.tasks[4]?.phase, "Delivery");

  const markdown = formatTaskPlanMarkdown(taskPlan);
  assert.match(markdown, /Implementation Units/);
  assert.match(markdown, /GET \/orders/);
  assert.match(markdown, /Fields: id, status/);
  assert.match(markdown, /Orders endpoint unavailable/);
  assert.match(markdown, /Authorization: Bearer token/);
  assert.match(markdown, /Dimensions: 960x640/);
  assert.match(markdown, /ViewBox: 0 0 960 640/);
  assert.match(markdown, /Text snippets: Orders; Status filter; Empty state/);
  assert.match(markdown, /Use existing table components/);
  assert.match(markdown, /T03-code-implementation/);
  assert.match(markdown, /Orders can be filtered by status/);
});
