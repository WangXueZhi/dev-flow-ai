import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FlagMap } from "../core/args.js";
import type { ProjectBrief } from "../core/brief.js";
import { loadConfig } from "../core/config.js";
import { appendExecutionLog, formatTaskChangelog } from "../core/execution-log.js";
import {
  buildDryRunPrompt,
  buildPatchSetPrompt,
  createDryRunProposal,
  dryRunSystemPrompt,
  formatDryRunProposal,
  patchSetSystemPrompt
} from "../core/executor.js";
import { CliError } from "../core/errors.js";
import { fileExists } from "../core/fs.js";
import { createPatchBackup, restorePatchBackup } from "../core/patch-backup.js";
import { applyPatchSet, parsePatchSet, type PatchSet } from "../core/patch-set.js";
import { createAiProviderFromEnv } from "../core/provider.js";
import { collectSourceContext, sourceContextCandidatePaths } from "../core/source-context.js";
import { shouldIncludeSourceContext } from "../core/source-context-policy.js";
import { createImplementationTargetProfile } from "../core/target-profile.js";
import type { ImplementationTask, ImplementationUnit, TaskPlan } from "../core/tasks.js";

export async function runExecute(flags: FlagMap): Promise<void> {
  const isDryRun = flags["dry-run"] === "true";
  const isApply = flags.apply === "true";
  const isRollback = flags.rollback === "true";
  const isValidate = flags.validate === "true";

  if ([isDryRun, isApply, isRollback, isValidate].filter(Boolean).length !== 1) {
    throw new CliError("Choose exactly one execution mode: --dry-run, --apply, --rollback, or --validate.");
  }

  if (isDryRun) {
    await runDryRun(flags);
    return;
  }

  if (isRollback) {
    await runRollback(flags);
    return;
  }

  if (isValidate) {
    await runValidate(flags);
    return;
  }

  await runApply(flags);
}

async function runDryRun(flags: FlagMap): Promise<void> {
  const config = await loadConfig();
  const projectBriefPath = join(config.artifactsDir, "project-brief.json");
  const taskPlanPath = flags.tasks ?? join(config.artifactsDir, "tasks.json");
  const outDir = flags.out ?? join(config.artifactsDir, "patch-proposals");
  const brief = await readRequiredJson<ProjectBrief>(projectBriefPath, "Run dev-flow brief or dev-flow plan first.");
  const taskPlan = await readRequiredJson<TaskPlan>(taskPlanPath, "Run dev-flow tasks first.");
  const selectedUnit = flags.unit ? selectUnit(taskPlan, flags.unit) : undefined;
  const selectedTasks = selectTasks(taskPlan, flags.task ?? (selectedUnit ? "T03-code-implementation" : undefined));
  const provider = createAiProviderFromEnv();

  await mkdir(outDir, { recursive: true });

  for (const task of selectedTasks) {
    const includeSourceContext = shouldIncludeSourceContext(flags);
    const sourceContext = provider && includeSourceContext
      ? await collectSourceContext(
          sourceContextCandidatePaths(createImplementationTargetProfile(task, brief, selectedUnit), selectedUnit)
        )
      : undefined;
    const proposalMarkdown = provider
      ? await provider.complete({
          system: dryRunSystemPrompt,
          prompt: buildDryRunPrompt(task, brief, selectedUnit, sourceContext),
          temperature: 0.2,
          emptyResponseMessage: "AI provider returned an empty patch proposal."
        })
      : formatDryRunProposal(createDryRunProposal(task, brief, selectedUnit));

    await writeFile(join(outDir, formatProposalFilename(task, selectedUnit)), proposalMarkdown, "utf8");
  }

  console.log(`Dry-run patch proposals written to ${outDir}`);
  console.log(`Tasks proposed: ${selectedTasks.length}`);
  if (selectedUnit) {
    console.log(`Target unit: ${selectedUnit.id}`);
  }
  console.log(provider ? "Executor: AI provider" : "Executor: local deterministic fallback");
}

async function runApply(flags: FlagMap): Promise<void> {
  const config = await loadConfig();
  const executionLogPath = join(config.artifactsDir, "execution-log.json");
  const taskChangelogPath = join(config.artifactsDir, "task-changelog.md");
  const patchSet = flags["patch-set"] ? await readPatchSet(flags["patch-set"]) : await generateAiPatchSet(flags);

  if (!flags["patch-set"]) {
    const patchSetPath = flags["save-patch-set"] ?? join(config.artifactsDir, "patch-sets", `${patchSet.taskId}.json`);
    await mkdir(dirname(patchSetPath), { recursive: true });
    await writeFile(patchSetPath, `${JSON.stringify(patchSet, null, 2)}\n`, "utf8");
    console.log(`Patch set written to ${patchSetPath}`);
  }

  const backupDir = join(config.artifactsDir, "backups", `${safeTimestamp()}-${patchSet.taskId}`);
  const backup = await createPatchBackup(patchSet, backupDir);
  let report: Awaited<ReturnType<typeof applyPatchSet>>;

  try {
    report = await applyPatchSet(patchSet);
  } catch (error) {
    const rollbackReportPath = join(config.artifactsDir, "rollback-report.json");

    try {
      const rollbackReport = await restorePatchBackup(backup.manifestPath);
      await mkdir(dirname(rollbackReportPath), { recursive: true });
      await writeFile(rollbackReportPath, `${JSON.stringify(rollbackReport, null, 2)}\n`, "utf8");
      console.log(`Backup manifest written to ${backup.manifestPath}`);
      console.log(`Rollback report written to ${rollbackReportPath}`);
    } catch (rollbackError) {
      throw new CliError(
        `Patch set apply failed: ${formatErrorMessage(error)}. Rollback also failed: ${formatErrorMessage(rollbackError)}. Backup manifest: ${backup.manifestPath}`
      );
    }

    throw new CliError(`Patch set apply failed and backup was restored: ${formatErrorMessage(error)}`);
  }

  report.backupManifestPath = backup.manifestPath;
  const executionLog = await appendExecutionLog(executionLogPath, report);
  await writeFile(taskChangelogPath, formatTaskChangelog(executionLog), "utf8");

  console.log(`Backup manifest written to ${backup.manifestPath}`);
  console.log(`Patch set applied for task ${report.taskId}`);
  console.log(`Execution log written to ${executionLogPath}`);
  console.log(`Task changelog written to ${taskChangelogPath}`);
  console.log(`Apply status: ${report.status}`);
}

async function runRollback(flags: FlagMap): Promise<void> {
  if (!flags.backup) {
    throw new CliError("execute --rollback requires --backup <manifest-path>.");
  }

  const config = await loadConfig();
  const outPath = flags.out ?? join(config.artifactsDir, "rollback-report.json");
  const report = await restorePatchBackup(flags.backup);

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Rollback report written to ${outPath}`);
  console.log(`Files processed: ${report.files.length}`);
}

async function runValidate(flags: FlagMap): Promise<void> {
  if (!flags["patch-set"]) {
    throw new CliError("execute --validate requires --patch-set <path>.");
  }

  const patchSet = await readPatchSet(flags["patch-set"]);
  const counts = countPatchOperations(patchSet);

  console.log("Patch set is valid.");
  console.log(`Task: ${patchSet.taskId}`);
  console.log(`Operations: ${patchSet.operations.length}`);
  console.log(`Writes: ${counts.write}`);
  console.log(`Replacements: ${counts.replace}`);
  console.log(`Deletes: ${counts.delete}`);
}

async function generateAiPatchSet(flags: FlagMap): Promise<PatchSet> {
  const provider = createAiProviderFromEnv();

  if (!provider) {
    throw new CliError("execute --apply requires DEVFLOW_AI_API_KEY, OPENAI_API_KEY, DEVFLOW_AI_FIXTURE_PATH, or --patch-set <path>.");
  }

  const taskId = flags.task ?? (flags.unit ? "T03-code-implementation" : undefined);

  if (!taskId) {
    throw new CliError("execute --apply with AI requires --task <id>.");
  }

  const config = await loadConfig();
  const projectBriefPath = join(config.artifactsDir, "project-brief.json");
  const taskPlanPath = flags.tasks ?? join(config.artifactsDir, "tasks.json");
  const brief = await readRequiredJson<ProjectBrief>(projectBriefPath, "Run dev-flow brief or dev-flow plan first.");
  const taskPlan = await readRequiredJson<TaskPlan>(taskPlanPath, "Run dev-flow tasks first.");
  const [task] = selectTasks(taskPlan, taskId);
  const selectedUnit = flags.unit ? selectUnit(taskPlan, flags.unit) : undefined;
  const sourceContext = shouldIncludeSourceContext(flags)
    ? await collectSourceContext(
        sourceContextCandidatePaths(createImplementationTargetProfile(task, brief, selectedUnit), selectedUnit)
      )
    : undefined;
  const response = await provider.complete({
    system: patchSetSystemPrompt,
    prompt: buildPatchSetPrompt(task, brief, selectedUnit, sourceContext),
    temperature: 0.1,
    emptyResponseMessage: "AI provider returned an empty patch set."
  });

  return parsePatchSet(response);
}

async function readPatchSet(path: string): Promise<PatchSet> {
  return parsePatchSet(await readFile(path, "utf8"));
}

function selectTasks(taskPlan: TaskPlan, taskId: string | undefined): ImplementationTask[] {
  const selectedTasks = taskId ? taskPlan.tasks.filter((task) => task.id === taskId) : taskPlan.tasks;

  if (selectedTasks.length === 0) {
    throw new CliError(`No task found for id: ${taskId}`);
  }

  return selectedTasks;
}

function selectUnit(taskPlan: TaskPlan, unitId: string): ImplementationUnit {
  const unit = taskPlan.implementationUnits.find((item) => item.id === unitId);

  if (!unit) {
    throw new CliError(`No implementation unit found for id: ${unitId}`);
  }

  return unit;
}

function formatProposalFilename(task: ImplementationTask, unit: ImplementationUnit | undefined): string {
  return unit ? `${task.id}-${unit.id}.md` : `${task.id}.md`;
}

async function readRequiredJson<T>(path: string, hint: string): Promise<T> {
  if (!(await fileExists(path))) {
    throw new CliError(`Missing ${path}. ${hint}`);
  }

  return JSON.parse(await readFile(path, "utf8")) as T;
}

function safeTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function countPatchOperations(patchSet: PatchSet): Record<PatchSet["operations"][number]["type"], number> {
  return patchSet.operations.reduce(
    (counts, operation) => {
      counts[operation.type] += 1;
      return counts;
    },
    {
      write: 0,
      replace: 0,
      delete: 0
    }
  );
}
