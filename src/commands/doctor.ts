import type { FlagMap } from "../core/args.js";
import { loadConfig } from "../core/config.js";
import { fileExists } from "../core/fs.js";
import { getAiProviderStatus } from "../core/provider.js";
import { getSourceContextPolicy, type SourceContextPolicy } from "../core/source-context-policy.js";
import { formatCliVersion } from "../core/version.js";
import { formatChromiumInstallHint, getChromiumRuntimeStatus, type ChromiumRuntimeStatus } from "../core/visual.js";

interface DoctorCheck {
  label: string;
  ok: boolean;
}

interface DoctorReport {
  version: string;
  checks: DoctorCheck[];
  aiProvider: ReturnType<typeof getAiProviderStatus>;
  sourceContext: SourceContextPolicy;
  chromium: ChromiumRuntimeStatus;
  messages: string[];
}

export async function runDoctor(flags: FlagMap): Promise<void> {
  const report = await createDoctorReport(flags);

  if (flags.json === "true") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  for (const check of report.checks) {
    console.log(`${check.ok ? "OK" : "--"} ${check.label}`);
  }

  for (const message of report.messages) {
    console.log(message);
  }
}

async function createDoctorReport(flags: FlagMap): Promise<DoctorReport> {
  const config = await loadConfig();
  const aiStatus = getAiProviderStatus();
  const sourceContext = getSourceContextPolicy(flags);
  const aiLabel = formatAiStatusLabel(aiStatus);
  const chromiumStatus = await getChromiumRuntimeStatus();
  const version = await formatCliVersion();
  const checks: DoctorCheck[] = ([
    [version, true],
    ["Node.js >= 20", isNodeAtLeast(20)],
    [".devflow/config.json", await fileExists(".devflow/config.json")],
    [config.requirementsPath, await fileExists(config.requirementsPath)],
    [config.uiPath, await fileExists(config.uiPath)],
    [config.apiPath, await fileExists(config.apiPath)],
    ["Playwright Chromium", chromiumStatus.available],
    [aiLabel, aiStatus.ready],
    [`AI source context: ${sourceContext.enabled ? "enabled" : "disabled"}`, true]
  ] as Array<[string, boolean]>).map(([label, ok]) => ({ label, ok }));

  const messages: string[] = [];
  if (aiStatus.mode === "fallback") {
    messages.push("AI provider is not configured; plan will use the local fallback.");
  } else if (aiStatus.mode === "fixture") {
    messages.push(`AI provider fixture configured: ${aiStatus.fixturePath}`);
  } else {
    messages.push(`AI provider configured via ${aiStatus.apiKeyEnvName}; model ${aiStatus.model}.`);
  }

  if (!chromiumStatus.available) {
    messages.push(formatChromiumInstallHint(chromiumStatus));
  }

  if (sourceContext.enabled) {
    messages.push("AI prompts may include bounded repository source snippets. Set DEVFLOW_SOURCE_CONTEXT=none or pass --no-source-context to omit them.");
  } else if (sourceContext.source === "flag") {
    messages.push("AI source context snippets are disabled by --no-source-context.");
  } else {
    messages.push(`AI source context snippets are disabled by DEVFLOW_SOURCE_CONTEXT=${sourceContext.value}.`);
  }

  return {
    version,
    checks,
    aiProvider: aiStatus,
    sourceContext,
    chromium: chromiumStatus,
    messages
  };
}

function formatAiStatusLabel(status: ReturnType<typeof getAiProviderStatus>): string {
  if (status.mode === "fixture") {
    return "DEVFLOW_AI_FIXTURE_PATH";
  }

  return status.apiKeyEnvName ?? "DEVFLOW_AI_API_KEY or OPENAI_API_KEY";
}

function isNodeAtLeast(major: number): boolean {
  const current = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  return current >= major;
}
