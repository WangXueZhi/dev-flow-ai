import type { FrontendTargetItem, FrontendTargetSource, ProjectBrief } from "./brief.js";

export interface TaskPlan {
  version: 1;
  source: {
    projectBriefPath: string;
    implementationPlanPath: string;
  };
  frontendTargets?: ProjectBrief["frontendTargets"];
  implementationUnits: ImplementationUnit[];
  tasks: ImplementationTask[];
  notes: string[];
}

export interface ImplementationUnit {
  id: string;
  kind:
    | "requirement"
    | "constraint"
    | "frontend-route"
    | "frontend-component"
    | "frontend-data"
    | "frontend-state"
    | "ui"
    | "ui-state"
    | "design-asset"
    | "design-token"
    | "api-endpoint"
    | "api-model"
    | "api-error"
    | "api-auth";
  title: string;
  source: string;
  details: string[];
  reviewChecklist?: string[];
}

export interface ImplementationTask {
  id: string;
  phase: string;
  title: string;
  objective: string;
  mode: "manual" | "ai-assisted";
  risk: "low" | "medium" | "high";
  dependsOn: string[];
  inputs: string[];
  expectedOutputs: string[];
  acceptanceCriteria: string[];
  verification: string[];
}

export function createTaskPlan(
  brief: ProjectBrief,
  implementationPlanMarkdown: string,
  source: TaskPlan["source"]
): TaskPlan {
  const acceptanceCriteria = brief.acceptanceCriteria.length
    ? brief.acceptanceCriteria
    : ["Implementation satisfies the reviewed requirements."];
  const recommendedVerification = brief.recommendedVerification.filter((command) => !command.startsWith("Add or document"));
  const hasImplementationPlan = implementationPlanMarkdown.trim().length > 0;
  const contextReviewCriteria = createContextReviewCriteria(brief);

  return {
    version: 1,
    source,
    frontendTargets: brief.frontendTargets,
    implementationUnits: createImplementationUnits(brief),
    tasks: [
      {
        id: "T01-context-review",
        phase: "Discovery",
        title: "Review project context and resolve blockers",
        objective: "Confirm source documents, detected stack, open questions, and verification commands before code changes.",
        mode: "manual",
        risk: "low",
        dependsOn: [],
        inputs: [
          brief.sourceDocuments.requirementsPath,
          brief.sourceDocuments.uiPath,
          brief.sourceDocuments.apiPath,
          source.projectBriefPath
        ],
        expectedOutputs: ["Confirmed assumptions", "Resolved or accepted open questions"],
        acceptanceCriteria: contextReviewCriteria.length
          ? contextReviewCriteria
          : ["Project context is reviewed and ready for implementation."],
        verification: []
      },
      {
        id: "T02-implementation-map",
        phase: "Planning",
        title: "Map requirements, UI states, and API contracts to implementation units",
        objective: "Turn the brief and implementation plan into concrete routes, components, data flows, and state handling work.",
        mode: "ai-assisted",
        risk: "medium",
        dependsOn: ["T01-context-review"],
        inputs: [source.projectBriefPath, source.implementationPlanPath],
        expectedOutputs: ["Route/component map", "State and API integration checklist"],
        acceptanceCriteria: [
          "Every requirement signal is mapped to an implementation unit.",
          "Loading, empty, error, and success states are accounted for.",
          "API integration points are isolated from presentation components."
        ],
        verification: []
      },
      {
        id: "T03-code-implementation",
        phase: "Implementation",
        title: "Implement the planned frontend changes",
        objective: "Apply small, reviewable source changes that satisfy the accepted plan and local repository conventions.",
        mode: "ai-assisted",
        risk: "high",
        dependsOn: ["T02-implementation-map"],
        inputs: [source.projectBriefPath, source.implementationPlanPath],
        expectedOutputs: ["Updated source files", "Updated or added tests where appropriate"],
        acceptanceCriteria: acceptanceCriteria.slice(0, 8),
        verification: recommendedVerification
      },
      {
        id: "T04-quality-pass",
        phase: "Verification",
        title: "Run verification and address failures",
        objective: "Run project checks, inspect failures, and keep a record of verification evidence.",
        mode: "ai-assisted",
        risk: "medium",
        dependsOn: ["T03-code-implementation"],
        inputs: [source.projectBriefPath],
        expectedOutputs: [".devflow/artifacts/verification-report.json"],
        acceptanceCriteria: ["Verification commands finish successfully or failures are documented with next actions."],
        verification: recommendedVerification
      },
      {
        id: "T05-delivery-report",
        phase: "Delivery",
        title: "Generate and review the delivery report",
        objective: "Summarize source context, planned work, verification results, open questions, and handoff notes.",
        mode: "ai-assisted",
        risk: "low",
        dependsOn: ["T04-quality-pass"],
        inputs: [
          source.projectBriefPath,
          source.implementationPlanPath,
          ".devflow/artifacts/verification-report.json"
        ],
        expectedOutputs: [".devflow/artifacts/delivery-report.md"],
        acceptanceCriteria: ["Delivery report is generated and reviewed before handoff."],
        verification: []
      }
    ],
    notes: [
      hasImplementationPlan
        ? "Tasks were generated with an implementation plan present."
        : "Implementation plan was missing or empty; tasks were generated from the project brief only.",
      "Dry-run execution should produce patch proposals before any source-changing command is allowed."
    ]
  };
}

function createContextReviewCriteria(brief: ProjectBrief): string[] {
  const riskCriteria = (brief.deliveryRisks ?? [])
    .filter((risk) => risk.level !== "low")
    .slice(0, 8)
    .map((risk) => `Risk accepted or mitigated: [${risk.level}] ${risk.summary}`);
  const questionCriteria = brief.openQuestions.map((question) => `Question resolved or explicitly accepted: ${question}`);

  return [...questionCriteria, ...riskCriteria];
}

export function formatTaskPlanMarkdown(taskPlan: TaskPlan): string {
  return `# Implementation Tasks

Generated by DevFlow.

## Source

- Project brief: \`${taskPlan.source.projectBriefPath}\`
- Implementation plan: \`${taskPlan.source.implementationPlanPath}\`

## Frontend Targets

${formatFrontendTargets(taskPlan.frontendTargets)}

## Implementation Units

${formatImplementationUnits(taskPlan.implementationUnits)}

## Tasks

${taskPlan.tasks.map(formatTask).join("\n\n")}

## Notes

${taskPlan.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function formatFrontendTargets(targets: ProjectBrief["frontendTargets"]): string {
  if (!targets) {
    return "- No normalized frontend targets were available in the project brief.";
  }

  const sections = [
    ["Routes", targets.routes],
    ["Components", targets.components],
    ["Data Needs", targets.dataNeeds],
    ["UI States", targets.uiStates]
  ] as const;

  return sections.map(([label, items]) => {
    const lines = items.length
      ? items.map((item) => `- ${item.summary}${item.sourceLine === undefined ? "" : ` (${item.source}:${item.sourceLine})`}`)
      : ["- None extracted."];

    return `### ${label}\n\n${lines.join("\n")}`;
  }).join("\n\n");
}

function createImplementationUnits(brief: ProjectBrief): ImplementationUnit[] {
  const units: ImplementationUnit[] = [];
  let index = 1;
  const nextId = () => `U${String(index++).padStart(2, "0")}`;
  const structuredRequirementKeys = new Set(
    [...brief.userStories, ...brief.constraints].map(normalizeUnitKey)
  );

  for (const story of brief.userStories.slice(0, 8)) {
    units.push({
      id: nextId(),
      kind: "requirement",
      title: story,
      source: brief.sourceDocuments.requirementsPath,
      details: ["Implement this user story through UI behavior, data needs, state handling, and verification evidence."]
    });
  }

  for (const constraint of brief.constraints.slice(0, 8)) {
    units.push({
      id: nextId(),
      kind: "constraint",
      title: constraint,
      source: brief.sourceDocuments.requirementsPath,
      details: ["Honor this requirement constraint during implementation, verification, and delivery handoff."]
    });
  }

  const remainingRequirementSignals = brief.signals.requirements
    .filter((item) => !structuredRequirementKeys.has(normalizeUnitKey(item)))
    .slice(0, 8);

  for (const signal of remainingRequirementSignals) {
    units.push({
      id: nextId(),
      kind: "requirement",
      title: signal,
      source: brief.sourceDocuments.requirementsPath,
      details: ["Map this requirement to UI behavior, state, and verification evidence."]
    });
  }

  for (const target of brief.frontendTargets?.routes ?? []) {
    units.push({
      id: nextId(),
      kind: "frontend-route",
      title: target.summary,
      source: formatFrontendTargetSource(brief, target),
      details: [
        `Target source: ${target.source}`,
        ...formatFrontendTargetEvidence(target.evidence),
        "Implement or update this route/view, including navigation, layout, data handoff, state coverage, and verification evidence."
      ]
    });
  }

  for (const target of brief.frontendTargets?.components ?? []) {
    units.push({
      id: nextId(),
      kind: "frontend-component",
      title: target.summary,
      source: formatFrontendTargetSource(brief, target),
      details: [
        `Target source: ${target.source}`,
        ...formatFrontendTargetEvidence(target.evidence),
        "Implement or update this component boundary, including props/data shape, responsive behavior, visual fidelity, and focused tests where useful."
      ]
    });
  }

  for (const target of brief.frontendTargets?.dataNeeds ?? []) {
    units.push({
      id: nextId(),
      kind: "frontend-data",
      title: target.summary,
      source: formatFrontendTargetSource(brief, target),
      details: [
        `Target source: ${target.source}`,
        ...formatFrontendTargetEvidence(target.evidence),
        "Map this frontend data need to a service/client boundary and wire loading, empty, error, success, and auth-aware UI states."
      ]
    });
  }

  for (const target of brief.frontendTargets?.uiStates ?? []) {
    units.push({
      id: nextId(),
      kind: "frontend-state",
      title: target.summary,
      source: formatFrontendTargetSource(brief, target),
      details: [
        `Target source: ${target.source}`,
        ...formatFrontendTargetEvidence(target.evidence),
        "Map this frontend state target to visible behavior, accessibility, responsive handling, and verification evidence."
      ]
    });
  }

  for (const signal of brief.signals.ui.slice(0, 8)) {
    units.push({
      id: nextId(),
      kind: "ui",
      title: signal,
      source: brief.sourceDocuments.uiPath,
      details: ["Map this UI signal to components, responsive behavior, and visual states."]
    });
  }

  for (const item of brief.uiStateChecklist ?? []) {
    units.push({
      id: nextId(),
      kind: "ui-state",
      title: item.summary,
      source: `${brief.sourceDocuments.uiPath}:${item.sourceLine}`,
      details: [
        `Kind: ${item.kind}`,
        "Map this UI checklist item to component behavior, visual state, responsive handling, and verification evidence."
      ]
    });
  }

  for (const asset of brief.designAssets) {
    units.push({
      id: nextId(),
      kind: "design-asset",
      title: asset.altText || asset.reference,
      source: asset.reference,
      details: [
        `Kind: ${asset.kind}`,
        asset.resolvedPath ? `Resolved path: ${asset.resolvedPath}` : undefined,
        asset.exists === undefined ? undefined : `Exists: ${asset.exists ? "yes" : "no"}`,
        ...formatDesignAssetMetadata(asset.metadata)
      ].filter((detail): detail is string => Boolean(detail))
    });
  }

  for (const token of brief.designTokens ?? []) {
    units.push({
      id: nextId(),
      kind: "design-token",
      title: `${token.name}: ${token.value}`,
      source: `${brief.sourceDocuments.uiPath}:${token.sourceLine}`,
      details: [
        `Category: ${token.category}`,
        `Value: ${token.value}`,
        token.summary
      ]
    });
  }

  for (const contract of brief.apiContracts) {
    units.push({
      id: nextId(),
      kind: "api-endpoint",
      title: `${contract.method} ${contract.path}`,
      source: `${brief.sourceDocuments.apiPath}:${contract.sourceLine}`,
      details: [
        "Map this endpoint to data fetching, loading, empty, error, and success states.",
        contract.summary,
        ...formatApiParameterDetails(contract.parameters)
      ]
    });
  }

  for (const model of brief.apiDataModels) {
    units.push({
      id: nextId(),
      kind: "api-model",
      title: model.name,
      source: `${brief.sourceDocuments.apiPath}:${model.sourceLine}`,
      details: [
        model.fields.length ? `Fields: ${model.fields.join(", ")}` : "Fields: none listed",
        model.summary
      ]
    });
  }

  for (const errorCase of brief.apiErrorCases) {
    units.push({
      id: nextId(),
      kind: "api-error",
      title: truncateTitle(errorCase.summary),
      source: `${brief.sourceDocuments.apiPath}:${errorCase.sourceLine}`,
      details: [
        "Map this API failure case to loading, stale, retry, unavailable, warning, or blocked UI behavior.",
        errorCase.summary
      ]
    });
  }

  for (const authRequirement of brief.apiAuthRequirements) {
    units.push({
      id: nextId(),
      kind: "api-auth",
      title: truncateTitle(authRequirement.summary),
      source: `${brief.sourceDocuments.apiPath}:${authRequirement.sourceLine}`,
      details: [
        "Map this auth requirement to request headers, session state, unauthorized UI, and safe error handling.",
        authRequirement.summary
      ]
    });
  }

  return units.map(addReviewChecklist);
}

function formatFrontendTargetSource(brief: ProjectBrief, target: FrontendTargetItem): string {
  const path = frontendTargetDocumentPath(brief, target.source);

  return target.sourceLine === undefined ? path : `${path}:${target.sourceLine}`;
}

function addReviewChecklist(unit: ImplementationUnit): ImplementationUnit {
  const reviewChecklist = unique([
    ...(unit.reviewChecklist ?? []),
    ...reviewChecklistForUnit(unit)
  ]);

  return reviewChecklist.length ? { ...unit, reviewChecklist } : unit;
}

function reviewChecklistForUnit(unit: ImplementationUnit): string[] {
  switch (unit.kind) {
    case "requirement":
      return [
        "Acceptance criteria or manual QA evidence covers this requirement.",
        "Implementation maps the requirement to visible UI behavior, data flow, or documented non-code follow-up."
      ];
    case "constraint":
      return [
        "Source changes do not violate this constraint.",
        "Any tradeoff against the constraint is called out in the delivery report."
      ];
    case "frontend-route":
      return [
        "Route or view is reachable through the expected navigation path.",
        "Route covers loading, empty, error, success, and responsive states where applicable.",
        "Verification or visual evidence covers the route boundary."
      ];
    case "frontend-component":
      return [
        "Component boundary has clear inputs, state ownership, and rendering responsibility.",
        "Responsive behavior, accessibility semantics, and key visual states are covered.",
        "Nearby tests or manual QA notes cover the component behavior."
      ];
    case "frontend-data":
      return [
        "Data fetching is isolated from presentation components.",
        "Request parameters, auth, loading, empty, error, and success states are handled.",
        "Mock, fixture, or typed data shape is aligned with the API contract."
      ];
    case "frontend-state":
    case "ui-state":
      return [
        "Visible state matches the UI note and has user-facing recovery where needed.",
        "Keyboard, focus, and screen-reader behavior are considered for interactive states.",
        "Responsive behavior is checked for the state."
      ];
    case "ui":
      return [
        "UI signal is mapped to a concrete route, component, state, or styling change.",
        "Responsive and accessibility implications are reviewed."
      ];
    case "design-asset":
      return [
        "Layout, spacing, visible copy, and visual hierarchy are checked against the referenced asset.",
        "Missing or stale assets are called out before source-changing execution."
      ];
    case "design-token":
      return [
        "Token is applied through the project's styling or theme system rather than one-off hardcoding.",
        "Desktop, tablet, and mobile text fit remain stable after the token is applied."
      ];
    case "api-endpoint":
      return [
        "Endpoint path, method, parameters, and auth are represented in the data client or service boundary.",
        "Loading, empty, error, success, and retry behavior are wired to the UI."
      ];
    case "api-model":
      return [
        "Frontend types or mapping code reflect the documented fields.",
        "Missing, optional, or unknown fields fail gracefully."
      ];
    case "api-error":
      return [
        "Documented API failure maps to visible retry, stale, unavailable, warning, or blocked UI behavior.",
        "Verification covers the user-facing failure state or records a manual QA note."
      ];
    case "api-auth":
      return [
        "Auth headers, cookies, or session requirements are isolated from presentation components.",
        "Unauthorized or expired-session behavior is visible and safe."
      ];
  }
}

function frontendTargetDocumentPath(brief: ProjectBrief, source: FrontendTargetSource): string {
  if (source === "api") {
    return brief.sourceDocuments.apiPath;
  }

  if (source === "requirements") {
    return brief.sourceDocuments.requirementsPath;
  }

  return brief.sourceDocuments.uiPath;
}

function formatFrontendTargetEvidence(evidence: string[]): string[] {
  return evidence.slice(0, 4).map((item) => `Evidence: ${item}`);
}

function formatApiParameterDetails(parameters: ProjectBrief["apiContracts"][number]["parameters"]): string[] {
  if (!parameters?.length) {
    return [];
  }

  return [`Parameters: ${parameters.map(formatApiParameterDetail).join("; ")}`];
}

function formatApiParameterDetail(parameter: NonNullable<ProjectBrief["apiContracts"][number]["parameters"]>[number]): string {
  const details = [
    parameter.schema,
    parameter.required === undefined ? undefined : parameter.required ? "required" : "optional",
    parameter.defaultValue ? `default ${parameter.defaultValue}` : undefined
  ].filter((item): item is string => Boolean(item));

  return `${parameter.in} ${parameter.name}${details.length ? ` (${details.join(", ")})` : ""}`;
}

function truncateTitle(value: string): string {
  return value.length > 96 ? `${value.slice(0, 93)}...` : value;
}

function normalizeUnitKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
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
  ].filter((detail): detail is string => Boolean(detail));
}

function formatImplementationUnits(units: ImplementationUnit[]): string {
  if (units.length === 0) {
    return "- No implementation units were generated from the project brief.";
  }

  return units.map((unit) => {
    const details = unit.details.map((detail) => `  - ${detail}`).join("\n");
    const reviewChecklist = unit.reviewChecklist?.length
      ? `\n  - Review checklist:\n${unit.reviewChecklist.map((item) => `    - ${item}`).join("\n")}`
      : "";

    return `- ${unit.id} [${unit.kind}] ${unit.title}\n  - Source: \`${unit.source}\`\n${details}${reviewChecklist}`;
  }).join("\n");
}

function formatTask(task: ImplementationTask): string {
  return `### ${task.id}: ${task.title}

- Phase: ${task.phase}
- Mode: ${task.mode}
- Risk: ${task.risk}
- Depends on: ${task.dependsOn.length ? task.dependsOn.join(", ") : "none"}

Objective:

${task.objective}

Expected outputs:

${task.expectedOutputs.map((output) => `- ${output}`).join("\n")}

Acceptance criteria:

${task.acceptanceCriteria.map((item) => `- [ ] ${item}`).join("\n")}

Verification:

${task.verification.length ? task.verification.map((command) => `- \`${command}\``).join("\n") : "- No command required."}`;
}
