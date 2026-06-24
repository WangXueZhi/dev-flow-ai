import { spawn } from "node:child_process";
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
import { writePromptArtifact } from "../core/prompt-artifact.js";
import { createAiProviderFromEnv } from "../core/provider.js";
import {
  collectSourceContext,
  createSourceContextSummaryEntry,
  sourceContextCandidatePaths,
  type SourceContext,
  type SourceContextSummaryEntry,
  type SourceContextSummaryLog
} from "../core/source-context.js";
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
  const promptOutDir = flags["save-prompt"];
  const sourceContextSummaryPath = join(config.artifactsDir, "source-context-summary.json");
  const brief = await readRequiredJson<ProjectBrief>(projectBriefPath, "Run dev-flow brief or dev-flow plan first.");
  const taskPlan = await readRequiredJson<TaskPlan>(taskPlanPath, "Run dev-flow tasks first.");
  const selectedUnit = flags.unit ? selectUnit(taskPlan, flags.unit) : undefined;
  const selectedTasks = selectTasks(taskPlan, flags.task ?? (selectedUnit ? "T03-code-implementation" : undefined));
  const provider = createAiProviderFromEnv();

  await mkdir(outDir, { recursive: true });

  for (const task of selectedTasks) {
    const shouldBuildAiPrompt = Boolean(provider || promptOutDir);
    const sourceContext = shouldBuildAiPrompt
      ? await collectExecutionSourceContext({
          flags,
          brief,
          task,
          unit: selectedUnit,
          mode: "dry-run",
          summaryPath: sourceContextSummaryPath
        })
      : undefined;
    const prompt = shouldBuildAiPrompt ? buildDryRunPrompt(task, brief, selectedUnit, sourceContext) : undefined;

    if (promptOutDir && prompt) {
      await writePromptArtifact(join(promptOutDir, formatPromptFilename(task, selectedUnit)), prompt);
    }

    const proposalMarkdown = provider
      ? await provider.complete({
          system: dryRunSystemPrompt,
          prompt: prompt ?? buildDryRunPrompt(task, brief, selectedUnit, sourceContext),
          temperature: 0.2,
          emptyResponseMessage: "AI provider returned an empty patch proposal."
        })
      : formatDryRunProposal(createDryRunProposal(task, brief, selectedUnit));

    await writeFile(join(outDir, formatProposalFilename(task, selectedUnit)), proposalMarkdown, "utf8");
  }

  console.log(`Dry-run patch proposals written to ${outDir}`);
  if (promptOutDir) {
    console.log(`Dry-run AI prompts written to ${promptOutDir}`);
  }
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
  const verificationReportPath = join(config.artifactsDir, "verification-report.json");
  const deliveryReportPath = join(config.artifactsDir, "delivery-report.md");

  if (flags["require-clean"] === "true") {
    await assertCleanGitWorktree(config.artifactsDir);
  }

  const patchSet = flags["patch-set"] ? await readPatchSet(flags["patch-set"]) : await generateAiPatchSet(flags);
  const reviewerNotes = collectReviewerNotes(flags);

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
  await writeFile(
    taskChangelogPath,
    formatTaskChangelog(executionLog, {
      executionLogPath,
      verificationReportPath,
      deliveryReportPath,
      reviewerNotes
    }),
    "utf8"
  );

  console.log(`Backup manifest written to ${backup.manifestPath}`);
  console.log(`Patch set applied for task ${report.taskId}`);
  console.log(`Execution log written to ${executionLogPath}`);
  console.log(`Task changelog written to ${taskChangelogPath}`);
  console.log(`Apply status: ${report.status}`);
}

function collectReviewerNotes(flags: FlagMap): string[] | undefined {
  const rawNotes = [flags["review-note"], flags["review-notes"]].filter((note): note is string => Boolean(note));
  const notes = rawNotes
    .flatMap((note) => note.split(/\r?\n/))
    .map((note) => note.trim().replace(/\s+/g, " "))
    .filter((note) => note.length > 0)
    .slice(0, 5);

  return notes.length ? notes : undefined;
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
  const sourceContextSummaryPath = join(config.artifactsDir, "source-context-summary.json");
  const brief = await readRequiredJson<ProjectBrief>(projectBriefPath, "Run dev-flow brief or dev-flow plan first.");
  const taskPlan = await readRequiredJson<TaskPlan>(taskPlanPath, "Run dev-flow tasks first.");
  const [task] = selectTasks(taskPlan, taskId);
  const selectedUnit = flags.unit ? selectUnit(taskPlan, flags.unit) : undefined;
  const sourceContext = await collectExecutionSourceContext({
    flags,
    brief,
    task,
    unit: selectedUnit,
    mode: "apply",
    summaryPath: sourceContextSummaryPath
  });
  const prompt = buildPatchSetPrompt(task, brief, selectedUnit, sourceContext);

  if (flags["save-prompt"]) {
    await writePromptArtifact(flags["save-prompt"], prompt);
    console.log(`Patch-set AI prompt written to ${flags["save-prompt"]}`);
  }

  const response = await provider.complete({
    system: patchSetSystemPrompt,
    prompt,
    temperature: 0.1,
    emptyResponseMessage: "AI provider returned an empty patch set."
  });

  return parsePatchSet(response);
}

async function collectExecutionSourceContext(input: {
  flags: FlagMap;
  brief: ProjectBrief;
  task: ImplementationTask;
  unit?: ImplementationUnit;
  mode: SourceContextSummaryEntry["mode"];
  summaryPath: string;
}): Promise<SourceContext | undefined> {
  if (!shouldIncludeSourceContext(input.flags)) {
    return undefined;
  }

  const sourceContext = await collectSourceContext(
    sourceContextCandidatePaths(createImplementationTargetProfile(input.task, input.brief, input.unit), input.unit)
  );
  await appendSourceContextSummary(
    input.summaryPath,
    createSourceContextSummaryEntry({
      context: sourceContext,
      generatedAt: new Date().toISOString(),
      mode: input.mode,
      taskId: input.task.id,
      unit: input.unit
    })
  );

  return sourceContext;
}

async function appendSourceContextSummary(path: string, entry: SourceContextSummaryEntry): Promise<void> {
  const existing = await readJsonIfExists<SourceContextSummaryLog>(path);
  const log: SourceContextSummaryLog = {
    version: 1,
    entries: [...(existing?.entries ?? []), entry]
  };

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(log, null, 2)}\n`, "utf8");
}

async function readPatchSet(path: string): Promise<PatchSet> {
  return parsePatchSet(await readFile(path, "utf8"));
}

async function readJsonIfExists<T>(path: string): Promise<T | undefined> {
  if (!(await fileExists(path))) {
    return undefined;
  }

  return JSON.parse(await readFile(path, "utf8")) as T;
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

function formatPromptFilename(task: ImplementationTask, unit: ImplementationUnit | undefined): string {
  return unit ? `${task.id}-${unit.id}.prompt.md` : `${task.id}.prompt.md`;
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

async function assertCleanGitWorktree(artifactsDir: string): Promise<void> {
  const status = await getGitStatusPorcelain();

  if (status.error) {
    throw new CliError(
      `execute --apply --require-clean could not run git status: ${status.error.message}. Run from a git repository with git installed, or omit --require-clean.`
    );
  }

  if (status.exitCode !== 0) {
    const detail = oneLine(status.stderr || status.stdout);
    throw new CliError(
      `execute --apply --require-clean requires git status to succeed.${detail ? ` git status: ${detail}` : ""}`
    );
  }

  const dirtyEntries = status.stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .filter((line) => !statusLineOnlyTouchesPath(line, artifactsDir));

  if (dirtyEntries.length > 0) {
    const preview = dirtyEntries.slice(0, 5).map(oneLine).join(", ");
    const suffix = dirtyEntries.length > 5 ? ", ..." : "";

    throw new CliError(
      `execute --apply --require-clean requires a clean git working tree outside ${artifactsDir}. Commit, stash, or discard local changes before applying source changes. Dirty entries: ${preview}${suffix}`
    );
  }

  console.log(`Git working tree is clean outside ${artifactsDir}.`);
}

function getGitStatusPorcelain(): Promise<{
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}> {
  return new Promise((resolve) => {
    const child = spawn("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
      cwd: process.cwd(),
      env: process.env
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result: { exitCode: number | null; stdout: string; stderr: string; error?: Error }) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      finish({ exitCode: null, stdout, stderr, error });
    });
    child.on("close", (exitCode) => {
      finish({ exitCode, stdout, stderr });
    });
  });
}

function statusLineOnlyTouchesPath(line: string, ignoredPath: string): boolean {
  const paths = statusLinePaths(line);

  return paths.length > 0 && paths.every((path) => isSameOrInsidePath(path, ignoredPath));
}

function statusLinePaths(line: string): string[] {
  const value = line.slice(3).trim();

  if (!value) {
    return [];
  }

  return value.split(" -> ").map((path) => path.trim()).filter(Boolean);
}

function isSameOrInsidePath(path: string, parentPath: string): boolean {
  const normalizedPath = normalizeGitPath(path);
  const normalizedParent = normalizeGitPath(parentPath);

  return normalizedPath === normalizedParent || normalizedPath.startsWith(`${normalizedParent}/`);
}

function normalizeGitPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/g, "");
}

function oneLine(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
