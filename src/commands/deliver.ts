import type { FlagMap } from "../core/args.js";
import { createDeliveryExecutionPlan } from "../core/delivery.js";
import { runExecute } from "./execute.js";
import { runPlan } from "./plan.js";
import { runReport } from "./report.js";
import { runTasks } from "./tasks.js";
import { runVerify } from "./verify.js";
import { runVisual } from "./visual.js";

export async function runDeliver(flags: FlagMap): Promise<void> {
  const executionPlan = createDeliveryExecutionPlan(flags);

  console.log("DevFlow delivery started.");

  await runPlan({
    requirements: flags.requirements,
    ui: flags.ui,
    api: flags.api
  });
  await runTasks({});
  await runExecute({
    "dry-run": "true",
    task: flags.task,
    unit: flags.unit,
    "no-source-context": flags["no-source-context"]
  });

  if (executionPlan.mode === "apply") {
    console.log("Source-changing execution approved for delivery.");
    await runExecute(executionPlan.applyFlags ?? {});
  }

  await runVerify({
    command: flags.command
  });

  if (flags["preview-url"]) {
    await runVisual({
      url: flags["preview-url"],
      text: flags["visual-text"] ?? flags.text,
      viewport: flags.viewport
    });
  }

  await runReport({
    "visual-report": flags["preview-url"] ? undefined : "none"
  });

  console.log("DevFlow delivery complete.");
}
