import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { fileExists } from "./fs.js";

const sourceDirectoryCandidates = [
  "app",
  "pages",
  "src",
  "src/app",
  "src/pages",
  "src/routes",
  "src/router",
  "src/views",
  "src/components",
  "src/lib",
  "components",
  "lib",
  "router",
  "test",
  "tests",
  "e2e"
];

const configFileCandidates = [
  "angular.json",
  "astro.config.js",
  "astro.config.mjs",
  "astro.config.ts",
  "biome.json",
  "biome.jsonc",
  "next.config.cjs",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "nuxt.config.js",
  "nuxt.config.mjs",
  "nuxt.config.ts",
  "cypress.config.js",
  "cypress.config.mjs",
  "cypress.config.ts",
  "eslint.config.cjs",
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.ts",
  ".eslintrc",
  ".eslintrc.cjs",
  ".eslintrc.js",
  ".eslintrc.json",
  ".eslintrc.yml",
  ".eslintrc.yaml",
  "jest.config.js",
  "jest.config.mjs",
  "jest.config.ts",
  "playwright.config.js",
  "playwright.config.mjs",
  "playwright.config.ts",
  "postcss.config.cjs",
  "postcss.config.js",
  "postcss.config.mjs",
  "prettier.config.cjs",
  "prettier.config.js",
  "prettier.config.mjs",
  ".prettierrc",
  ".prettierrc.cjs",
  ".prettierrc.js",
  ".prettierrc.json",
  ".prettierrc.yml",
  ".prettierrc.yaml",
  "svelte.config.js",
  "svelte.config.mjs",
  "tailwind.config.cjs",
  "tailwind.config.js",
  "tailwind.config.mjs",
  "tailwind.config.ts",
  "tsconfig.json",
  "vite.config.cjs",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.ts",
  "vitest.config.js",
  "vitest.config.mjs",
  "vitest.config.ts",
  "vue.config.js"
];

export interface WorkspacePackage {
  name?: string;
  path: string;
  scripts: Record<string, string>;
}

export interface StackProfile {
  packageManager: string | undefined;
  runtimes: string[];
  frameworks: string[];
  buildTools: string[];
  dataLibraries?: string[];
  styling: string[];
  testing: string[];
  scripts: Record<string, string>;
  workspacePackages?: WorkspacePackage[];
  sourceDirectories: string[];
  configFiles: string[];
  notes: string[];
}

interface PackageJson {
  name?: string;
  type?: string;
  bin?: string | Record<string, string>;
  packageManager?: string;
  workspaces?: string[] | { packages?: string[] };
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

interface WorkspacePackageDetail extends WorkspacePackage {
  packageJson: PackageJson;
}

export async function detectStack(rootDir = "."): Promise<StackProfile> {
  const packageJson = await readPackageJson(rootDir);
  const packageManager = await detectPackageManager(rootDir, packageJson);
  const workspacePackageDetails = await detectWorkspacePackages(rootDir, packageJson);
  const workspacePackages = workspacePackageDetails.map(({ packageJson: _packageJson, ...workspacePackage }) => workspacePackage);
  const dependencies = {
    ...packageJson.optionalDependencies,
    ...packageJson.peerDependencies,
    ...packageJson.devDependencies,
    ...packageJson.dependencies,
    ...mergeWorkspaceDependencies(workspacePackageDetails)
  };
  const scripts = packageJson.scripts ?? {};
  const scriptValues = [
    ...Object.values(scripts),
    ...workspacePackages.flatMap((workspacePackage) => Object.values(workspacePackage.scripts))
  ];
  const hasDependency = (name: string) => Boolean(dependencies[name]);

  const sourceDirectories = await detectDirectories(rootDir, [
    ...sourceDirectoryCandidates,
    ...workspacePackages.flatMap((workspacePackage) => workspaceSourceDirectoryCandidates(workspacePackage.path))
  ]);
  const configFiles = await detectFiles(rootDir, [
    ...configFileCandidates,
    ...workspacePackages.flatMap((workspacePackage) => workspaceConfigFileCandidates(workspacePackage.path))
  ]);
  const hasConfigFile = (pattern: RegExp) => configFiles.some((configFile) => pattern.test(configFileName(configFile)));
  const hasReactSignal =
    hasDependency("react") ||
    hasDependency("react-dom") ||
    hasDependency("@vitejs/plugin-react") ||
    hasDependency("@vitejs/plugin-react-swc");
  const hasVueSignal = hasDependency("vue") || hasDependency("@vitejs/plugin-vue") || hasConfigFile(/^vue\.config\./);
  const hasAngularSignal = hasDependency("@angular/core") || hasDependency("@angular/cli") || hasConfigFile(/^angular\.json$/);
  const hasSvelteSignal = hasDependency("svelte") || hasDependency("@sveltejs/kit") || hasConfigFile(/^svelte\.config\./);
  const hasAstroSignal = hasDependency("astro") || hasConfigFile(/^astro\.config\./);
  const hasNextSignal = hasDependency("next") || hasConfigFile(/^next\.config\./);
  const hasNuxtSignal = hasDependency("nuxt") || hasDependency("nuxt3") || hasConfigFile(/^nuxt\.config\./);
  const hasReactRouterSignal = hasDependency("react-router") || hasDependency("react-router-dom");
  const hasBiomeSignal = hasDependency("@biomejs/biome") || hasDependency("biome") || hasConfigFile(/^biome\.jsonc?$/);
  const hasEslintSignal = hasDependency("eslint") || hasConfigFile(/^(eslint\.config\.|\.eslintrc)/);
  const hasPrettierSignal = hasDependency("prettier") || hasConfigFile(/^(\.prettierrc|prettier\.config\.)/);

  const runtimes = unique([
    "Node.js",
    hasDependency("typescript") ? "TypeScript" : undefined,
    packageJson.type === "module" ? "ES modules" : undefined,
    packageJson.bin ? "CLI package" : undefined
  ]);

  const frameworks = unique([
    hasNextSignal ? "Next.js" : undefined,
    hasReactSignal ? "React" : undefined,
    hasReactRouterSignal ? "React Router" : undefined,
    hasVueSignal ? "Vue" : undefined,
    hasNuxtSignal ? "Nuxt" : undefined,
    hasSvelteSignal ? "Svelte" : undefined,
    hasAngularSignal ? "Angular" : undefined,
    hasAstroSignal ? "Astro" : undefined
  ]);

  const buildTools = unique([
    hasDependency("vite") || hasConfigFile(/^vite\.config\./) ? "Vite" : undefined,
    hasDependency("webpack") ? "Webpack" : undefined,
    hasDependency("rollup") ? "Rollup" : undefined,
    hasDependency("esbuild") ? "esbuild" : undefined,
    hasAngularSignal ? "Angular CLI" : undefined,
    hasDependency("tsx") ? "tsx" : undefined,
    hasDependency("typescript") ? "tsc" : undefined,
    hasDependency("vue-tsc") ? "vue-tsc" : undefined,
    hasDependency("svelte-check") ? "svelte-check" : undefined,
    hasBiomeSignal ? "Biome" : undefined,
    hasEslintSignal ? "ESLint" : undefined,
    hasPrettierSignal ? "Prettier" : undefined
  ]);

  const dataLibraries = unique([
    hasDependency("@tanstack/react-query") || hasDependency("react-query") ? "TanStack Query" : undefined,
    hasDependency("swr") ? "SWR" : undefined,
    hasDependency("@apollo/client") || hasDependency("apollo-angular") || hasDependency("@vue/apollo-composable") ? "Apollo Client" : undefined,
    hasDependency("urql") || hasDependency("@urql/vue") ? "urql" : undefined,
    hasDependency("@reduxjs/toolkit") || hasDependency("react-redux") ? "Redux Toolkit" : undefined,
    hasDependency("pinia") ? "Pinia" : undefined,
    hasDependency("vuex") ? "Vuex" : undefined,
    hasDependency("@ngrx/store") || hasDependency("@ngrx/effects") ? "NgRx" : undefined,
    hasDependency("axios") ? "Axios" : undefined,
    hasDependency("graphql-request") ? "graphql-request" : undefined
  ]);

  const styling = unique([
    hasDependency("tailwindcss") || hasConfigFile(/^tailwind\.config\./) ? "Tailwind CSS" : undefined,
    hasDependency("sass") ? "Sass" : undefined,
    hasDependency("less") ? "Less" : undefined,
    hasDependency("styled-components") ? "styled-components" : undefined,
    hasDependency("@emotion/react") ? "Emotion" : undefined,
    hasDependency("bootstrap") ? "Bootstrap" : undefined
  ]);

  const testing = unique([
    hasDependency("vitest") || hasConfigFile(/^vitest\.config\./) ? "Vitest" : undefined,
    hasDependency("jest") || hasConfigFile(/^jest\.config\./) ? "Jest" : undefined,
    hasDependency("playwright") || hasDependency("@playwright/test") || hasConfigFile(/^playwright\.config\./) ? "Playwright" : undefined,
    hasDependency("cypress") || hasConfigFile(/^cypress\.config\./) ? "Cypress" : undefined,
    hasDependency("@testing-library/react") ? "Testing Library" : undefined,
    scriptValues.some((script) => script.includes("node --test")) ? "node:test" : undefined
  ]);

  const notes = unique([
    packageManager ? undefined : "No lockfile detected; package manager is inferred as unknown.",
    frameworks.length === 0 ? "No frontend framework dependency detected yet." : undefined,
    Object.keys(scripts).length === 0 && workspacePackages.every((workspacePackage) => Object.keys(workspacePackage.scripts).length === 0)
      ? "No package scripts detected."
      : undefined,
    workspacePackages.length ? `Workspace packages detected: ${workspacePackages.map((workspacePackage) => workspacePackage.path).join(", ")}` : undefined
  ]);

  return {
    packageManager,
    runtimes,
    frameworks,
    buildTools,
    dataLibraries,
    styling,
    testing,
    scripts,
    workspacePackages,
    sourceDirectories,
    configFiles,
    notes
  };
}

async function readPackageJson(rootDir: string): Promise<PackageJson> {
  const path = join(rootDir, "package.json");

  if (!(await fileExists(path))) {
    return {};
  }

  return JSON.parse(await readFile(path, "utf8")) as PackageJson;
}

async function detectWorkspacePackages(rootDir: string, packageJson: PackageJson): Promise<WorkspacePackageDetail[]> {
  const patterns = unique([
    ...packageWorkspacePatterns(packageJson),
    ...(await pnpmWorkspacePatterns(rootDir))
  ]);
  const paths = unique((await Promise.all(patterns.map((pattern) => expandWorkspacePattern(rootDir, pattern)))).flat())
    .sort()
    .slice(0, 12);
  const workspacePackages: WorkspacePackageDetail[] = [];

  for (const path of paths) {
    if (!(await fileExists(join(rootDir, path, "package.json")))) {
      continue;
    }

    const workspacePackageJson = await readPackageJson(join(rootDir, path));
    const scripts = workspacePackageJson.scripts ?? {};

    workspacePackages.push({
      name: workspacePackageJson.name,
      path,
      scripts,
      packageJson: workspacePackageJson
    });
  }

  return workspacePackages;
}

function packageWorkspacePatterns(packageJson: PackageJson): string[] {
  const workspaces = packageJson.workspaces;

  if (Array.isArray(workspaces)) {
    return workspaces.filter((pattern): pattern is string => typeof pattern === "string");
  }

  if (Array.isArray(workspaces?.packages)) {
    return workspaces.packages.filter((pattern): pattern is string => typeof pattern === "string");
  }

  return [];
}

async function pnpmWorkspacePatterns(rootDir: string): Promise<string[]> {
  const path = join(rootDir, "pnpm-workspace.yaml");

  if (!(await fileExists(path))) {
    return [];
  }

  try {
    const parsed = parseYaml(await readFile(path, "utf8")) as { packages?: unknown };

    return Array.isArray(parsed?.packages)
      ? parsed.packages.filter((pattern): pattern is string => typeof pattern === "string")
      : [];
  } catch {
    return [];
  }
}

async function expandWorkspacePattern(rootDir: string, pattern: string): Promise<string[]> {
  const normalized = normalizeWorkspacePattern(pattern);

  if (!normalized) {
    return [];
  }

  if (!normalized.includes("*")) {
    return (await directoryExists(join(rootDir, normalized))) ? [normalized] : [];
  }

  const basePath = normalized.slice(0, normalized.indexOf("*")).replace(/\/+$/, "");

  if (!basePath || !(await directoryExists(join(rootDir, basePath)))) {
    return [];
  }

  const entries = await readdir(join(rootDir, basePath), { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => `${basePath}/${entry.name}`)
    .filter((path) => !path.includes("node_modules"));
}

function normalizeWorkspacePattern(pattern: string): string | undefined {
  const trimmed = pattern.trim();

  if (!trimmed || trimmed.startsWith("!") || trimmed.startsWith("/") || trimmed.includes("..")) {
    return undefined;
  }

  return trimmed
    .replace(/\\/g, "/")
    .replace(/\/package\.json$/, "")
    .replace(/\/+$/, "");
}

function mergeWorkspaceDependencies(workspacePackages: WorkspacePackageDetail[]): Record<string, string> {
  return workspacePackages.reduce<Record<string, string>>((dependencies, workspacePackage) => ({
    ...dependencies,
    ...workspacePackage.packageJson.optionalDependencies,
    ...workspacePackage.packageJson.peerDependencies,
    ...workspacePackage.packageJson.devDependencies,
    ...workspacePackage.packageJson.dependencies
  }), {});
}

function workspaceSourceDirectoryCandidates(workspacePath: string): string[] {
  return sourceDirectoryCandidates.map((sourceDirectory) => `${workspacePath}/${sourceDirectory}`);
}

function workspaceConfigFileCandidates(workspacePath: string): string[] {
  return configFileCandidates.map((configFile) => `${workspacePath}/${configFile}`);
}

function configFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

async function detectPackageManager(rootDir: string, packageJson: PackageJson): Promise<string | undefined> {
  const checks: Array<[string, string]> = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["package-lock.json", "npm"],
    ["bun.lock", "bun"],
    ["bun.lockb", "bun"]
  ];

  for (const [lockfile, packageManager] of checks) {
    if (await fileExists(join(rootDir, lockfile))) {
      return packageManager;
    }
  }

  return parsePackageManager(packageJson.packageManager);
}

function parsePackageManager(packageManager: string | undefined): string | undefined {
  const match = /^([a-z][a-z0-9-]*)@/i.exec(packageManager ?? "");

  return match?.[1];
}

async function detectFiles(rootDir: string, candidates: string[]): Promise<string[]> {
  const detected: string[] = [];

  for (const candidate of candidates) {
    if (await fileExists(join(rootDir, candidate))) {
      detected.push(candidate);
    }
  }

  return detected;
}

async function detectDirectories(rootDir: string, candidates: string[]): Promise<string[]> {
  const detected: string[] = [];

  for (const candidate of candidates) {
    try {
      const result = await stat(join(rootDir, candidate));
      if (result.isDirectory()) {
        detected.push(candidate);
      }
    } catch {
      continue;
    }
  }

  return detected;
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    const result = await stat(path);

    return result.isDirectory();
  } catch {
    return false;
  }
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
