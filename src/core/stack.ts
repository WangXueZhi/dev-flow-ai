import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileExists } from "./fs.js";

export interface StackProfile {
  packageManager: string | undefined;
  runtimes: string[];
  frameworks: string[];
  buildTools: string[];
  styling: string[];
  testing: string[];
  scripts: Record<string, string>;
  sourceDirectories: string[];
  configFiles: string[];
  notes: string[];
}

interface PackageJson {
  type?: string;
  bin?: string | Record<string, string>;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export async function detectStack(rootDir = "."): Promise<StackProfile> {
  const packageJson = await readPackageJson(rootDir);
  const dependencies = {
    ...packageJson.optionalDependencies,
    ...packageJson.peerDependencies,
    ...packageJson.devDependencies,
    ...packageJson.dependencies
  };
  const scripts = packageJson.scripts ?? {};
  const hasDependency = (name: string) => Boolean(dependencies[name]);

  const packageManager = await detectPackageManager(rootDir, packageJson);
  const sourceDirectories = await detectDirectories(rootDir, [
    "app",
    "pages",
    "src",
    "src/app",
    "src/pages",
    "src/routes",
    "src/views",
    "src/components",
    "src/lib",
    "components",
    "lib",
    "test",
    "tests",
    "e2e"
  ]);
  const configFiles = await detectFiles(rootDir, [
    "angular.json",
    "astro.config.js",
    "astro.config.mjs",
    "astro.config.ts",
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
    "jest.config.js",
    "jest.config.mjs",
    "jest.config.ts",
    "playwright.config.js",
    "playwright.config.mjs",
    "playwright.config.ts",
    "postcss.config.cjs",
    "postcss.config.js",
    "postcss.config.mjs",
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
  ]);
  const hasConfigFile = (pattern: RegExp) => configFiles.some((configFile) => pattern.test(configFile));
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

  const runtimes = unique([
    "Node.js",
    hasDependency("typescript") ? "TypeScript" : undefined,
    packageJson.type === "module" ? "ES modules" : undefined,
    packageJson.bin ? "CLI package" : undefined
  ]);

  const frameworks = unique([
    hasNextSignal ? "Next.js" : undefined,
    hasReactSignal ? "React" : undefined,
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
    hasDependency("typescript") ? "tsc" : undefined
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
    Object.values(scripts).some((script) => script.includes("node --test")) ? "node:test" : undefined
  ]);

  const notes = unique([
    packageManager ? undefined : "No lockfile detected; package manager is inferred as unknown.",
    frameworks.length === 0 ? "No frontend framework dependency detected yet." : undefined,
    Object.keys(scripts).length === 0 ? "No package scripts detected." : undefined
  ]);

  return {
    packageManager,
    runtimes,
    frameworks,
    buildTools,
    styling,
    testing,
    scripts,
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

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
