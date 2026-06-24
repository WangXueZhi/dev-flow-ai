import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FlagMap } from "../core/args.js";
import { createProjectBrief } from "../core/brief.js";
import { loadConfig } from "../core/config.js";
import { loadProjectContext } from "../core/context.js";
import { createAiProviderFromEnv } from "../core/provider.js";
import { buildPlannerPrompt, createImplementationPlan } from "../core/planner.js";
import { writePromptArtifact } from "../core/prompt-artifact.js";
import { detectStack } from "../core/stack.js";

export async function runPlan(flags: FlagMap): Promise<void> {
  const config = await loadConfig();
  const context = await loadProjectContext({
    requirementsPath: flags.requirements ?? config.requirementsPath,
    uiPath: flags.ui ?? config.uiPath,
    apiPath: flags.api ?? config.apiPath
  });
  const stack = await detectStack();
  const brief = createProjectBrief(context, stack);

  const provider = createAiProviderFromEnv();
  const prompt = buildPlannerPrompt(context, brief);
  const plan = await createImplementationPlan(context, provider, brief, prompt);
  const outPath = flags.out ?? join(config.artifactsDir, "implementation-plan.md");
  const briefPath = join(config.artifactsDir, "project-brief.json");

  await mkdir(dirname(outPath), { recursive: true });
  await mkdir(dirname(briefPath), { recursive: true });
  if (flags["save-prompt"]) {
    await writePromptArtifact(flags["save-prompt"], prompt);
  }
  await writeFile(briefPath, `${JSON.stringify(brief, null, 2)}\n`, "utf8");
  await writeFile(outPath, plan, "utf8");

  if (flags["save-prompt"]) {
    console.log(`Planner prompt written to ${flags["save-prompt"]}`);
  }
  console.log(`Project brief written to ${briefPath}`);
  console.log(`Implementation plan written to ${outPath}`);
  console.log(provider ? "Planner: AI provider" : "Planner: local deterministic fallback");
}
