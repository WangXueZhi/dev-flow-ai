import type { Dirent } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import type { FlagMap } from "../core/args.js";
import type { ProjectBrief } from "../core/brief.js";
import { loadConfig } from "../core/config.js";
import type { ExecutionLog } from "../core/execution-log.js";
import { fileExists } from "../core/fs.js";
import {
  createDeliveryManifest,
  formatDeliveryReport,
  type DeliveryArtifactEntry,
  type DeliveryArtifactKind,
  type DeliveryArtifactStatus
} from "../core/report.js";
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
  const taskChangelogPath = join(config.artifactsDir, "task-changelog.md");
  const rollbackReportPath = join(config.artifactsDir, "rollback-report.json");
  const verificationReportPath = join(config.artifactsDir, "verification-report.json");
  const defaultVisualReportPath = join(config.artifactsDir, "visual", "visual-report.json");
  const visualReportPath = flags["visual-report"] && flags["visual-report"] !== "none"
    ? flags["visual-report"]
    : defaultVisualReportPath;
  const outPath = flags.out ?? join(config.artifactsDir, "delivery-report.md");
  const manifestPath = flags["manifest-out"] ?? join(config.artifactsDir, "delivery-manifest.json");
  const brief = await readJsonIfExists<ProjectBrief>(projectBriefPath);
  const executionLog = await readJsonIfExists<ExecutionLog>(executionLogPath);
  const verification = await readJsonIfExists<VerificationReport>(verificationReportPath);
  const visualReportEnabled = flags["visual-report"] !== "none";
  const visualReport = flags["visual-report"] === "none"
    ? undefined
    : await readJsonIfExists<VisualReport>(visualReportPath);
  const input = {
    brief,
    deliveryManifestPath: manifestPath,
    implementationPlanPath,
    projectBriefPath,
    taskPlanPath,
    taskPlanMarkdownPath,
    patchProposalsDir,
    executionLogPath,
    taskChangelogPath,
    executionLog,
    rollbackReportPath,
    verificationReportPath,
    verification,
    visualReportPath,
    visualReport
  };
  const report = formatDeliveryReport(input);

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, report, "utf8");

  const manifest = createDeliveryManifest({
    ...input,
    artifactsDir: config.artifactsDir,
    deliveryReportPath: outPath,
    deliveryManifestPath: manifestPath,
    generatedAt: new Date().toISOString(),
    artifacts: await collectDeliveryArtifacts({
      artifactsDir: config.artifactsDir,
      projectBriefPath,
      implementationPlanPath,
      taskPlanPath,
      taskPlanMarkdownPath,
      patchProposalsDir,
      executionLogPath,
      executionLog,
      taskChangelogPath,
      rollbackReportPath,
      verificationReportPath,
      visualReportPath,
      visualReport,
      visualReportEnabled,
      deliveryReportPath: outPath,
      deliveryManifestPath: manifestPath
    })
  });

  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`Delivery report written to ${outPath}`);
  console.log(`Delivery manifest written to ${manifestPath}`);
}

async function readJsonIfExists<T>(path: string): Promise<T | undefined> {
  if (!(await fileExists(path))) {
    return undefined;
  }

  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function collectDeliveryArtifacts(input: {
  artifactsDir: string;
  projectBriefPath: string;
  implementationPlanPath: string;
  taskPlanPath: string;
  taskPlanMarkdownPath: string;
  patchProposalsDir: string;
  executionLogPath: string;
  executionLog: ExecutionLog | undefined;
  taskChangelogPath: string;
  rollbackReportPath: string;
  verificationReportPath: string;
  visualReportPath: string;
  visualReport: VisualReport | undefined;
  visualReportEnabled: boolean;
  deliveryReportPath: string;
  deliveryManifestPath: string;
}): Promise<DeliveryArtifactEntry[]> {
  const patchSetDir = join(input.artifactsDir, "patch-sets");
  const backupsDir = join(input.artifactsDir, "backups");
  const patchProposalFiles = await listFiles(input.patchProposalsDir, (name) => name.endsWith(".md"));
  const patchSetFiles = await listFiles(patchSetDir, (name) => name.endsWith(".json"));
  const backupManifestFiles = unique([
    ...await listFilesRecursive(backupsDir, (path) => path.endsWith(`${sep}manifest.json`)),
    ...(input.executionLog?.entries.flatMap((entry) => entry.backupManifestPath ? [entry.backupManifestPath] : []) ?? [])
  ]);
  const entries: DeliveryArtifactEntry[] = [
    await artifact("project-brief", "Project brief", "json", input.projectBriefPath, true, "Structured context extracted from requirements, UI notes, API docs, and repository signals."),
    await artifact("implementation-plan", "Implementation plan", "markdown", input.implementationPlanPath, true, "Human-readable implementation plan."),
    await artifact("task-plan-json", "Task plan JSON", "json", input.taskPlanPath, true, "Machine-readable implementation task plan."),
    await artifact("task-plan-markdown", "Task plan Markdown", "markdown", input.taskPlanMarkdownPath, true, "Human-readable implementation task plan."),
    await artifact("patch-proposals", "Patch proposals", "directory", input.patchProposalsDir, true, "Dry-run implementation proposals for review.", patchProposalFiles.length),
    await artifact("execution-log", "Execution log", "json", input.executionLogPath, false, "Source-changing patch-set application history.", undefined, Boolean(input.executionLog)),
    await artifact("task-changelog", "Task changelog", "markdown", input.taskChangelogPath, false, "Human-readable source-changing task change history.", undefined, await fileExists(input.taskChangelogPath)),
    await artifact("rollback-report", "Rollback report", "json", input.rollbackReportPath, false, "Manual or automatic rollback result.", undefined, await fileExists(input.rollbackReportPath)),
    await artifact("verification-report", "Verification report", "json", input.verificationReportPath, true, "Verification command results."),
    input.visualReportEnabled
      ? await artifact("visual-report", "Visual report", "json", input.visualReportPath, false, "Preview screenshot, text, blank-screen, and layout checks.", undefined, true)
      : fixedArtifact("visual-report", "Visual report", "json", input.visualReportPath, "not-applicable", false, "Preview screenshot, text, blank-screen, and layout checks."),
    await artifact("patch-sets", "Patch sets", "directory", patchSetDir, false, "Generated or reviewed patch-set JSON files.", patchSetFiles.length, patchSetFiles.length > 0),
    await artifact("backups", "Backups", "directory", backupsDir, false, "Backup manifests created before source-changing apply.", backupManifestFiles.length, backupManifestFiles.length > 0),
    fixedArtifact("delivery-report", "Delivery report", "markdown", input.deliveryReportPath, "present", true, "Human-readable delivery report."),
    fixedArtifact("delivery-manifest", "Delivery manifest", "json", input.deliveryManifestPath, "present", true, "Machine-readable delivery artifact index and evidence summary.")
  ];

  entries.push(...await Promise.all(input.visualReport?.screenshots.map((screenshot) =>
    artifact(
      `visual-screenshot-${screenshot.viewport.name}`,
      `${screenshot.viewport.name} screenshot`,
      "image",
      screenshot.path,
      false,
      "Visual verification screenshot.",
      undefined,
      true
    )
  ) ?? []));

  entries.push(...await Promise.all(backupManifestFiles.map((path, index) =>
    artifact(
      `backup-manifest-${index + 1}`,
      `Backup manifest ${index + 1}`,
      "json",
      path,
      false,
      "Backup manifest referenced by source-changing execution.",
      undefined,
      true
    )
  )));

  return entries;
}

async function artifact(
  id: string,
  label: string,
  kind: DeliveryArtifactKind,
  path: string,
  required: boolean,
  role: string,
  count?: number,
  expected = required
): Promise<DeliveryArtifactEntry> {
  return fixedArtifact(id, label, kind, path, await artifactStatus(path, expected), required, role, count);
}

function fixedArtifact(
  id: string,
  label: string,
  kind: DeliveryArtifactKind,
  path: string,
  status: DeliveryArtifactStatus,
  required: boolean,
  role: string,
  count?: number
): DeliveryArtifactEntry {
  return {
    id,
    label,
    kind,
    path,
    status,
    required,
    role,
    count
  };
}

async function artifactStatus(path: string, expected: boolean): Promise<DeliveryArtifactStatus> {
  if (await fileExists(path)) {
    return "present";
  }

  return expected ? "missing" : "not-applicable";
}

async function listFiles(dir: string, predicate: (name: string) => boolean): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile() && predicate(entry.name))
      .map((entry) => join(dir, entry.name));
  } catch {
    return [];
  }
}

async function listFilesRecursive(dir: string, predicate: (path: string) => boolean, limit = 100): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    if (results.length >= limit) {
      return;
    }

    let entries: Dirent[];

    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= limit) {
        return;
      }

      const entryPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile() && predicate(entryPath)) {
        results.push(entryPath);
      }
    }
  }

  await walk(dir);
  return results;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
