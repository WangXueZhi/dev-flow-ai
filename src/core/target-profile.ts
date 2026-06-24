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
      ...(brief.stack.dataLibraries ?? []),
      ...brief.stack.styling,
      ...brief.stack.testing
    ]),
    frontendTargets: buildFrontendTargetSummary(brief),
    componentCandidates: buildComponentCandidates(brief, primaryRoot, jsxExtension, moduleExtension, unit),
    dataCandidates: hasApiWork ? buildDataCandidates(brief, primaryRoot, moduleExtension, unit) : [],
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
  moduleExtension: string,
  unit?: ImplementationUnit
): string[] {
  const candidates: string[] = [
    ...explicitRoutePathsFromUnit(unit).flatMap((routePath) => routeCandidatesForPath(brief, root, jsxExtension, moduleExtension, routePath)),
    ...explicitComponentNamesFromUnit(unit).flatMap((name) => componentCandidatesForName(brief, root, jsxExtension, name)),
    ...buildExplicitRouteCandidates(brief, root, jsxExtension, moduleExtension),
    ...buildExplicitComponentCandidates(brief, root, jsxExtension)
  ];

  if (hasFramework(brief, "Next.js")) {
    candidates.push("app/", "app/page.tsx", "app/layout.tsx", "pages/", "pages/index.tsx", `${root}/components/`);
  }

  if (hasFramework(brief, "React")) {
    candidates.push(`${root}/App.${jsxExtension}`, `${root}/main.${jsxExtension}`, `${root}/components/`, `${root}/features/`);
  }

  if (hasClientSideReactRouting(brief)) {
    candidates.push(...reactRouteConfigCandidates(root, jsxExtension, moduleExtension), `${root}/router/`, `${root}/routes/`);
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

function buildExplicitRouteCandidates(
  brief: ProjectBrief,
  root: string,
  jsxExtension: string,
  moduleExtension: string
): string[] {
  return explicitRoutePaths(brief).flatMap((routePath) => routeCandidatesForPath(brief, root, jsxExtension, moduleExtension, routePath));
}

function routeCandidatesForPath(
  brief: ProjectBrief,
  root: string,
  jsxExtension: string,
  moduleExtension: string,
  routePath: string
): string[] {
  const subpath = routeSubpath(routePath);
  if (!subpath) {
    return [];
  }

  const componentName = pascalCaseFromPath(subpath);
  const kebabName = kebabCase(componentName);
  const candidates: string[] = [];

  if (hasFramework(brief, "Next.js")) {
    candidates.push(`app/${subpath}/page.${jsxExtension}`, `pages/${subpath}.${jsxExtension}`, `${root}/app/${subpath}/page.${jsxExtension}`, `${root}/pages/${subpath}.${jsxExtension}`);
  }

  if (hasFramework(brief, "Nuxt")) {
    candidates.push(`pages/${subpath}.vue`, `${root}/pages/${subpath}.vue`);
  }

  if (hasFramework(brief, "Vue")) {
    candidates.push(`${root}/views/${componentName}.vue`, `${root}/router/`);
  }

  if (hasFramework(brief, "Svelte")) {
    candidates.push(`src/routes/${subpath}/+page.svelte`, `${root}/routes/${subpath}/+page.svelte`);
  }

  if (hasFramework(brief, "Astro")) {
    candidates.push(`src/pages/${subpath}.astro`, `${root}/pages/${subpath}.astro`);
  }

  if (hasFramework(brief, "Angular")) {
    candidates.push(`${root}/app/${kebabName}/`, `${root}/app/${kebabName}/${kebabName}.component.${moduleExtension}`, `${root}/app/app.routes.${moduleExtension}`);
  }

  if (hasFramework(brief, "React") || candidates.length === 0) {
    candidates.push(`${root}/pages/${componentName}.${jsxExtension}`, `${root}/routes/${componentName}.${jsxExtension}`, `${root}/features/${kebabName}/`);
  }

  if (hasClientSideReactRouting(brief)) {
    candidates.push(...reactRouteConfigCandidates(root, jsxExtension, moduleExtension));
  }

  return candidates;
}

function buildExplicitComponentCandidates(brief: ProjectBrief, root: string, jsxExtension: string): string[] {
  return explicitComponentNames(brief).flatMap((name) => componentCandidatesForName(brief, root, jsxExtension, name));
}

function componentCandidatesForName(
  brief: ProjectBrief,
  root: string,
  jsxExtension: string,
  name: string
): string[] {
  const kebabName = kebabCase(name);
  const candidates: string[] = [];

  if (hasFramework(brief, "Vue") || hasFramework(brief, "Nuxt")) {
    candidates.push(`${root}/components/${name}.vue`, `components/${name}.vue`);
  }

  if (hasFramework(brief, "Svelte")) {
    candidates.push(`src/lib/${name}.svelte`, `${root}/lib/${name}.svelte`);
  }

  if (hasFramework(brief, "Astro")) {
    candidates.push(`src/components/${name}.astro`, `${root}/components/${name}.astro`);
  }

  if (hasFramework(brief, "Angular")) {
    candidates.push(`${root}/app/${kebabName}/${kebabName}.component.ts`);
  }

  if (hasFramework(brief, "React") || hasFramework(brief, "Next.js") || candidates.length === 0) {
    candidates.push(`${root}/components/${name}.${jsxExtension}`, `${root}/features/${kebabName}/${name}.${jsxExtension}`);
  }

  return candidates;
}

function reactRouteConfigCandidates(root: string, jsxExtension: string, moduleExtension: string): string[] {
  return unique([
    `${root}/router/index.${jsxExtension}`,
    `${root}/router/index.${moduleExtension}`,
    `${root}/routes.${jsxExtension}`,
    `${root}/routes.${moduleExtension}`,
    `${root}/AppRoutes.${jsxExtension}`
  ]);
}

function explicitRoutePaths(brief: ProjectBrief): string[] {
  return (brief.frontendTargets?.routes ?? [])
    .map((target) => /^Route path\s+(\S+)$/i.exec(target.summary)?.[1])
    .filter((path): path is string => Boolean(path))
    .slice(0, 4);
}

function explicitComponentNames(brief: ProjectBrief): string[] {
  return (brief.frontendTargets?.components ?? [])
    .map((target) => /^Component\s+([A-Z][A-Za-z0-9.]*)$/i.exec(target.summary)?.[1])
    .filter((name): name is string => Boolean(name))
    .slice(0, 6);
}

function explicitRoutePathsFromUnit(unit: ImplementationUnit | undefined): string[] {
  if (unit?.kind !== "frontend-route") {
    return [];
  }

  return extractRoutePathsFromText([unit.title, ...unit.details]).slice(0, 2);
}

function explicitComponentNamesFromUnit(unit: ImplementationUnit | undefined): string[] {
  if (unit?.kind !== "frontend-component") {
    return [];
  }

  return extractComponentNamesFromText([unit.title, ...unit.details]).slice(0, 2);
}

function extractRoutePathsFromText(values: string[]): string[] {
  return unique(values
    .map((value) => /^Route path\s+(\S+)$/i.exec(value)?.[1])
    .filter((path): path is string => Boolean(path)));
}

function extractComponentNamesFromText(values: string[]): string[] {
  return unique(values
    .map((value) => /^Component\s+([A-Z][A-Za-z0-9.]*)$/i.exec(value)?.[1])
    .filter((name): name is string => Boolean(name)));
}

function routeSubpath(routePath: string): string | undefined {
  const subpath = routePath
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/:([A-Za-z0-9_-]+)/g, "[$1]");

  return subpath || undefined;
}

function pascalCaseFromPath(path: string): string {
  const value = path
    .replace(/\[([^\]]+)\]/g, "$1")
    .split("/")
    .filter(Boolean)
    .map((part) => part.split(/[-_\s]+/).filter(Boolean).map(capitalize).join(""))
    .join("");

  return value || "Route";
}

function kebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[._\s/]+/g, "-")
    .toLowerCase();
}

function capitalize(value: string): string {
  return value ? `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}` : "";
}

function buildDataCandidates(
  brief: ProjectBrief,
  root: string,
  moduleExtension: string,
  unit?: ImplementationUnit
): string[] {
  const candidates = [
    ...buildExplicitApiDataCandidates(brief, root, moduleExtension, unit),
    ...buildDataLibraryRootCandidates(brief, root, moduleExtension),
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

function buildExplicitApiDataCandidates(
  brief: ProjectBrief,
  root: string,
  moduleExtension: string,
  unit?: ImplementationUnit
): string[] {
  const unitPaths = explicitApiPathsFromUnit(unit);
  const contractPaths = brief.apiContracts.map((contract) => contract.path).slice(0, 6);

  return unique([...unitPaths, ...contractPaths])
    .flatMap((path) => apiDataCandidatesForPath(brief, root, moduleExtension, path));
}

function apiDataCandidatesForPath(
  brief: ProjectBrief,
  root: string,
  moduleExtension: string,
  path: string
): string[] {
  const subpath = apiSubpath(path);
  if (!subpath) {
    return [];
  }

  const resourceName = kebabCase(pascalCaseFromPath(subpath));
  const pascalName = pascalCaseFromPath(subpath);
  const candidates: string[] = [];

  if (hasFramework(brief, "Next.js")) {
    candidates.push(`app/api/${subpath}/route.${moduleExtension}`, `pages/api/${subpath}.${moduleExtension}`, `${root}/app/api/${subpath}/route.${moduleExtension}`);
  }

  if (hasFramework(brief, "Nuxt")) {
    candidates.push(`server/api/${subpath}.${moduleExtension}`, `server/api/${subpath}/index.${moduleExtension}`, `composables/use${pascalName}Api.${moduleExtension}`);
  }

  if (hasFramework(brief, "Svelte")) {
    candidates.push(`src/routes/api/${subpath}/+server.${moduleExtension}`, `${root}/routes/api/${subpath}/+server.${moduleExtension}`, `src/lib/server/${resourceName}.${moduleExtension}`);
  }

  if (hasFramework(brief, "Astro")) {
    candidates.push(`src/pages/api/${subpath}.${moduleExtension}`, `${root}/pages/api/${subpath}.${moduleExtension}`);
  }

  if (hasFramework(brief, "Angular")) {
    candidates.push(`${root}/app/services/${resourceName}.service.${moduleExtension}`);
  }

  candidates.push(...dataLibraryCandidatesForApiPath(brief, root, moduleExtension, resourceName, pascalName));
  candidates.push(`${root}/lib/api/${resourceName}.${moduleExtension}`, `${root}/services/${resourceName}.${moduleExtension}`, `${root}/api/${resourceName}.${moduleExtension}`);

  return candidates;
}

function buildDataLibraryRootCandidates(brief: ProjectBrief, root: string, moduleExtension: string): string[] {
  const candidates: string[] = [];

  if (hasDataLibrary(brief, "TanStack Query")) {
    candidates.push(`${root}/lib/queryClient.${moduleExtension}`, `${root}/queries/`, `${root}/hooks/`);
  }

  if (hasDataLibrary(brief, "SWR")) {
    candidates.push(`${root}/lib/fetcher.${moduleExtension}`, `${root}/swr/`, `${root}/hooks/`);
  }

  if (hasGraphqlClient(brief)) {
    candidates.push(`${root}/graphql/`, `${root}/lib/graphql.${moduleExtension}`, `${root}/lib/graphql/`);
  }

  if (hasDataLibrary(brief, "Redux Toolkit")) {
    candidates.push(`${root}/store/`, `${root}/features/`);
  }

  if (hasDataLibrary(brief, "Pinia") || hasDataLibrary(brief, "Vuex")) {
    candidates.push(`${root}/stores/`);
  }

  if (hasDataLibrary(brief, "NgRx")) {
    candidates.push(`${root}/app/store/`, `${root}/app/**/*.effects.${moduleExtension}`);
  }

  if (hasDataLibrary(brief, "Axios")) {
    candidates.push(`${root}/lib/http.${moduleExtension}`, `${root}/lib/axios.${moduleExtension}`);
  }

  return candidates;
}

function dataLibraryCandidatesForApiPath(
  brief: ProjectBrief,
  root: string,
  moduleExtension: string,
  resourceName: string,
  pascalName: string
): string[] {
  const candidates: string[] = [];

  if (hasDataLibrary(brief, "TanStack Query")) {
    candidates.push(`${root}/hooks/use${pascalName}Query.${moduleExtension}`, `${root}/queries/${resourceName}.${moduleExtension}`, `${root}/lib/queries/${resourceName}.${moduleExtension}`);
  }

  if (hasDataLibrary(brief, "SWR")) {
    candidates.push(`${root}/hooks/use${pascalName}.${moduleExtension}`, `${root}/swr/${resourceName}.${moduleExtension}`, `${root}/lib/swr/${resourceName}.${moduleExtension}`);
  }

  if (hasGraphqlClient(brief)) {
    candidates.push(`${root}/graphql/${resourceName}.${moduleExtension}`, `${root}/lib/graphql/${resourceName}.${moduleExtension}`);
  }

  if (hasDataLibrary(brief, "Redux Toolkit")) {
    candidates.push(`${root}/store/${resourceName}Api.${moduleExtension}`, `${root}/features/${resourceName}/${resourceName}Api.${moduleExtension}`);
  }

  if (hasDataLibrary(brief, "Pinia") || hasDataLibrary(brief, "Vuex")) {
    candidates.push(`${root}/stores/${resourceName}.${moduleExtension}`);
  }

  if (hasDataLibrary(brief, "NgRx")) {
    candidates.push(`${root}/app/store/${resourceName}.actions.${moduleExtension}`, `${root}/app/store/${resourceName}.effects.${moduleExtension}`, `${root}/app/store/${resourceName}.reducer.${moduleExtension}`);
  }

  if (hasDataLibrary(brief, "Axios")) {
    candidates.push(`${root}/lib/http/${resourceName}.${moduleExtension}`);
  }

  return candidates;
}

function explicitApiPathsFromUnit(unit: ImplementationUnit | undefined): string[] {
  if (unit?.kind !== "frontend-data" && unit?.kind !== "api-endpoint") {
    return [];
  }

  return extractApiPathsFromText([unit.title, ...unit.details]).slice(0, 4);
}

function extractApiPathsFromText(values: string[]): string[] {
  return unique(values.flatMap((value) => {
    const matches = value.matchAll(/\b(?:GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s`),;]+)/gi);

    return [...matches].map((match) => match[1]).filter((path): path is string => Boolean(path));
  }));
}

function apiSubpath(path: string): string | undefined {
  return routeSubpath(path)?.replace(/^api\//i, "");
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

  if (hasDataLibrary(brief, "TanStack Query") || hasDataLibrary(brief, "SWR")) {
    notes.push("Use the detected query/fetching library boundaries for cache keys, revalidation, loading, error, and stale-data states.");
  }

  if (hasGraphqlClient(brief)) {
    notes.push("Use the detected GraphQL client conventions for queries, mutations, generated types, and colocated data hooks where present.");
  }

  if (hasDataLibrary(brief, "Redux Toolkit") || hasDataLibrary(brief, "Pinia") || hasDataLibrary(brief, "Vuex") || hasDataLibrary(brief, "NgRx")) {
    notes.push("Use the detected store/data-layer conventions before wiring API results into presentational components.");
  }

  if (unit?.kind === "frontend-route") {
    notes.push("Scope this unit to the route or view shell first, then connect component, data, state, styling, and tests around that route boundary.");
  }

  if (unit?.kind === "frontend-component") {
    notes.push("Scope this unit to the component boundary, including inputs, rendered states, responsive behavior, and nearby tests.");
  }

  if (unit?.kind === "frontend-data") {
    notes.push("Scope this unit to frontend data integration, keeping API/service code separate from presentation and covering loading, empty, error, success, and auth-aware states.");
  }

  if (unit?.kind === "frontend-state") {
    notes.push("Scope this unit to the documented UI state, including visible feedback, accessibility semantics, responsive behavior, and verification evidence.");
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

  if (unit?.kind === "design-token") {
    notes.push("Treat this design token as a styling-system constraint; update styles, theme tokens, components, and responsive checks consistently.");
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

function hasClientSideReactRouting(brief: ProjectBrief): boolean {
  if (hasFramework(brief, "Next.js")) {
    return false;
  }

  return (
    hasFramework(brief, "React Router") ||
    (hasFramework(brief, "React") && (
      brief.stack.buildTools.includes("Vite") ||
      brief.stack.sourceDirectories.some((directory) => /(^|\/)(routes|router)$/.test(directory))
    ))
  );
}

function hasConfigFile(brief: ProjectBrief, pattern: RegExp): boolean {
  return brief.stack.configFiles.some((configFile) => pattern.test(configFile));
}

function hasDataLibrary(brief: ProjectBrief, library: string): boolean {
  return (brief.stack.dataLibraries ?? []).includes(library);
}

function hasGraphqlClient(brief: ProjectBrief): boolean {
  return hasDataLibrary(brief, "Apollo Client") || hasDataLibrary(brief, "urql") || hasDataLibrary(brief, "graphql-request");
}

function isApiUnit(unit: ImplementationUnit | undefined): boolean {
  return unit?.kind === "frontend-data" || unit?.kind === "api-endpoint" || unit?.kind === "api-model" || unit?.kind === "api-error" || unit?.kind === "api-auth";
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
