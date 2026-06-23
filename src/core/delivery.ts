import type { FlagMap } from "./args.js";
import { CliError } from "./errors.js";

export interface DeliveryExecutionPlan {
  mode: "dry-run-only" | "apply";
  applyFlags?: FlagMap;
}

export function createDeliveryExecutionPlan(flags: FlagMap): DeliveryExecutionPlan {
  if (flags.apply !== "true") {
    return { mode: "dry-run-only" };
  }

  if (flags.yes !== "true") {
    throw new CliError("deliver --apply changes project files; pass --yes to confirm source-changing execution.");
  }

  if (!flags["patch-set"] && !flags.task && !flags.unit) {
    throw new CliError("deliver --apply requires --task <id>, --unit <id>, or --patch-set <path>.");
  }

  return {
    mode: "apply",
    applyFlags: {
      apply: "true",
      task: flags.task,
      unit: flags.unit,
      tasks: flags.tasks,
      "patch-set": flags["patch-set"],
      "save-patch-set": flags["save-patch-set"]
    }
  };
}
