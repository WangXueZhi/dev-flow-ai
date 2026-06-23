import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FlagMap } from "../core/args.js";
import { createProjectBrief, type ProjectBrief } from "../core/brief.js";
import { loadConfig } from "../core/config.js";
import { loadProjectContext } from "../core/context.js";
import { fileExists } from "../core/fs.js";
import { detectStack } from "../core/stack.js";
import { createTaskPlan, formatTaskPlanMarkdown } from "../core/tasks.js";

export async function runTasks(flags: FlagMap): Promise<void> {
  const config = await loadConfig();
  const projectBriefPath = join(config.artifactsDir, "project-brief.json");
  const implementationPlanPath = join(config.artifactsDir, "implementation-plan.md");
  const outPath = flags.out ?? join(config.artifactsDir, "tasks.json");
  const markdownPath = flags["markdown-out"] ?? defaultMarkdownPath(outPath);
  const brief = await loadOrCreateBrief(config, projectBriefPath);
  const implementationPlan = await readTextIfExists(implementationPlanPath);
  const taskPlan = createTaskPlan(brief, implementationPlan, {
    projectBriefPath,
    implementationPlanPath
  });

  await mkdir(dirname(outPath), { recursive: true });
  await mkdir(dirname(markdownPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(taskPlan, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, formatTaskPlanMarkdown(taskPlan), "utf8");

  console.log(`Task plan written to ${outPath}`);
  console.log(`Task plan markdown written to ${markdownPath}`);
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

async function readTextIfExists(path: string): Promise<string> {
  if (!(await fileExists(path))) {
    return "";
  }

  return readFile(path, "utf8");
}

function defaultMarkdownPath(outPath: string): string {
  return outPath.toLowerCase().endsWith(".json") ? outPath.replace(/\.json$/i, ".md") : `${outPath}.md`;
}
