import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FlagMap } from "../core/args.js";
import { loadConfig } from "../core/config.js";
import { CliError } from "../core/errors.js";
import { createAiProviderFromEnv, getAiProviderStatus, type AiProviderStatus } from "../core/provider.js";

type SmokeProviderStatus = "failed" | "passed" | "skipped";

interface SmokeProviderReport {
  version: 1;
  generatedAt: string;
  startedAt: string;
  finishedAt: string;
  status: SmokeProviderStatus;
  required: boolean;
  apiKeyEnvName?: AiProviderStatus["apiKeyEnvName"];
  provider: AiProviderStatus;
  responseExcerpt?: string;
  message: string;
}

export async function runSmokeProvider(flags: FlagMap, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const config = await loadConfig();
  const reportPath = flags.out ?? env.DEVFLOW_LIVE_SMOKE_REPORT ?? join(config.artifactsDir, "live-provider-smoke.json");
  const requireLive = flags["require-live"] === "true" || env.DEVFLOW_REQUIRE_LIVE_SMOKE === "true";
  const startedAt = new Date().toISOString();
  const providerEnv = { ...env };
  delete providerEnv.DEVFLOW_AI_FIXTURE_PATH;
  const providerStatus = getAiProviderStatus(providerEnv);

  if (providerStatus.mode !== "live" || !providerStatus.apiKeyEnvName) {
    const message = "AI provider smoke skipped: set DEVFLOW_AI_API_KEY or OPENAI_API_KEY to run against a real provider.";
    const status: SmokeProviderStatus = requireLive ? "failed" : "skipped";
    const report = createReport({
      startedAt,
      status,
      required: requireLive,
      provider: providerStatus,
      message: requireLive ? `${message} --require-live was set.` : message
    });

    await writeReport(reportPath, report);
    printReportResult(reportPath, report, flags);

    if (requireLive) {
      throw new CliError(report.message, 1);
    }

    return;
  }

  const provider = createAiProviderFromEnv(providerEnv);

  if (!provider) {
    const report = createReport({
      startedAt,
      status: "failed",
      required: requireLive,
      provider: providerStatus,
      apiKeyEnvName: providerStatus.apiKeyEnvName,
      message: "AI provider smoke expected a live provider, but no provider could be created."
    });

    await writeReport(reportPath, report);
    printReportResult(reportPath, report, flags);
    throw new CliError(report.message, 1);
  }

  try {
    const response = await provider.complete({
      system: "You are DevFlow's AI provider smoke test. Reply briefly so the CLI can confirm the provider responds.",
      prompt: "Return a short confirmation that the DevFlow provider smoke request reached the model.",
      temperature: 0,
      emptyResponseMessage: "AI provider smoke returned an empty response."
    });
    const report = createReport({
      startedAt,
      status: "passed",
      required: requireLive,
      provider: providerStatus,
      apiKeyEnvName: providerStatus.apiKeyEnvName,
      responseExcerpt: excerpt(response),
      message: `AI provider smoke passed with ${providerStatus.apiKeyEnvName}.`
    });

    await writeReport(reportPath, report);
    printReportResult(reportPath, report, flags);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const report = createReport({
      startedAt,
      status: "failed",
      required: requireLive,
      provider: providerStatus,
      apiKeyEnvName: providerStatus.apiKeyEnvName,
      message
    });

    await writeReport(reportPath, report);
    printReportResult(reportPath, report, flags);
    throw new CliError(message, 1);
  }
}

function createReport(input: {
  startedAt: string;
  status: SmokeProviderStatus;
  required: boolean;
  provider: AiProviderStatus;
  apiKeyEnvName?: AiProviderStatus["apiKeyEnvName"];
  responseExcerpt?: string;
  message: string;
}): SmokeProviderReport {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
    status: input.status,
    required: input.required,
    apiKeyEnvName: input.apiKeyEnvName,
    provider: input.provider,
    responseExcerpt: input.responseExcerpt,
    message: input.message
  };
}

async function writeReport(path: string, report: SmokeProviderReport): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function printReportResult(path: string, report: SmokeProviderReport, flags: FlagMap): void {
  if (flags.json === "true") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(report.message);
  console.log(`AI provider smoke report written to ${path}.`);
}

function excerpt(value: string, limit = 240): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit)}...`;
}
