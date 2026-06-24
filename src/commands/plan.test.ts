import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runPlan } from "./plan.js";

test("runPlan can save the planner prompt for review", async (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-plan-prompt-"));
  const originalCwd = process.cwd();
  const originalLog = console.log;
  const originalEnv = {
    DEVFLOW_AI_API_KEY: process.env.DEVFLOW_AI_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    DEVFLOW_AI_FIXTURE_PATH: process.env.DEVFLOW_AI_FIXTURE_PATH
  };
  const logs: string[] = [];

  t.after(() => {
    console.log = originalLog;
    restoreEnv(originalEnv);
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  });

  console.log = (message?: unknown) => {
    logs.push(String(message));
  };
  process.chdir(workspace);
  mkdirSync(join(workspace, "docs"), { recursive: true });
  writeFileSync(join(workspace, "docs", "requirements.md"), "# Requirements\n\n- Release dashboard is visible.\n", "utf8");
  writeFileSync(join(workspace, "docs", "ui.md"), "# UI Notes\n\n- Dashboard has loading and error states.\n", "utf8");
  writeFileSync(join(workspace, "docs", "api.md"), "# API Docs\n\n- GET /api/release/readiness\n", "utf8");
  delete process.env.DEVFLOW_AI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.DEVFLOW_AI_FIXTURE_PATH;

  await runPlan({
    out: "review/implementation-plan.md",
    "save-prompt": ".devflow/artifacts/prompts/plan.prompt.md"
  });

  const prompt = readFileSync(join(workspace, ".devflow", "artifacts", "prompts", "plan.prompt.md"), "utf8");

  assert.match(readFileSync(join(workspace, "review", "implementation-plan.md"), "utf8"), /Implementation Plan/);
  assert.match(readFileSync(join(workspace, ".devflow", "artifacts", "project-brief.json"), "utf8"), /Release dashboard is visible/);
  assert.match(prompt, /Create a frontend implementation plan/);
  assert.match(prompt, /Structured Project Brief/);
  assert.match(prompt, /Release dashboard is visible/);
  assert.match(prompt, /Dashboard has loading and error states/);
  assert.match(prompt, /GET \/api\/release\/readiness/);
  assert.match(logs.join("\n"), /Planner prompt written to \.devflow\/artifacts\/prompts\/plan\.prompt\.md/);
});

function restoreEnv(env: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}
