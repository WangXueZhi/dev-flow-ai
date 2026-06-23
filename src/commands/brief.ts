import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FlagMap } from "../core/args.js";
import { createProjectBrief } from "../core/brief.js";
import { loadConfig } from "../core/config.js";
import { loadProjectContext } from "../core/context.js";
import { detectStack } from "../core/stack.js";

export async function runBrief(flags: FlagMap): Promise<void> {
  const config = await loadConfig();
  const context = await loadProjectContext({
    requirementsPath: flags.requirements ?? config.requirementsPath,
    uiPath: flags.ui ?? config.uiPath,
    apiPath: flags.api ?? config.apiPath
  });
  const stack = await detectStack();
  const brief = createProjectBrief(context, stack);
  const outPath = flags.out ?? join(config.artifactsDir, "project-brief.json");

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(brief, null, 2)}\n`, "utf8");

  console.log(`Project brief written to ${outPath}`);
  console.log(`Detected stack: ${formatDetectedStack(brief.stack.frameworks, brief.stack.runtimes)}`);
}

function formatDetectedStack(frameworks: string[], runtimes: string[]): string {
  const detected = [...frameworks, ...runtimes];
  return detected.length > 0 ? detected.join(", ") : "unknown";
}
