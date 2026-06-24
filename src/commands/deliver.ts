import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FlagMap } from "../core/args.js";
import type { ProjectBrief } from "../core/brief.js";
import { loadConfig } from "../core/config.js";
import { createDeliveryExecutionPlan } from "../core/delivery.js";
import { inferRequiredTextFromBrief } from "../core/visual.js";
import { runExecute } from "./execute.js";
import { runPlan } from "./plan.js";
import { runReport } from "./report.js";
import { runTasks } from "./tasks.js";
import { runVerify } from "./verify.js";
import { runVisual } from "./visual.js";

export async function runDeliver(flags: FlagMap): Promise<void> {
  const executionPlan = createDeliveryExecutionPlan(flags);
  const promptDir = flags["save-prompts"];

  console.log("DevFlow delivery started.");

  await runPlan({
    requirements: flags.requirements,
    ui: flags.ui,
    api: flags.api,
    "save-prompt": promptDir ? join(promptDir, "plan.prompt.md") : undefined
  });
  await runTasks({});
  await runExecute({
    "dry-run": "true",
    task: flags.task,
    unit: flags.unit,
    "no-source-context": flags["no-source-context"],
    "save-prompt": promptDir ? join(promptDir, "dry-run") : undefined
  });

  if (executionPlan.mode === "apply") {
    console.log("Source-changing execution approved for delivery.");
    await runExecute({
      ...(executionPlan.applyFlags ?? {}),
      "save-prompt": promptDir ? join(promptDir, "apply.prompt.md") : executionPlan.applyFlags?.["save-prompt"]
    });
  }

  await runVerify({
    command: flags.command
  });

  if (flags["preview-url"]) {
    const visualText = flags["visual-text"] ?? flags.text ?? await inferVisualTextFromProjectBrief();
    await runVisual({
      url: flags["preview-url"],
      text: visualText,
      viewport: flags.viewport
    });
  }

  await runReport({
    "visual-report": flags["preview-url"] ? undefined : "none"
  });

  console.log("DevFlow delivery complete.");
}

async function inferVisualTextFromProjectBrief(): Promise<string | undefined> {
  try {
    const config = await loadConfig();
    const projectBriefPath = join(config.artifactsDir, "project-brief.json");
    const brief = JSON.parse(await readFile(projectBriefPath, "utf8")) as ProjectBrief;
    const requiredText = inferRequiredTextFromBrief(brief);

    if (requiredText.length === 0) {
      return undefined;
    }

    console.log(`Inferred visual text checks from project brief: ${requiredText.join(", ")}`);
    return requiredText.join(",");
  } catch {
    return undefined;
  }
}
