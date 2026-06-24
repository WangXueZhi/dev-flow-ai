import type { ProjectBrief } from "./brief.js";
import { patchSetLimits, type PatchSet } from "./patch-set.js";
import { formatSourceContextForPrompt, type SourceContext } from "./source-context.js";
import type { ImplementationTask, ImplementationUnit } from "./tasks.js";
import { createImplementationTargetProfile, type ImplementationTargetProfile } from "./target-profile.js";

export interface DryRunProposal {
  taskId: string;
  title: string;
  targetUnit?: ImplementationUnit;
  targetProfile: ImplementationTargetProfile;
  summary: string;
  suggestedFiles: string[];
  steps: string[];
  verification: string[];
  uiChecklist: string[];
  deliveryRisks: string[];
  guardrails: string[];
}

export const dryRunSystemPrompt =
  "You are DevFlow's implementation executor. Produce a reviewable dry-run patch proposal in Markdown. Do not claim that files were changed. Do not output destructive commands. Ground every step in the task, project brief, repository conventions, and verification commands.";

export const patchSetSystemPrompt =
  "You are DevFlow's source-changing executor. Return only strict JSON matching the requested PatchSet schema. Do not wrap the JSON in Markdown. Use relative paths only. Do not target .git or node_modules. Keep changes small, reviewable, and grounded in the task acceptance criteria.";

export function buildDryRunPrompt(
  task: ImplementationTask,
  brief: ProjectBrief,
  unit?: ImplementationUnit,
  sourceContext?: SourceContext
): string {
  return `Create a dry-run patch proposal for this implementation task.

The proposal must include:
- Summary
- Candidate files
- Proposed code-change steps
- UI checklist coverage
- Delivery risks and mitigations
- Testing or verification commands
- Risks and guardrails
- Any assumptions that must be approved before source-changing execution

## Task

${JSON.stringify(task, null, 2)}

${unit ? `## Target Implementation Unit\n\n${JSON.stringify(unit, null, 2)}\n` : ""}

## Repository Target Profile

${JSON.stringify(createImplementationTargetProfile(task, brief, unit), null, 2)}

${sourceContext ? `${formatSourceContextForPrompt(sourceContext)}\n` : ""}

## Project Brief

${JSON.stringify(brief, null, 2)}
`;
}

export function buildPatchSetPrompt(
  task: ImplementationTask,
  brief: ProjectBrief,
  unit?: ImplementationUnit,
  sourceContext?: SourceContext
): string {
  const schemaExample: PatchSet = {
    version: 1,
    taskId: task.id,
    summary: "Short summary of the source changes.",
    operations: [
      {
        type: "write",
        path: "src/example.ts",
        content: "export const example = true;\n",
        overwrite: true
      },
      {
        type: "replace",
        path: "src/App.tsx",
        search: "old text",
        replace: "new text",
        expectedReplacements: 1
      },
      {
        type: "delete",
        path: "src/obsolete.ts",
        missingOk: true
      }
    ]
  };

  return `Create a minimal PatchSet JSON for this implementation task.

PatchSet schema example:

${JSON.stringify(schemaExample, null, 2)}

Rules:
- Return JSON only.
- Use operation types "write", "replace", or "delete" only.
- Use relative paths only.
- Do not target .git, node_modules, generated build output, or dependency folders.
- Use "delete" only for source files made obsolete by this task; do not delete directories.
- Keep the patch set small and scoped to the task.
- Respect deliveryRisks and uiStateChecklist from the project brief.
- Do not guess through high delivery risks; only implement behavior grounded in accepted task context.
- Use at most ${patchSetLimits.maxOperations} operations.
- Keep each write operation at or below ${patchSetLimits.maxWriteBytes} bytes.
- Keep each replace search at or below ${patchSetLimits.maxSearchBytes} bytes and each replacement at or below ${patchSetLimits.maxReplaceBytes} bytes.
- Include tests or docs only when directly useful for the task.

## Task

${JSON.stringify(task, null, 2)}

${unit ? `## Target Implementation Unit\n\n${JSON.stringify(unit, null, 2)}\n` : ""}

## Repository Target Profile

${JSON.stringify(createImplementationTargetProfile(task, brief, unit), null, 2)}

${sourceContext ? `${formatSourceContextForPrompt(sourceContext)}\n` : ""}

## Project Brief

${JSON.stringify(brief, null, 2)}
`;
}

export function createDryRunProposal(task: ImplementationTask, brief: ProjectBrief, unit?: ImplementationUnit): DryRunProposal {
  const targetProfile = createImplementationTargetProfile(task, brief, unit);
  const proposal: DryRunProposal = {
    taskId: task.id,
    title: task.title,
    targetProfile,
    summary: unit
      ? `Dry-run proposal for ${task.id} scoped to ${unit.id}. No source files have been changed.`
      : `Dry-run proposal for ${task.id}. No source files have been changed.`,
    suggestedFiles: suggestFiles(task, brief, unit, targetProfile),
    steps: buildSteps(task, unit),
    verification: targetProfile.verificationCommands,
    uiChecklist: buildUiChecklist(brief, unit),
    deliveryRisks: buildDeliveryRiskSummaries(brief),
    guardrails: buildGuardrails(brief)
  };

  if (unit) {
    proposal.targetUnit = unit;
  }

  return proposal;
}

function buildGuardrails(brief: ProjectBrief): string[] {
  const highRiskCount = (brief.deliveryRisks ?? []).filter((risk) => risk.level === "high").length;
  const guardrails = [
    "Review this proposal before allowing source-changing execution.",
    "Keep changes scoped to the task objective and acceptance criteria.",
    "Preserve existing repository conventions detected in the project brief.",
    "Run verification and regenerate the delivery report after code changes."
  ];

  if (highRiskCount > 0) {
    guardrails.push(`Resolve or explicitly accept ${highRiskCount} high delivery risk(s) before applying source changes.`);
  }

  return guardrails;
}

export function formatDryRunProposal(proposal: DryRunProposal): string {
  return `# Patch Proposal: ${proposal.taskId}

${proposal.summary}

## Task

${proposal.title}

${proposal.targetUnit ? `## Target Unit\n\n${formatTargetUnit(proposal.targetUnit)}\n` : ""}

## Stack Targeting

${formatTargetProfile(proposal.targetProfile)}

## Suggested Files

${proposal.suggestedFiles.map((file) => `- \`${file}\``).join("\n")}

## Proposed Steps

${proposal.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## UI Checklist

${proposal.uiChecklist.length ? proposal.uiChecklist.map((item) => `- ${item}`).join("\n") : "- No UI checklist items were extracted for this proposal."}

## Delivery Risks

${proposal.deliveryRisks.length ? proposal.deliveryRisks.map((risk) => `- ${risk}`).join("\n") : "- No delivery risks were detected for this proposal."}

## Verification

${proposal.verification.length ? proposal.verification.map((command) => `- \`${command}\``).join("\n") : "- No verification command available."}

## Guardrails

${proposal.guardrails.map((guardrail) => `- ${guardrail}`).join("\n")}
`;
}

function formatTargetUnit(unit: ImplementationUnit): string {
  const details = unit.details.map((detail) => `- ${detail}`);
  const dependsOn = unit.dependsOn?.length ? [`- Depends on: ${unit.dependsOn.join(", ")}`] : [];
  const reviewChecklist = unit.reviewChecklist?.length
    ? ["- Review checklist:", ...unit.reviewChecklist.map((item) => `  - ${item}`)]
    : [];

  return [
    `- ${unit.id} [${unit.kind}] ${unit.title}`,
    `- Source: \`${unit.source}\``,
    ...dependsOn,
    ...details,
    ...reviewChecklist
  ].join("\n");
}

function suggestFiles(
  task: ImplementationTask,
  brief: ProjectBrief,
  unit: ImplementationUnit | undefined,
  targetProfile: ImplementationTargetProfile
): string[] {
  const sourceRoots = brief.stack.sourceDirectories.length ? brief.stack.sourceDirectories : ["src"];

  if (unit?.kind === "design-asset") {
    return unique([
      unit.source,
      ...targetProfile.componentCandidates,
      ...targetProfile.styleCandidates,
      ...targetProfile.testCandidates
    ]);
  }

  if (unit?.kind === "design-token") {
    return unique([
      ...targetProfile.styleCandidates,
      ...targetProfile.componentCandidates,
      ...targetProfile.configCandidates,
      ...targetProfile.testCandidates
    ]);
  }

  if (unit?.kind === "frontend-route") {
    return unique([
      ...targetProfile.componentCandidates,
      ...targetProfile.dataCandidates.slice(0, 4),
      ...targetProfile.styleCandidates,
      ...targetProfile.testCandidates,
      ...targetProfile.configCandidates
    ]);
  }

  if (unit?.kind === "frontend-component") {
    return unique([
      ...targetProfile.componentCandidates,
      ...targetProfile.styleCandidates,
      ...targetProfile.testCandidates,
      ...targetProfile.configCandidates
    ]);
  }

  if (unit?.kind === "frontend-state") {
    return unique([
      ...targetProfile.componentCandidates,
      ...targetProfile.dataCandidates.slice(0, 4),
      ...targetProfile.styleCandidates,
      ...targetProfile.testCandidates,
      ...targetProfile.configCandidates
    ]);
  }

  if (unit?.kind === "frontend-data" || unit?.kind === "api-endpoint" || unit?.kind === "api-model" || unit?.kind === "api-error" || unit?.kind === "api-auth") {
    return unique([
      ...targetProfile.dataCandidates,
      ...targetProfile.componentCandidates.slice(0, 4),
      ...targetProfile.testCandidates,
      ...targetProfile.configCandidates
    ]);
  }

  if (task.id.includes("delivery")) {
    return [".devflow/artifacts/delivery-report.md"];
  }

  if (task.id.includes("quality")) {
    return [".devflow/artifacts/verification-report.json"];
  }

  if (task.id.includes("context") || task.id.includes("map")) {
    return [
      brief.sourceDocuments.requirementsPath,
      brief.sourceDocuments.uiPath,
      brief.sourceDocuments.apiPath,
      ".devflow/artifacts/project-brief.json",
      ".devflow/artifacts/implementation-plan.md"
    ];
  }

  return unique([
    ...targetProfile.componentCandidates,
    ...targetProfile.dataCandidates,
    ...targetProfile.styleCandidates,
    ...targetProfile.testCandidates,
    ...targetProfile.configCandidates,
    ...sourceRoots
  ]);
}

function buildSteps(task: ImplementationTask, unit?: ImplementationUnit): string[] {
  const steps = [
    "Read the task inputs and confirm assumptions against the project brief.",
    "Identify the smallest set of files needed for this task.",
    "Apply changes incrementally and keep each change tied to an acceptance criterion.",
    "Update or add focused tests when behavior changes.",
    "Run the listed verification commands and capture results."
  ];

  if (!unit) {
    return steps;
  }

  return [
    `Focus this proposal on implementation unit ${unit.id}: ${unit.title}.`,
    ...steps
  ];
}

function buildUiChecklist(brief: ProjectBrief, unit?: ImplementationUnit): string[] {
  if (unit?.kind === "ui-state" || unit?.kind === "frontend-state") {
    return [
      `${unit.id} [${unit.kind}] ${unit.title} (${unit.source})`,
      ...unit.details
    ];
  }

  return (brief.uiStateChecklist ?? [])
    .slice(0, 8)
    .map((item) => `[${item.kind}] ${item.summary} (${brief.sourceDocuments.uiPath}:${item.sourceLine})`);
}

function buildDeliveryRiskSummaries(brief: ProjectBrief): string[] {
  return (brief.deliveryRisks ?? []).slice(0, 8).map((risk) => {
    const source = risk.sourceLine === undefined ? risk.source : `${risk.source}:${risk.sourceLine}`;

    return `[${risk.level}] ${source}: ${risk.summary} Recommendation: ${risk.recommendation}`;
  });
}

function formatTargetProfile(profile: ImplementationTargetProfile): string {
  return [
    `- Source roots: ${formatInlineList(profile.sourceRoots)}`,
    `- Stack tags: ${profile.stackTags.length ? formatInlineList(profile.stackTags) : "none detected"}`,
    `- Route targets: ${formatInlineListOrNone(profile.frontendTargets.routes)}`,
    `- Component targets: ${formatInlineListOrNone(profile.frontendTargets.components)}`,
    `- Data targets: ${formatInlineListOrNone(profile.frontendTargets.dataNeeds)}`,
    `- UI state targets: ${formatInlineListOrNone(profile.frontendTargets.uiStates)}`,
    `- Component candidates: ${formatInlineList(profile.componentCandidates)}`,
    `- Data candidates: ${profile.dataCandidates.length ? formatInlineList(profile.dataCandidates) : "none for this task"}`,
    `- Style candidates: ${formatInlineList(profile.styleCandidates)}`,
    `- Test candidates: ${formatInlineList(profile.testCandidates)}`,
    `- Config candidates: ${formatInlineList(profile.configCandidates)}`,
    ...profile.notes.map((note) => `- ${note}`)
  ].join("\n");
}

function formatInlineList(values: string[]): string {
  return values.map((value) => `\`${value}\``).join(", ");
}

function formatInlineListOrNone(values: string[]): string {
  return values.length ? formatInlineList(values) : "none extracted";
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
