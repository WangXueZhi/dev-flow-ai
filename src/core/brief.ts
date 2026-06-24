import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize } from "node:path";
import { parse as parseYaml } from "yaml";
import type { ProjectContext } from "./context.js";
import { extractChecklistItems, extractMarkdownSignals } from "./signals.js";
import type { StackProfile, WorkspacePackage } from "./stack.js";

export interface DesignAsset {
  source: "ui-design-link" | "ui-markdown-image";
  kind: "local" | "remote";
  altText: string;
  reference: string;
  resolvedPath?: string;
  exists?: boolean;
  metadata?: DesignAssetMetadata;
}

export interface DesignAssetMetadata {
  width?: string;
  height?: string;
  viewBox?: string;
  title?: string;
  description?: string;
  colors?: string[];
  textSnippets?: string[];
}

export type DesignTokenCategory = "color" | "iconography" | "motion" | "other" | "radius" | "shadow" | "spacing" | "typography";

export interface DesignToken {
  category: DesignTokenCategory;
  sourceLine: number;
  name: string;
  value: string;
  summary: string;
}

export type UiStateChecklistKind = "screen" | "component" | "state" | "interaction" | "responsive" | "accessibility";

export interface UiStateChecklistItem {
  kind: UiStateChecklistKind;
  sourceLine: number;
  summary: string;
}

export type FrontendTargetSource = "api" | "design" | "requirements" | "ui";

export interface FrontendTargetItem {
  source: FrontendTargetSource;
  sourceLine?: number;
  summary: string;
  evidence: string[];
}

export interface FrontendTargets {
  routes: FrontendTargetItem[];
  components: FrontendTargetItem[];
  dataNeeds: FrontendTargetItem[];
  uiStates: FrontendTargetItem[];
}

export type DeliveryRiskLevel = "low" | "medium" | "high";
export type DeliveryRiskSource = "requirements" | "ui" | "api" | "repository";

export interface DeliveryRisk {
  level: DeliveryRiskLevel;
  source: DeliveryRiskSource;
  sourceLine?: number;
  summary: string;
  recommendation: string;
}

export interface ApiContract {
  method: string;
  path: string;
  sourceLine: number;
  summary: string;
  parameters?: ApiParameter[];
}

export type ApiParameterLocation = "cookie" | "header" | "path" | "query";

export interface ApiParameter {
  name: string;
  in: ApiParameterLocation;
  required?: boolean;
  schema?: string;
  defaultValue?: string;
  summary: string;
}

export interface ApiDataModel {
  name: string;
  sourceLine: number;
  fields: string[];
  summary: string;
}

export interface ApiErrorCase {
  sourceLine: number;
  summary: string;
}

export interface ApiAuthRequirement {
  sourceLine: number;
  summary: string;
}

export interface ApiStateRequirement {
  sourceLine: number;
  summary: string;
}

export interface InvalidApiDataModel {
  sourceLine: number;
  error: string;
}

export interface ProjectBrief {
  version: 1;
  sourceDocuments: {
    requirementsPath: string;
    uiPath: string;
    apiPath: string;
  };
  stack: StackProfile;
  signals: {
    requirements: string[];
    ui: string[];
    api: string[];
  };
  designAssets: DesignAsset[];
  designTokens?: DesignToken[];
  uiStateChecklist: UiStateChecklistItem[];
  apiContracts: ApiContract[];
  apiDataModels: ApiDataModel[];
  apiErrorCases: ApiErrorCase[];
  apiAuthRequirements: ApiAuthRequirement[];
  apiStateRequirements?: ApiStateRequirement[];
  invalidApiDataModels: InvalidApiDataModel[];
  frontendTargets?: FrontendTargets;
  userStories: string[];
  constraints: string[];
  acceptanceCriteria: string[];
  deliveryRisks: DeliveryRisk[];
  openQuestions: string[];
  recommendedVerification: string[];
}

interface MarkdownCodeBlock {
  sourceLine: number;
  content: string;
}

interface LinkedOpenApiBlock extends MarkdownCodeBlock {
  kind: "json" | "yaml";
  reference: string;
}

interface LinkedGraphqlBlock extends MarkdownCodeBlock {
  reference: string;
}

export function createProjectBrief(context: ProjectContext, stack: StackProfile): ProjectBrief {
  const acceptanceCriteria = extractChecklistItems(context.requirements);
  const apiDataModelResult = extractApiDataModels(context.api, context.apiPath);
  const sourceDocuments = {
    requirementsPath: context.requirementsPath,
    uiPath: context.uiPath,
    apiPath: context.apiPath
  };
  const signals = {
    requirements: extractMarkdownSignals(context.requirements),
    ui: extractMarkdownSignals(context.ui),
    api: extractMarkdownSignals(context.api)
  };
  const designAssets = extractDesignAssets(context.ui, context.uiPath);
  const designTokens = extractDesignTokens(context.ui);
  const uiStateChecklist = extractUiStateChecklist(context.ui);
  const apiContracts = extractApiContracts(context.api, context.apiPath);
  const apiErrorCases = extractApiErrorCases(context.api, context.apiPath);
  const apiAuthRequirements = extractApiAuthRequirements(context.api, context.apiPath);
  const apiStateRequirements = extractApiStateRequirements(context.api);
  const recommendedVerification = buildRecommendedVerification(stack);
  const userStories = extractRequirementUserStories(context.requirements);
  const constraints = extractRequirementConstraints(context.requirements);

  return {
    version: 1,
    sourceDocuments,
    stack,
    signals,
    designAssets,
    designTokens,
    uiStateChecklist,
    apiContracts,
    apiDataModels: apiDataModelResult.models,
    apiErrorCases,
    apiAuthRequirements,
    apiStateRequirements,
    invalidApiDataModels: apiDataModelResult.invalid,
    frontendTargets: buildFrontendTargets({
      signals,
      designAssets,
      uiStateChecklist,
      apiContracts,
      apiDataModels: apiDataModelResult.models,
      apiErrorCases,
      apiAuthRequirements,
      apiStateRequirements,
      userStories,
      acceptanceCriteria
    }),
    userStories,
    constraints,
    acceptanceCriteria,
    deliveryRisks: assessDeliveryRisks(context, stack, {
      acceptanceCriteria,
      designAssets,
      uiStateChecklist,
      apiContracts,
      apiErrorCases,
      apiAuthRequirements,
      invalidApiDataModels: apiDataModelResult.invalid,
      recommendedVerification
    }),
    openQuestions: buildOpenQuestions(context, stack, acceptanceCriteria),
    recommendedVerification
  };
}

export function extractRequirementUserStories(requirementsMarkdown: string): string[] {
  return uniqueMarkdownItems([
    ...extractSectionListItems(requirementsMarkdown, /\buser stories?\b/i, 16),
    ...requirementsMarkdown
      .split(/\r?\n/)
      .map((line) => normalizeMarkdownListItem(line.trim()))
      .filter((item): item is string => Boolean(item && /^As (?:a|an|the) .+ I want .+ so that .+/i.test(item)))
  ], 12);
}

export function extractRequirementConstraints(requirementsMarkdown: string): string[] {
  return extractSectionListItems(
    requirementsMarkdown,
    /\b(constraints?|technical constraints?|product constraints?|accessibility requirements?|performance|browser requirements?)\b/i,
    12
  );
}

interface FrontendTargetsInput {
  signals: ProjectBrief["signals"];
  designAssets: DesignAsset[];
  uiStateChecklist: UiStateChecklistItem[];
  apiContracts: ApiContract[];
  apiDataModels: ApiDataModel[];
  apiErrorCases: ApiErrorCase[];
  apiAuthRequirements: ApiAuthRequirement[];
  apiStateRequirements?: ApiStateRequirement[];
  userStories: string[];
  acceptanceCriteria: string[];
}

interface FrontendTargetTextSource {
  source: FrontendTargetSource;
  summary: string;
  evidence: string[];
  sourceLine?: number;
}

function buildFrontendTargets(input: FrontendTargetsInput): FrontendTargets {
  const textSources = buildFrontendTargetTextSources(input);

  return {
    routes: uniqueFrontendTargets([
      ...extractExplicitRouteTargets(textSources),
      ...input.uiStateChecklist
        .filter((item) => item.kind === "screen")
        .map((item) => frontendTarget("ui", item.summary, [`UI screen note at line ${item.sourceLine}`], item.sourceLine)),
      ...input.signals.ui
        .filter(isRouteTargetSignal)
        .map((signal) => frontendTarget("ui", signal, ["UI signal"])),
      ...input.userStories
        .slice(0, 4)
        .map((story) => frontendTarget("requirements", `Route or view for user story: ${story}`, ["User story"])),
      ...input.acceptanceCriteria
        .filter(isRouteTargetSignal)
        .slice(0, 4)
        .map((criterion) => frontendTarget("requirements", `Route or view for acceptance criterion: ${criterion}`, ["Acceptance criterion"])),
      ...input.signals.requirements
        .slice(0, 4)
        .map((signal) => frontendTarget("requirements", `Route or view for requirement: ${signal}`, ["Requirement signal"]))
    ], 12),
    components: uniqueFrontendTargets([
      ...input.uiStateChecklist
        .filter((item) => item.kind === "component")
        .map((item) => frontendTarget("ui", item.summary, [`UI component note at line ${item.sourceLine}`], item.sourceLine)),
      ...input.designAssets.map((asset) => {
        const label = asset.altText || asset.reference;
        const evidence = [
          `Design asset: ${asset.reference}`,
          asset.metadata?.textSnippets?.length ? `Text: ${asset.metadata.textSnippets.join("; ")}` : undefined
        ].filter((item): item is string => Boolean(item));

        return frontendTarget("design", `Component or layout from design asset: ${label}`, evidence);
      }),
      ...extractExplicitComponentTargets(textSources),
      ...input.acceptanceCriteria
        .filter(isComponentTargetSignal)
        .slice(0, 4)
        .map((criterion) => frontendTarget("requirements", `Component for acceptance criterion: ${criterion}`, ["Acceptance criterion"]))
    ], 12),
    dataNeeds: uniqueFrontendTargets([
      ...input.apiContracts.map((contract) => frontendTarget(
        "api",
        `Integrate ${contract.method} ${contract.path}`,
        [contract.summary, ...formatApiParameterEvidence(contract.parameters)],
        contract.sourceLine
      )),
      ...input.apiDataModels.map((model) => frontendTarget(
        "api",
        `Use data model ${model.name}${model.fields.length ? ` with fields ${model.fields.join(", ")}` : ""}`,
        [model.summary],
        model.sourceLine
      )),
      ...input.apiAuthRequirements.map((auth) => frontendTarget("api", `Handle auth requirement: ${auth.summary}`, ["API auth"], auth.sourceLine))
    ], 16),
    uiStates: uniqueFrontendTargets([
      ...input.uiStateChecklist
        .filter((item) => item.kind !== "screen" && item.kind !== "component")
        .map((item) => frontendTarget("ui", item.summary, [`UI ${item.kind} note at line ${item.sourceLine}`], item.sourceLine)),
      ...input.apiErrorCases.map((errorCase) => frontendTarget(
        "api",
        `Represent API failure state: ${errorCase.summary}`,
        ["API error case"],
        errorCase.sourceLine
      )),
      ...(input.apiStateRequirements ?? []).map((state) => frontendTarget(
        "api",
        `Represent API state requirement: ${state.summary}`,
        ["API state requirement"],
        state.sourceLine
      )),
      ...input.acceptanceCriteria
        .map((criterion) => {
          const kind = classifyUiChecklistKeyword(criterion);

          return kind
            ? frontendTarget("requirements", `UI ${kind} for acceptance criterion: ${criterion}`, ["Acceptance criterion"])
            : undefined;
        })
        .filter((target): target is FrontendTargetItem => Boolean(target))
        .slice(0, 6)
    ], 16)
  };
}

function buildFrontendTargetTextSources(input: FrontendTargetsInput): FrontendTargetTextSource[] {
  return [
    ...input.uiStateChecklist.map((item) => ({
      source: "ui" as const,
      summary: item.summary,
      evidence: [`UI ${item.kind} note at line ${item.sourceLine}`],
      sourceLine: item.sourceLine
    })),
    ...input.signals.ui.map((summary) => ({
      source: "ui" as const,
      summary,
      evidence: ["UI signal"]
    })),
    ...input.signals.requirements.map((summary) => ({
      source: "requirements" as const,
      summary,
      evidence: ["Requirement signal"]
    })),
    ...input.userStories.map((summary) => ({
      source: "requirements" as const,
      summary,
      evidence: ["User story"]
    })),
    ...input.acceptanceCriteria.map((summary) => ({
      source: "requirements" as const,
      summary,
      evidence: ["Acceptance criterion"]
    }))
  ];
}

function extractExplicitRouteTargets(sources: FrontendTargetTextSource[]): FrontendTargetItem[] {
  return sources.flatMap((source) =>
    extractRoutePaths(source.summary).map((path) =>
      frontendTarget(source.source, `Route path ${path}`, [...source.evidence, source.summary], source.sourceLine)
    )
  );
}

function extractExplicitComponentTargets(sources: FrontendTargetTextSource[]): FrontendTargetItem[] {
  return sources.flatMap((source) =>
    extractComponentNames(source.summary).map((name) =>
      frontendTarget(source.source, `Component ${name}`, [...source.evidence, source.summary], source.sourceLine)
    )
  );
}

function extractRoutePaths(summary: string): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  const pattern = /(?:^|[\s([`"'“”])((?:\/[A-Za-z0-9._~!$&'()*+,;=:@%\[\]-]+)+\/?)(?=$|[\s)\]`"',.!?;:])/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(summary)) !== null) {
    const path = normalizeRoutePath(match[1]);

    if (!path || seen.has(path)) {
      continue;
    }

    seen.add(path);
    paths.push(path);
  }

  return paths;
}

function normalizeRoutePath(path: string | undefined): string | undefined {
  if (!path || path === "/" || /^\/api(?:\/|$)/i.test(path)) {
    return undefined;
  }

  if (/\.(?:avif|css|gif|jpe?g|js|json|md|png|svg|tsx?|jsx?|webp)$/i.test(path)) {
    return undefined;
  }

  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function extractComponentNames(summary: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const patterns = [
    /<([A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)?)\b/g,
    /\b(?:component|components|card|panel|table|form|modal|drawer|banner|toast|sidebar|navigation|widget)\s+[`"']?([A-Z][A-Za-z0-9]{2,})[`"']?/gi,
    /[`"']?([A-Z][A-Za-z0-9]{2,})[`"']?\s+(?:component|card|panel|table|form|modal|drawer|banner|toast|sidebar|widget)\b/g
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(summary)) !== null) {
      const name = normalizeComponentName(match[1]);

      if (!name || seen.has(name)) {
        continue;
      }

      seen.add(name);
      names.push(name);
    }
  }

  return names;
}

function normalizeComponentName(name: string | undefined): string | undefined {
  if (!name || ["API", "HTML", "HTTP", "JSON", "URL"].includes(name)) {
    return undefined;
  }

  return name;
}

function isRouteTargetSignal(summary: string): boolean {
  return /\b(screen|route|view|page|dashboard|modal|drawer)\b/i.test(summary);
}

function isComponentTargetSignal(summary: string): boolean {
  const componentPattern =
    /\b(component|card|panel|table|list|form|button|input|field|chart|graph|nav|navigation|menu|sidebar|header|footer|banner|toast|pill|badge)\b/i;

  return componentPattern.test(summary);
}

function frontendTarget(
  source: FrontendTargetSource,
  summary: string,
  evidence: string[],
  sourceLine?: number
): FrontendTargetItem {
  return {
    source,
    sourceLine,
    summary,
    evidence
  };
}

function uniqueFrontendTargets(items: FrontendTargetItem[], limit: number): FrontendTargetItem[] {
  const results: FrontendTargetItem[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const key = `${item.source}:${item.summary.toLowerCase()}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(item);

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

function formatApiParameterEvidence(parameters: ApiParameter[] | undefined): string[] {
  if (!parameters?.length) {
    return [];
  }

  return [`Parameters: ${parameters.map(formatApiParameterSummary).join("; ")}`];
}

export function extractUiStateChecklist(uiMarkdown: string, limit = 24): UiStateChecklistItem[] {
  const items: UiStateChecklistItem[] = [];
  const seen = new Set<string>();
  const lines = uiMarkdown.split(/\r?\n/);
  let currentKind: UiStateChecklistKind | undefined;
  let inFence = false;

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      continue;
    }

    const heading = /^#{1,6}\s+(.+)$/.exec(trimmed);

    if (heading) {
      currentKind = classifyUiChecklistHeading(heading[1] ?? "");
      continue;
    }

    const summary = normalizeMarkdownListItem(trimmed);

    if (!summary || isPlaceholderRequirementItem(summary)) {
      continue;
    }

    const kind = currentKind ?? classifyUiChecklistKeyword(summary);

    if (!kind) {
      continue;
    }

    addUiStateChecklistItem(items, seen, {
      kind,
      sourceLine: index + 1,
      summary: summary.replace(/`/g, "")
    });

    if (items.length >= limit) {
      break;
    }
  }

  return items;
}

interface DeliveryRiskAssessmentInput {
  acceptanceCriteria: string[];
  designAssets: DesignAsset[];
  uiStateChecklist: UiStateChecklistItem[];
  apiContracts: ApiContract[];
  apiErrorCases: ApiErrorCase[];
  apiAuthRequirements: ApiAuthRequirement[];
  invalidApiDataModels: InvalidApiDataModel[];
  recommendedVerification: string[];
}

export function assessDeliveryRisks(
  context: ProjectContext,
  stack: StackProfile,
  input?: Partial<DeliveryRiskAssessmentInput>
): DeliveryRisk[] {
  const acceptanceCriteria = input?.acceptanceCriteria ?? extractChecklistItems(context.requirements);
  const designAssets = input?.designAssets ?? extractDesignAssets(context.ui, context.uiPath);
  const uiStateChecklist = input?.uiStateChecklist ?? extractUiStateChecklist(context.ui);
  const apiContracts = input?.apiContracts ?? extractApiContracts(context.api, context.apiPath);
  const apiErrorCases = input?.apiErrorCases ?? extractApiErrorCases(context.api, context.apiPath);
  const apiAuthRequirements = input?.apiAuthRequirements ?? extractApiAuthRequirements(context.api, context.apiPath);
  const invalidApiDataModels = input?.invalidApiDataModels ?? extractApiDataModels(context.api, context.apiPath).invalid;
  const recommendedVerification = input?.recommendedVerification ?? buildRecommendedVerification(stack);
  const risks: DeliveryRisk[] = [];

  if (acceptanceCriteria.length === 0) {
    risks.push({
      level: "high",
      source: "requirements",
      summary: "Requirements do not include explicit acceptance criteria.",
      recommendation: "Add testable acceptance criteria before autonomous source-changing execution."
    });
  }

  risks.push(...extractAmbiguousRequirementRisks(context.requirements));

  if (stack.frameworks.length === 0) {
    risks.push({
      level: "high",
      source: "repository",
      summary: "No frontend framework was detected.",
      recommendation: "Confirm the target frontend stack and source entry points before implementation."
    });
  }

  if (recommendedVerification.some((command) => command.startsWith("Add or document"))) {
    risks.push({
      level: "high",
      source: "repository",
      summary: "No runnable verification command was detected.",
      recommendation: "Add or document at least one build, lint, typecheck, test, or check command."
    });
  }

  if (uiStateChecklist.length === 0) {
    risks.push({
      level: "medium",
      source: "ui",
      summary: "UI notes do not include structured screen, component, state, interaction, responsive, or accessibility checklist items.",
      recommendation: "Add UI state notes so implementation can cover loading, empty, error, success, interaction, and responsive behavior."
    });
  } else if (!uiStateChecklist.some((item) => item.kind === "responsive")) {
    risks.push({
      level: "medium",
      source: "ui",
      summary: "UI checklist does not include responsive behavior.",
      recommendation: "Document desktop, tablet, and mobile expectations before visual verification."
    });
  }

  for (const asset of designAssets) {
    if (asset.kind === "local" && asset.exists === false) {
      risks.push({
        level: "medium",
        source: "ui",
        summary: `Referenced UI design asset was not found: ${asset.reference}.`,
        recommendation: "Add the missing asset or update the UI notes to a valid design reference."
      });
    }
  }

  if (apiContracts.length === 0) {
    risks.push({
      level: "high",
      source: "api",
      summary: "API docs do not include recognizable HTTP endpoint contracts.",
      recommendation: "Document endpoints or OpenAPI paths before implementation depends on API data."
    });
  }

  if (apiErrorCases.length === 0) {
    risks.push({
      level: "medium",
      source: "api",
      summary: "API docs do not explicitly describe error handling.",
      recommendation: "Document error responses and user-facing failure behavior."
    });
  }

  if (apiAuthRequirements.length === 0) {
    risks.push({
      level: "medium",
      source: "api",
      summary: "API docs do not explicitly describe authentication or authorization requirements.",
      recommendation: "Clarify auth headers, session behavior, and unauthorized UI before integration."
    });
  }

  for (const invalidModel of invalidApiDataModels) {
    risks.push({
      level: "high",
      source: "api",
      sourceLine: invalidModel.sourceLine,
      summary: `API docs contain an invalid data model: ${invalidModel.error}`,
      recommendation: "Fix the invalid JSON or OpenAPI block before generating source-changing patches."
    });
  }

  return uniqueDeliveryRisks(risks, 16);
}

export function extractApiContracts(apiMarkdown: string, apiPath?: string): ApiContract[] {
  const contracts: ApiContract[] = [];
  const seen = new Set<string>();
  const endpointPattern = /\b(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+([^\s`),\]]+)/i;
  const lines = apiMarkdown.split(/\r?\n/);
  let inFencedCodeBlock = false;

  for (const [index, line] of lines.entries()) {
    if (/^```/.test(line.trim())) {
      inFencedCodeBlock = !inFencedCodeBlock;
      continue;
    }

    const match = endpointPattern.exec(line);

    if (match) {
      const method = (match[1] ?? "").toUpperCase();
      const path = (match[2] ?? "").replace(/`+$/g, "");
      const parameters = extractApiParametersFromPath(path);
      const contract: ApiContract = {
        method,
        path,
        sourceLine: index + 1,
        summary: normalizeApiSummary(line)
      };

      if (parameters.length) {
        contract.parameters = parameters;
      }

      addApiContract(contracts, seen, contract);
    }

    if (!inFencedCodeBlock) {
      for (const contract of extractInlineGraphqlContracts(line, index + 1)) {
        addApiContract(contracts, seen, contract);
      }
    }
  }

  for (const block of extractGraphqlBlocks(apiMarkdown)) {
    for (const contract of extractGraphqlOperationContracts(block.content, block.sourceLine + 1)) {
      addApiContract(contracts, seen, contract);
    }

    for (const contract of extractGraphqlSchemaOperationContracts(block.content, block.sourceLine + 1)) {
      addApiContract(contracts, seen, contract);
    }
  }

  for (const block of extractLinkedGraphqlBlocks(apiMarkdown, apiPath)) {
    for (const contract of extractGraphqlOperationContracts(block.content, block.sourceLine, undefined, true, { fixedSourceLine: true })) {
      addApiContract(contracts, seen, contract);
    }

    for (const contract of extractGraphqlSchemaOperationContracts(block.content, block.sourceLine, { fixedSourceLine: true })) {
      addApiContract(contracts, seen, contract);
    }
  }

  for (const document of extractOpenApiDocuments(apiMarkdown, apiPath)) {
    for (const contract of extractOpenApiContracts(document)) {
      addApiContract(contracts, seen, contract);
    }
  }

  return contracts;
}

export function extractApiDataModels(apiMarkdown: string, apiPath?: string): { models: ApiDataModel[]; invalid: InvalidApiDataModel[] } {
  const models: ApiDataModel[] = [];
  const invalid: InvalidApiDataModel[] = [];

  for (const block of extractJsonBlocks(apiMarkdown)) {
    try {
      const parsed = JSON.parse(block.content) as unknown;

      if (isOpenApiDocument(parsed)) {
        models.push(...describeOpenApiDataModels({ sourceLine: block.sourceLine, document: parsed }));
        continue;
      }

      models.push(...describeJsonModel(parsed, block.sourceLine));
    } catch (error) {
      invalid.push({
        sourceLine: block.sourceLine,
        error: error instanceof Error ? error.message : "Invalid JSON data model."
      });
    }
  }

  for (const block of extractYamlBlocks(apiMarkdown)) {
    try {
      const parsed = parseYaml(block.content) as unknown;

      if (isOpenApiDocument(parsed)) {
        models.push(...describeOpenApiDataModels({ sourceLine: block.sourceLine, document: parsed }));
      }
    } catch (error) {
      if (!looksLikeOpenApiYaml(block.content)) {
        continue;
      }

      invalid.push({
        sourceLine: block.sourceLine,
        error: error instanceof Error ? error.message : "Invalid OpenAPI YAML document."
      });
    }
  }

  for (const block of extractLinkedOpenApiBlocks(apiMarkdown, apiPath)) {
    try {
      const parsed = parseLinkedOpenApiBlock(block);

      if (isOpenApiDocument(parsed)) {
        models.push(...describeOpenApiDataModels({ sourceLine: block.sourceLine, document: parsed }));
      }
    } catch (error) {
      invalid.push({
        sourceLine: block.sourceLine,
        error: `Invalid linked OpenAPI document ${block.reference}: ${error instanceof Error ? error.message : "Could not parse document."}`
      });
    }
  }

  for (const block of extractGraphqlBlocks(apiMarkdown)) {
    models.push(...describeGraphqlDataModels(block.content, block.sourceLine + 1));
  }

  for (const block of extractLinkedGraphqlBlocks(apiMarkdown, apiPath)) {
    models.push(...describeGraphqlDataModels(block.content, block.sourceLine, { fixedSourceLine: true }));
  }

  return { models, invalid };
}

export function extractApiErrorCases(apiMarkdown: string, apiPath?: string): ApiErrorCase[] {
  const notes = extractApiNotes(apiMarkdown, {
    headingPattern: /\b(errors?|failures?|exceptions?)\b/i,
    keywordPattern: /\b(error|errors|fail|fails|failed|failure|unavailable|timeout|partial|invalid|stale|warning|unauthorized|forbidden)\b/i
  });
  const seen = new Set(notes.map((note) => note.summary.toLowerCase()));

  for (const document of extractOpenApiDocuments(apiMarkdown, apiPath)) {
    for (const note of extractOpenApiErrorCases(document)) {
      addApiNote(notes, seen, note);
    }
  }

  return notes;
}

export function extractApiAuthRequirements(apiMarkdown: string, apiPath?: string): ApiAuthRequirement[] {
  const notes = extractApiNotes(apiMarkdown, {
    headingPattern: /\b(auth|authentication|authorization|permissions?|security)\b/i,
    keywordPattern: /\b(auth|authentication|authorization|bearer|token|cookie|session|api key|permission|oauth|jwt|secret)\b/i
  });
  const seen = new Set(notes.map((note) => note.summary.toLowerCase()));

  for (const document of extractOpenApiDocuments(apiMarkdown, apiPath)) {
    for (const note of extractOpenApiAuthRequirements(document)) {
      addApiNote(notes, seen, note);
    }
  }

  return notes;
}

export function extractApiStateRequirements(apiMarkdown: string): ApiStateRequirement[] {
  return extractApiNotes(apiMarkdown, {
    headingPattern: /\b(loading|states?|ui behavior|frontend behavior|data freshness|cach(?:e|ing)|polling|realtime|real-time|offline|empty|pagination|refresh)\b/i,
    keywordPattern: /\b(loading|skeleton|empty|success|retry|refresh|poll|polling|realtime|real-time|cache|cached|caching|stale|fresh|fallback|offline|optimistic|pagination|page size|cursor|debounce|throttle|rate limit|background refresh|last known)\b/i
  });
}

export function formatBriefForPrompt(brief: ProjectBrief): string {
  return JSON.stringify(brief, null, 2);
}

export function extractDesignTokens(uiMarkdown: string): DesignToken[] {
  const tokens: DesignToken[] = [];
  const seen = new Set<string>();
  const lines = uiMarkdown.split(/\r?\n/);
  let sectionCategory: DesignTokenCategory | undefined;

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    const heading = /^#{1,6}\s+(.+)$/.exec(trimmed);

    if (heading) {
      sectionCategory = designTokenCategoryFromText(heading[1] ?? "");
      continue;
    }

    const item = normalizeMarkdownListItem(trimmed) ?? normalizeCssTokenLine(trimmed);

    if (!item) {
      continue;
    }

    const lineCategory = designTokenCategoryFromText(item);
    const valueCategory = designTokenCategoryFromValue(item);
    const category = lineCategory ?? (sectionCategory && sectionCategory !== "other" ? sectionCategory : valueCategory ?? sectionCategory);

    if (!category || !hasDesignTokenValue(item, category)) {
      continue;
    }

    const token = parseDesignTokenLine(item, category, index + 1);

    if (!token) {
      continue;
    }

    const key = `${token.category}:${token.name.toLowerCase()}:${token.value.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    tokens.push(token);

    if (tokens.length >= 24) {
      break;
    }
  }

  return tokens;
}

function normalizeCssTokenLine(line: string): string | undefined {
  return /^--[-_a-z0-9]+\s*:/i.test(line) ? line : undefined;
}

function designTokenCategoryFromText(text: string): DesignTokenCategory | undefined {
  if (/\b(colors?|palette|brand|background|foreground|surface|semantic colors?)\b/i.test(text)) {
    return "color";
  }

  if (/\b(typography|font|fonts|type scale|line height|letter spacing|text style)\b/i.test(text)) {
    return "typography";
  }

  if (/\b(spacing|space|gap|padding|margin|density)\b/i.test(text)) {
    return "spacing";
  }

  if (/\b(radius|radii|rounded|corner)\b/i.test(text)) {
    return "radius";
  }

  if (/\b(shadow|shadows|elevation)\b/i.test(text)) {
    return "shadow";
  }

  if (/\b(motion|animation|duration|easing|transition)\b/i.test(text)) {
    return "motion";
  }

  if (/\b(iconography|icons?)\b/i.test(text)) {
    return "iconography";
  }

  if (/\b(visual tokens?|design tokens?|tokens?)\b/i.test(text)) {
    return "other";
  }

  return undefined;
}

function designTokenCategoryFromValue(text: string): DesignTokenCategory | undefined {
  if (/(#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\()/i.test(text)) {
    return "color";
  }

  if (/\b\d+(?:\.\d+)?(?:px|rem|em|%)\b/i.test(text)) {
    return "spacing";
  }

  if (/\b\d+(?:\.\d+)?(?:ms|s)\b/i.test(text)) {
    return "motion";
  }

  return undefined;
}

function hasDesignTokenValue(text: string, category: DesignTokenCategory): boolean {
  if (/(#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\()/i.test(text)) {
    return true;
  }

  if (/\b\d+(?:\.\d+)?(?:px|rem|em|%|ms|s)\b/i.test(text)) {
    return true;
  }

  if (/^\s*[^:=]+[:=]\s*\S+/.test(text)) {
    return category !== "other" || /(?:color|font|spacing|radius|shadow|icon|motion|duration|easing)/i.test(text);
  }

  return false;
}

function parseDesignTokenLine(text: string, category: DesignTokenCategory, sourceLine: number): DesignToken | undefined {
  const split = /^`?([^`:=]+?)`?\s*[:=]\s*(.+)$/.exec(text);
  const name = split ? cleanDesignTokenName(split[1] ?? "") : cleanDesignTokenName(text);
  const value = split ? cleanDesignTokenValue(split[2] ?? "") : extractDesignTokenValue(text);

  if (!name || !value || isPlaceholderDesignTokenValue(value)) {
    return undefined;
  }

  return {
    category,
    sourceLine,
    name,
    value,
    summary: `${name}: ${value}`
  };
}

function cleanDesignTokenName(value: string): string {
  return value
    .replace(/^`|`$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDesignTokenValue(value: string): string {
  return value
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDesignTokenValue(text: string): string | undefined {
  const value = /(#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\([^)]+\)|\b\d+(?:\.\d+)?(?:px|rem|em|%|ms|s)\b)/i.exec(text)?.[0];

  return value ? cleanDesignTokenValue(value) : undefined;
}

function isPlaceholderDesignTokenValue(value: string): boolean {
  return /^(?:-|n\/a|none|tbd|todo|unknown|to be confirmed)$/i.test(value.trim());
}

export function extractDesignAssets(uiMarkdown: string, uiPath: string): DesignAsset[] {
  const assets: DesignAsset[] = [];
  const imagePattern = /!\[([^\]]*)\]\(([^)\n]+)\)/g;
  const linkPattern = /\[([^\]]+)\]\(([^)\n]+)\)/g;
  const bareUrlPattern = /https?:\/\/[^\s<>)]+/g;
  const baseDir = dirname(uiPath);

  for (const match of uiMarkdown.matchAll(imagePattern)) {
    const altText = (match[1] ?? "").trim();
    const reference = normalizeMarkdownImageReference(match[2] ?? "");

    if (!reference) {
      continue;
    }

    if (isRemoteReference(reference)) {
      assets.push({
        source: "ui-markdown-image",
        kind: "remote",
        altText,
        reference
      });
      continue;
    }

    const resolvedPath = normalize(isAbsolute(reference) ? reference : join(baseDir, reference));
    const exists = existsSync(resolvedPath);
    const metadata = exists ? extractDesignAssetMetadata(resolvedPath, reference) : undefined;
    const asset: DesignAsset = {
      source: "ui-markdown-image",
      kind: "local",
      altText,
      reference,
      resolvedPath,
      exists
    };

    if (metadata) {
      asset.metadata = metadata;
    }

    assets.push(asset);
  }

  const seenDesignReferences = new Set(assets.map((asset) => asset.reference.toLowerCase()));

  for (const match of uiMarkdown.matchAll(linkPattern)) {
    if (match.index !== undefined && match.index > 0 && uiMarkdown[match.index - 1] === "!") {
      continue;
    }

    const label = (match[1] ?? "").trim();
    const reference = normalizeMarkdownImageReference(match[2] ?? "");

    addRemoteDesignLinkAsset(assets, seenDesignReferences, reference, label);
  }

  for (const match of uiMarkdown.matchAll(bareUrlPattern)) {
    const reference = normalizeBareUrlReference(match[0] ?? "");

    addRemoteDesignLinkAsset(assets, seenDesignReferences, reference, designLinkLabel(reference));
  }

  return assets;
}

function addRemoteDesignLinkAsset(assets: DesignAsset[], seenReferences: Set<string>, reference: string, altText: string): void {
  if (!reference || !isRemoteDesignReference(reference)) {
    return;
  }

  const key = reference.toLowerCase();

  if (seenReferences.has(key)) {
    return;
  }

  seenReferences.add(key);
  assets.push({
    source: "ui-design-link",
    kind: "remote",
    altText,
    reference
  });
}

function extractDesignAssetMetadata(path: string, reference: string): DesignAssetMetadata | undefined {
  if (isSvgReference(reference)) {
    return extractSvgMetadata(path);
  }

  if (isPngReference(reference) || isJpegReference(reference)) {
    return extractRasterImageMetadata(path, reference);
  }

  return undefined;
}

function extractSvgMetadata(path: string): DesignAssetMetadata | undefined {
  try {
    const svg = readFileSync(path, "utf8");
    const root = /<svg\b([^>]*)>/i.exec(svg);
    const rootAttributes = root?.[1] ?? "";
    const title = extractFirstElementText(svg, "title");
    const description = extractFirstElementText(svg, "desc");
    const colors = extractSvgColors(svg, 12);
    const textSnippets = extractElementTexts(svg, "text", 8);
    const metadata: DesignAssetMetadata = {
      width: readSvgAttribute(rootAttributes, "width"),
      height: readSvgAttribute(rootAttributes, "height"),
      viewBox: readSvgAttribute(rootAttributes, "viewBox"),
      title,
      description,
      colors: colors.length ? colors : undefined,
      textSnippets: textSnippets.length ? textSnippets : undefined
    };

    return hasSvgMetadata(metadata) ? metadata : undefined;
  } catch {
    return undefined;
  }
}

function extractRasterImageMetadata(path: string, reference: string): DesignAssetMetadata | undefined {
  try {
    const bytes = readFileSync(path);
    const dimensions = isPngReference(reference) ? readPngDimensions(bytes) : readJpegDimensions(bytes);

    if (!dimensions) {
      return undefined;
    }

    return {
      width: String(dimensions.width),
      height: String(dimensions.height)
    };
  } catch {
    return undefined;
  }
}

function isSvgReference(value: string): boolean {
  return /\.svg(?:[?#].*)?$/i.test(value);
}

function isPngReference(value: string): boolean {
  return /\.png(?:[?#].*)?$/i.test(value);
}

function isJpegReference(value: string): boolean {
  return /\.jpe?g(?:[?#].*)?$/i.test(value);
}

function readPngDimensions(bytes: Buffer): { width: number; height: number } | undefined {
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  if (bytes.length < 24 || !pngSignature.every((byte, index) => bytes[index] === byte)) {
    return undefined;
  }

  return toDimensions(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
}

function readJpegDimensions(bytes: Buffer): { width: number; height: number } | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return undefined;
  }

  let offset = 2;

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }

    const marker = bytes[offset];
    offset += 1;

    if (marker === undefined || marker === 0xd9 || marker === 0xda) {
      return undefined;
    }

    if (isJpegStandaloneMarker(marker)) {
      continue;
    }

    if (offset + 2 > bytes.length) {
      return undefined;
    }

    const segmentLength = bytes.readUInt16BE(offset);
    const segmentStart = offset + 2;
    const nextOffset = offset + segmentLength;

    if (segmentLength < 2 || nextOffset > bytes.length) {
      return undefined;
    }

    if (isJpegStartOfFrameMarker(marker)) {
      if (segmentStart + 5 > bytes.length) {
        return undefined;
      }

      return toDimensions(bytes.readUInt16BE(segmentStart + 3), bytes.readUInt16BE(segmentStart + 1));
    }

    offset = nextOffset;
  }

  return undefined;
}

function isJpegStandaloneMarker(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

function isJpegStartOfFrameMarker(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function toDimensions(width: number, height: number): { width: number; height: number } | undefined {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  return { width, height };
}

function readSvgAttribute(attributes: string, name: string): string | undefined {
  const unquotedValue = "([^\\s\"'=<>`]+)";
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|${unquotedValue})`, "i");
  const match = pattern.exec(attributes);

  return cleanSvgText(match?.[1] ?? match?.[2] ?? match?.[3] ?? "");
}

function extractFirstElementText(svg: string, tagName: string): string | undefined {
  return extractElementTexts(svg, tagName, 1)[0];
}

function extractElementTexts(svg: string, tagName: string, limit: number): string[] {
  const snippets: string[] = [];
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");

  for (const match of svg.matchAll(pattern)) {
    const text = cleanSvgText(match[1] ?? "");

    if (!text || snippets.includes(text)) {
      continue;
    }

    snippets.push(text);

    if (snippets.length >= limit) {
      break;
    }
  }

  return snippets;
}

function cleanSvgText(value: string): string | undefined {
  const cleaned = decodeXmlEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return undefined;
  }

  return cleaned.length > 160 ? `${cleaned.slice(0, 157)}...` : cleaned;
}

function extractSvgColors(svg: string, limit: number): string[] {
  const colors: string[] = [];
  const seen = new Set<string>();
  const addColor = (value: string | undefined) => {
    const color = normalizeSvgColor(value ?? "");

    if (!color || seen.has(color)) {
      return;
    }

    seen.add(color);
    colors.push(color);
  };
  const colorAttributePattern =
    /\b(?:fill|stroke|stop-color|flood-color|lighting-color|color)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
  const colorDeclarationPattern =
    /\b(?:fill|stroke|stop-color|flood-color|lighting-color|color)\s*:\s*([^;}\n]+)/gi;

  for (const match of svg.matchAll(colorAttributePattern)) {
    addColor(match[1] ?? match[2] ?? match[3]);

    if (colors.length >= limit) {
      return colors;
    }
  }

  for (const match of svg.matchAll(colorDeclarationPattern)) {
    addColor(match[1]);

    if (colors.length >= limit) {
      return colors;
    }
  }

  return colors;
}

function normalizeSvgColor(value: string): string | undefined {
  const color = decodeXmlEntities(value)
    .replace(/\s*!important\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (
    !color ||
    /^(none|transparent|currentColor|inherit|initial|unset)$/i.test(color) ||
    /^url\(/i.test(color)
  ) {
    return undefined;
  }

  if (/^#[0-9a-f]{3,8}$/i.test(color)) {
    return color.toLowerCase();
  }

  if (/^(?:rgb|rgba|hsl|hsla)\(/i.test(color)) {
    return color
      .replace(/\s*,\s*/g, ", ")
      .replace(/\(\s+/g, "(")
      .replace(/\s+\)/g, ")");
  }

  if (/^var\(--[\w-]+\)$/i.test(color)) {
    return color;
  }

  if (isCommonSvgNamedColor(color)) {
    return color.toLowerCase();
  }

  return undefined;
}

function isCommonSvgNamedColor(value: string): boolean {
  return [
    "black",
    "white",
    "red",
    "green",
    "blue",
    "yellow",
    "cyan",
    "magenta",
    "gray",
    "grey",
    "orange",
    "purple",
    "pink",
    "brown",
    "navy",
    "teal",
    "lime",
    "olive",
    "maroon",
    "silver",
    "gold",
    "rebeccapurple"
  ].includes(value.toLowerCase());
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi, (entity, token: string) => {
    const normalized = token.toLowerCase();

    if (normalized === "amp") {
      return "&";
    }

    if (normalized === "lt") {
      return "<";
    }

    if (normalized === "gt") {
      return ">";
    }

    if (normalized === "quot") {
      return "\"";
    }

    if (normalized === "apos") {
      return "'";
    }

    const codePoint = normalized.startsWith("#x")
      ? Number.parseInt(normalized.slice(2), 16)
      : Number.parseInt(normalized.slice(1), 10);

    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
  });
}

function hasSvgMetadata(metadata: DesignAssetMetadata): boolean {
  return Boolean(
    metadata.width ||
    metadata.height ||
    metadata.viewBox ||
    metadata.title ||
    metadata.description ||
    metadata.colors?.length ||
    metadata.textSnippets?.length
  );
}

function buildOpenQuestions(
  context: ProjectContext,
  stack: StackProfile,
  acceptanceCriteria: string[]
): string[] {
  const questions: string[] = [];

  if (acceptanceCriteria.length === 0) {
    questions.push("Requirements do not include explicit acceptance criteria.");
  }

  if (stack.frameworks.length === 0) {
    questions.push("No frontend framework was detected; implementation should confirm the target stack.");
  }

  if (!context.ui.toLowerCase().includes("responsive")) {
    questions.push("UI notes do not explicitly describe responsive behavior.");
  }

  if (extractApiErrorCases(context.api, context.apiPath).length === 0) {
    questions.push("API docs do not explicitly describe error handling.");
  }

  if (extractApiContracts(context.api, context.apiPath).length === 0) {
    questions.push("API docs do not include recognizable HTTP endpoint contracts.");
  }

  if (extractApiAuthRequirements(context.api, context.apiPath).length === 0) {
    questions.push("API docs do not explicitly describe authentication or authorization requirements.");
  }

  for (const invalidModel of extractApiDataModels(context.api, context.apiPath).invalid) {
    questions.push(`API docs contain an invalid API data model at line ${invalidModel.sourceLine}: ${invalidModel.error}`);
  }

  for (const asset of extractDesignAssets(context.ui, context.uiPath)) {
    if (asset.kind === "local" && asset.exists === false) {
      questions.push(`UI design asset was referenced but not found: ${asset.reference}`);
    }
  }

  return questions;
}

function extractSectionListItems(markdown: string, headingPattern: RegExp, limit: number): string[] {
  const items: string[] = [];
  const lines = markdown.split(/\r?\n/);
  let inMatchingSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const heading = /^#{1,6}\s+(.+)$/.exec(trimmed);

    if (heading) {
      inMatchingSection = headingPattern.test(heading[1] ?? "");
      continue;
    }

    if (!inMatchingSection) {
      continue;
    }

    const item = normalizeMarkdownListItem(trimmed);

    if (!item || isPlaceholderRequirementItem(item)) {
      continue;
    }

    items.push(item);
  }

  return uniqueMarkdownItems(items, limit);
}

function normalizeMarkdownListItem(line: string): string | undefined {
  const item = line
    .replace(/^(?:[-*]|\d+\.)\s+/, "")
    .replace(/^\[[ xX]\]\s+/, "")
    .trim();

  return item === line ? undefined : item;
}

function classifyUiChecklistHeading(heading: string): UiStateChecklistKind | undefined {
  if (/\b(screens?|routes?|views?)\b/i.test(heading)) {
    return "screen";
  }

  if (/\bcomponents?\b/i.test(heading)) {
    return "component";
  }

  if (/\b(states?|status|statuses|visual states?)\b/i.test(heading)) {
    return "state";
  }

  if (/\b(responsive|breakpoints?|viewports?|mobile|tablet|desktop)\b/i.test(heading)) {
    return "responsive";
  }

  if (/\b(interactions?|behaviors?|controls?|actions?)\b/i.test(heading)) {
    return "interaction";
  }

  if (/\b(accessibility|a11y|keyboard|focus|aria)\b/i.test(heading)) {
    return "accessibility";
  }

  return undefined;
}

function classifyUiChecklistKeyword(summary: string): UiStateChecklistKind | undefined {
  if (/\b(responsive|desktop|tablet|mobile|breakpoint|viewport|stack|single-column|two-column)\b/i.test(summary)) {
    return "responsive";
  }

  if (/\b(accessibility|a11y|keyboard|focus|aria|screen reader|semantic|label)\b/i.test(summary)) {
    return "accessibility";
  }

  if (/\b(hover|active|disabled|selected|checked|expanded|collapsed|drag|drop|click|tap|search|filter|sort|submit|cancel|save|retry|refresh|navigate|open|close)\b/i.test(summary)) {
    return "interaction";
  }

  if (/\b(loading|empty|error|success|skeleton|toast|modal|drawer|healthy|warning|blocked|in progress|pending|failed|offline|stale|unavailable)\b/i.test(summary)) {
    return "state";
  }

  return undefined;
}

function addUiStateChecklistItem(
  items: UiStateChecklistItem[],
  seen: Set<string>,
  item: UiStateChecklistItem
): void {
  const key = `${item.kind}:${item.summary.toLowerCase()}`;

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  items.push(item);
}

function extractAmbiguousRequirementRisks(requirementsMarkdown: string): DeliveryRisk[] {
  const risks: DeliveryRisk[] = [];
  const lines = requirementsMarkdown.split(/\r?\n/);
  let inFence = false;

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }

    if (inFence || !trimmed) {
      continue;
    }

    const summary = normalizeMarkdownListItem(trimmed) ?? trimmed.replace(/^#{1,6}\s+/, "");

    if (/^(?:requirements?|goal|user stories?|acceptance criteria|constraints?)$/i.test(summary)) {
      continue;
    }

    if (/\b(TBD|TODO|FIXME|unknown|not sure|to be decided|to be confirmed)\b/i.test(summary)) {
      risks.push({
        level: "high",
        source: "requirements",
        sourceLine: index + 1,
        summary: `Requirement contains an unresolved placeholder: ${summary}`,
        recommendation: "Resolve the placeholder before source-changing execution."
      });
      continue;
    }

    if (/\b(maybe|probably|roughly|nice to have|eventually|later|future|etc\.?)\b/i.test(summary)) {
      risks.push({
        level: "medium",
        source: "requirements",
        sourceLine: index + 1,
        summary: `Requirement uses tentative scope language: ${summary}`,
        recommendation: "Clarify whether this behavior is in scope for the current delivery."
      });
      continue;
    }

    if (/\b(fast|intuitive|simple|clean|polished|beautiful|modern|easy)\b/i.test(summary)) {
      risks.push({
        level: "medium",
        source: "requirements",
        sourceLine: index + 1,
        summary: `Requirement uses subjective quality language: ${summary}`,
        recommendation: "Convert subjective quality goals into measurable acceptance criteria or visual checks."
      });
    }
  }

  return risks;
}

function uniqueDeliveryRisks(risks: DeliveryRisk[], limit: number): DeliveryRisk[] {
  const uniqueRisks: DeliveryRisk[] = [];
  const seen = new Set<string>();

  for (const risk of risks) {
    const key = `${risk.level}:${risk.source}:${risk.sourceLine ?? ""}:${risk.summary.toLowerCase()}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueRisks.push(risk);

    if (uniqueRisks.length >= limit) {
      break;
    }
  }

  return uniqueRisks;
}

function isPlaceholderRequirementItem(item: string): boolean {
  return item.endsWith(":") || item.includes("...");
}

function uniqueMarkdownItems(items: string[], limit: number): string[] {
  const uniqueItems: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const key = item.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueItems.push(item);

    if (uniqueItems.length >= limit) {
      break;
    }
  }

  return uniqueItems;
}

function normalizeMarkdownImageReference(value: string): string {
  const trimmed = value.trim();
  const withoutAngles = trimmed.startsWith("<") && trimmed.includes(">")
    ? trimmed.slice(1, trimmed.indexOf(">"))
    : trimmed;
  const titleIndex = withoutAngles.search(/\s+["']/);
  const reference = titleIndex >= 0 ? withoutAngles.slice(0, titleIndex) : withoutAngles;

  return reference.trim();
}

function normalizeBareUrlReference(value: string): string {
  return value.trim().replace(/[),.;:]+$/g, "");
}

function isRemoteReference(value: string): boolean {
  return /^https?:\/\//i.test(value) || /^data:/i.test(value);
}

function isPotentialLocalOpenApiReference(value: string): boolean {
  if (!value || isRemoteReference(value)) {
    return false;
  }

  const normalized = value.replaceAll("\\", "/");

  return /\.(?:json|ya?ml)(?:[?#].*)?$/i.test(normalized) && /(?:^|[/._-])(?:api|openapi|swagger)(?:[/._-]|$)/i.test(normalized);
}

function isPotentialLocalGraphqlReference(value: string): boolean {
  if (!value || isRemoteReference(value)) {
    return false;
  }

  return /\.(?:graphql|gql)(?:[?#].*)?$/i.test(value.replaceAll("\\", "/"));
}

function stripReferenceQuery(value: string): string {
  return value.split(/[?#]/, 1)[0] ?? value;
}

function isJsonReference(value: string): boolean {
  return /\.json(?:[?#].*)?$/i.test(value);
}

function isRemoteDesignReference(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) {
    return false;
  }

  try {
    const hostname = new URL(value).hostname.toLowerCase();

    return (
      hostname === "xd.adobe.com" ||
      matchesDesignHost(hostname, "figma.com") ||
      matchesDesignHost(hostname, "figjam.com") ||
      matchesDesignHost(hostname, "framer.com") ||
      matchesDesignHost(hostname, "invisionapp.com") ||
      matchesDesignHost(hostname, "sketch.cloud") ||
      matchesDesignHost(hostname, "zeplin.io")
    );
  } catch {
    return false;
  }
}

function matchesDesignHost(hostname: string, expected: string): boolean {
  return hostname === expected || hostname.endsWith(`.${expected}`);
}

function designLinkLabel(reference: string): string {
  try {
    const hostname = new URL(reference).hostname.toLowerCase();

    if (matchesDesignHost(hostname, "figma.com") || matchesDesignHost(hostname, "figjam.com")) {
      return "Figma design";
    }

    if (hostname === "xd.adobe.com") {
      return "Adobe XD design";
    }

    if (matchesDesignHost(hostname, "framer.com")) {
      return "Framer design";
    }

    if (matchesDesignHost(hostname, "invisionapp.com")) {
      return "InVision design";
    }

    if (matchesDesignHost(hostname, "sketch.cloud")) {
      return "Sketch design";
    }

    if (matchesDesignHost(hostname, "zeplin.io")) {
      return "Zeplin design";
    }
  } catch {
    return "Design reference";
  }

  return "Design reference";
}

function normalizeApiSummary(line: string): string {
  return line
    .replace(/^\s*[-*]\s+/, "")
    .replace(/`/g, "")
    .trim();
}

function extractApiParametersFromPath(path: string): ApiParameter[] {
  const parameters: ApiParameter[] = [];
  const seen = new Set<string>();
  const [pathWithoutQuery = "", query = ""] = path.split("?", 2);

  for (const match of pathWithoutQuery.matchAll(/\{([^}/?#]+)\}|\/:([A-Za-z_][A-Za-z0-9_]*)/g)) {
    const name = normalizeApiParameterName(match[1] ?? match[2]);

    if (!name) {
      continue;
    }

    addApiParameter(parameters, seen, {
      name,
      in: "path",
      required: true,
      summary: `path parameter ${name} required`
    });
  }

  for (const part of query.split("&")) {
    if (!part.trim()) {
      continue;
    }

    const [rawName = "", rawValue = ""] = part.split("=", 2);
    const name = normalizeApiParameterName(decodeUrlPart(rawName));

    if (!name) {
      continue;
    }

    const defaultValue = decodeUrlPart(rawValue);
    addApiParameter(parameters, seen, {
      name,
      in: "query",
      required: false,
      defaultValue: defaultValue || undefined,
      summary: `query parameter ${name}${defaultValue ? ` default ${defaultValue}` : ""}`
    });
  }

  return parameters;
}

function decodeUrlPart(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function normalizeApiParameterName(name: string | undefined): string | undefined {
  const cleaned = name?.replace(/`/g, "").trim();

  return cleaned || undefined;
}

function addApiParameter(parameters: ApiParameter[], seen: Set<string>, parameter: ApiParameter): void {
  const key = `${parameter.in}:${parameter.name.toLowerCase()}`;

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  parameters.push(parameter);
}

function extractInlineGraphqlContracts(line: string, sourceLine: number): ApiContract[] {
  const summary = normalizeApiSummary(line);

  if (!summary || !/\b(?:query|mutation|subscription)\s+[_A-Za-z][_0-9A-Za-z]*/.test(summary)) {
    return [];
  }

  if (!/\bGraphQL\b/i.test(summary) && !/`[^`]*\b(?:query|mutation|subscription)\s+[_A-Za-z][_0-9A-Za-z]*/.test(line) && !/[({]/.test(summary)) {
    return [];
  }

  return extractGraphqlOperationContracts(summary, sourceLine, summary, false);
}

function extractGraphqlOperationContracts(
  content: string,
  sourceLine: number,
  summary?: string,
  allowAnonymous = true,
  options?: { fixedSourceLine?: boolean }
): ApiContract[] {
  const contracts: ApiContract[] = [];
  const operationPattern = /\b(query|mutation|subscription)\b\s*([_A-Za-z][_0-9A-Za-z]*)?/g;

  for (const match of content.matchAll(operationPattern)) {
    const operation = match[1];
    const name = match[2];

    if (!operation || (!name && !allowAnonymous)) {
      continue;
    }

    const path = name ? `${operation} ${name}` : operation;
    const lineOffset = options?.fixedSourceLine ? 0 : content.slice(0, match.index).split(/\r?\n/).length - 1;

    contracts.push({
      method: "GRAPHQL",
      path,
      sourceLine: sourceLine + lineOffset,
      summary: summary ?? `GraphQL ${path}`
    });
  }

  return contracts;
}

function extractGraphqlSchemaOperationContracts(
  content: string,
  sourceLine: number,
  options?: { fixedSourceLine?: boolean }
): ApiContract[] {
  const contracts: ApiContract[] = [];

  for (const definition of extractGraphqlDefinitions(content)) {
    if (definition.kind !== "type") {
      continue;
    }

    const operation = graphqlRootOperation(definition.name);
    if (!operation) {
      continue;
    }

    const definitionSourceLine = options?.fixedSourceLine ? sourceLine : sourceLine + definition.lineOffset;

    for (const field of extractGraphqlFields(definition.body)) {
      const fieldSourceLine = options?.fixedSourceLine ? sourceLine : definitionSourceLine + field.lineOffset;
      const args = field.args ? normalizeGraphqlArguments(field.args) : undefined;

      contracts.push({
        method: "GRAPHQL",
        path: `${operation} ${field.name}`,
        sourceLine: fieldSourceLine,
        summary: args ? `GraphQL ${operation} ${field.name}${args}` : `GraphQL ${operation} ${field.name}`
      });
    }
  }

  return contracts;
}

function addApiContract(contracts: ApiContract[], seen: Set<string>, contract: ApiContract): void {
  const key = `${contract.method} ${contract.path}`;

  if (!contract.method || !contract.path) {
    return;
  }

  if (seen.has(key)) {
    const existing = contracts.find((item) => `${item.method} ${item.path}` === key);

    if (existing && contract.parameters?.length) {
      existing.parameters = mergeApiParameters(existing.parameters, contract.parameters);
    }

    return;
  }

  seen.add(key);
  contracts.push(contract);
}

function mergeApiParameters(
  current: ApiParameter[] | undefined,
  incoming: ApiParameter[]
): ApiParameter[] {
  const merged: ApiParameter[] = [];
  const seen = new Set<string>();

  for (const parameter of [...(current ?? []), ...incoming]) {
    addApiParameter(merged, seen, parameter);
  }

  return merged.length ? merged : [];
}

function formatApiParameterSummary(parameter: ApiParameter): string {
  const required = parameter.required === undefined
    ? undefined
    : parameter.required
      ? "required"
      : "optional";
  const details = [
    parameter.schema,
    required,
    parameter.defaultValue ? `default ${parameter.defaultValue}` : undefined
  ].filter((value): value is string => Boolean(value));

  return `${parameter.in} ${parameter.name}${details.length ? ` (${details.join(", ")})` : ""}`;
}

function extractOpenApiDocuments(markdown: string, apiPath?: string): Array<{ sourceLine: number; document: Record<string, unknown> }> {
  return [
    ...extractJsonOpenApiDocuments(markdown),
    ...extractYamlOpenApiDocuments(markdown),
    ...extractLinkedOpenApiDocuments(markdown, apiPath)
  ];
}

function extractJsonOpenApiDocuments(markdown: string): Array<{ sourceLine: number; document: Record<string, unknown> }> {
  const documents: Array<{ sourceLine: number; document: Record<string, unknown> }> = [];

  for (const block of extractJsonBlocks(markdown)) {
    try {
      const parsed = JSON.parse(block.content) as unknown;

      if (isOpenApiDocument(parsed)) {
        documents.push({
          sourceLine: block.sourceLine,
          document: parsed
        });
      }
    } catch {
      continue;
    }
  }

  return documents;
}

function extractYamlOpenApiDocuments(markdown: string): Array<{ sourceLine: number; document: Record<string, unknown> }> {
  const documents: Array<{ sourceLine: number; document: Record<string, unknown> }> = [];

  for (const block of extractYamlBlocks(markdown)) {
    try {
      const parsed = parseYaml(block.content) as unknown;

      if (isOpenApiDocument(parsed)) {
        documents.push({
          sourceLine: block.sourceLine,
          document: parsed
        });
      }
    } catch {
      continue;
    }
  }

  return documents;
}

function extractLinkedOpenApiDocuments(markdown: string, apiPath: string | undefined): Array<{ sourceLine: number; document: Record<string, unknown> }> {
  const documents: Array<{ sourceLine: number; document: Record<string, unknown> }> = [];

  for (const block of extractLinkedOpenApiBlocks(markdown, apiPath)) {
    try {
      const parsed = parseLinkedOpenApiBlock(block);

      if (isOpenApiDocument(parsed)) {
        documents.push({
          sourceLine: block.sourceLine,
          document: parsed
        });
      }
    } catch {
      continue;
    }
  }

  return documents;
}

function extractLinkedOpenApiBlocks(markdown: string, apiPath: string | undefined): LinkedOpenApiBlock[] {
  if (!apiPath) {
    return [];
  }

  const blocks: LinkedOpenApiBlock[] = [];
  const seen = new Set<string>();
  const linkPattern = /\[([^\]]+)\]\(([^)\n]+)\)/g;
  const baseDir = dirname(apiPath);

  for (const match of markdown.matchAll(linkPattern)) {
    const reference = normalizeMarkdownImageReference(match[2] ?? "");
    const fileReference = stripReferenceQuery(reference);

    if (!isPotentialLocalOpenApiReference(reference)) {
      continue;
    }

    const resolvedPath = normalize(isAbsolute(fileReference) ? fileReference : join(baseDir, fileReference));
    const key = resolvedPath.toLowerCase();

    if (seen.has(key) || !existsSync(resolvedPath)) {
      continue;
    }

    seen.add(key);
    blocks.push({
      sourceLine: match.index === undefined ? 1 : markdown.slice(0, match.index).split(/\r?\n/).length,
      content: readFileSync(resolvedPath, "utf8"),
      kind: isJsonReference(fileReference) ? "json" : "yaml",
      reference
    });
  }

  return blocks;
}

function extractLinkedGraphqlBlocks(markdown: string, apiPath: string | undefined): LinkedGraphqlBlock[] {
  if (!apiPath) {
    return [];
  }

  const blocks: LinkedGraphqlBlock[] = [];
  const seen = new Set<string>();
  const linkPattern = /\[([^\]]+)\]\(([^)\n]+)\)/g;
  const baseDir = dirname(apiPath);

  for (const match of markdown.matchAll(linkPattern)) {
    const reference = normalizeMarkdownImageReference(match[2] ?? "");
    const fileReference = stripReferenceQuery(reference);

    if (!isPotentialLocalGraphqlReference(reference)) {
      continue;
    }

    const resolvedPath = normalize(isAbsolute(fileReference) ? fileReference : join(baseDir, fileReference));
    const key = resolvedPath.toLowerCase();

    if (seen.has(key) || !existsSync(resolvedPath)) {
      continue;
    }

    seen.add(key);
    blocks.push({
      sourceLine: match.index === undefined ? 1 : markdown.slice(0, match.index).split(/\r?\n/).length,
      content: readFileSync(resolvedPath, "utf8"),
      reference
    });
  }

  return blocks;
}

function parseLinkedOpenApiBlock(block: LinkedOpenApiBlock): unknown {
  return block.kind === "json" ? JSON.parse(block.content) : parseYaml(block.content);
}

function isOpenApiDocument(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value) && typeof value.openapi === "string" && isPlainObject(value.paths);
}

function extractOpenApiContracts(openApi: { sourceLine: number; document: Record<string, unknown> }): ApiContract[] {
  const contracts: ApiContract[] = [];
  const paths = openApi.document.paths;

  if (!isPlainObject(paths)) {
    return contracts;
  }

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!isPlainObject(pathItem)) {
      continue;
    }

    for (const [method, operation] of Object.entries(pathItem)) {
      const normalizedMethod = method.toUpperCase();

      if (!isHttpMethod(normalizedMethod) || !isPlainObject(operation)) {
        continue;
      }

      const summary = stringValue(operation.summary) ?? stringValue(operation.description) ?? `${normalizedMethod} ${path}`;
      const parameters = readOpenApiParameters(openApi.document, pathItem.parameters, operation.parameters);
      const contract: ApiContract = {
        method: normalizedMethod,
        path,
        sourceLine: openApi.sourceLine,
        summary
      };

      if (parameters?.length) {
        contract.parameters = parameters;
      }

      contracts.push(contract);
    }
  }

  return contracts;
}

function readOpenApiParameters(
  document: Record<string, unknown>,
  pathParameters: unknown,
  operationParameters: unknown
): ApiParameter[] | undefined {
  const parameters: ApiParameter[] = [];
  const seen = new Set<string>();

  for (const value of [...readOpenApiParameterObjects(document, pathParameters), ...readOpenApiParameterObjects(document, operationParameters)]) {
    const name = normalizeApiParameterName(stringValue(value.name));
    const location = normalizeApiParameterLocation(stringValue(value.in));

    if (!name || !location) {
      continue;
    }

    const required = value.required === true || location === "path"
      ? true
      : value.required === false
        ? false
        : undefined;
    const schema = describeOpenApiParameterSchema(value.schema);
    const defaultValue = readOpenApiParameterDefault(value);
    const description = stringValue(value.description);
    const parameter: ApiParameter = {
      name,
      in: location,
      summary: [
        `${location} parameter ${name}`,
        required === undefined ? undefined : required ? "required" : "optional",
        schema ? `schema ${schema}` : undefined,
        defaultValue ? `default ${defaultValue}` : undefined,
        description
      ].filter((part): part is string => Boolean(part)).join("; ")
    };

    if (required !== undefined) {
      parameter.required = required;
    }

    if (schema) {
      parameter.schema = schema;
    }

    if (defaultValue) {
      parameter.defaultValue = defaultValue;
    }

    addApiParameter(parameters, seen, parameter);
  }

  return parameters.length ? parameters : undefined;
}

function readOpenApiParameterObjects(
  document: Record<string, unknown>,
  value: unknown
): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => resolveOpenApiParameter(document, item))
    .filter((item): item is Record<string, unknown> => Boolean(item));
}

function resolveOpenApiParameter(
  document: Record<string, unknown>,
  value: unknown
): Record<string, unknown> | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const ref = stringValue(value.$ref);

  if (!ref) {
    return value;
  }

  const resolved = resolveOpenApiRef(document, ref);

  return isPlainObject(resolved) ? resolved : undefined;
}

function resolveOpenApiRef(document: Record<string, unknown>, ref: string): unknown {
  if (!ref.startsWith("#/")) {
    return undefined;
  }

  return ref
    .slice(2)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce<unknown>((current, part) => isPlainObject(current) ? current[part] : undefined, document);
}

function normalizeApiParameterLocation(value: string | undefined): ApiParameterLocation | undefined {
  if (value === "cookie" || value === "header" || value === "path" || value === "query") {
    return value;
  }

  return undefined;
}

function describeOpenApiParameterSchema(schema: unknown): string | undefined {
  if (!isPlainObject(schema)) {
    return undefined;
  }

  const ref = stringValue(schema.$ref);
  if (ref) {
    return formatOpenApiRef(ref);
  }

  const type = stringValue(schema.type);
  const format = stringValue(schema.format);
  const enumValues = Array.isArray(schema.enum)
    ? schema.enum.map((value) => scalarToString(value)).filter((value): value is string => Boolean(value)).slice(0, 6)
    : [];
  const parts = [
    type,
    format ? `format ${format}` : undefined,
    enumValues.length ? `enum ${enumValues.join("|")}` : undefined
  ].filter((value): value is string => Boolean(value));

  return parts.length ? parts.join(", ") : undefined;
}

function readOpenApiParameterDefault(parameter: Record<string, unknown>): string | undefined {
  if (isPlainObject(parameter.schema)) {
    const schemaDefault = scalarToString(parameter.schema.default);

    if (schemaDefault) {
      return schemaDefault;
    }
  }

  return scalarToString(parameter.example);
}

function scalarToString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function extractOpenApiErrorCases(openApi: { sourceLine: number; document: Record<string, unknown> }): ApiErrorCase[] {
  const cases: ApiErrorCase[] = [];
  const paths = openApi.document.paths;

  if (!isPlainObject(paths)) {
    return cases;
  }

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!isPlainObject(pathItem)) {
      continue;
    }

    for (const [method, operation] of Object.entries(pathItem)) {
      const normalizedMethod = method.toUpperCase();

      if (!isHttpMethod(normalizedMethod) || !isPlainObject(operation) || !isPlainObject(operation.responses)) {
        continue;
      }

      for (const [status, response] of Object.entries(operation.responses)) {
        if (!isErrorStatus(status)) {
          continue;
        }

        const description = isPlainObject(response) ? stringValue(response.description) : undefined;
        cases.push({
          sourceLine: openApi.sourceLine,
          summary: `${normalizedMethod} ${path} ${status}: ${description ?? "error response"}`
        });
      }
    }
  }

  return cases;
}

function extractOpenApiAuthRequirements(
  openApi: { sourceLine: number; document: Record<string, unknown> }
): ApiAuthRequirement[] {
  const requirements: ApiAuthRequirement[] = [];
  const components = openApi.document.components;
  const securitySchemes = isPlainObject(components) && isPlainObject(components.securitySchemes)
    ? components.securitySchemes
    : undefined;

  if (securitySchemes) {
    for (const [name, scheme] of Object.entries(securitySchemes)) {
      if (!isPlainObject(scheme)) {
        continue;
      }

      const parts = [
        stringValue(scheme.type),
        stringValue(scheme.scheme),
        stringValue(scheme.bearerFormat)
      ].filter((value): value is string => Boolean(value));
      requirements.push({
        sourceLine: openApi.sourceLine,
        summary: `OpenAPI security scheme ${name}: ${parts.length ? parts.join(" ") : "configured"}`
      });
    }
  }

  for (const names of readSecurityRequirementNames(openApi.document.security)) {
    requirements.push({
      sourceLine: openApi.sourceLine,
      summary: `OpenAPI global security requirement: ${names.join(", ")}`
    });
  }

  const paths = openApi.document.paths;

  if (!isPlainObject(paths)) {
    return requirements;
  }

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!isPlainObject(pathItem)) {
      continue;
    }

    for (const [method, operation] of Object.entries(pathItem)) {
      const normalizedMethod = method.toUpperCase();

      if (!isHttpMethod(normalizedMethod) || !isPlainObject(operation)) {
        continue;
      }

      for (const names of readSecurityRequirementNames(operation.security)) {
        requirements.push({
          sourceLine: openApi.sourceLine,
          summary: `OpenAPI ${normalizedMethod} ${path} security requirement: ${names.join(", ")}`
        });
      }
    }
  }

  return requirements;
}

function describeOpenApiDataModels(openApi: { sourceLine: number; document: Record<string, unknown> }): ApiDataModel[] {
  const models: ApiDataModel[] = [];
  const seen = new Set<string>();
  const components = openApi.document.components;
  const schemas = isPlainObject(components) && isPlainObject(components.schemas) ? components.schemas : undefined;

  if (schemas) {
    for (const [name, schema] of Object.entries(schemas)) {
      addOpenApiDataModel(models, seen, {
        name,
        sourceLine: openApi.sourceLine,
        fields: describeOpenApiSchemaFields(schema),
        summary: "OpenAPI component schema"
      });
    }
  }

  const paths = openApi.document.paths;

  if (!isPlainObject(paths)) {
    return models;
  }

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!isPlainObject(pathItem)) {
      continue;
    }

    for (const [method, operation] of Object.entries(pathItem)) {
      const normalizedMethod = method.toUpperCase();

      if (!isHttpMethod(normalizedMethod) || !isPlainObject(operation)) {
        continue;
      }

      const requestBody = operation.requestBody;
      if (isPlainObject(requestBody)) {
        for (const contentSchema of readOpenApiContentSchemas(requestBody.content)) {
          addOpenApiDataModel(models, seen, {
            name: `${normalizedMethod} ${path} request`,
            sourceLine: openApi.sourceLine,
            fields: describeOpenApiSchemaFields(contentSchema.schema),
            summary: `OpenAPI request schema (${contentSchema.mediaType})`
          });
        }
      }

      if (!isPlainObject(operation.responses)) {
        continue;
      }

      for (const [status, response] of Object.entries(operation.responses)) {
        if (!isPlainObject(response)) {
          continue;
        }

        for (const contentSchema of readOpenApiContentSchemas(response.content)) {
          addOpenApiDataModel(models, seen, {
            name: `${normalizedMethod} ${path} ${status} response`,
            sourceLine: openApi.sourceLine,
            fields: describeOpenApiSchemaFields(contentSchema.schema),
            summary: `OpenAPI response schema (${contentSchema.mediaType})`
          });
        }
      }
    }
  }

  return models;
}

function addOpenApiDataModel(
  models: ApiDataModel[],
  seen: Set<string>,
  model: ApiDataModel
): void {
  const key = `${model.name}:${model.summary}`;

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  models.push(model);
}

function readOpenApiContentSchemas(value: unknown): Array<{ mediaType: string; schema: unknown }> {
  if (!isPlainObject(value)) {
    return [];
  }

  const schemas: Array<{ mediaType: string; schema: unknown }> = [];

  for (const [mediaType, media] of Object.entries(value)) {
    if (isPlainObject(media) && media.schema !== undefined) {
      schemas.push({
        mediaType,
        schema: media.schema
      });
    }
  }

  return schemas;
}

function describeOpenApiSchemaFields(schema: unknown): string[] {
  if (!isPlainObject(schema)) {
    return [];
  }

  const ref = stringValue(schema.$ref);

  if (ref) {
    return [`$ref: ${formatOpenApiRef(ref)}`];
  }

  if (isPlainObject(schema.properties)) {
    return Object.keys(schema.properties);
  }

  if (isPlainObject(schema.items)) {
    return describeOpenApiSchemaFields(schema.items).map((field) => `items.${field}`);
  }

  return [];
}

type GraphqlDefinitionKind = "enum" | "input" | "interface" | "type";

interface GraphqlDefinition {
  kind: GraphqlDefinitionKind;
  name: string;
  body: string;
  lineOffset: number;
}

interface GraphqlField {
  name: string;
  args?: string;
  lineOffset: number;
}

function describeGraphqlDataModels(
  content: string,
  sourceLine: number,
  options?: { fixedSourceLine?: boolean }
): ApiDataModel[] {
  const models: ApiDataModel[] = [];
  const seen = new Set<string>();

  for (const definition of extractGraphqlDefinitions(content)) {
    if (definition.kind === "type" && graphqlRootOperation(definition.name)) {
      continue;
    }

    const fields = definition.kind === "enum"
      ? extractGraphqlEnumValues(definition.body)
      : extractGraphqlFields(definition.body).map((field) => field.name);

    addGraphqlDataModel(models, seen, {
      name: definition.name,
      sourceLine: options?.fixedSourceLine ? sourceLine : sourceLine + definition.lineOffset,
      fields,
      summary: `GraphQL ${definition.kind}`
    });
  }

  return models;
}

function addGraphqlDataModel(
  models: ApiDataModel[],
  seen: Set<string>,
  model: ApiDataModel
): void {
  const key = `${model.name}:${model.summary}`;

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  models.push(model);
}

function extractGraphqlDefinitions(content: string): GraphqlDefinition[] {
  const definitions: GraphqlDefinition[] = [];
  const definitionPattern = /\b(type|input|interface|enum)\s+([_A-Za-z][_0-9A-Za-z]*)[^{]*\{([\s\S]*?)\}/g;

  for (const match of content.matchAll(definitionPattern)) {
    const kind = match[1] as GraphqlDefinitionKind | undefined;
    const name = match[2];
    const body = match[3];

    if (!kind || !name || body === undefined) {
      continue;
    }

    definitions.push({
      kind,
      name,
      body,
      lineOffset: content.slice(0, match.index).split(/\r?\n/).length - 1
    });
  }

  return definitions;
}

function extractGraphqlFields(body: string): GraphqlField[] {
  const fields: GraphqlField[] = [];

  for (const [index, line] of body.split(/\r?\n/).entries()) {
    const normalized = stripGraphqlComment(line).trim();
    const match = /^([_A-Za-z][_0-9A-Za-z]*)(\s*\([^)]*\))?\s*:/.exec(normalized);
    const name = match?.[1];

    if (!name) {
      continue;
    }

    fields.push({
      name,
      args: match[2],
      lineOffset: index
    });
  }

  return fields;
}

function extractGraphqlEnumValues(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => {
      const normalized = stripGraphqlComment(line).trim();
      const match = /^([_A-Za-z][_0-9A-Za-z]*)\b/.exec(normalized);

      return match?.[1];
    })
    .filter((value): value is string => Boolean(value))
    .slice(0, 16);
}

function stripGraphqlComment(value: string): string {
  return value.replace(/#.*/, "");
}

function normalizeGraphqlArguments(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function graphqlRootOperation(name: string): "mutation" | "query" | "subscription" | undefined {
  if (name === "Query") {
    return "query";
  }

  if (name === "Mutation") {
    return "mutation";
  }

  if (name === "Subscription") {
    return "subscription";
  }

  return undefined;
}

function formatOpenApiRef(ref: string): string {
  const parts = ref.split("/");

  return parts[parts.length - 1] || ref;
}

function readSecurityRequirementNames(value: unknown): string[][] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isPlainObject)
    .map((item) => Object.keys(item))
    .filter((names) => names.length > 0);
}

function isHttpMethod(value: string): boolean {
  return ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"].includes(value);
}

function isErrorStatus(value: string): boolean {
  return /^4\d\d$/.test(value) || /^5\d\d$/.test(value) || value.toLowerCase() === "default";
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function extractApiNotes(
  markdown: string,
  options: {
    headingPattern: RegExp;
    keywordPattern: RegExp;
  }
): Array<{ sourceLine: number; summary: string }> {
  const notes: Array<{ sourceLine: number; summary: string }> = [];
  const seen = new Set<string>();
  const lines = markdown.split(/\r?\n/);
  let inMatchingSection = false;
  let inFence = false;

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      continue;
    }

    const heading = /^#{1,6}\s+(.+)$/.exec(trimmed);

    if (heading) {
      inMatchingSection = options.headingPattern.test(heading[1] ?? "");
      continue;
    }

    const summary = normalizeApiNoteLine(trimmed);

    if (!summary) {
      continue;
    }

    if (!inMatchingSection && !options.keywordPattern.test(summary)) {
      continue;
    }

    const key = summary.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    notes.push({
      sourceLine: index + 1,
      summary
    });
  }

  return notes;
}

function addApiNote(
  notes: Array<{ sourceLine: number; summary: string }>,
  seen: Set<string>,
  note: { sourceLine: number; summary: string }
): void {
  const key = note.summary.toLowerCase();

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  notes.push(note);
}

function normalizeApiNoteLine(line: string): string {
  return line
    .replace(/^\s*[-*]\s+/, "")
    .replace(/`/g, "")
    .trim();
}

function extractJsonBlocks(markdown: string): MarkdownCodeBlock[] {
  return extractFencedCodeBlocks(markdown, /^```json\s*$/i);
}

function extractYamlBlocks(markdown: string): MarkdownCodeBlock[] {
  return extractFencedCodeBlocks(markdown, /^```ya?ml\s*$/i);
}

function extractGraphqlBlocks(markdown: string): MarkdownCodeBlock[] {
  return extractFencedCodeBlocks(markdown, /^```(?:graphql|gql)\s*$/i);
}

function extractFencedCodeBlocks(markdown: string, openingPattern: RegExp): MarkdownCodeBlock[] {
  const blocks: MarkdownCodeBlock[] = [];
  const lines = markdown.split(/\r?\n/);
  let current: { sourceLine: number; lines: string[] } | undefined;

  for (const [index, line] of lines.entries()) {
    if (!current && openingPattern.test(line.trim())) {
      current = {
        sourceLine: index + 1,
        lines: []
      };
      continue;
    }

    if (current && /^```\s*$/.test(line.trim())) {
      blocks.push({
        sourceLine: current.sourceLine,
        content: current.lines.join("\n")
      });
      current = undefined;
      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  return blocks;
}

function looksLikeOpenApiYaml(content: string): boolean {
  return /^\s*openapi\s*:/im.test(content);
}

function describeJsonModel(value: unknown, sourceLine: number): ApiDataModel[] {
  if (Array.isArray(value)) {
    return [
      {
        name: "array",
        sourceLine,
        fields: value.length > 0 && isPlainObject(value[0]) ? Object.keys(value[0]) : [],
        summary: "JSON array"
      }
    ];
  }

  if (!isPlainObject(value)) {
    return [
      {
        name: "value",
        sourceLine,
        fields: [],
        summary: `JSON ${typeof value}`
      }
    ];
  }

  const entries = Object.entries(value);

  if (entries.length === 0) {
    return [
      {
        name: "object",
        sourceLine,
        fields: [],
        summary: "Empty JSON object"
      }
    ];
  }

  return entries.map(([name, child]) => ({
    name,
    sourceLine,
    fields: isPlainObject(child) ? Object.keys(child) : [],
    summary: isPlainObject(child) ? `${name} object` : `${name}: ${Array.isArray(child) ? "array" : typeof child}`
  }));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildRecommendedVerification(stack: StackProfile): string[] {
  const scripts = stack.scripts;
  const scriptCommands = uniqueStrings([
    ...buildPackageScriptVerificationCommands(stack.packageManager, scripts),
    ...buildWorkspacePackageVerificationCommands(stack.packageManager, stack.workspacePackages ?? [])
  ]).slice(0, 16);

  if (scriptCommands.length > 0) {
    return scriptCommands;
  }

  const inferredCommands = buildInferredVerificationCommands(stack);

  return inferredCommands.length > 0 ? inferredCommands : ["Add or document verification commands for this project."];
}

function buildPackageScriptVerificationCommands(
  packageManager: string | undefined,
  scripts: Record<string, string>
): string[] {
  return selectVerificationScriptNames(scripts)
    .map((name) => formatPackageScriptCommand(packageManager, name));
}

function buildWorkspacePackageVerificationCommands(
  packageManager: string | undefined,
  workspacePackages: WorkspacePackage[]
): string[] {
  return workspacePackages
    .flatMap((workspacePackage) =>
      selectVerificationScriptNames(workspacePackage.scripts)
        .map((scriptName) => formatWorkspacePackageScriptCommand(packageManager, workspacePackage, scriptName))
    )
    .slice(0, 12);
}

function selectVerificationScriptNames(scripts: Record<string, string>): string[] {
  const scriptGroups = [
    ["check", "check:ci", "verify", "verify:ci", "validate", "validate:ci", "ci", "ci:check", "ci:verify", "ci:validate"],
    ["lint", "lint:ci", "ci:lint", "lint:check", "eslint", "eslint:ci", "biome:check", "biome:ci"],
    ["format:check", "check:format", "format:ci", "ci:format", "prettier:check", "prettier:ci"],
    ["typecheck", "type-check", "type:check", "typecheck:ci", "type-check:ci", "type:ci", "ci:typecheck", "ci:types", "check:types", "types", "tsc"],
    ["test", "test:ci", "ci:test", "test:unit", "test:unit:ci", "unit", "unit:ci", "test:run", "vitest", "vitest:ci", "jest", "jest:ci"],
    ["coverage", "coverage:ci", "ci:coverage", "test:coverage", "test:coverage:ci"],
    ["test:component", "component:test", "test:component:ci", "component:test:ci", "ci:component"],
    ["test:integration", "integration:test", "test:int", "test:integration:ci", "integration:test:ci", "ci:integration"],
    ["test:e2e", "e2e", "e2e:ci", "ci:e2e", "test:playwright", "playwright:test", "playwright:ci", "test:cypress", "cypress:run", "cypress:ci"],
    ["build", "build:ci", "ci:build", "build:prod", "compile", "compile:ci"],
    ["audit", "audit:ci", "ci:audit", "security:audit"]
  ];

  return scriptGroups
    .map((names) => names.find((name) => scripts[name]))
    .filter((name): name is string => Boolean(name));
}

function buildInferredVerificationCommands(stack: StackProfile): string[] {
  const hasTypeScriptSignal =
    hasStackSignal(stack, "runtimes", "TypeScript") ||
    hasStackSignal(stack, "buildTools", "tsc") ||
    hasConfigFileNamed(stack, "tsconfig.json");
  const hasVueTypeChecker = hasStackSignal(stack, "buildTools", "vue-tsc");
  const hasSvelteTypeChecker = hasStackSignal(stack, "buildTools", "svelte-check");
  const hasFrameworkTypeChecker = hasVueTypeChecker || hasSvelteTypeChecker;
  const svelteCheckArgs = hasConfigFileNamed(stack, "tsconfig.json") ? "--tsconfig ./tsconfig.json" : "";
  const commands = [
    hasStackSignal(stack, "buildTools", "Biome")
      ? formatPackageExecCommand(stack.packageManager, "biome", "check .")
      : undefined,
    hasStackSignal(stack, "buildTools", "ESLint")
      ? formatPackageExecCommand(stack.packageManager, "eslint", ".")
      : undefined,
    hasStackSignal(stack, "buildTools", "Prettier")
      ? formatPackageExecCommand(stack.packageManager, "prettier", "--check .")
      : undefined,
    hasVueTypeChecker ? formatPackageExecCommand(stack.packageManager, "vue-tsc", "--noEmit") : undefined,
    hasSvelteTypeChecker ? formatPackageExecCommand(stack.packageManager, "svelte-check", svelteCheckArgs) : undefined,
    hasTypeScriptSignal && !hasFrameworkTypeChecker ? formatPackageExecCommand(stack.packageManager, "tsc", "--noEmit") : undefined,
    hasStackSignal(stack, "testing", "Vitest") ? formatPackageExecCommand(stack.packageManager, "vitest", "run") : undefined,
    !hasStackSignal(stack, "testing", "Vitest") && hasStackSignal(stack, "testing", "Jest")
      ? formatPackageExecCommand(stack.packageManager, "jest", "--runInBand")
      : undefined,
    !hasStackSignal(stack, "testing", "Vitest") &&
    !hasStackSignal(stack, "testing", "Jest") &&
    hasStackSignal(stack, "testing", "node:test")
      ? "node --test"
      : undefined,
    hasStackSignal(stack, "testing", "Playwright") ? formatPackageExecCommand(stack.packageManager, "playwright", "test") : undefined,
    hasStackSignal(stack, "testing", "Cypress") ? formatPackageExecCommand(stack.packageManager, "cypress", "run") : undefined,
    inferBuildCommand(stack)
  ];

  return uniqueStrings(commands.filter((command): command is string => Boolean(command)));
}

function formatPackageScriptCommand(packageManager: string | undefined, scriptName: string): string {
  if (packageManager === "pnpm" || packageManager === "yarn") {
    return `${packageManager} ${scriptName}`;
  }

  if (packageManager === "bun") {
    return `bun run ${scriptName}`;
  }

  return `npm run ${scriptName}`;
}

function formatWorkspacePackageScriptCommand(
  packageManager: string | undefined,
  workspacePackage: WorkspacePackage,
  scriptName: string
): string {
  if (packageManager === "pnpm") {
    return workspacePackage.name
      ? `pnpm --filter ${workspacePackage.name} ${scriptName}`
      : `pnpm --dir ${workspacePackage.path} ${scriptName}`;
  }

  if (packageManager === "yarn") {
    return workspacePackage.name
      ? `yarn workspace ${workspacePackage.name} ${scriptName}`
      : `yarn --cwd ${workspacePackage.path} ${scriptName}`;
  }

  if (packageManager === "bun") {
    return `bun --cwd ${workspacePackage.path} run ${scriptName}`;
  }

  return `npm --prefix ${workspacePackage.path} run ${scriptName}`;
}

function formatPackageExecCommand(packageManager: string | undefined, binary: string, args = ""): string {
  const command = args ? `${binary} ${args}` : binary;

  if (packageManager === "pnpm") {
    return `pnpm exec ${command}`;
  }

  if (packageManager === "yarn") {
    return `yarn ${command}`;
  }

  if (packageManager === "bun") {
    return `bunx ${command}`;
  }

  return `npx --no-install ${command}`;
}

function inferBuildCommand(stack: StackProfile): string | undefined {
  if (hasStackSignal(stack, "buildTools", "Vite")) {
    return formatPackageExecCommand(stack.packageManager, "vite", "build");
  }

  if (hasStackSignal(stack, "frameworks", "Next.js")) {
    return formatPackageExecCommand(stack.packageManager, "next", "build");
  }

  if (hasStackSignal(stack, "frameworks", "Nuxt")) {
    return formatPackageExecCommand(stack.packageManager, "nuxt", "build");
  }

  if (hasStackSignal(stack, "frameworks", "Astro")) {
    return formatPackageExecCommand(stack.packageManager, "astro", "build");
  }

  if (hasStackSignal(stack, "frameworks", "Angular") || hasStackSignal(stack, "buildTools", "Angular CLI")) {
    return formatPackageExecCommand(stack.packageManager, "ng", "build");
  }

  return undefined;
}

function hasStackSignal(stack: StackProfile, field: "buildTools" | "frameworks" | "runtimes" | "testing", value: string): boolean {
  return stack[field].includes(value);
}

function hasConfigFileNamed(stack: StackProfile, fileName: string): boolean {
  return stack.configFiles.some((configFile) => configFile.split("/").pop() === fileName);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
