import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runVerify } from "./verify.js";

test("runVerify updates an existing task changelog with verification summary", async (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-verify-changelog-"));
  const originalCwd = process.cwd();
  const originalLog = console.log;
  const logs: string[] = [];

  t.after(() => {
    console.log = originalLog;
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  });

  console.log = (message?: unknown) => {
    logs.push(String(message));
  };
  process.chdir(workspace);
  writeBrief(["node -e \"console.log('verify ok')\""]);
  writeFileSync(
    ".devflow/artifacts/task-changelog.md",
    "# Task Changelog\n\n## Entries\n\n- Existing task handoff\n",
    "utf8"
  );

  await runVerify({});
  await runVerify({});

  const report = JSON.parse(readFileSync(".devflow/artifacts/verification-report.json", "utf8")) as {
    status: string;
    results: Array<{ command: string; exitCode: number }>;
  };
  const changelog = readFileSync(".devflow/artifacts/task-changelog.md", "utf8");

  assert.equal(report.status, "passed");
  assert.equal(report.results[0]?.exitCode, 0);
  assert.match(changelog, /## Verification Summary/);
  assert.match(changelog, /- Status: passed/);
  assert.match(changelog, /- Report: `\.devflow\/artifacts\/verification-report\.json`/);
  assert.match(changelog, /- Commands passed: 1\/1/);
  assert.match(changelog, /`node -e "console\.log\('verify ok'\)"`: exit 0/);
  assert.equal([...changelog.matchAll(/devflow-verification-summary:start/g)].length, 1);
  assert.match(logs.join("\n"), /Task changelog verification summary updated/);
});

test("runVerify does not create a task changelog when none exists", async (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-verify-no-changelog-"));
  const originalCwd = process.cwd();
  const originalLog = console.log;
  const logs: string[] = [];

  t.after(() => {
    console.log = originalLog;
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  });

  console.log = (message?: unknown) => {
    logs.push(String(message));
  };
  process.chdir(workspace);
  writeBrief(["node -e \"console.log('verify ok')\""]);

  await runVerify({});

  assert.equal(existsSync(".devflow/artifacts/verification-report.json"), true);
  assert.equal(existsSync(".devflow/artifacts/task-changelog.md"), false);
  assert.doesNotMatch(logs.join("\n"), /Task changelog verification summary updated/);
});

test("runVerify records failed verification in the task changelog summary", async (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-verify-failed-changelog-"));
  const originalCwd = process.cwd();
  const originalLog = console.log;
  const originalExitCode = process.exitCode;

  t.after(() => {
    console.log = originalLog;
    process.exitCode = originalExitCode;
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  });

  console.log = () => undefined;
  process.chdir(workspace);
  writeBrief(["node -e \"process.exit(2)\""]);
  writeFileSync(".devflow/artifacts/task-changelog.md", "# Task Changelog\n", "utf8");

  await runVerify({});

  const report = JSON.parse(readFileSync(".devflow/artifacts/verification-report.json", "utf8")) as {
    status: string;
    results: Array<{ exitCode: number }>;
  };
  const changelog = readFileSync(".devflow/artifacts/task-changelog.md", "utf8");

  assert.equal(process.exitCode, 1);
  assert.equal(report.status, "failed");
  assert.equal(report.results[0]?.exitCode, 2);
  assert.match(changelog, /- Status: failed/);
  assert.match(changelog, /- Commands passed: 0\/1/);
  assert.match(changelog, /`node -e "process\.exit\(2\)"`: exit 2/);
});

function writeBrief(recommendedVerification: string[]): void {
  mkdirSync(".devflow/artifacts", { recursive: true });
  writeFileSync(
    ".devflow/artifacts/project-brief.json",
    `${JSON.stringify({ recommendedVerification }, null, 2)}\n`,
    "utf8"
  );
}
