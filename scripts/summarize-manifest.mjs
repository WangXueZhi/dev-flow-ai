#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const heading = "### DevFlow Delivery";

export function formatDevFlowSummary(manifest) {
  const counts = manifest.counts || {};
  const status = manifest.status || {};
  const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
  const verificationCommands = Array.isArray(manifest.evidence?.verificationCommands)
    ? manifest.evidence.verificationCommands
    : [];
  const sourceContextEntries = Array.isArray(manifest.evidence?.sourceContext)
    ? manifest.evidence.sourceContext
    : [];
  const visualLayoutIssues = Array.isArray(manifest.evidence?.visualLayoutIssues)
    ? manifest.evidence.visualLayoutIssues
    : [];
  const reviewerNotes = Array.isArray(manifest.evidence?.taskChangelog?.reviewHandoff?.reviewerNotes)
    ? manifest.evidence.taskChangelog.reviewHandoff.reviewerNotes
    : [];
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
    `- Design tokens: ${counts.designTokens ?? 0}`,
    `- API state requirements: ${counts.apiStateRequirements ?? 0}`,
    `- Touched files: ${counts.touchedFiles ?? 0}`,
    `- Applied operations: ${counts.appliedOperations ?? 0}`,
    `- Visual layout issues: ${counts.visualLayoutIssues ?? 0}`,
    "",
    "Artifacts:",
    artifactLine("delivery-report"),
    artifactLine("delivery-manifest"),
    artifactLine("verification-report"),
    artifactLine("visual-report"),
    artifactLine("prompt-artifacts"),
    artifactLine("source-context-summary")
  ].filter(Boolean);
  const verificationFailures = verificationCommands.filter((command) => command.exitCode !== 0).slice(0, 3);

  lines.push(...formatSourceContextSampling(sourceContextEntries));
  lines.push(...formatVisualLayoutIssues(visualLayoutIssues));
  lines.push(...formatReviewerNotes(reviewerNotes));

  if (verificationFailures.length > 0) {
    lines.push("", "Verification failures:");
    for (const command of verificationFailures) {
      lines.push(`- \`${command.command}\`: exit ${command.exitCode ?? "unknown"}`);
      const excerpt = command.outputExcerpt?.stderr ?? command.outputExcerpt?.stdout;

      if (excerpt) {
        lines.push(`  - ${formatOneLineExcerpt(excerpt)}`);
      }

      if (command.remediation) {
        lines.push(`  - Suggested follow-up: ${command.remediation}`);
      }

      if (command.remediationPlan?.nextActions?.[0]) {
        lines.push(`  - Next action: ${command.remediationPlan.nextActions[0]}`);
      }

      if (command.remediationPlan?.artifactReferences?.[0]) {
        const artifact = command.remediationPlan.artifactReferences[0];
        lines.push(`  - Related artifact: ${artifact.label} (${artifact.path})`);
      }

      if (command.outputExcerpt?.truncatedStderr || command.outputExcerpt?.truncatedStdout) {
        lines.push("  - Output excerpt was truncated.");
      }
    }
  }

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

function formatReviewerNotes(notes) {
  if (notes.length === 0) {
    return [];
  }

  const shown = notes.slice(-3);
  const hidden = notes.length - shown.length;
  const lines = ["", "Reviewer notes:"];

  if (hidden > 0) {
    lines.push(`- Showing latest ${shown.length}; ${hidden} older note(s) omitted.`);
  }

  for (const note of shown) {
    lines.push(`- ${note}`);
  }

  return lines;
}

function formatVisualLayoutIssues(issues) {
  if (!Array.isArray(issues) || issues.length === 0) {
    return [];
  }

  const shown = issues.slice(0, 3);
  const lines = ["", "Visual layout issues:"];

  for (const issue of shown) {
    const text = issue.text ? ` Text: "${formatOneLineExcerpt(issue.text)}"` : "";
    lines.push(
      `- ${issue.viewport || "unknown"} ${issue.type || "layout-issue"} at ${issue.selector || "unknown"}: ${formatOneLineExcerpt(issue.message || "")}${text}`
    );
  }

  if (issues.length > shown.length) {
    const hidden = issues.length - shown.length;
    lines.push(`- ${hidden} more issue${hidden === 1 ? "" : "s"} not shown.`);
  }

  return lines;
}

function formatSourceContextSampling(entries) {
  if (entries.length === 0) {
    return [];
  }

  const latest = entries.at(-1);
  const unit = latest.unit ? `, unit \`${latest.unit.id}\` [${latest.unit.kind}] ${latest.unit.title}` : "";
  const sampled = Array.isArray(latest.entries) ? latest.entries.slice(0, 3) : [];
  const omitted = Array.isArray(latest.omitted) ? latest.omitted.length : 0;
  const lines = [
    "",
    "Source context sampling:",
    `- Runs recorded: ${entries.length}`,
    `- Latest run: \`${latest.mode}\` \`${latest.taskId}\`${unit} at ${latest.generatedAt}`,
    `- Sampled entries: ${Array.isArray(latest.entries) ? latest.entries.length : 0}`,
    `- Omitted candidates: ${omitted}`
  ];

  for (const entry of sampled) {
    const truncated = entry.truncated ? ", truncated" : "";
    lines.push(`- \`${entry.path}\` (${entry.kind}${truncated})`);
  }

  if (Array.isArray(latest.entries) && latest.entries.length > sampled.length) {
    const hidden = latest.entries.length - sampled.length;
    lines.push(`- ${hidden} more entr${hidden === 1 ? "y" : "ies"} not shown`);
  }

  return lines;
}

function formatOneLineExcerpt(value) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact;
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
