import type { ProjectBrief } from "./brief.js";
import type { ImplementationTask, ImplementationUnit } from "./tasks.js";

export interface ImplementationTargetProfile {
  sourceRoots: string[];
  stackTags: string[];
  frontendTargets: {
    routes: string[];
    components: string[];
    dataNeeds: string[];
    uiStates: string[];
  };
  componentCandidates: string[];
  dataCandidates: string[];
  styleCandidates: string[];
  testCandidates: string[];
  configCandidates: string[];
  verificationCommands: string[];
  notes: string[];
}

export function createImplementationTargetProfile(
  task: ImplementationTask,
  brief: ProjectBrief,
  unit?: ImplementationUnit
): ImplementationTargetProfile {
  const sourceRoots = brief.stack.sourceDirectories.length ? brief.stack.sourceDirectories : ["src"];
  const primaryRoot = sourceRoots[0] ?? "src";
  const isTypeScript = brief.stack.runtimes.includes("TypeScript") || brief.stack.configFiles.includes("tsconfig.json");
  const jsxExtension = isTypeScript ? "tsx" : "jsx";
  const moduleExtension = isTypeScript ? "ts" : "js";
  const hasApiWork = isApiUnit(unit) || brief.apiContracts.length > 0 || brief.apiErrorCases.length > 0 || brief.apiAuthRequirements.length > 0;

  return {
    sourceRoots,
    stackTags: unique([
      ...brief.stack.frameworks,
      ...brief.stack.buildTools,
      ...brief.stack.styling,
      ...brief.stack.testing
    ]),
    frontendTargets: buildFrontendTargetSummary(brief),
    componentCandidates: buildComponentCandidates(brief, primaryRoot, jsxExtension, moduleExtension),
    dataCandidates: hasApiWork ? buildDataCandidates(brief, primaryRoot, moduleExtension) : [],
    styleCandidates: buildStyleCandidates(brief, primaryRoot),
    testCandidates: buildTestCandidates(brief, primaryRoot, jsxExtension, moduleExtension),
    configCandidates: unique(["package.json", ...brief.stack.configFiles]),
    verificationCommands: task.verification.length ? task.verification : brief.recommendedVerification,
    notes: buildTargetNotes(task, brief, unit, hasApiWork)
  };
}

function buildFrontendTargetSummary(brief: ProjectBrief): ImplementationTargetProfile["frontendTargets"] {
  return {
    routes: summarizeFrontendTargets(brief.frontendTargets?.routes),
    components: summarizeFrontendTargets(brief.frontendTargets?.components),
    dataNeeds: summarizeFrontendTargets(brief.frontendTargets?.dataNeeds),
    uiStates: summarizeFrontendTargets(brief.frontendTargets?.uiStates)
  };
}

function summarizeFrontendTargets(targets: NonNullable<ProjectBrief["frontendTargets"]>[keyof NonNullable<ProjectBrief["frontendTargets"]>] | undefined): string[] {
  return (targets ?? []).slice(0, 6).map((target) => {
    const location = target.sourceLine === undefined ? target.source : `${target.source}:${target.sourceLine}`;

    return `${target.summary} (${location})`;
  });
}

function buildComponentCandidates(
  brief: ProjectBrief,
  root: string,
  jsxExtension: string,
  moduleExtension: string
): string[] {
  const candidates: string[] = [];

  if (hasFramework(brief, "Next.js")) {
    candidates.push("app/", "app/page.tsx", "app/layout.tsx", "pages/", "pages/index.tsx", `${root}/components/`);
  }

  if (hasFramework(brief, "React")) {
    candidates.push(`${root}/App.${jsxExtension}`, `${root}/main.${jsxExtension}`, `${root}/components/`, `${root}/features/`);
  }

  if (hasFramework(brief, "Vue")) {
    candidates.push(`${root}/App.vue`, `${root}/main.${moduleExtension}`, `${root}/components/`);
  }

  if (hasFramework(brief, "Nuxt")) {
    candidates.push("app.vue", "pages/", "layouts/", "components/", "composables/", `${root}/pages/`, `${root}/components/`);
  }

  if (hasFramework(brief, "Svelte")) {
    candidates.push("src/routes/", "src/routes/+page.svelte", "src/routes/+layout.svelte", "src/lib/", `${root}/routes/`, `${root}/lib/`);
  }

  if (hasFramework(brief, "Angular")) {
    candidates.push(`${root}/app/`, `${root}/main.ts`, `${root}/app/app.component.ts`, `${root}/app/app.routes.ts`, `${root}/app/**/*.component.ts`);
  }

  if (hasFramework(brief, "Astro")) {
    candidates.push("src/pages/", "src/pages/index.astro", "src/components/", "src/layouts/", `${root}/pages/`, `${root}/components/`, `${root}/layouts/`);
  }

  if (candidates.length === 0) {
    candidates.push(root, `${root}/components/`);
  }

  return unique(candidates);
}

function buildDataCandidates(brief: ProjectBrief, root: string, moduleExtension: string): string[] {
  const candidates = [
    `${root}/api/`,
    `${root}/lib/api.${moduleExtension}`,
    `${root}/services/`,
    `${root}/data.${moduleExtension}`,
    `${root}/data/`
  ];

  if (hasFramework(brief, "Next.js")) {
    candidates.push("app/api/", "pages/api/", `${root}/app/api/`);
  }

  if (hasFramework(brief, "Nuxt")) {
    candidates.push("server/api/", "server/utils/", `composables/useApi.${moduleExtension}`, "composables/", "stores/");
  }

  if (hasFramework(brief, "Vue")) {
    candidates.push(`${root}/composables/`, `${root}/stores/`);
  }

  if (hasFramework(brief, "Svelte")) {
    candidates.push("src/lib/server/", "src/routes/**/+server.ts", "src/routes/**/+page.server.ts", `${root}/lib/server/`, `${root}/routes/**/+server.${moduleExtension}`);
  }

  if (hasFramework(brief, "Angular")) {
    candidates.push(`${root}/app/services/`, `${root}/app/**/*.service.${moduleExtension}`, `${root}/app/**/*.resolver.${moduleExtension}`);
  }

  if (hasFramework(brief, "Astro")) {
    candidates.push("src/pages/api/", "src/lib/", "src/content/", `${root}/pages/api/`, `${root}/lib/`);
  }

  return unique(candidates);
}

function buildStyleCandidates(brief: ProjectBrief, root: string): string[] {
  const candidates = [`${root}/styles.css`, `${root}/index.css`, `${root}/App.css`];

  if (hasFramework(brief, "Next.js")) {
    candidates.push("app/globals.css", `${root}/app/globals.css`);
  }

  if (hasFramework(brief, "Nuxt")) {
    candidates.push("assets/css/", "app.vue", "nuxt.config.ts");
  }

  if (hasFramework(brief, "Svelte")) {
    candidates.push("src/app.css", "src/routes/+layout.svelte", `${root}/app.css`, `${root}/routes/+layout.svelte`);
  }

  if (hasFramework(brief, "Astro")) {
    candidates.push("src/styles/", "src/layouts/", `${root}/styles/`, `${root}/layouts/`);
  }

  if (hasFramework(brief, "Angular")) {
    candidates.push(`${root}/styles.css`, `${root}/styles.scss`, `${root}/app/**/*.scss`);
  }

  if (brief.stack.styling.includes("Tailwind CSS")) {
    candidates.push("tailwind.config.js", "tailwind.config.ts", `${root}/globals.css`);
  }

  if (brief.stack.styling.includes("Sass")) {
    candidates.push(`${root}/styles.scss`);
  }

  return unique(candidates);
}

function buildTestCandidates(
  brief: ProjectBrief,
  root: string,
  jsxExtension: string,
  moduleExtension: string
): string[] {
  const testExtension = hasFramework(brief, "React") || hasFramework(brief, "Next.js") ? jsxExtension : moduleExtension;
  const candidates: string[] = [];

  if (brief.stack.testing.includes("Vitest")) {
    candidates.push(`${root}/**/*.test.${testExtension}`, `${root}/**/*.spec.${testExtension}`);
  }

  if (brief.stack.testing.includes("Jest")) {
    candidates.push(`${root}/**/*.test.${testExtension}`, `${root}/**/*.spec.${testExtension}`, "__tests__/");
  }

  if (brief.stack.testing.includes("Testing Library")) {
    candidates.push(`${root}/test-utils.${moduleExtension}`, `${root}/setupTests.${moduleExtension}`);
  }

  if (hasFramework(brief, "Svelte")) {
    candidates.push("src/routes/**/*.test.ts", "src/lib/**/*.test.ts");
  }

  if (hasFramework(brief, "Angular")) {
    candidates.push(`${root}/app/**/*.spec.${moduleExtension}`);
  }

  if (hasFramework(brief, "Astro")) {
    candidates.push("src/**/*.test.ts", "src/**/*.spec.ts");
  }

  if (brief.stack.testing.includes("Playwright") || hasConfigFile(brief, /^playwright\.config\./)) {
    candidates.push("e2e/", "tests/e2e/");
  }

  if (brief.stack.testing.includes("Cypress") || hasConfigFile(brief, /^cypress\.config\./)) {
    candidates.push("cypress/e2e/", "cypress/component/");
  }

  if (candidates.length === 0) {
    candidates.push("tests/", `${root}/__tests__/`);
  }

  return unique(candidates);
}

function buildTargetNotes(
  task: ImplementationTask,
  brief: ProjectBrief,
  unit: ImplementationUnit | undefined,
  hasApiWork: boolean
): string[] {
  const notes: string[] = [];

  if (hasFramework(brief, "React")) {
    notes.push("Use React component boundaries and keep data loading separate from presentational UI where possible.");
  }

  if (hasFramework(brief, "Next.js")) {
    notes.push("For Next.js apps, prefer app/pages routes and keep server/client boundaries explicit.");
  }

  if (hasFramework(brief, "Nuxt")) {
    notes.push("For Nuxt apps, map routes through pages, shared UI through components/layouts, and API data through composables or server/api handlers.");
  }

  if (hasFramework(brief, "Vue")) {
    notes.push("Use Vue single-file component boundaries and keep composables or stores separate from presentational UI.");
  }

  if (hasFramework(brief, "Svelte")) {
    notes.push("Use Svelte route and lib conventions, and keep server-only logic out of client components.");
  }

  if (hasFramework(brief, "Angular")) {
    notes.push("Use Angular feature/module boundaries and keep services separate from components.");
  }

  if (hasFramework(brief, "Astro")) {
    notes.push("Use Astro pages, layouts, and components, and isolate interactive islands where framework components are needed.");
  }

  if (brief.stack.buildTools.includes("Vite")) {
    notes.push("For Vite apps, browser entry points usually live around src/main.* and src/App.*.");
  }

  if (hasApiWork) {
    notes.push("Map API contracts into a data client or service layer before wiring loading, empty, error, and success UI states.");
  }

  if (unit?.kind === "api-error") {
    notes.push("Represent the documented API failure with visible UI state, retry or stale-data behavior, and delivery-report evidence.");
  }

  if (unit?.kind === "api-auth") {
    notes.push("Keep auth handling isolated from presentation components and document unauthorized or expired-session behavior.");
  }

  if (unit?.kind === "design-asset") {
    notes.push("Use the referenced design asset as visual evidence, then reflect layout, spacing, and state decisions in source changes.");
  }

  if (unit?.kind === "constraint") {
    notes.push("Treat this requirement constraint as a non-negotiable implementation boundary and call out any tradeoffs in the delivery report.");
  }

  if (task.risk === "high") {
    notes.push("Keep the first patch small enough to review, then run verification before expanding the change set.");
  }

  notes.push("Use detected package scripts for verification; do not invent unchecked commands in the final handoff.");

  return unique(notes);
}

function hasFramework(brief: ProjectBrief, framework: string): boolean {
  return brief.stack.frameworks.includes(framework);
}

function hasConfigFile(brief: ProjectBrief, pattern: RegExp): boolean {
  return brief.stack.configFiles.some((configFile) => pattern.test(configFile));
}

function isApiUnit(unit: ImplementationUnit | undefined): boolean {
  return unit?.kind === "api-endpoint" || unit?.kind === "api-model" || unit?.kind === "api-error" || unit?.kind === "api-auth";
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
