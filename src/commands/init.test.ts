import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runInit } from "./init.js";

test("runInit creates structured starter documents", async (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-init-"));
  const originalCwd = process.cwd();
  const originalLog = console.log;

  t.after(() => {
    console.log = originalLog;
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  });

  console.log = () => undefined;
  process.chdir(workspace);

  await runInit({});

  const requirements = readFileSync("docs/requirements.md", "utf8");
  const ui = readFileSync("docs/ui.md", "utf8");
  const api = readFileSync("docs/api.md", "utf8");
  const config = readFileSync(".devflow/config.json", "utf8");

  assert.match(config, /artifactsDir/);
  assert.match(requirements, /## Users And Roles/);
  assert.match(requirements, /## Acceptance Criteria/);
  assert.match(requirements, /Loading, empty, error, and success states/);
  assert.match(ui, /## Design Assets/);
  assert.match(ui, /!\[Primary screen wireframe\]\(assets\/primary-screen\.png\)/);
  assert.match(ui, /## Responsive Behavior/);
  assert.match(api, /## Authentication/);
  assert.match(api, /GET \/api\/example/);
  assert.match(api, /```json/);
  assert.match(api, /## OpenAPI JSON Or YAML/);
  assert.match(api, /```yaml/);
});
