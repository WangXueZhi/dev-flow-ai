import type { Dirent, Stats } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
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

type PromptArtifactStatus = "empty" | "invalid" | "missing" | "present";

interface PromptArtifactsDiagnostics {
  path: string;
  status: PromptArtifactStatus;
  fileCount: number;
  latestFile?: string;
  latestModifiedAt?: string;
  truncated: boolean;
}

interface DoctorReport {
  version: string;
  checks: DoctorCheck[];
  aiProvider: ReturnType<typeof getAiProviderStatus>;
  sourceContext: SourceContextPolicy;
  promptArtifacts: PromptArtifactsDiagnostics;
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
  const promptArtifacts = await collectPromptArtifactsDiagnostics(join(config.artifactsDir, "prompts"));
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
    [formatPromptArtifactsCheck(promptArtifacts), promptArtifacts.status === "present"],
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

  messages.push(formatPromptArtifactsMessage(promptArtifacts));

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
    promptArtifacts,
    chromium: chromiumStatus,
    messages
  };
}

async function collectPromptArtifactsDiagnostics(path: string, limit = 1000): Promise<PromptArtifactsDiagnostics> {
  let root: Stats;
  try {
    root = await stat(path);
  } catch {
    return {
      path,
      status: "missing",
      fileCount: 0,
      truncated: false
    };
  }

  if (!root.isDirectory()) {
    return {
      path,
      status: "invalid",
      fileCount: 0,
      truncated: false
    };
  }

  let fileCount = 0;
  let latestFile: string | undefined;
  let latestMtimeMs = 0;
  let truncated = false;

  async function walk(currentDir: string): Promise<void> {
    if (fileCount >= limit) {
      truncated = true;
      return;
    }

    let entries: Dirent[];
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (fileCount >= limit) {
        truncated = true;
        return;
      }

      const entryPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      fileCount += 1;

      try {
        const entryStats = await stat(entryPath);
        if (entryStats.mtimeMs >= latestMtimeMs) {
          latestMtimeMs = entryStats.mtimeMs;
          latestFile = entryPath;
        }
      } catch {
        // Ignore files that disappear during the scan; doctor should stay read-only and best-effort.
      }
    }
  }

  await walk(path);

  return {
    path,
    status: fileCount > 0 ? "present" : "empty",
    fileCount,
    latestFile,
    latestModifiedAt: latestMtimeMs > 0 ? new Date(latestMtimeMs).toISOString() : undefined,
    truncated
  };
}

function formatPromptArtifactsCheck(promptArtifacts: PromptArtifactsDiagnostics): string {
  if (promptArtifacts.status === "present") {
    return `Prompt artifacts: ${promptArtifacts.fileCount} file${promptArtifacts.fileCount === 1 ? "" : "s"}`;
  }

  if (promptArtifacts.status === "empty") {
    return "Prompt artifacts: empty directory";
  }

  if (promptArtifacts.status === "invalid") {
    return "Prompt artifacts: path is not a directory";
  }

  return "Prompt artifacts: not saved";
}

function formatPromptArtifactsMessage(promptArtifacts: PromptArtifactsDiagnostics): string {
  if (promptArtifacts.status === "present") {
    const latest = promptArtifacts.latestFile ? ` Latest: ${promptArtifacts.latestFile}.` : "";
    const truncated = promptArtifacts.truncated ? " File count was truncated during scan." : "";

    return `Prompt artifacts available in ${promptArtifacts.path} (${promptArtifacts.fileCount} file${promptArtifacts.fileCount === 1 ? "" : "s"}).${latest}${truncated}`;
  }

  if (promptArtifacts.status === "empty") {
    return `Prompt artifact directory is empty: ${promptArtifacts.path}. Use --save-prompt or deliver --save-prompts to create reviewable AI prompts.`;
  }

  if (promptArtifacts.status === "invalid") {
    return `Prompt artifact path is not a directory: ${promptArtifacts.path}.`;
  }

  return `Prompt artifacts are not saved yet. Use --save-prompt or deliver --save-prompts to write them under ${promptArtifacts.path}.`;
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
