import assert from "node:assert/strict";
import { test } from "node:test";
import { createProjectBrief } from "./brief.js";
import { buildPlannerPrompt, createImplementationPlan } from "./planner.js";
import type { ProjectContext } from "./context.js";
import type { StackProfile } from "./stack.js";

const context: ProjectContext = {
  requirementsPath: "docs/requirements.md",
  requirements: "# Requirements\n\n- Users can filter orders by status.",
  uiPath: "docs/ui.md",
  ui: "# UI Notes\n\n- Orders table includes loading and empty states.",
  apiPath: "docs/api.md",
  api: "# API Docs\n\n- GET /orders?status=open"
};

const stack: StackProfile = {
  packageManager: "npm",
  runtimes: ["Node.js"],
  frameworks: ["React"],
  buildTools: ["Vite"],
  styling: [],
  testing: [],
  scripts: {},
  sourceDirectories: ["src"],
  configFiles: [],
  notes: []
};

test("buildPlannerPrompt includes all source documents", () => {
  const prompt = buildPlannerPrompt(context);

  assert.match(prompt, /Users can filter orders/);
  assert.match(prompt, /Orders table/);
  assert.match(prompt, /GET \/orders/);
});

test("createImplementationPlan uses fallback when provider is absent", async () => {
  const plan = await createImplementationPlan(context, undefined);

  assert.match(plan, /Implementation Plan/);
  assert.match(plan, /Users can filter orders/);
  assert.match(plan, /Verification Checklist/);
  assert.doesNotMatch(plan, /- Requirements\n- Users can filter orders/);
});

test("createImplementationPlan includes UI state checklist from the brief", async () => {
  const brief = createProjectBrief(context, stack);
  const plan = await createImplementationPlan(context, undefined, brief);

  assert.match(plan, /UI State Checklist/);
  assert.match(plan, /\[state\] Line 3: Orders table includes loading and empty states/);
});
