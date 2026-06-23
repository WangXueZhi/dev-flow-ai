import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FlagMap } from "../core/args.js";
import type { ProjectBrief } from "../core/brief.js";
import { loadConfig } from "../core/config.js";
import type { ExecutionLog } from "../core/execution-log.js";
import { fileExists } from "../core/fs.js";
import { formatDeliveryReport } from "../core/report.js";
import type { VerificationReport } from "../core/verification.js";
import type { VisualReport } from "../core/visual.js";

export async function runReport(flags: FlagMap): Promise<void> {
  const config = await loadConfig();
  const projectBriefPath = join(config.artifactsDir, "project-brief.json");
  const implementationPlanPath = join(config.artifactsDir, "implementation-plan.md");
  const taskPlanPath = join(config.artifactsDir, "tasks.json");
  const taskPlanMarkdownPath = join(config.artifactsDir, "tasks.md");
  const patchProposalsDir = join(config.artifactsDir, "patch-proposals");
  const executionLogPath = join(config.artifactsDir, "execution-log.json");
  const rollbackReportPath = join(config.artifactsDir, "rollback-report.json");
  const verificationReportPath = join(config.artifactsDir, "verification-report.json");
  const defaultVisualReportPath = join(config.artifactsDir, "visual", "visual-report.json");
  const visualReportPath = flags["visual-report"] && flags["visual-report"] !== "none"
    ? flags["visual-report"]
    : defaultVisualReportPath;
  const outPath = flags.out ?? join(config.artifactsDir, "delivery-report.md");
  const brief = await readJsonIfExists<ProjectBrief>(projectBriefPath);
  const executionLog = await readJsonIfExists<ExecutionLog>(executionLogPath);
  const verification = await readJsonIfExists<VerificationReport>(verificationReportPath);
  const visualReport = flags["visual-report"] === "none"
    ? undefined
    : await readJsonIfExists<VisualReport>(visualReportPath);
  const report = formatDeliveryReport({
    brief,
    implementationPlanPath,
    projectBriefPath,
    taskPlanPath,
    taskPlanMarkdownPath,
    patchProposalsDir,
    executionLogPath,
    executionLog,
    rollbackReportPath,
    verificationReportPath,
    verification,
    visualReportPath,
    visualReport
  });

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, report, "utf8");

  console.log(`Delivery report written to ${outPath}`);
}

async function readJsonIfExists<T>(path: string): Promise<T | undefined> {
  if (!(await fileExists(path))) {
    return undefined;
  }

  return JSON.parse(await readFile(path, "utf8")) as T;
}
