import type { ProjectBrief } from "./brief.js";
import type { ExecutionLog } from "./execution-log.js";
import type { AppliedPatchOperation, AppliedPatchReport } from "./patch-set.js";
import type { SourceContextSummaryLog } from "./source-context.js";
import type { VerificationReport } from "./verification.js";
import type { VisualReport } from "./visual.js";

export interface DeliveryReportInput {
  brief: ProjectBrief | undefined;
  deliveryManifestPath?: string;
  implementationPlanPath: string;
  projectBriefPath: string;
  taskPlanPath: string;
  taskPlanMarkdownPath: string;
  patchProposalsDir: string;
  promptArtifactsDir?: string;
  sourceContextSummaryPath?: string;
  sourceContextSummary?: SourceContextSummaryLog;
  executionLogPath: string;
  taskChangelogPath?: string;
  taskChangelog?: TaskChangelogSummary;
  executionLog: ExecutionLog | undefined;
  rollbackReportPath: string;
  verificationReportPath: string;
  verification: VerificationReport | undefined;
  visualReportPath: string;
  visualReport: VisualReport | undefined;
}

export type DeliveryArtifactKind = "directory" | "image" | "json" | "markdown";
export type DeliveryArtifactStatus = "missing" | "not-applicable" | "present";
export type DeliveryReadinessStatus = "needs attention" | "ready for review";

export interface DeliveryArtifactEntry {
  id: string;
  label: string;
  kind: DeliveryArtifactKind;
  path: string;
  status: DeliveryArtifactStatus;
  required: boolean;
  role: string;
  count?: number;
}

export interface TaskChangelogSummary {
  reviewHandoff: {
    executionLogPath?: string;
    verificationReportPath?: string;
    deliveryReportPath?: string;
    reviewerNotes: string[];
  };
  verificationSummary?: {
    status?: string;
    reportPath?: string;
    finishedAt?: string;
    commandsPassed?: string;
    commands: string[];
  };
}

export interface DeliveryManifestInput extends DeliveryReportInput {
  artifactsDir: string;
  deliveryReportPath: string;
  deliveryManifestPath: string;
  generatedAt: string;
  artifacts: DeliveryArtifactEntry[];
}

export interface DeliveryAcceptanceEvidence {
  id: string;
  text: string;
  status: AcceptanceCriterionAssessment["status"];
  evidence: string[];
  knownGaps: string[];
  assumptions: string[];
  manualQa: string[];
}

export type VerificationRemediationCategory =
  | "audit"
  | "build"
  | "e2e"
  | "format"
  | "general"
  | "imports"
  | "lint"
  | "test"
  | "typecheck";

export interface VerificationRemediationPlan {
  category: VerificationRemediationCategory;
  summary: string;
  nextActions: string[];
  artifactReferences: Array<{
    label: string;
    path: string;
  }>;
}

export interface DeliveryManifest {
  version: 1;
  generatedAt: string;
  artifactsDir: string;
  status: {
    readiness: DeliveryReadinessStatus;
    verification: VerificationReport["status"] | "missing";
    visual: VisualReport["status"] | "not-run";
    sourceChanges: "applied" | "not-applied" | "unchanged";
  };
  sourceDocuments?: ProjectBrief["sourceDocuments"];
  artifacts: DeliveryArtifactEntry[];
  counts: {
    acceptanceCriteria: number;
    openQuestions: number;
    deliveryRisks: number;
    highDeliveryRisks: number;
    appliedEntries: number;
    appliedOperations: number;
    touchedFiles: number;
    verificationCommands: number;
    visualScreenshots: number;
    visualLayoutIssues: number;
    visualRequiredText: number;
    designTokens: number;
    reviewerNotes: number;
  };
  evidence: {
    acceptanceCriteria: DeliveryAcceptanceEvidence[];
    verificationCommands: Array<{
      command: string;
      exitCode: number | null;
      durationMs: number;
      remediation?: string;
      remediationPlan?: VerificationRemediationPlan;
      outputExcerpt?: {
        stdout?: string;
        stderr?: string;
        truncatedStdout?: boolean;
        truncatedStderr?: boolean;
      };
    }>;
    visualScreenshots: Array<{
      viewport: string;
      width: number;
      height: number;
      path: string;
      blank?: boolean;
      distinctPixelRatio?: number;
    }>;
    visualRequiredText: Array<{
      text: string;
      found: boolean;
    }>;
    designTokens: Array<{
      category: NonNullable<ProjectBrief["designTokens"]>[number]["category"];
      sourceLine: number;
      name: string;
      value: string;
      summary: string;
    }>;
    appliedChanges: {
      entries: number;
      touchedFiles: string[];
      operations: {
        total: number;
        written: number;
        deleted: number;
        unchanged: number;
      };
      lineDelta: number;
      backupManifestPaths: string[];
    };
    sourceContext?: SourceContextSummaryLog["entries"];
    taskChangelog?: TaskChangelogSummary;
    deliveryRisks: ProjectBrief["deliveryRisks"];
    openQuestions: string[];
  };
}

interface AcceptanceCriterionAssessment {
  status: "ready for review" | "needs evidence" | "needs attention";
  evidence: string[];
  knownGaps: string[];
  assumptions: string[];
  manualQa: string[];
}

export function formatDeliveryReport(input: DeliveryReportInput): string {
  const verification = input.verification;
  const brief = input.brief;

  return `# Delivery Report

Generated by DevFlow.

## Artifacts

- Project brief: \`${input.projectBriefPath}\`
- Implementation plan: \`${input.implementationPlanPath}\`
- Task plan: \`${input.taskPlanPath}\`
- Task plan markdown: \`${input.taskPlanMarkdownPath}\`
- Patch proposals: \`${input.patchProposalsDir}\`
${input.promptArtifactsDir ? `- Prompt artifacts: \`${input.promptArtifactsDir}\`` : ""}
${input.sourceContextSummaryPath ? `- Source context summary: \`${input.sourceContextSummaryPath}\`` : ""}
- Execution log: \`${input.executionLogPath}\`
${input.taskChangelogPath ? `- Task changelog: \`${input.taskChangelogPath}\`` : ""}
- Rollback report: \`${input.rollbackReportPath}\`
- Verification report: \`${input.verificationReportPath}\`
- Visual report: \`${input.visualReportPath}\`
${input.deliveryManifestPath ? `- Delivery manifest: \`${input.deliveryManifestPath}\`` : ""}

## Source Documents

${brief ? `- Requirements: \`${brief.sourceDocuments.requirementsPath}\`
- UI notes: \`${brief.sourceDocuments.uiPath}\`
- API docs: \`${brief.sourceDocuments.apiPath}\`` : "- Project brief was not available."}

## User Stories

${brief ? formatRequirementList(brief.userStories, "No explicit user stories were found in the requirements document.") : "- Project brief was not available."}

## Requirement Constraints

${brief ? formatRequirementList(brief.constraints, "No explicit requirement constraints were found.") : "- Project brief was not available."}

## Acceptance Criteria

${brief ? formatAcceptanceCriteria(brief) : "- Project brief was not available."}

## Acceptance Evidence

${brief ? formatAcceptanceEvidence(input) : "- Project brief was not available."}

## UI State Checklist

${brief ? formatUiStateChecklist(brief) : "- Project brief was not available."}

## Design Assets

${brief ? formatDesignAssets(brief) : "- Project brief was not available."}

## Design Tokens

${brief ? formatDesignTokens(brief) : "- Project brief was not available."}

## API Contracts

${brief ? formatApiContracts(brief) : "- Project brief was not available."}

## API Data Models

${brief ? formatApiDataModels(brief) : "- Project brief was not available."}

## API Error Cases

${brief ? formatApiErrorCases(brief) : "- Project brief was not available."}

## API Auth Requirements

${brief ? formatApiAuthRequirements(brief) : "- Project brief was not available."}

## API State Requirements

${brief ? formatApiStateRequirements(brief) : "- Project brief was not available."}

## Repository Stack

${brief ? formatStack(brief) : "- Stack profile was not available."}

## Source Context Sampling

${formatSourceContextSummary(input.sourceContextSummary)}

## Applied Changes

${input.executionLog ? formatExecutionLog(input.executionLog) : "- Execution log was not available."}

## Review Handoff

${formatReviewHandoff(input)}

## Verification

${verification ? formatVerification(verification, input.verificationReportPath) : "- Verification has not been run yet."}

## Visual Verification

${input.visualReport ? formatVisual(input.visualReport) : "- Visual verification has not been run yet."}

## Risk Assessment

${brief ? formatRiskAssessment(brief) : "- Project brief was not available."}

## Delivery Readiness

${formatDeliveryReadiness(input)}

## Open Questions

${brief?.openQuestions.length ? brief.openQuestions.map((question) => `- ${question}`).join("\n") : "- No open questions recorded."}

## Next Actions

- Review the implementation plan against the source documents.
- Review acceptance criteria against verification and visual evidence.
- Review dry-run patch proposals before source-changing execution.
- Resolve open questions before autonomous code-changing work.
- Run or re-run verification after implementation changes.
${input.visualReport ? "- Review visual screenshots before handoff." : "- Attach screenshots or preview URLs once UI execution exists."}
`;
}

export function createDeliveryManifest(input: DeliveryManifestInput): DeliveryManifest {
  const brief = input.brief;
  const operations = input.executionLog?.entries.flatMap((entry) => entry.operations) ?? [];
  const touchedFiles = unique(operations.filter((operation) => operation.status !== "unchanged").map((operation) => operation.path));
  const highDeliveryRisks = (brief?.deliveryRisks ?? []).filter((risk) => risk.level === "high");
  const deliveryEvidence = collectDeliveryEvidence(input);
  const acceptanceCriteria = brief?.acceptanceCriteria.map((criterion, index) => {
    const assessment = assessAcceptanceCriterion(input, criterion, deliveryEvidence);

    return {
      id: `AC${index + 1}`,
      text: criterion,
      status: assessment.status,
      evidence: assessment.evidence,
      knownGaps: assessment.knownGaps,
      assumptions: assessment.assumptions,
      manualQa: assessment.manualQa
    };
  }) ?? [];

  return {
    version: 1,
    generatedAt: input.generatedAt,
    artifactsDir: input.artifactsDir,
    status: {
      readiness: assessDeliveryReadiness(input).status,
      verification: input.verification?.status ?? "missing",
      visual: input.visualReport?.status ?? "not-run",
      sourceChanges: sourceChangeStatus(input.executionLog)
    },
    sourceDocuments: brief?.sourceDocuments,
    artifacts: input.artifacts,
    counts: {
      acceptanceCriteria: brief?.acceptanceCriteria.length ?? 0,
      openQuestions: brief?.openQuestions.length ?? 0,
      deliveryRisks: brief?.deliveryRisks.length ?? 0,
      highDeliveryRisks: highDeliveryRisks.length,
      appliedEntries: input.executionLog?.entries.length ?? 0,
      appliedOperations: operations.length,
      touchedFiles: touchedFiles.length,
      verificationCommands: input.verification?.results.length ?? 0,
      visualScreenshots: input.visualReport?.screenshots.length ?? 0,
      visualLayoutIssues: input.visualReport?.layoutIssues?.length ?? 0,
      visualRequiredText: input.visualReport?.requiredText.length ?? 0,
      designTokens: brief?.designTokens?.length ?? 0,
      reviewerNotes: input.taskChangelog?.reviewHandoff.reviewerNotes.length ?? 0
    },
    evidence: {
      acceptanceCriteria,
      verificationCommands: input.verification?.results.map((result) => {
        const remediationPlan = verificationRemediationPlanForResult(result, input.verificationReportPath);

        return {
          command: result.command,
          exitCode: result.exitCode,
          durationMs: result.durationMs,
          remediation: remediationPlan?.summary,
          remediationPlan,
          outputExcerpt: result.outputExcerpt
        };
      }) ?? [],
      visualScreenshots: input.visualReport?.screenshots.map((screenshot) => ({
        viewport: screenshot.viewport.name,
        width: screenshot.viewport.width,
        height: screenshot.viewport.height,
        path: screenshot.path,
        blank: screenshot.analysis?.blank,
        distinctPixelRatio: screenshot.analysis?.distinctPixelRatio
      })) ?? [],
      visualRequiredText: input.visualReport?.requiredText.map((check) => ({
        text: check.text,
        found: check.found
      })) ?? [],
      designTokens: brief?.designTokens?.map((token) => ({
        category: token.category,
        sourceLine: token.sourceLine,
        name: token.name,
        value: token.value,
        summary: token.summary
      })) ?? [],
      appliedChanges: {
        entries: input.executionLog?.entries.length ?? 0,
        touchedFiles,
        operations: {
          total: operations.length,
          written: operations.filter((operation) => operation.status === "written").length,
          deleted: operations.filter((operation) => operation.status === "deleted").length,
          unchanged: operations.filter((operation) => operation.status === "unchanged").length
        },
        lineDelta: operations.reduce((total, operation) => total + (operation.lineDelta ?? 0), 0),
        backupManifestPaths: input.executionLog?.entries.flatMap((entry) => entry.backupManifestPath ? [entry.backupManifestPath] : []) ?? []
      },
      sourceContext: input.sourceContextSummary?.entries ?? [],
      taskChangelog: input.taskChangelog,
      deliveryRisks: brief?.deliveryRisks ?? [],
      openQuestions: brief?.openQuestions ?? []
    }
  };
}

const taskChangelogVerificationSummaryStart = "<!-- devflow-verification-summary:start -->";
const taskChangelogVerificationSummaryEnd = "<!-- devflow-verification-summary:end -->";

export function parseTaskChangelogSummary(markdown: string): TaskChangelogSummary {
  const reviewHandoff = parseReviewHandoff(extractMarkdownSection(markdown, "Review Handoff"));
  const verificationSummary = parseTaskChangelogVerificationSummary(markdown);

  return {
    reviewHandoff,
    verificationSummary
  };
}

function parseReviewHandoff(section: string | undefined): TaskChangelogSummary["reviewHandoff"] {
  const lines = section?.split(/\r?\n/) ?? [];
  const reviewerNotes: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s*-\s+Reviewer notes:\s*$/.test(lines[index] ?? "")) {
      for (let noteIndex = index + 1; noteIndex < lines.length; noteIndex += 1) {
        const noteMatch = /^\s{2,}-\s+(.+?)\s*$/.exec(lines[noteIndex] ?? "");

        if (!noteMatch) {
          break;
        }

        reviewerNotes.push(normalizeWhitespace(noteMatch[1]));
      }
    }
  }

  return {
    executionLogPath: parseBulletValue(lines, "Execution log"),
    verificationReportPath: parseBulletValue(lines, "Verification report"),
    deliveryReportPath: parseBulletValue(lines, "Delivery report"),
    reviewerNotes
  };
}

function parseTaskChangelogVerificationSummary(markdown: string): TaskChangelogSummary["verificationSummary"] | undefined {
  const block = extractBetweenMarkers(
    markdown,
    taskChangelogVerificationSummaryStart,
    taskChangelogVerificationSummaryEnd
  );

  if (!block) {
    return undefined;
  }

  const section = extractMarkdownSection(block, "Verification Summary") ?? block;
  const lines = section.split(/\r?\n/);
  const commands = readIndentedBulletsAfter(lines, "Commands").map(stripInlineCodeFromSummary);

  return {
    status: parseBulletValue(lines, "Status"),
    reportPath: parseBulletValue(lines, "Report"),
    finishedAt: parseBulletValue(lines, "Finished at"),
    commandsPassed: parseBulletValue(lines, "Commands passed"),
    commands
  };
}

function extractMarkdownSection(markdown: string, heading: string): string | undefined {
  const lines = markdown.split(/\r?\n/);
  const headingLine = `## ${heading}`;
  const start = lines.findIndex((line) => line.trim() === headingLine);

  if (start === -1) {
    return undefined;
  }

  const bodyStart = start + 1;
  const end = lines.findIndex((line, index) => index > start && /^##\s+/.test(line));
  const body = lines.slice(bodyStart, end === -1 ? undefined : end).join("\n").trim();

  return body || undefined;
}

function extractBetweenMarkers(markdown: string, startMarker: string, endMarker: string): string | undefined {
  const start = markdown.indexOf(startMarker);

  if (start === -1) {
    return undefined;
  }

  const contentStart = start + startMarker.length;
  const end = markdown.indexOf(endMarker, contentStart);

  if (end === -1) {
    return undefined;
  }

  const block = markdown.slice(contentStart, end).trim();

  return block || undefined;
}

function parseBulletValue(lines: string[], label: string): string | undefined {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^\\s*-\\s+${escapedLabel}:\\s+(.+?)\\s*$`);

  for (const line of lines) {
    const match = pattern.exec(line);

    if (match) {
      return stripInlineCode(match[1]);
    }
  }

  return undefined;
}

function readIndentedBulletsAfter(lines: string[], label: string): string[] {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startPattern = new RegExp(`^\\s*-\\s+${escapedLabel}:\\s*$`);
  const start = lines.findIndex((line) => startPattern.test(line));

  if (start === -1) {
    return [];
  }

  const values: string[] = [];

  for (const line of lines.slice(start + 1)) {
    const match = /^\s{2,}-\s+(.+?)\s*$/.exec(line);

    if (!match) {
      break;
    }

    values.push(normalizeWhitespace(match[1]));
  }

  return values;
}

function stripInlineCode(value: string): string {
  const trimmed = value.trim();
  const match = /^(`+)([\s\S]*)\1$/.exec(trimmed);

  return match ? match[2] : trimmed;
}

function stripInlineCodeFromSummary(value: string): string {
  const match = /^(`+)([\s\S]*?)\1(: .*)$/.exec(value);

  return match ? `${match[2]}${match[3]}` : stripInlineCode(value);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatAcceptanceCriteria(brief: ProjectBrief): string {
  if (brief.acceptanceCriteria.length === 0) {
    return "- No explicit acceptance criteria were found in the requirements document.";
  }

  return brief.acceptanceCriteria.map((criterion) => `- ${criterion}`).join("\n");
}

function formatAcceptanceEvidence(input: DeliveryReportInput): string {
  const brief = input.brief;
  if (!brief) {
    return "- Project brief was not available.";
  }

  if (brief.acceptanceCriteria.length === 0) {
    return "- No explicit acceptance criteria were found in the requirements document.";
  }

  const evidence = collectDeliveryEvidence(input);

  return brief.acceptanceCriteria.map((criterion, index) => {
    const assessment = assessAcceptanceCriterion(input, criterion, evidence);
    const lines = [`- AC${index + 1}: ${criterion}`, `  - Status: ${assessment.status}`];

    lines.push(...formatAssessmentLines("Evidence", assessment.evidence));
    lines.push(...formatAssessmentLines("Known gap", assessment.knownGaps));
    lines.push(...formatAssessmentLines("Assumption", assessment.assumptions));
    lines.push(...formatAssessmentLines("Manual QA", assessment.manualQa));

    return lines.join("\n");
  }).join("\n");
}

function assessAcceptanceCriterion(
  input: DeliveryReportInput,
  criterion: string,
  evidence: string[]
): AcceptanceCriterionAssessment {
  const knownGaps: string[] = [];
  const assumptions: string[] = [];
  const manualQa = manualQaForCriterion(criterion);

  if (!input.executionLog?.entries.length) {
    knownGaps.push("No source-changing execution log is available for this delivery.");
  }

  if (!input.verification) {
    knownGaps.push("Verification has not been run.");
  } else if (input.verification.status !== "passed") {
    knownGaps.push(`Verification status is ${input.verification.status}.`);
  }

  if (!input.visualReport) {
    knownGaps.push("Visual verification has not been run for a preview URL.");
  } else {
    if (input.visualReport.status !== "passed") {
      knownGaps.push(`Visual verification status is ${input.visualReport.status}.`);
    }

    const missingText = input.visualReport.requiredText.filter((check) => !check.found).map((check) => `"${check.text}"`);
    if (missingText.length > 0) {
      knownGaps.push(`Visual required text missing: ${missingText.join(", ")}.`);
    }

    if (input.visualReport.requiredText.length === 0) {
      assumptions.push("Screenshots were captured without required text checks tied to this criterion.");
    }
  }

  if (input.brief?.openQuestions.length) {
    knownGaps.push(`${input.brief.openQuestions.length} open question(s) remain.`);
  }

  if (evidence.length === 0) {
    knownGaps.push("No verification, visual, or applied-change evidence was found.");
  } else {
    assumptions.push("Delivery-level evidence applies to this criterion; reviewers should confirm the specific behavior is covered.");
  }

  return {
    status: acceptanceStatus(knownGaps, evidence),
    evidence,
    knownGaps,
    assumptions,
    manualQa
  };
}

function acceptanceStatus(knownGaps: string[], evidence: string[]): AcceptanceCriterionAssessment["status"] {
  const hasFailedEvidence = knownGaps.some(
    (gap) =>
      gap.startsWith("Verification status is") ||
      gap.startsWith("Visual verification status is") ||
      gap.startsWith("Visual required text missing") ||
      gap.includes("open question")
  );

  if (hasFailedEvidence) {
    return "needs attention";
  }

  return evidence.length && knownGaps.length === 0 ? "ready for review" : "needs evidence";
}

function formatAssessmentLines(label: string, items: string[]): string[] {
  return items.length ? items.map((item) => `  - ${label}: ${item}`) : [];
}

function manualQaForCriterion(criterion: string): string[] {
  const normalized = criterion.toLowerCase();
  const quotedCriterion = `"${truncateInline(criterion, 96)}"`;
  const lines: string[] = [];

  if (isVerificationCriterion(criterion, normalized)) {
    lines.push(`Review verification output for ${quotedCriterion} and rerun the matching command before handoff.`);
  } else {
    lines.push(`Exercise the user path for ${quotedCriterion} in the implemented UI.`);
  }

  if (/\b(responsive|desktop|tablet|mobile|width|viewport|overlap|layout|text)\b/.test(normalized)) {
    lines.push("Confirm the relevant responsive viewport, layout, and text-fit behavior.");
  } else if (/\b(loading|empty|error|success|state|states)\b/.test(normalized)) {
    lines.push("Confirm loading, empty, error, and success states where they apply.");
  } else {
    lines.push("Capture reviewer notes or screenshots for behavior not covered by automated checks.");
  }

  return lines;
}

function isVerificationCriterion(criterion: string, normalized: string): boolean {
  return (
    /`[^`]*(?:npm|pnpm|yarn|bun|node|vite|vitest|jest|playwright|tsc|eslint)[^`]*`/.test(criterion) ||
    /\b(?:npm run|pnpm|yarn|bun)\b/.test(normalized) ||
    /\b(?:lint|typecheck|verification|verify|test command|build command|production build|app builds|project builds|build succeeds)\b/.test(normalized)
  );
}

function collectDeliveryEvidence(input: DeliveryReportInput): string[] {
  const evidence: string[] = [];

  if (input.executionLog?.entries.length) {
    const operations = input.executionLog.entries.flatMap((entry) => entry.operations);
    const touchedFiles = unique(operations.filter((operation) => operation.status !== "unchanged").map((operation) => operation.path));
    evidence.push(
      touchedFiles.length
        ? `Source-changing execution recorded ${input.executionLog.entries.length} entr${input.executionLog.entries.length === 1 ? "y" : "ies"} touching ${formatTouchedFiles(touchedFiles)}.`
        : `Source-changing execution recorded ${input.executionLog.entries.length} entr${input.executionLog.entries.length === 1 ? "y" : "ies"}.`
    );
  }

  if (input.verification) {
    const commands = input.verification.results.slice(0, 3).map((result) => `\`${result.command}\` exit ${result.exitCode ?? "unknown"}`);
    const omitted = input.verification.results.length - commands.length;
    const commandSummary = commands.length
      ? `${commands.join(", ")}${omitted > 0 ? `, and ${omitted} more` : ""}`
      : "no commands recorded";

    evidence.push(`Verification ${input.verification.status}: ${commandSummary}.`);
  }

  if (input.visualReport) {
    const foundText = input.visualReport.requiredText.filter((check) => check.found).length;
    const textSummary = input.visualReport.requiredText.length
      ? `${foundText}/${input.visualReport.requiredText.length} required text checks found`
      : "no required text checks";

    evidence.push(`Visual verification ${input.visualReport.status}: ${input.visualReport.screenshots.length} screenshot(s), ${textSummary}.`);
  }

  return evidence;
}

function formatRequirementList(items: string[], emptyMessage: string): string {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : `- ${emptyMessage}`;
}

function formatDeliveryReadiness(input: DeliveryReportInput): string {
  const assessment = assessDeliveryReadiness(input);
  const lines = [`- Status: ${assessment.status}`, ...assessment.evidence.map((item) => `- Evidence: ${item}`)];

  if (assessment.attention.length) {
    lines.push(...assessment.attention.map((item) => `- Attention: ${item}`));
  }

  return lines.join("\n");
}

function formatReviewHandoff(input: DeliveryReportInput): string {
  const changelog = input.taskChangelog;

  if (!changelog) {
    return "- Task changelog was not available.";
  }

  const lines = [input.taskChangelogPath ? `- Task changelog: \`${input.taskChangelogPath}\`` : undefined];
  const review = changelog.reviewHandoff;

  if (review.executionLogPath) {
    lines.push(`- Execution log: \`${review.executionLogPath}\``);
  }

  if (review.verificationReportPath) {
    lines.push(`- Verification report: \`${review.verificationReportPath}\``);
  }

  if (review.deliveryReportPath) {
    lines.push(`- Delivery report: \`${review.deliveryReportPath}\``);
  }

  if (review.reviewerNotes.length) {
    lines.push("- Reviewer notes:", ...review.reviewerNotes.map((note) => `  - ${note}`));
  }

  if (changelog.verificationSummary) {
    lines.push("- Latest changelog verification:");

    if (changelog.verificationSummary.status) {
      lines.push(`  - Status: ${changelog.verificationSummary.status}`);
    }

    if (changelog.verificationSummary.reportPath) {
      lines.push(`  - Report: \`${changelog.verificationSummary.reportPath}\``);
    }

    if (changelog.verificationSummary.finishedAt) {
      lines.push(`  - Finished at: ${changelog.verificationSummary.finishedAt}`);
    }

    if (changelog.verificationSummary.commandsPassed) {
      lines.push(`  - Commands passed: ${changelog.verificationSummary.commandsPassed}`);
    }

    if (changelog.verificationSummary.commands.length) {
      lines.push("  - Commands:");
      lines.push(...changelog.verificationSummary.commands.map((command) => `    - ${command}`));
    }
  }

  const rendered = lines.filter((line): line is string => Boolean(line));

  return rendered.length ? rendered.join("\n") : "- Task changelog did not include a review handoff or verification summary.";
}

function assessDeliveryReadiness(input: DeliveryReportInput): {
  status: DeliveryReadinessStatus;
  evidence: string[];
  attention: string[];
} {
  const blockers: string[] = [];
  const evidence: string[] = [];

  if (!input.brief) {
    blockers.push("Project brief was not available.");
  } else {
    const highRisks = (input.brief.deliveryRisks ?? []).filter((risk) => risk.level === "high");
    const mediumRisks = (input.brief.deliveryRisks ?? []).filter((risk) => risk.level === "medium");

    if (input.brief.acceptanceCriteria.length === 0) {
      blockers.push("Requirements do not include explicit acceptance criteria.");
    } else {
      evidence.push(`${input.brief.acceptanceCriteria.length} acceptance criteria recorded.`);
    }

    if (input.brief.openQuestions.length > 0) {
      blockers.push(`${input.brief.openQuestions.length} open question(s) remain.`);
    }

    if (highRisks.length > 0) {
      blockers.push(`${highRisks.length} high delivery risk(s) remain.`);
    }

    if (mediumRisks.length > 0) {
      evidence.push(`${mediumRisks.length} medium delivery risk(s) recorded for review.`);
    }
  }

  if (!input.verification) {
    blockers.push("Verification has not been run.");
  } else if (input.verification.status !== "passed") {
    blockers.push(`Verification status is ${input.verification.status}.`);
  } else {
    evidence.push("Verification passed.");
  }

  if (!input.visualReport) {
    evidence.push("Visual verification was not run for this delivery.");
  } else if (input.visualReport.status !== "passed") {
    blockers.push(`Visual verification status is ${input.visualReport.status}.`);
  } else {
    evidence.push("Visual verification passed.");
  }

  const status = blockers.length ? "needs attention" : "ready for review";

  return {
    status,
    evidence,
    attention: blockers
  };
}

function formatStack(brief: ProjectBrief): string {
  const stack = brief.stack;
  const lines = [
    stack.packageManager ? `Package manager: ${stack.packageManager}` : undefined,
    stack.runtimes.length ? `Runtime: ${stack.runtimes.join(", ")}` : undefined,
    stack.frameworks.length ? `Frameworks: ${stack.frameworks.join(", ")}` : undefined,
    stack.buildTools.length ? `Build tools: ${stack.buildTools.join(", ")}` : undefined,
    stack.styling.length ? `Styling: ${stack.styling.join(", ")}` : undefined,
    stack.testing.length ? `Testing: ${stack.testing.join(", ")}` : undefined,
    stack.workspacePackages?.length ? `Workspace packages: ${formatWorkspacePackages(stack.workspacePackages)}` : undefined,
    stack.sourceDirectories.length ? `Source directories: ${stack.sourceDirectories.join(", ")}` : undefined
  ].filter((line): line is string => Boolean(line));

  return lines.length ? lines.map((line) => `- ${line}`).join("\n") : "- No stack signals recorded.";
}

function formatWorkspacePackages(workspacePackages: NonNullable<ProjectBrief["stack"]["workspacePackages"]>): string {
  return workspacePackages.map((workspacePackage) =>
    workspacePackage.name ? `${workspacePackage.path} (${workspacePackage.name})` : workspacePackage.path
  ).join(", ");
}

function formatSourceContextSummary(summary: SourceContextSummaryLog | undefined): string {
  if (!summary || summary.entries.length === 0) {
    return "- No source-context sampling summary was available for this delivery.";
  }

  const recentEntries = summary.entries.slice(-5);
  const omitted = summary.entries.length - recentEntries.length;
  const lines = [
    `- Sampling runs recorded: ${summary.entries.length}`,
    omitted > 0 ? `- Showing latest ${recentEntries.length}; ${omitted} older run(s) omitted.` : undefined,
    ...recentEntries.flatMap((entry) => {
      const unit = entry.unit ? `, unit ${entry.unit.id} [${entry.unit.kind}] ${entry.unit.title}` : "";
      const sampled = entry.entries.length
        ? entry.entries.map((item) => `\`${item.path}\` (${item.kind}${item.truncated ? ", truncated" : ""})`).join(", ")
        : "none";
      const details = [
        `- ${entry.mode} ${entry.taskId}${unit} at ${entry.generatedAt}`,
        `  - Sampled: ${sampled}`,
        entry.omitted.length ? `  - Omitted: ${entry.omitted.slice(0, 4).join("; ")}${entry.omitted.length > 4 ? "; ..." : ""}` : undefined
      ].filter((line): line is string => Boolean(line));

      return details;
    })
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}

function formatUiStateChecklist(brief: ProjectBrief): string {
  const items = brief.uiStateChecklist ?? [];

  if (items.length === 0) {
    return "- No UI state checklist items were extracted from the UI notes.";
  }

  return items
    .map((item) => `- [${item.kind}] Line ${item.sourceLine}: ${item.summary}`)
    .join("\n");
}

function formatRiskAssessment(brief: ProjectBrief): string {
  const risks = brief.deliveryRisks ?? [];

  if (risks.length === 0) {
    return "- No delivery risks were detected from the current project brief.";
  }

  return risks.map((risk) => {
    const source = risk.sourceLine === undefined ? risk.source : `${risk.source}:${risk.sourceLine}`;

    return `- [${risk.level}] ${source}: ${risk.summary} Recommendation: ${risk.recommendation}`;
  }).join("\n");
}

function formatDesignAssets(brief: ProjectBrief): string {
  if (brief.designAssets.length === 0) {
    return "- No UI design assets were referenced from the UI notes.";
  }

  return brief.designAssets.map((asset) => {
    const details = [
      asset.kind,
      asset.altText ? `alt: ${asset.altText}` : undefined,
      asset.resolvedPath ? `resolved: ${asset.resolvedPath}` : undefined,
      asset.exists === undefined ? undefined : `exists: ${asset.exists ? "yes" : "no"}`
    ].filter((value): value is string => Boolean(value));
    const metadata = formatDesignAssetMetadata(asset.metadata);

    return [
      `- \`${asset.reference}\`: ${details.join(", ")}`,
      ...metadata.map((line) => `  - ${line}`)
    ].join("\n");
  }).join("\n");
}

function formatDesignTokens(brief: ProjectBrief): string {
  const tokens = brief.designTokens ?? [];

  if (tokens.length === 0) {
    return "- No structured design tokens were extracted from the UI notes.";
  }

  return tokens.map((token) => `- [${token.category}] ${token.name}: ${token.value} (ui:${token.sourceLine})`).join("\n");
}

function formatDesignAssetMetadata(metadata: ProjectBrief["designAssets"][number]["metadata"]): string[] {
  if (!metadata) {
    return [];
  }

  return [
    metadata.width || metadata.height ? `Dimensions: ${metadata.width ?? "unknown"}x${metadata.height ?? "unknown"}` : undefined,
    metadata.viewBox ? `ViewBox: ${metadata.viewBox}` : undefined,
    metadata.title ? `Title: ${metadata.title}` : undefined,
    metadata.description ? `Description: ${metadata.description}` : undefined,
    metadata.colors?.length ? `Colors: ${metadata.colors.join(", ")}` : undefined,
    metadata.textSnippets?.length ? `Text snippets: ${metadata.textSnippets.join("; ")}` : undefined
  ].filter((line): line is string => Boolean(line));
}

function formatApiContracts(brief: ProjectBrief): string {
  if (brief.apiContracts.length === 0) {
    return "- No recognizable HTTP endpoint contracts were found in the API docs.";
  }

  return brief.apiContracts
    .map((contract) => {
      const parameters = formatApiParameterList(contract.parameters);

      return `- \`${contract.method} ${contract.path}\` (line ${contract.sourceLine}): ${contract.summary}${parameters ? ` Parameters: ${parameters}.` : ""}`;
    })
    .join("\n");
}

function formatApiParameterList(parameters: ProjectBrief["apiContracts"][number]["parameters"]): string | undefined {
  if (!parameters?.length) {
    return undefined;
  }

  return parameters.map((parameter) => {
    const details = [
      parameter.schema,
      parameter.required === undefined ? undefined : parameter.required ? "required" : "optional",
      parameter.defaultValue ? `default ${parameter.defaultValue}` : undefined
    ].filter((item): item is string => Boolean(item));

    return `${parameter.in} ${parameter.name}${details.length ? ` (${details.join(", ")})` : ""}`;
  }).join("; ");
}

function formatApiDataModels(brief: ProjectBrief): string {
  if (brief.apiDataModels.length === 0 && brief.invalidApiDataModels.length === 0) {
    return "- No JSON or OpenAPI data model blocks were found in the API docs.";
  }

  const models = brief.apiDataModels.map((model) => {
    const fields = model.fields.length ? model.fields.join(", ") : "no fields listed";

    return `- \`${model.name}\` (line ${model.sourceLine}): ${fields}`;
  });
  const invalid = brief.invalidApiDataModels.map(
    (model) => `- Invalid API data model at line ${model.sourceLine}: ${model.error}`
  );

  return [...models, ...invalid].join("\n");
}

function formatApiErrorCases(brief: ProjectBrief): string {
  if (brief.apiErrorCases.length === 0) {
    return "- No explicit API error cases were found.";
  }

  return brief.apiErrorCases.map((item) => `- Line ${item.sourceLine}: ${item.summary}`).join("\n");
}

function formatApiAuthRequirements(brief: ProjectBrief): string {
  if (brief.apiAuthRequirements.length === 0) {
    return "- No explicit API authentication or authorization requirements were found.";
  }

  return brief.apiAuthRequirements.map((item) => `- Line ${item.sourceLine}: ${item.summary}`).join("\n");
}

function formatApiStateRequirements(brief: ProjectBrief): string {
  const items = brief.apiStateRequirements ?? [];

  if (items.length === 0) {
    return "- No explicit API-driven loading, empty, cache, refresh, or data freshness requirements were found.";
  }

  return items.map((item) => `- Line ${item.sourceLine}: ${item.summary}`).join("\n");
}

function formatVerification(report: VerificationReport, verificationReportPath?: string): string {
  if (report.status === "skipped") {
    return "- Verification was skipped because no commands were available.";
  }

  const summary = [`- Status: ${report.status}`, `- Started: ${report.startedAt}`, `- Finished: ${report.finishedAt}`];
  const commands = report.results.map(
    (result) => `- \`${result.command}\`: exit ${result.exitCode ?? "unknown"} in ${result.durationMs}ms`
  );
  const failureDetails = report.results.flatMap((result) => formatVerificationFailureDetails(result, verificationReportPath));

  return [...summary, ...commands, ...failureDetails].join("\n");
}

function formatVerificationFailureDetails(result: VerificationReport["results"][number], verificationReportPath?: string): string[] {
  if (result.exitCode === 0) {
    return [];
  }

  const lines: string[] = [];

  if (result.outputExcerpt) {
    lines.push(`- Failure output for \`${result.command}\`:`);

    if (result.outputExcerpt.stderr) {
      lines.push("  - stderr excerpt:", formatIndentedCodeBlock(result.outputExcerpt.stderr, "    "));
    }

    if (result.outputExcerpt.stdout) {
      lines.push("  - stdout excerpt:", formatIndentedCodeBlock(result.outputExcerpt.stdout, "    "));
    }

    if (result.outputExcerpt.truncatedStderr || result.outputExcerpt.truncatedStdout) {
      lines.push("  - Output excerpt was truncated.");
    }
  }

  const remediationPlan = verificationRemediationPlanForResult(result, verificationReportPath);

  if (remediationPlan) {
    lines.push(`- Suggested follow-up for \`${result.command}\`: ${remediationPlan.summary}`);
    lines.push("  - Remediation plan:", ...remediationPlan.nextActions.map((action) => `    - ${action}`));

    if (remediationPlan.artifactReferences.length > 0) {
      lines.push(
        "  - Related artifacts:",
        ...remediationPlan.artifactReferences.map((artifact) => `    - ${artifact.label}: \`${artifact.path}\``)
      );
    }
  }

  return lines;
}

function verificationRemediationForResult(result: VerificationReport["results"][number]): string | undefined {
  return verificationRemediationPlanForResult(result)?.summary;
}

function verificationRemediationPlanForResult(
  result: VerificationReport["results"][number],
  verificationReportPath?: string
): VerificationRemediationPlan | undefined {
  if (result.exitCode === 0) {
    return undefined;
  }

  const rerunAction = `Rerun \`${result.command}\` after the targeted fix.`;
  const command = result.command.toLowerCase();
  const output = [
    result.stdout,
    result.stderr,
    result.outputExcerpt?.stdout,
    result.outputExcerpt?.stderr
  ].filter((value): value is string => Boolean(value)).join("\n").toLowerCase();
  const signal = `${command}\n${output}`;

  if (/\b(missing export|no exported member|module not found|cannot find module|failed to resolve import|cannot resolve)\b/.test(signal)) {
    return createVerificationRemediationPlan({
      category: "imports",
      summary: "Fix missing imports, exports, or module paths, then rerun the failing verification command.",
      nextActions: [
        "Inspect the first unresolved module, export, or import path in the failure output.",
        "Update the owning module export or correct the consumer import path.",
        rerunAction
      ],
      verificationReportPath
    });
  }

  if (/\b(audit|advisory|vulnerabilit|security)\b/.test(command)) {
    return createVerificationRemediationPlan({
      category: "audit",
      summary: "Review dependency advisories, update or patch affected packages, then rerun the audit command.",
      nextActions: [
        "Read the advisory IDs and affected package ranges in the audit output.",
        "Update, override, or patch the affected dependencies with an intentional changelog note.",
        rerunAction
      ],
      verificationReportPath
    });
  }

  if (/\b(prettier|format|format:check|check:format)\b/.test(command)) {
    return createVerificationRemediationPlan({
      category: "format",
      summary: "Run the project formatter or fix formatting drift, then rerun the formatting check.",
      nextActions: [
        "Run the repository formatter command or apply the reported formatting edits.",
        "Review the resulting diff to confirm only formatting changed.",
        rerunAction
      ],
      verificationReportPath
    });
  }

  if (/\b(eslint|lint|biome)\b/.test(command)) {
    return createVerificationRemediationPlan({
      category: "lint",
      summary: "Fix lint diagnostics or adjust the relevant rule intentionally, then rerun the lint command.",
      nextActions: [
        "Group lint diagnostics by file and rule so repeated issues can be fixed together.",
        "Update implementation code or document an intentional rule exception.",
        rerunAction
      ],
      verificationReportPath
    });
  }

  if (/\b(typecheck|type-check|type:check|check:types|tsc|vue-tsc|svelte-check|typescript|ts\d{4})\b/.test(signal)) {
    return createVerificationRemediationPlan({
      category: "typecheck",
      summary: "Resolve TypeScript or framework type-checking errors, then rerun the type check.",
      nextActions: [
        "Start with the earliest type error because later diagnostics may be cascading failures.",
        "Align component props, API models, route params, or generated types with the implementation.",
        rerunAction
      ],
      verificationReportPath
    });
  }

  if (/\b(playwright|cypress|e2e)\b/.test(command)) {
    return createVerificationRemediationPlan({
      category: "e2e",
      summary: "Inspect E2E failure artifacts such as screenshots, traces, or videos, fix the user flow, then rerun the E2E command.",
      nextActions: [
        "Open the failing scenario output and any screenshots, traces, or videos produced by the runner.",
        "Fix the broken user flow, selector, routing state, or async loading expectation.",
        rerunAction
      ],
      verificationReportPath
    });
  }

  if (/\b(vitest|jest|node --test|test|unit|component|integration|coverage)\b/.test(command)) {
    return createVerificationRemediationPlan({
      category: "test",
      summary: "Inspect failing tests or coverage thresholds, update the implementation or tests, then rerun the test command.",
      nextActions: [
        "Identify the first failing assertion or coverage threshold from the test output.",
        "Update the implementation or the test expectation so it matches the accepted behavior.",
        rerunAction
      ],
      verificationReportPath
    });
  }

  if (/\b(build|compile|vite|next|nuxt|astro|ng build|angular)\b/.test(command)) {
    return createVerificationRemediationPlan({
      category: "build",
      summary: "Resolve bundler or production build errors, then rerun the build command.",
      nextActions: [
        "Find the first bundler, compiler, or framework error in the build output.",
        "Fix the source, config, environment, or asset path that prevents production compilation.",
        rerunAction
      ],
      verificationReportPath
    });
  }

  return createVerificationRemediationPlan({
    category: "general",
    summary: "Inspect the full verification report, address the failing command, then rerun verification before handoff.",
    nextActions: [
      "Open the full verification report and identify the earliest actionable failure.",
      "Apply the smallest fix that addresses the failing command without masking unrelated issues.",
      rerunAction
    ],
    verificationReportPath
  });
}

function createVerificationRemediationPlan(input: {
  category: VerificationRemediationCategory;
  summary: string;
  nextActions: string[];
  verificationReportPath?: string;
}): VerificationRemediationPlan {
  return {
    category: input.category,
    summary: input.summary,
    nextActions: input.nextActions,
    artifactReferences: input.verificationReportPath
      ? [{ label: "Full verification report", path: input.verificationReportPath }]
      : []
  };
}

function formatIndentedCodeBlock(value: string, indent: string): string {
  const body = value.split(/\r?\n/).map((line) => `${indent}${line}`).join("\n");

  return `${indent}\`\`\`text\n${body}\n${indent}\`\`\``;
}

function formatExecutionLog(log: ExecutionLog): string {
  if (log.entries.length === 0) {
    return "- No source-changing patch sets have been applied.";
  }

  const recentEntries = log.entries.slice(-5);
  const omitted = log.entries.length - recentEntries.length;
  const summary = formatExecutionSummary(log);

  if (omitted > 0) {
    summary.push(`- Showing latest ${recentEntries.length}; ${omitted} older entries omitted.`);
  }

  return [...summary, ...recentEntries.map(formatExecutionEntry)].join("\n");
}

function formatExecutionEntry(entry: AppliedPatchReport): string {
  const lines = [
    `- ${entry.taskId}: ${entry.status} at ${entry.appliedAt}`,
    `  - Summary: ${entry.summary}`,
    entry.backupManifestPath ? `  - Backup: \`${entry.backupManifestPath}\`` : undefined,
    ...entry.operations.map(formatPatchOperation)
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}

function formatPatchOperation(operation: AppliedPatchOperation): string {
  const details = [
    operation.status,
    `${operation.bytesWritten} bytes`,
    operation.replacements === undefined ? undefined : `${operation.replacements} replacements`,
    formatLineStats(operation)
  ].filter((value): value is string => Boolean(value));

  return `  - ${operation.type} \`${operation.path}\`: ${details.join(", ")}`;
}

function formatExecutionSummary(log: ExecutionLog): string[] {
  const operations = log.entries.flatMap((entry) => entry.operations);
  const touchedFiles = unique(operations.map((operation) => operation.path));
  const writtenOperations = operations.filter((operation) => operation.status === "written").length;
  const deletedOperations = operations.filter((operation) => operation.status === "deleted").length;
  const unchangedOperations = operations.filter((operation) => operation.status === "unchanged").length;
  const backups = log.entries.filter((entry) => Boolean(entry.backupManifestPath)).length;

  return [
    `- Entries recorded: ${log.entries.length}`,
    touchedFiles.length ? `- Files touched: ${formatTouchedFiles(touchedFiles)}` : undefined,
    `- Written operations: ${writtenOperations}`,
    deletedOperations ? `- Deleted operations: ${deletedOperations}` : undefined,
    `- Unchanged operations: ${unchangedOperations}`,
    backups ? `- Backups recorded: ${backups}` : undefined
  ].filter((line): line is string => Boolean(line));
}

function formatTouchedFiles(paths: string[]): string {
  const shown = paths.slice(0, 8).map((path) => `\`${path}\``).join(", ");
  const omitted = paths.length - 8;

  return omitted > 0 ? `${shown}, and ${omitted} more` : shown;
}

function sourceChangeStatus(log: ExecutionLog | undefined): DeliveryManifest["status"]["sourceChanges"] {
  if (!log?.entries.length) {
    return "not-applied";
  }

  return log.entries.some((entry) => entry.status === "applied") ? "applied" : "unchanged";
}

function truncateInline(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function formatLineStats(operation: AppliedPatchOperation): string | undefined {
  if (operation.linesBefore === undefined || operation.linesAfter === undefined || operation.lineDelta === undefined) {
    return undefined;
  }

  return `lines ${operation.linesBefore}->${operation.linesAfter} (${formatSignedNumber(operation.lineDelta)})`;
}

function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function formatVisual(report: VisualReport): string {
  const summary = [`- Status: ${report.status}`, `- URL: ${report.url}`];
  const screenshots = report.screenshots.map(
    (screenshot) => {
      const analysis = screenshot.analysis
        ? `, blank: ${screenshot.analysis.blank ? "yes" : "no"}, distinct pixels: ${formatRatio(screenshot.analysis.distinctPixelRatio)}`
        : "";

      return [
        `- ${screenshot.viewport.name} ${screenshot.viewport.width}x${screenshot.viewport.height}: \`${screenshot.path}\`${analysis}`,
        `  - Screenshot: ![${screenshot.viewport.name} screenshot](${screenshot.path})`
      ].join("\n");
    }
  );
  const textChecks = report.requiredText.map((check) => `- Text "${check.text}": ${check.found ? "found" : "missing"}`);
  const layoutIssues = report.layoutIssues?.length
    ? report.layoutIssues.map(
      (issue) =>
        `- Layout ${issue.viewport.name} ${issue.type} at ${issue.selector}: ${issue.message}${issue.text ? ` Text: "${issue.text}"` : ""}`
    )
    : ["- Layout issues: none"];

  return [...summary, ...screenshots, ...textChecks, ...layoutIssues].join("\n");
}

function formatRatio(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}
