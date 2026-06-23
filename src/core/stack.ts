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

  const packageManager = await detectPackageManager(rootDir);
  const sourceDirectories = await detectDirectories(rootDir, [
    "app",
    "pages",
    "src",
    "components",
    "lib",
    "test",
    "tests",
    "e2e"
  ]);
  const configFiles = await detectFiles(rootDir, [
    "angular.json",
    "astro.config.mjs",
    "next.config.js",
    "next.config.mjs",
    "nuxt.config.ts",
    "playwright.config.ts",
    "postcss.config.js",
    "svelte.config.js",
    "tailwind.config.js",
    "tailwind.config.ts",
    "tsconfig.json",
    "vite.config.js",
    "vite.config.ts",
    "vitest.config.ts"
  ]);

  const runtimes = unique([
    "Node.js",
    hasDependency("typescript") ? "TypeScript" : undefined,
    packageJson.type === "module" ? "ES modules" : undefined,
    packageJson.bin ? "CLI package" : undefined
  ]);

  const frameworks = unique([
    hasDependency("next") ? "Next.js" : undefined,
    hasDependency("react") ? "React" : undefined,
    hasDependency("vue") ? "Vue" : undefined,
    hasDependency("nuxt") ? "Nuxt" : undefined,
    hasDependency("svelte") || hasDependency("@sveltejs/kit") ? "Svelte" : undefined,
    hasDependency("@angular/core") ? "Angular" : undefined,
    hasDependency("astro") ? "Astro" : undefined
  ]);

  const buildTools = unique([
    hasDependency("vite") ? "Vite" : undefined,
    hasDependency("webpack") ? "Webpack" : undefined,
    hasDependency("rollup") ? "Rollup" : undefined,
    hasDependency("esbuild") ? "esbuild" : undefined,
    hasDependency("tsx") ? "tsx" : undefined,
    hasDependency("typescript") ? "tsc" : undefined
  ]);

  const styling = unique([
    hasDependency("tailwindcss") ? "Tailwind CSS" : undefined,
    hasDependency("sass") ? "Sass" : undefined,
    hasDependency("less") ? "Less" : undefined,
    hasDependency("styled-components") ? "styled-components" : undefined,
    hasDependency("@emotion/react") ? "Emotion" : undefined,
    hasDependency("bootstrap") ? "Bootstrap" : undefined
  ]);

  const testing = unique([
    hasDependency("vitest") ? "Vitest" : undefined,
    hasDependency("jest") ? "Jest" : undefined,
    hasDependency("playwright") || hasDependency("@playwright/test") ? "Playwright" : undefined,
    hasDependency("cypress") ? "Cypress" : undefined,
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

async function detectPackageManager(rootDir: string): Promise<string | undefined> {
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

  return undefined;
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
