import type { FlagMap } from "../core/args.js";
import { loadConfig } from "../core/config.js";
import { fileExists } from "../core/fs.js";
import { getAiProviderStatus } from "../core/provider.js";
import { formatChromiumInstallHint, getChromiumRuntimeStatus } from "../core/visual.js";

export async function runDoctor(_flags: FlagMap): Promise<void> {
  const config = await loadConfig();
  const aiStatus = getAiProviderStatus();
  const aiLabel = formatAiStatusLabel(aiStatus);
  const chromiumStatus = await getChromiumRuntimeStatus();
  const checks = [
    ["Node.js >= 20", isNodeAtLeast(20)],
    [".devflow/config.json", await fileExists(".devflow/config.json")],
    [config.requirementsPath, await fileExists(config.requirementsPath)],
    [config.uiPath, await fileExists(config.uiPath)],
    [config.apiPath, await fileExists(config.apiPath)],
    ["Playwright Chromium", chromiumStatus.available],
    [aiLabel, aiStatus.ready]
  ] as const;

  for (const [label, ok] of checks) {
    console.log(`${ok ? "OK" : "--"} ${label}`);
  }

  if (aiStatus.mode === "fallback") {
    console.log("AI provider is not configured; plan will use the local fallback.");
  } else if (aiStatus.mode === "fixture") {
    console.log(`AI provider fixture configured: ${aiStatus.fixturePath}`);
  } else {
    console.log(`AI provider configured via ${aiStatus.apiKeyEnvName}; model ${aiStatus.model}.`);
  }

  if (!chromiumStatus.available) {
    console.log(formatChromiumInstallHint(chromiumStatus));
  }
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
