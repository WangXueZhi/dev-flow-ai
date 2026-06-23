#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const heading = "### DevFlow Delivery";

export function formatDevFlowSummary(manifest) {
  const counts = manifest.counts || {};
  const status = manifest.status || {};
  const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
  const risks = Array.isArray(manifest.evidence?.deliveryRisks) ? manifest.evidence.deliveryRisks : [];
  const openQuestions = Array.isArray(manifest.evidence?.openQuestions) ? manifest.evidence.openQuestions : [];
  const artifact = (id) => artifacts.find((item) => item.id === id);
  const artifactLine = (id) => {
    const item = artifact(id);
    return item ? `- ${item.label}: \`${item.path}\` (${item.status})` : undefined;
  };
  const lines = [
    heading,
    "",
    `- Readiness: **${status.readiness || "unknown"}**`,
    `- Verification: **${status.verification || "unknown"}**`,
    `- Visual: **${status.visual || "unknown"}**`,
    `- Source changes: **${status.sourceChanges || "unknown"}**`,
    `- Acceptance criteria: ${counts.acceptanceCriteria ?? 0}`,
    `- Open questions: ${counts.openQuestions ?? 0}`,
    `- Delivery risks: ${counts.deliveryRisks ?? 0} (${counts.highDeliveryRisks ?? 0} high)`,
    `- Touched files: ${counts.touchedFiles ?? 0}`,
    "",
    "Artifacts:",
    artifactLine("delivery-report"),
    artifactLine("delivery-manifest"),
    artifactLine("verification-report"),
    artifactLine("visual-report")
  ].filter(Boolean);

  if (risks.length > 0) {
    lines.push("", "Top delivery risks:");
    for (const risk of risks.slice(0, 3)) {
      const source = risk.sourceLine === undefined ? risk.source : `${risk.source}:${risk.sourceLine}`;
      lines.push(`- [${risk.level}] ${source}: ${risk.summary}`);
    }
  }

  if (openQuestions.length > 0) {
    lines.push("", "Open questions:");
    for (const question of openQuestions.slice(0, 3)) {
      lines.push(`- ${question}`);
    }
  }

  return lines.join("\n");
}

export function formatMissingManifestSummary(manifestPath) {
  return `${heading}\n\nDelivery manifest not found at \`${manifestPath || "unknown"}\`.`;
}

export function writeDevFlowSummary({ manifestPath, summaryPath }) {
  if (!summaryPath) {
    console.log("GITHUB_STEP_SUMMARY is not available; skipping DevFlow summary.");
    return "skipped";
  }

  if (!manifestPath || !existsSync(manifestPath)) {
    appendFileSync(summaryPath, `${formatMissingManifestSummary(manifestPath)}\n`);
    return "missing";
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  appendFileSync(summaryPath, `${formatDevFlowSummary(manifest)}\n`);
  return "written";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeDevFlowSummary({
    manifestPath: process.env.MANIFEST_PATH,
    summaryPath: process.env.GITHUB_STEP_SUMMARY
  });
}
