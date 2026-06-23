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

  if (flags.json === "true") {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  console.log(formatDeliveryStatus(manifest, manifestPath));
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
    ...formatTopRisks(manifest),
    ...formatOpenQuestions(manifest)
  ];

  return lines.join("\n");
}

function formatKeyArtifacts(manifest: DeliveryManifest): string[] {
  const ids = ["delivery-report", "delivery-manifest", "verification-report", "visual-report"];
  const artifacts = ids
    .map((id) => manifest.artifacts.find((artifact) => artifact.id === id))
    .filter((artifact): artifact is DeliveryManifest["artifacts"][number] => Boolean(artifact));

  if (artifacts.length === 0) {
    return ["- No key delivery artifacts were listed in the manifest."];
  }

  return artifacts.map((artifact) => `- ${artifact.label}: ${artifact.path} (${artifact.status})`);
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
