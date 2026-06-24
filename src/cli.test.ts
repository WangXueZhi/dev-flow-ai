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
  assert.match(result.stdout, /dev-flow smoke-provider \[--out <path>\] \[--require-live\] \[--json\]/);
  assert.match(result.stdout, /status\s+Print delivery readiness and manifest status/);
  assert.match(result.stdout, /smoke-provider\s+Send a minimal live AI provider request and write a smoke report/);
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
    aiProvider: {
      mode: string;
      chatCompletionsUrl: string;
      model: string;
      baseUrlSource: string;
      modelSource: string;
      fixtureOverridesLive: boolean;
    };
    sourceContext: { enabled: boolean; source: string };
    promptArtifacts: { path: string; status: string; fileCount: number; truncated: boolean };
  };

  assert.equal(report.version, `dev-flow ${packageJson.version}`);
  assert.ok(report.checks.some((check) => check.label === "Node.js >= 20"));
  assert.ok(report.aiProvider.mode);
  assert.equal(report.aiProvider.chatCompletionsUrl, "https://api.openai.com/v1/chat/completions");
  assert.equal(report.aiProvider.model, "gpt-4.1");
  assert.equal(report.aiProvider.baseUrlSource, "default");
  assert.equal(report.aiProvider.modelSource, "default");
  assert.equal(report.aiProvider.fixtureOverridesLive, false);
  assert.equal(report.sourceContext.enabled, true);
  assert.ok(report.sourceContext.source);
  assert.equal(report.promptArtifacts.path, ".devflow/artifacts/prompts");
  assert.equal(typeof report.promptArtifacts.fileCount, "number");
  assert.equal(report.promptArtifacts.truncated, false);
});

test("dev-flow doctor --json surfaces live provider endpoint diagnostics", () => {
  const result = spawnSync(process.execPath, [cliPath, "doctor", "--json"], {
    encoding: "utf8",
    env: {
      ...process.env,
      DEVFLOW_AI_API_KEY: "test-key",
      OPENAI_API_KEY: "ignored-key",
      DEVFLOW_AI_BASE_URL: "https://gateway.example/v1/",
      DEVFLOW_AI_MODEL: "example-model"
    }
  });

  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout) as {
    aiProvider: {
      mode: string;
      apiKeyEnvName?: string;
      liveApiKeyEnvName?: string;
      baseUrl: string;
      baseUrlSource: string;
      chatCompletionsUrl: string;
      model: string;
      modelSource: string;
    };
    messages: string[];
  };

  assert.equal(report.aiProvider.mode, "live");
  assert.equal(report.aiProvider.apiKeyEnvName, "DEVFLOW_AI_API_KEY");
  assert.equal(report.aiProvider.liveApiKeyEnvName, "DEVFLOW_AI_API_KEY");
  assert.equal(report.aiProvider.baseUrl, "https://gateway.example/v1/");
  assert.equal(report.aiProvider.baseUrlSource, "env");
  assert.equal(report.aiProvider.chatCompletionsUrl, "https://gateway.example/v1/chat/completions");
  assert.equal(report.aiProvider.model, "example-model");
  assert.equal(report.aiProvider.modelSource, "env");
  assert.ok(report.messages.some((message) => message.includes("endpoint https://gateway.example/v1/chat/completions")));
});

test("dev-flow doctor --json reports fixture override diagnostics", () => {
  const result = spawnSync(process.execPath, [cliPath, "doctor", "--json"], {
    encoding: "utf8",
    env: {
      ...process.env,
      DEVFLOW_AI_FIXTURE_PATH: "fixtures/patch-set.json",
      DEVFLOW_AI_API_KEY: "test-key"
    }
  });

  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout) as {
    aiProvider: {
      mode: string;
      liveApiKeyEnvName?: string;
      fixtureOverridesLive: boolean;
    };
    messages: string[];
  };

  assert.equal(report.aiProvider.mode, "fixture");
  assert.equal(report.aiProvider.liveApiKeyEnvName, "DEVFLOW_AI_API_KEY");
  assert.equal(report.aiProvider.fixtureOverridesLive, true);
  assert.ok(report.messages.some((message) => message.includes("Fixture responses override DEVFLOW_AI_API_KEY")));
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
