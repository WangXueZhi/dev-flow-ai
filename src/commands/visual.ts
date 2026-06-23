import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FlagMap } from "../core/args.js";
import { loadConfig } from "../core/config.js";
import { CliError } from "../core/errors.js";
import { parseRequiredText, parseViewportSpec, runVisualCheck } from "../core/visual.js";

export async function runVisual(flags: FlagMap): Promise<void> {
  if (!flags.url) {
    throw new CliError("visual requires --url <preview-url>.");
  }

  const config = await loadConfig();
  const outDir = flags.out ?? join(config.artifactsDir, "visual");
  const reportPath = join(outDir, "visual-report.json");
  const report = await runVisualCheck({
    url: flags.url,
    outDir,
    viewports: parseViewportSpec(flags.viewport),
    requiredText: parseRequiredText(flags.text)
  });

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Visual report written to ${reportPath}`);
  console.log(`Screenshots captured: ${report.screenshots.length}`);
  console.log(`Visual status: ${report.status}`);

  if (report.status === "failed") {
    process.exitCode = 1;
  }
}
