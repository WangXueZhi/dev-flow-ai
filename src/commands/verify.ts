import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FlagMap } from "../core/args.js";
import { createProjectBrief, type ProjectBrief } from "../core/brief.js";
import { loadConfig } from "../core/config.js";
import { loadProjectContext } from "../core/context.js";
import { fileExists } from "../core/fs.js";
import { detectStack } from "../core/stack.js";
import { runVerificationCommands } from "../core/verification.js";

export async function runVerify(flags: FlagMap): Promise<void> {
  const config = await loadConfig();
  const briefPath = join(config.artifactsDir, "project-brief.json");
  const reportPath = flags.out ?? join(config.artifactsDir, "verification-report.json");
  const brief = await loadOrCreateBrief(config, briefPath);
  const commands = selectVerificationCommands(flags.command, brief.recommendedVerification);
  const report = await runVerificationCommands(commands);

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Verification report written to ${reportPath}`);
  console.log(`Verification status: ${report.status}`);

  if (report.status === "failed") {
    process.exitCode = 1;
  }
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

function selectVerificationCommands(flagCommand: string | undefined, recommended: string[]): string[] {
  if (flagCommand) {
    return [flagCommand];
  }

  return recommended.filter((command) => !command.startsWith("Add or document"));
}
