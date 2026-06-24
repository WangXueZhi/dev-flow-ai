#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const cliPath = join(repoRoot, "dist", "cli.js");
const apiKeyName = process.env.DEVFLOW_AI_API_KEY ? "DEVFLOW_AI_API_KEY" : process.env.OPENAI_API_KEY ? "OPENAI_API_KEY" : undefined;
const requireLive = process.env.DEVFLOW_REQUIRE_LIVE_SMOKE === "true";
const startedAt = new Date().toISOString();
const reportPath = process.env.DEVFLOW_LIVE_SMOKE_REPORT ?? join(repoRoot, ".devflow", "artifacts", "live-provider-smoke.json");
const childEnv = { ...process.env };
delete childEnv.DEVFLOW_AI_FIXTURE_PATH;
const providerStatus = await readProviderStatus(childEnv);

if (!apiKeyName) {
  const message = "Live provider smoke skipped: set DEVFLOW_AI_API_KEY or OPENAI_API_KEY to run against a real provider.";

  if (requireLive) {
    console.error(`${message} DEVFLOW_REQUIRE_LIVE_SMOKE=true was set.`);
    await writeSmokeReport({
      status: "failed",
      message: `${message} DEVFLOW_REQUIRE_LIVE_SMOKE=true was set.`
    });
    process.exit(1);
  }

  await writeSmokeReport({ status: "skipped", message });
  console.log(message);
  process.exit(0);
}

if (!existsSync(cliPath)) {
  console.error("Live provider smoke requires dist/cli.js. Run `npm run build` first.");
  await writeSmokeReport({
    status: "failed",
    message: "Live provider smoke requires dist/cli.js. Run `npm run build` first."
  });
  process.exit(1);
}

const workspace = await mkdtemp(join(tmpdir(), "devflow-live-smoke-"));

try {
  await mkdir(join(workspace, "docs"), { recursive: true });
  await writeFile(
    join(workspace, "docs", "requirements.md"),
    [
      "# Requirements",
      "",
      "- As a release manager, I want a deployment readiness panel.",
      "- [ ] Readiness status, blocking incidents, and next deploy window are visible.",
      "- [ ] Failed API calls show a retryable error state."
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    join(workspace, "docs", "ui.md"),
    [
      "# UI Notes",
      "",
      "- Single dashboard card with readiness status, deploy window, and incident count.",
      "- Desktop and tablet layouts should keep labels readable.",
      "- Error state should be visually distinct from the healthy state."
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    join(workspace, "docs", "api.md"),
    [
      "# API Docs",
      "",
      "- GET /api/release/readiness",
      "- Authorization: Bearer token is required.",
      "- 503 responses mean release readiness is unavailable and should show retry copy.",
      "",
      "```json",
      "{\"readiness\":{\"status\":\"blocked\",\"incidentCount\":2,\"nextWindow\":\"2026-06-24T10:00:00Z\"}}",
      "```"
    ].join("\n"),
    "utf8"
  );

  await run(
    process.execPath,
    [
      cliPath,
      "deliver",
      "--requirements",
      "docs/requirements.md",
      "--ui",
      "docs/ui.md",
      "--api",
      "docs/api.md",
      "--command",
      `${process.execPath} -e "console.log('live smoke verify')"`
    ],
    workspace,
    childEnv
  );

  const plan = await readFile(join(workspace, ".devflow", "artifacts", "implementation-plan.md"), "utf8");
  const proposal = await readFile(
    join(workspace, ".devflow", "artifacts", "patch-proposals", "T03-code-implementation.md"),
    "utf8"
  );
  const report = await readFile(join(workspace, ".devflow", "artifacts", "delivery-report.md"), "utf8");

  assertIncludes(plan, "release", "implementation plan");
  assertIncludes(proposal, "release", "dry-run proposal");
  assertIncludes(report, "Delivery Report", "delivery report");

  const artifacts = {
    implementationPlanPath: join(workspace, ".devflow", "artifacts", "implementation-plan.md"),
    patchProposalPath: join(workspace, ".devflow", "artifacts", "patch-proposals", "T03-code-implementation.md"),
    deliveryReportPath: join(workspace, ".devflow", "artifacts", "delivery-report.md")
  };
  const keepWorkspace = process.env.DEVFLOW_KEEP_LIVE_SMOKE_DIR === "true";

  await writeSmokeReport({
    status: "passed",
    message: `Live provider smoke passed with ${apiKeyName}.`,
    workspace: keepWorkspace ? workspace : undefined,
    workspaceRetained: keepWorkspace,
    artifacts: keepWorkspace ? artifacts : undefined
  });

  console.log(`Live provider smoke passed with ${apiKeyName}; artifacts were written in ${workspace}.`);
  console.log(`Live provider smoke report written to ${reportPath}.`);

  if (!keepWorkspace) {
    await rm(workspace, { recursive: true, force: true });
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  console.error(message);
  console.error(`Live provider smoke workspace: ${workspace}`);
  await writeSmokeReport({
    status: "failed",
    message,
    workspace,
    workspaceRetained: true
  });
  process.exit(1);
}

async function readProviderStatus(env) {
  try {
    const providerModule = await import(new URL("../dist/core/provider.js", import.meta.url));
    const status = providerModule.getAiProviderStatus(env);

    return {
      mode: status.mode,
      ready: status.ready,
      apiKeyEnvName: status.apiKeyEnvName,
      liveApiKeyEnvName: status.liveApiKeyEnvName,
      fixtureOverridesLive: status.fixtureOverridesLive,
      baseUrl: status.baseUrl,
      baseUrlSource: status.baseUrlSource,
      chatCompletionsUrl: status.chatCompletionsUrl,
      model: status.model,
      modelSource: status.modelSource
    };
  } catch {
    return {
      mode: apiKeyName ? "live" : "fallback",
      ready: Boolean(apiKeyName),
      apiKeyEnvName,
      liveApiKeyEnvName: apiKeyName,
      fixtureOverridesLive: false,
      baseUrl: env.DEVFLOW_AI_BASE_URL?.trim() || "https://api.openai.com/v1",
      baseUrlSource: env.DEVFLOW_AI_BASE_URL?.trim() ? "env" : "default",
      chatCompletionsUrl: `${(env.DEVFLOW_AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "")}/chat/completions`,
      model: env.DEVFLOW_AI_MODEL?.trim() || "gpt-4.1",
      modelSource: env.DEVFLOW_AI_MODEL?.trim() ? "env" : "default"
    };
  }
}

async function writeSmokeReport(input) {
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    startedAt,
    finishedAt: new Date().toISOString(),
    status: input.status,
    required: requireLive,
    apiKeyEnvName: apiKeyName,
    provider: providerStatus,
    workspace: input.workspace,
    workspaceRetained: input.workspaceRetained,
    artifacts: input.artifacts,
    message: input.message
  };

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function run(command, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with ${exitCode}`));
    });
  });
}

function assertIncludes(value, expected, label) {
  if (!value.toLowerCase().includes(expected.toLowerCase())) {
    throw new Error(`Live provider smoke expected ${label} to include "${expected}".`);
  }
}
