import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FlagMap } from "../core/args.js";
import { loadConfig } from "../core/config.js";
import { CliError } from "../core/errors.js";
import { fileExists } from "../core/fs.js";
import type { DeliveryManifest } from "../core/report.js";

export async function runStatus(flags: FlagMap): Promise<void> {
  const config = await loadConfig();
  const manifestPath = flags.manifest ?? join(config.artifactsDir, "delivery-manifest.json");

  if (!(await fileExists(manifestPath))) {
    throw new CliError(`Missing ${manifestPath}. Run dev-flow deliver or dev-flow report first.`);
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as DeliveryManifest;
  const gateFailures = deliveryStatusGateFailures(manifest, flags);

  if (flags.json === "true") {
    console.log(JSON.stringify(manifest, null, 2));
    failIfNeeded(gateFailures);
    return;
  }

  console.log(formatDeliveryStatus(manifest, manifestPath));
  failIfNeeded(gateFailures);
}

function deliveryStatusGateFailures(manifest: DeliveryManifest, flags: FlagMap): string[] {
  const failures: string[] = [];

  if (flags["fail-on-attention"] === "true" && manifest.status.readiness !== "ready for review") {
    failures.push(`readiness is ${manifest.status.readiness}`);
  }

  if (flags["fail-on-failed-verification"] === "true" && manifest.status.verification === "failed") {
    failures.push("verification status is failed");
  }

  return failures;
}

function failIfNeeded(failures: string[]): void {
  if (failures.length > 0) {
    throw new CliError(`Delivery status gate failed: ${failures.join("; ")}.`);
  }
}

function formatDeliveryStatus(manifest: DeliveryManifest, manifestPath: string): string {
  const counts = manifest.counts;
  const lines = [
    "DevFlow delivery status",
    "",
    `Manifest: ${manifestPath}`,
    `Generated: ${manifest.generatedAt}`,
    `Readiness: ${manifest.status.readiness}`,
    `Verification: ${manifest.status.verification}`,
    `Visual: ${manifest.status.visual}`,
    `Source changes: ${manifest.status.sourceChanges}`,
    "",
    "Counts:",
    `- Acceptance criteria: ${counts.acceptanceCriteria}`,
    `- Open questions: ${counts.openQuestions}`,
    `- Delivery risks: ${counts.deliveryRisks} (${counts.highDeliveryRisks} high)`,
    `- Touched files: ${counts.touchedFiles}`,
    `- Verification commands: ${counts.verificationCommands}`,
    `- Visual screenshots: ${counts.visualScreenshots}`,
    "",
    "Artifacts:",
    ...formatKeyArtifacts(manifest),
    ...formatSourceContextSampling(manifest),
    ...formatVerificationFailures(manifest),
    ...formatTopRisks(manifest),
    ...formatOpenQuestions(manifest)
  ];

  return lines.join("\n");
}

function formatKeyArtifacts(manifest: DeliveryManifest): string[] {
  const ids = ["delivery-report", "delivery-manifest", "verification-report", "visual-report", "source-context-summary"];
  const artifacts = ids
    .map((id) => manifest.artifacts.find((artifact) => artifact.id === id))
    .filter((artifact): artifact is DeliveryManifest["artifacts"][number] => Boolean(artifact));

  if (artifacts.length === 0) {
    return ["- No key delivery artifacts were listed in the manifest."];
  }

  return artifacts.map((artifact) => `- ${artifact.label}: ${artifact.path} (${artifact.status})`);
}

function formatSourceContextSampling(manifest: DeliveryManifest): string[] {
  const entries = manifest.evidence.sourceContext ?? [];

  if (entries.length === 0) {
    return [];
  }

  const latest = entries[entries.length - 1]!;
  const unit = latest.unit ? `, unit ${latest.unit.id} [${latest.unit.kind}] ${latest.unit.title}` : "";
  const sampled = latest.entries.slice(0, 3);
  const sampledLines = sampled.map((entry) => {
    const truncated = entry.truncated ? ", truncated" : "";

    return `- Sampled: ${entry.path} (${entry.kind}${truncated})`;
  });

  if (latest.entries.length > sampled.length) {
    sampledLines.push(`- Sampled: ${latest.entries.length - sampled.length} more entr${latest.entries.length - sampled.length === 1 ? "y" : "ies"} not shown`);
  }

  return [
    "",
    "Source context sampling:",
    `- Runs recorded: ${entries.length}`,
    `- Latest run: ${latest.mode} ${latest.taskId}${unit} at ${latest.generatedAt}`,
    `- Sampled entries: ${latest.entries.length}`,
    `- Omitted candidates: ${latest.omitted.length}`,
    ...sampledLines
  ];
}

function formatVerificationFailures(manifest: DeliveryManifest): string[] {
  const failures = manifest.evidence.verificationCommands
    .filter((command) => command.exitCode !== 0)
    .slice(0, 3);

  if (failures.length === 0) {
    return [];
  }

  return [
    "",
    "Verification failures:",
    ...failures.flatMap((command) => {
      const lines = [`- \`${command.command}\`: exit ${command.exitCode ?? "unknown"}`];
      const excerpt = command.outputExcerpt?.stderr ?? command.outputExcerpt?.stdout;

      if (excerpt) {
        lines.push(`  - ${formatOneLineExcerpt(excerpt)}`);
      }

      if (command.outputExcerpt?.truncatedStderr || command.outputExcerpt?.truncatedStdout) {
        lines.push("  - Output excerpt was truncated.");
      }

      return lines;
    })
  ];
}

function formatOneLineExcerpt(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact;
}

function formatTopRisks(manifest: DeliveryManifest): string[] {
  const risks = manifest.evidence.deliveryRisks.slice(0, 3);

  if (risks.length === 0) {
    return [];
  }

  return [
    "",
    "Top delivery risks:",
    ...risks.map((risk) => {
      const source = risk.sourceLine === undefined ? risk.source : `${risk.source}:${risk.sourceLine}`;

      return `- [${risk.level}] ${source}: ${risk.summary}`;
    })
  ];
}

function formatOpenQuestions(manifest: DeliveryManifest): string[] {
  const questions = manifest.evidence.openQuestions.slice(0, 3);

  if (questions.length === 0) {
    return [];
  }

  return ["", "Open questions:", ...questions.map((question) => `- ${question}`)];
}
