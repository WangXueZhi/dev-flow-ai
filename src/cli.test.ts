import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("./cli.js", import.meta.url));
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
};

test("dev-flow version prints the package version", () => {
  const result = spawnSync(process.execPath, [cliPath, "version"], { encoding: "utf8" });

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), `dev-flow ${packageJson.version}`);
});

test("dev-flow --version prints the package version", () => {
  const result = spawnSync(process.execPath, [cliPath, "--version"], { encoding: "utf8" });

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), `dev-flow ${packageJson.version}`);
});

test("dev-flow help lists the status command", () => {
  const result = spawnSync(process.execPath, [cliPath, "help"], { encoding: "utf8" });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /dev-flow status \[--manifest <path>\] \[--json\] \[--fail-on-attention\] \[--fail-on-failed-verification\]/);
  assert.match(result.stdout, /status\s+Print delivery readiness and manifest status/);
});

test("dev-flow doctor prints the package version", () => {
  const result = spawnSync(process.execPath, [cliPath, "doctor"], { encoding: "utf8" });

  assert.equal(result.status, 0);
  assert.match(result.stdout, new RegExp(`OK dev-flow ${packageJson.version.replaceAll(".", "\\.")}`));
  assert.match(result.stdout, /AI source context: enabled/);
});

test("dev-flow doctor --json prints structured diagnostics", () => {
  const result = spawnSync(process.execPath, [cliPath, "doctor", "--json"], { encoding: "utf8" });

  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout) as {
    version: string;
    checks: Array<{ label: string; ok: boolean }>;
    aiProvider: { mode: string };
    sourceContext: { enabled: boolean; source: string };
    promptArtifacts: { path: string; status: string; fileCount: number; truncated: boolean };
  };

  assert.equal(report.version, `dev-flow ${packageJson.version}`);
  assert.ok(report.checks.some((check) => check.label === "Node.js >= 20"));
  assert.ok(report.aiProvider.mode);
  assert.equal(report.sourceContext.enabled, true);
  assert.ok(report.sourceContext.source);
  assert.equal(report.promptArtifacts.path, ".devflow/artifacts/prompts");
  assert.equal(typeof report.promptArtifacts.fileCount, "number");
  assert.equal(report.promptArtifacts.truncated, false);
});

test("dev-flow doctor --json reports saved prompt artifacts", () => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-doctor-"));

  try {
    const promptDir = join(workspace, ".devflow", "artifacts", "prompts", "dry-run");
    mkdirSync(promptDir, { recursive: true });
    writeFileSync(join(promptDir, "T03-code-implementation.prompt.md"), "Dry-run prompt\n", "utf8");

    const result = spawnSync(process.execPath, [cliPath, "doctor", "--json"], {
      cwd: workspace,
      encoding: "utf8"
    });

    assert.equal(result.status, 0);
    const report = JSON.parse(result.stdout) as {
      checks: Array<{ label: string; ok: boolean }>;
      messages: string[];
      promptArtifacts: {
        path: string;
        status: string;
        fileCount: number;
        latestFile?: string;
        latestModifiedAt?: string;
      };
    };

    assert.equal(report.promptArtifacts.path, ".devflow/artifacts/prompts");
    assert.equal(report.promptArtifacts.status, "present");
    assert.equal(report.promptArtifacts.fileCount, 1);
    assert.equal(report.promptArtifacts.latestFile, ".devflow/artifacts/prompts/dry-run/T03-code-implementation.prompt.md");
    assert.ok(report.promptArtifacts.latestModifiedAt);
    assert.ok(report.checks.some((check) => check.label === "Prompt artifacts: 1 file" && check.ok));
    assert.ok(report.messages.some((message) => message.includes("Prompt artifacts available")));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("dev-flow doctor reports disabled source context diagnostics", () => {
  const result = spawnSync(process.execPath, [cliPath, "doctor", "--json"], {
    encoding: "utf8",
    env: {
      ...process.env,
      DEVFLOW_SOURCE_CONTEXT: "none"
    }
  });

  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout) as {
    sourceContext: { enabled: boolean; source: string; value?: string };
    messages: string[];
  };

  assert.equal(report.sourceContext.enabled, false);
  assert.equal(report.sourceContext.source, "env");
  assert.equal(report.sourceContext.value, "none");
  assert.ok(report.messages.some((message) => message.includes("DEVFLOW_SOURCE_CONTEXT=none")));
});
