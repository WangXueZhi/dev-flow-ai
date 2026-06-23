#!/usr/bin/env node
import { runBrief } from "./commands/brief.js";
import { runDeliver } from "./commands/deliver.js";
import { runDoctor } from "./commands/doctor.js";
import { runExecute } from "./commands/execute.js";
import { runInit } from "./commands/init.js";
import { runPlan } from "./commands/plan.js";
import { runReport } from "./commands/report.js";
import { runStatus } from "./commands/status.js";
import { runTasks } from "./commands/tasks.js";
import { runVerify } from "./commands/verify.js";
import { runVisual } from "./commands/visual.js";
import { parseArgs } from "./core/args.js";
import { CliError } from "./core/errors.js";
import { formatCliVersion } from "./core/version.js";

async function main(argv: string[]): Promise<void> {
  const parsed = parseArgs(argv);

  switch (parsed.command) {
    case "brief":
      await runBrief(parsed.flags);
      return;
    case "init":
      await runInit(parsed.flags);
      return;
    case "plan":
      await runPlan(parsed.flags);
      return;
    case "tasks":
      await runTasks(parsed.flags);
      return;
    case "execute":
      await runExecute(parsed.flags);
      return;
    case "deliver":
      await runDeliver(parsed.flags);
      return;
    case "verify":
      await runVerify(parsed.flags);
      return;
    case "visual":
      await runVisual(parsed.flags);
      return;
    case "report":
      await runReport(parsed.flags);
      return;
    case "status":
      await runStatus(parsed.flags);
      return;
    case "doctor":
      await runDoctor(parsed.flags);
      return;
    case "version":
      await printVersion();
      return;
    case "help":
    case undefined:
      printHelp();
      return;
    default:
      throw new CliError(`Unknown command: ${parsed.command}`, 1);
  }
}

function printHelp(): void {
  console.log(`DevFlow

Usage:
  dev-flow init
  dev-flow brief [--requirements <path>] [--ui <path>] [--api <path>] [--out <path>]
  dev-flow plan [--requirements <path>] [--ui <path>] [--api <path>] [--out <path>]
  dev-flow tasks [--out <path>] [--markdown-out <path>]
  dev-flow execute --dry-run [--task <id>] [--unit <id>] [--out <dir>] [--no-source-context]
  dev-flow execute --apply [--task <id>] [--unit <id>] [--patch-set <path>] [--save-patch-set <path>] [--no-source-context]
  dev-flow execute --validate --patch-set <path>
  dev-flow execute --rollback --backup <manifest-path> [--out <path>]
  dev-flow deliver [--requirements <path>] [--ui <path>] [--api <path>] [--task <id>] [--unit <id>] [--apply --yes] [--patch-set <path>] [--preview-url <url>] [--visual-text <a,b>] [--no-source-context]
  dev-flow verify [--command <shell-command>] [--out <path>]
  dev-flow visual --url <preview-url> [--text <a,b>] [--viewport <name:widthxheight>] [--out <dir>]
  dev-flow report [--out <path>] [--manifest-out <path>] [--visual-report <path|none>]
  dev-flow status [--manifest <path>] [--json]
  dev-flow doctor [--json] [--no-source-context]
  dev-flow version

Commands:
  init      Create .devflow config and starter docs
  brief     Create a structured project brief from docs and repository signals
  plan      Generate an implementation plan from requirements, UI notes, and API docs
  tasks     Generate an implementation task plan from DevFlow artifacts
  execute   Generate dry-run proposals, apply patch sets, or rollback from backups
  deliver   Run plan, tasks, dry-run execution, optional apply, verification, visual checks, and report
  verify    Run recommended verification commands and record results
  visual    Capture screenshots, blank-screen checks, and text checks for a preview URL
  report    Generate a delivery report from DevFlow artifacts
  status    Print delivery readiness and manifest status
  doctor    Check local runtime and project readiness
  version   Print the installed DevFlow version

Environment:
  DEVFLOW_AI_API_KEY       Optional API key for an OpenAI-compatible provider
  OPENAI_API_KEY           Fallback API key when DEVFLOW_AI_API_KEY is not set
  DEVFLOW_AI_BASE_URL      Optional base URL, defaults to https://api.openai.com/v1
  DEVFLOW_AI_MODEL         Optional model, defaults to gpt-4.1
  DEVFLOW_AI_FIXTURE_PATH  Optional fixture response file for tests and CI
  DEVFLOW_SOURCE_CONTEXT   Set to none, false, off, 0, or disabled to omit source snippets from AI prompts
`);
}

async function printVersion(): Promise<void> {
  console.log(await formatCliVersion());
}

main(process.argv.slice(2)).catch((error: unknown) => {
  if (error instanceof CliError) {
    console.error(`Error: ${error.message}`);
    process.exitCode = error.exitCode;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
