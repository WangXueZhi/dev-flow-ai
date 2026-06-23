import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FlagMap } from "../core/args.js";
import { createProjectBrief } from "../core/brief.js";
import { loadConfig } from "../core/config.js";
import { loadProjectContext } from "../core/context.js";
import { createAiProviderFromEnv } from "../core/provider.js";
import { createImplementationPlan } from "../core/planner.js";
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
  const plan = await createImplementationPlan(context, provider, brief);
  const outPath = flags.out ?? join(config.artifactsDir, "implementation-plan.md");
  const briefPath = join(config.artifactsDir, "project-brief.json");

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(briefPath, `${JSON.stringify(brief, null, 2)}\n`, "utf8");
  await writeFile(outPath, plan, "utf8");

  console.log(`Project brief written to ${briefPath}`);
  console.log(`Implementation plan written to ${outPath}`);
  console.log(provider ? "Planner: AI provider" : "Planner: local deterministic fallback");
}
