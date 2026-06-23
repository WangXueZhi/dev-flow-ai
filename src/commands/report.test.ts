import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runReport } from "./report.js";

test("runReport can suppress stale visual reports", async (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-report-"));
  const originalCwd = process.cwd();
  const originalLog = console.log;

  t.after(() => {
    console.log = originalLog;
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  });

  console.log = () => undefined;
  process.chdir(workspace);
  mkdirSync(".devflow/artifacts/visual", { recursive: true });
  writeFileSync(
    ".devflow/artifacts/visual/visual-report.json",
    `${JSON.stringify(
      {
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: "2026-01-01T00:00:01.000Z",
        url: "http://127.0.0.1:5173",
        status: "passed",
        screenshots: [
          {
            viewport: { name: "desktop", width: 1440, height: 1000 },
            path: ".devflow/artifacts/visual/desktop.png",
            title: "Stale Preview",
            bodyCharacters: 100,
            analysis: {
              width: 1440,
              height: 1000,
              sampledPixels: 720000,
              distinctPixels: 100000,
              distinctPixelRatio: 0.1389,
              blank: false
            }
          }
        ],
        layoutIssues: [],
        requiredText: [{ text: "Stale Preview", found: true }]
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  await runReport({ "visual-report": "none" });

  const report = readFileSync(".devflow/artifacts/delivery-report.md", "utf8");
  assert.match(report, /Visual verification has not been run yet/);
  assert.doesNotMatch(report, /Stale Preview/);

  const manifest = JSON.parse(readFileSync(".devflow/artifacts/delivery-manifest.json", "utf8")) as {
    status: { visual: string };
    artifacts: Array<{ id: string; status: string }>;
  };
  assert.equal(manifest.status.visual, "not-run");
  assert.equal(manifest.artifacts.find((artifact) => artifact.id === "visual-report")?.status, "not-applicable");
  assert.doesNotMatch(JSON.stringify(manifest), /Stale Preview/);
});
