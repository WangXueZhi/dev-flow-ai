import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FlagMap } from "../core/args.js";
import { createProjectBrief, type ProjectBrief } from "../core/brief.js";
import { loadConfig } from "../core/config.js";
import { loadProjectContext } from "../core/context.js";
import { fileExists } from "../core/fs.js";
import { detectStack } from "../core/stack.js";
import { runVerificationCommands, type VerificationReport } from "../core/verification.js";

const verificationSummaryStart = "<!-- devflow-verification-summary:start -->";
const verificationSummaryEnd = "<!-- devflow-verification-summary:end -->";

export async function runVerify(flags: FlagMap): Promise<void> {
  const config = await loadConfig();
  const briefPath = join(config.artifactsDir, "project-brief.json");
  const reportPath = flags.out ?? join(config.artifactsDir, "verification-report.json");
  const taskChangelogPath = join(config.artifactsDir, "task-changelog.md");
  const brief = await loadOrCreateBrief(config, briefPath);
  const commands = selectVerificationCommands(flags.command, brief.recommendedVerification);
  const report = await runVerificationCommands(commands);

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await updateTaskChangelogVerificationSummary(taskChangelogPath, report, reportPath);

  console.log(`Verification report written to ${reportPath}`);
  console.log(`Verification status: ${report.status}`);

  if (report.status === "failed") {
    process.exitCode = 1;
  }
}

async function loadOrCreateBrief(config: Awaited<ReturnType<typeof loadConfig>>, briefPath: string): Promise<ProjectBrief> {
  if (await fileExists(briefPath)) {
    return JSON.parse(await readFile(briefPath, "utf8")) as ProjectBrief;
  }

  const context = await loadProjectContext({
    requirementsPath: config.requirementsPath,
    uiPath: config.uiPath,
    apiPath: config.apiPath
  });
  const brief = createProjectBrief(context, await detectStack());

  await mkdir(dirname(briefPath), { recursive: true });
  await writeFile(briefPath, `${JSON.stringify(brief, null, 2)}\n`, "utf8");

  return brief;
}

function selectVerificationCommands(flagCommand: string | undefined, recommended: string[]): string[] {
  if (flagCommand) {
    return [flagCommand];
  }

  return recommended.filter((command) => !command.startsWith("Add or document"));
}

async function updateTaskChangelogVerificationSummary(
  taskChangelogPath: string,
  report: VerificationReport,
  reportPath: string
): Promise<void> {
  if (!(await fileExists(taskChangelogPath))) {
    return;
  }

  const current = await readFile(taskChangelogPath, "utf8");
  const next = upsertVerificationSummary(current, report, reportPath);

  await writeFile(taskChangelogPath, next, "utf8");
  console.log(`Task changelog verification summary updated in ${taskChangelogPath}`);
}

function upsertVerificationSummary(current: string, report: VerificationReport, reportPath: string): string {
  const block = formatVerificationSummaryBlock(report, reportPath);
  const existingBlock = new RegExp(
    `${escapeRegExp(verificationSummaryStart)}[\\s\\S]*?${escapeRegExp(verificationSummaryEnd)}\\n?`,
    "m"
  );

  if (existingBlock.test(current)) {
    return current.replace(existingBlock, `${block}\n`);
  }

  const trimmed = current.trimEnd();

  return trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}

function formatVerificationSummaryBlock(report: VerificationReport, reportPath: string): string {
  const total = report.results.length;
  const passed = report.results.filter((result) => result.exitCode === 0).length;
  const commandLines = total
    ? report.results.map(
      (result) =>
        `  - ${formatInlineCode(result.command)}: exit ${result.exitCode ?? "unknown"}, ${result.durationMs}ms`
    )
    : ["  - none"];

  return [
    verificationSummaryStart,
    "## Verification Summary",
    "",
    `- Status: ${report.status}`,
    `- Report: ${formatInlineCode(reportPath)}`,
    `- Finished at: ${report.finishedAt}`,
    `- Commands passed: ${passed}/${total}`,
    "- Commands:",
    ...commandLines,
    verificationSummaryEnd
  ].join("\n");
}

function formatInlineCode(value: string): string {
  const longestFence = Math.max(0, ...Array.from(value.matchAll(/`+/g), (match) => match[0].length));
  const fence = "`".repeat(longestFence + 1);

  return `${fence}${value}${fence}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
