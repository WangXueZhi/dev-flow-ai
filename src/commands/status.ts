import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FlagMap } from "../core/args.js";
import { loadConfig } from "../core/config.js";
import { CliError } from "../core/errors.js";
import { fileExists } from "../core/fs.js";
import type { DeliveryManifest } from "../core/report.js";
import type { SmokeProviderReport } from "./smoke-provider.js";

type SmokeProviderReportSummary =
  | { state: "missing"; path: string }
  | { state: "present"; path: string; report: SmokeProviderReport }
  | { state: "invalid"; path: string; message: string };

export async function runStatus(flags: FlagMap, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const config = await loadConfig();
  const manifestPath = flags.manifest ?? join(config.artifactsDir, "delivery-manifest.json");
  const smokeReportPath = env.DEVFLOW_LIVE_SMOKE_REPORT ?? join(config.artifactsDir, "live-provider-smoke.json");

  if (!(await fileExists(manifestPath))) {
    throw new CliError(`Missing ${manifestPath}. Run dev-flow deliver or dev-flow report first.`);
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as DeliveryManifest;
  const smokeReport = await readSmokeProviderReport(smokeReportPath);
  const gateFailures = deliveryStatusGateFailures(manifest, flags);

  if (flags.json === "true") {
    console.log(JSON.stringify(manifest, null, 2));
    failIfNeeded(gateFailures);
    return;
  }

  console.log(formatDeliveryStatus(manifest, manifestPath, smokeReport));
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

  if (flags["fail-on-failed-visual"] === "true" && manifest.status.visual === "failed") {
    failures.push("visual status is failed");
  }

  if (flags["fail-on-missing-artifacts"] === "true") {
    const missingArtifacts = missingRequiredArtifacts(manifest);

    if (missingArtifacts.length > 0) {
      failures.push(`missing required artifacts: ${formatArtifactList(missingArtifacts)}`);
    }
  }

  return failures;
}

function failIfNeeded(failures: string[]): void {
  if (failures.length > 0) {
    throw new CliError(`Delivery status gate failed: ${failures.join("; ")}.`);
  }
}

function formatDeliveryStatus(manifest: DeliveryManifest, manifestPath: string, smokeReport: SmokeProviderReportSummary): string {
  const counts = manifest.counts;
  const visualRequiredText = manifest.evidence.visualRequiredText ?? [];
  const missingVisualText = visualRequiredText.filter((check) => !check.found);
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
    `- Applied operations: ${counts.appliedOperations}`,
    `- Verification commands: ${counts.verificationCommands}`,
    `- Visual screenshots: ${counts.visualScreenshots}`,
    `- Visual required text: ${counts.visualRequiredText} (${missingVisualText.length} missing)`,
    `- Visual layout issues: ${counts.visualLayoutIssues}`,
    `- Design tokens: ${counts.designTokens ?? 0}`,
    `- API state requirements: ${counts.apiStateRequirements ?? 0}`,
    "",
    "Artifacts:",
    ...formatKeyArtifacts(manifest),
    ...formatMissingRequiredArtifacts(manifest),
    ...formatSmokeProviderReport(smokeReport),
    ...formatReviewerNotes(manifest),
    ...formatSourceContextSampling(manifest),
    ...formatMissingVisualText(manifest),
    ...formatVisualLayoutIssues(manifest),
    ...formatVerificationFailures(manifest),
    ...formatTopRisks(manifest),
    ...formatOpenQuestions(manifest)
  ];

  return lines.join("\n");
}

function formatKeyArtifacts(manifest: DeliveryManifest): string[] {
  const ids = ["delivery-report", "delivery-manifest", "verification-report", "visual-report", "prompt-artifacts", "source-context-summary"];
  const artifacts = ids
    .map((id) => manifest.artifacts.find((artifact) => artifact.id === id))
    .filter((artifact): artifact is DeliveryManifest["artifacts"][number] => Boolean(artifact));

  if (artifacts.length === 0) {
    return ["- No key delivery artifacts were listed in the manifest."];
  }

  return artifacts.map((artifact) => `- ${artifact.label}: ${artifact.path} (${artifact.status})`);
}

function missingRequiredArtifacts(manifest: DeliveryManifest): DeliveryManifest["artifacts"] {
  return manifest.artifacts.filter((artifact) => artifact.required && artifact.status === "missing");
}

function formatMissingRequiredArtifacts(manifest: DeliveryManifest): string[] {
  const missingArtifacts = missingRequiredArtifacts(manifest);

  if (missingArtifacts.length === 0) {
    return [];
  }

  const shown = missingArtifacts.slice(0, 5);
  const hidden = missingArtifacts.length - shown.length;
  const lines = ["", "Missing required artifacts:", ...shown.map((artifact) => `- ${artifact.label}: ${artifact.path}`)];

  if (hidden > 0) {
    lines.push(`- ${hidden} more required artifact${hidden === 1 ? "" : "s"} not shown.`);
  }

  return lines;
}

function formatArtifactList(artifacts: DeliveryManifest["artifacts"]): string {
  const shown = artifacts.slice(0, 3).map((artifact) => `${artifact.label} (${artifact.path})`);
  const hidden = artifacts.length - shown.length;

  return hidden > 0 ? `${shown.join(", ")}, and ${hidden} more` : shown.join(", ");
}

async function readSmokeProviderReport(path: string): Promise<SmokeProviderReportSummary> {
  if (!(await fileExists(path))) {
    return { state: "missing", path };
  }

  try {
    const report = JSON.parse(await readFile(path, "utf8")) as SmokeProviderReport;

    if (!isSmokeProviderReport(report)) {
      return { state: "invalid", path, message: "report does not match the expected live provider smoke shape" };
    }

    return { state: "present", path, report };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return { state: "invalid", path, message };
  }
}

function isSmokeProviderReport(value: unknown): value is SmokeProviderReport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const report = value as Partial<SmokeProviderReport>;

  return (
    report.version === 1 &&
    typeof report.generatedAt === "string" &&
    typeof report.startedAt === "string" &&
    typeof report.finishedAt === "string" &&
    (report.status === "passed" || report.status === "failed" || report.status === "skipped") &&
    typeof report.required === "boolean" &&
    Boolean(report.provider) &&
    typeof report.provider === "object" &&
    typeof report.provider.mode === "string" &&
    typeof report.provider.chatCompletionsUrl === "string" &&
    typeof report.provider.model === "string" &&
    typeof report.message === "string"
  );
}

function formatSmokeProviderReport(summary: SmokeProviderReportSummary): string[] {
  if (summary.state === "missing") {
    return [];
  }

  if (summary.state === "invalid") {
    return [
      "",
      "AI provider smoke:",
      `- Report: ${summary.path} (invalid)`,
      `- Error: ${formatOneLineExcerpt(summary.message)}`
    ];
  }

  const report = summary.report;
  const provider = report.provider;
  const keySource = report.apiKeyEnvName ?? provider.apiKeyEnvName ?? provider.liveApiKeyEnvName ?? "none";
  const required = report.required ? "yes" : "no";

  return [
    "",
    "AI provider smoke:",
    `- Report: ${summary.path}`,
    `- Status: ${report.status}`,
    `- Required: ${required}`,
    `- Generated: ${report.generatedAt}`,
    `- Provider: ${provider.mode}, model ${provider.model}, endpoint ${provider.chatCompletionsUrl}`,
    `- Key source: ${keySource}`,
    `- Message: ${formatOneLineExcerpt(report.message)}`
  ];
}

function formatReviewerNotes(manifest: DeliveryManifest): string[] {
  const notes = manifest.evidence.taskChangelog?.reviewHandoff.reviewerNotes ?? [];

  if (notes.length === 0) {
    return [];
  }

  const shown = notes.slice(-3);
  const hidden = notes.length - shown.length;
  const lines = ["", "Reviewer notes:"];

  if (hidden > 0) {
    lines.push(`- Showing latest ${shown.length}; ${hidden} older note(s) omitted.`);
  }

  lines.push(...shown.map((note) => `- ${note}`));

  return lines;
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

function formatMissingVisualText(manifest: DeliveryManifest): string[] {
  const visualRequiredText = manifest.evidence.visualRequiredText ?? [];
  const missing = visualRequiredText.filter((check) => !check.found).slice(0, 3);

  if (missing.length === 0) {
    return [];
  }

  const hidden = visualRequiredText.filter((check) => !check.found).length - missing.length;
  const lines = ["", "Missing visual text:"];

  lines.push(...missing.map((check) => `- "${formatOneLineExcerpt(check.text)}"`));

  if (hidden > 0) {
    lines.push(`- ${hidden} more missing text check${hidden === 1 ? "" : "s"} not shown.`);
  }

  return lines;
}

function formatVisualLayoutIssues(manifest: DeliveryManifest): string[] {
  const visualLayoutIssues = manifest.evidence.visualLayoutIssues ?? [];
  const issues = visualLayoutIssues.slice(0, 3);

  if (issues.length === 0) {
    return [];
  }

  const hidden = visualLayoutIssues.length - issues.length;
  const lines = ["", "Visual layout issues:"];

  lines.push(...issues.map((issue) => {
    const text = issue.text ? ` Text: "${formatOneLineExcerpt(issue.text)}"` : "";

    return `- ${issue.viewport} ${issue.type} at ${issue.selector}: ${formatOneLineExcerpt(issue.message)}${text}`;
  }));

  if (hidden > 0) {
    lines.push(`- ${hidden} more issue${hidden === 1 ? "" : "s"} not shown.`);
  }

  return lines;
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
