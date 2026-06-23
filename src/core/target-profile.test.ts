import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProjectBrief } from "./brief.js";
import { createImplementationTargetProfile } from "./target-profile.js";
import type { ImplementationTask } from "./tasks.js";

const task: ImplementationTask = {
  id: "T03-code-implementation",
  phase: "Implementation",
  title: "Implement release dashboard",
  objective: "Build the release dashboard route and API-backed states.",
  mode: "ai-assisted",
  risk: "high",
  dependsOn: [],
  inputs: [".devflow/artifacts/project-brief.json"],
  expectedOutputs: ["Updated source files"],
  acceptanceCriteria: ["Release dashboard shows loading, error, and success states."],
  verification: []
};

test("createImplementationTargetProfile includes Nuxt route, data, style, and test candidates", () => {
  const brief: ProjectBrief = {
    version: 1,
    sourceDocuments: {
      requirementsPath: "docs/requirements.md",
      uiPath: "docs/ui.md",
      apiPath: "docs/api.md"
    },
    stack: {
      packageManager: "pnpm",
      runtimes: ["Node.js", "TypeScript"],
      frameworks: ["Vue", "Nuxt"],
      buildTools: [],
      styling: ["Tailwind CSS"],
      testing: ["Vitest"],
      scripts: {
        test: "vitest run"
      },
      sourceDirectories: ["pages", "components", "composables"],
      configFiles: ["nuxt.config.ts", "vitest.config.mjs", "playwright.config.js", "cypress.config.ts"],
      notes: []
    },
    signals: {
      requirements: [],
      ui: [],
      api: []
    },
    designAssets: [],
    uiStateChecklist: [],
    apiContracts: [
      {
        method: "GET",
        path: "/api/release/readiness",
        sourceLine: 3,
        summary: "GET /api/release/readiness"
      }
    ],
    apiDataModels: [],
    apiErrorCases: [],
    apiAuthRequirements: [],
    invalidApiDataModels: [],
    frontendTargets: {
      routes: [],
      components: [],
      dataNeeds: [],
      uiStates: []
    },
    userStories: [],
    constraints: [],
    acceptanceCriteria: [],
    deliveryRisks: [],
    openQuestions: [],
    recommendedVerification: ["pnpm test"]
  };

  const profile = createImplementationTargetProfile(task, brief);

  assert.ok(profile.componentCandidates.includes("app.vue"));
  assert.ok(profile.componentCandidates.includes("pages/"));
  assert.ok(profile.componentCandidates.includes("layouts/"));
  assert.ok(profile.componentCandidates.includes("components/"));
  assert.ok(profile.componentCandidates.includes("composables/"));
  assert.ok(profile.dataCandidates.includes("server/api/"));
  assert.ok(profile.dataCandidates.includes("composables/useApi.ts"));
  assert.ok(profile.styleCandidates.includes("assets/css/"));
  assert.ok(profile.styleCandidates.includes("nuxt.config.ts"));
  assert.ok(profile.testCandidates.includes("pages/**/*.test.ts"));
  assert.ok(profile.testCandidates.includes("e2e/"));
  assert.ok(profile.testCandidates.includes("cypress/e2e/"));
  assert.ok(profile.notes.some((note) => /For Nuxt apps/.test(note)));
});

test("createImplementationTargetProfile derives candidates from explicit frontend targets", () => {
  const brief: ProjectBrief = {
    version: 1,
    sourceDocuments: {
      requirementsPath: "docs/requirements.md",
      uiPath: "docs/ui.md",
      apiPath: "docs/api.md"
    },
    stack: {
      packageManager: "npm",
      runtimes: ["Node.js", "TypeScript"],
      frameworks: ["React"],
      buildTools: ["Vite"],
      styling: [],
      testing: ["Vitest"],
      scripts: {
        test: "vitest run"
      },
      sourceDirectories: ["src"],
      configFiles: ["vite.config.ts"],
      notes: []
    },
    signals: {
      requirements: [],
      ui: [],
      api: []
    },
    designAssets: [],
    uiStateChecklist: [],
    apiContracts: [
      {
        method: "GET",
        path: "/api/release/summary",
        sourceLine: 12,
        summary: "GET /api/release/summary"
      }
    ],
    apiDataModels: [],
    apiErrorCases: [],
    apiAuthRequirements: [],
    invalidApiDataModels: [],
    frontendTargets: {
      routes: [
        {
          source: "requirements",
          summary: "Route path /settings/profile",
          evidence: ["Acceptance criterion"]
        }
      ],
      components: [
        {
          source: "ui",
          summary: "Component RetryBanner",
          evidence: ["UI signal"]
        }
      ],
      dataNeeds: [],
      uiStates: []
    },
    userStories: [],
    constraints: [],
    acceptanceCriteria: [],
    deliveryRisks: [],
    openQuestions: [],
    recommendedVerification: ["npm run test"]
  };

  const profile = createImplementationTargetProfile(task, brief);

  assert.deepEqual(profile.componentCandidates.slice(0, 6), [
    "src/pages/SettingsProfile.tsx",
    "src/routes/SettingsProfile.tsx",
    "src/features/settings-profile/",
    "src/components/RetryBanner.tsx",
    "src/features/retry-banner/RetryBanner.tsx",
    "src/App.tsx"
  ]);
  assert.deepEqual(profile.dataCandidates.slice(0, 3), [
    "src/lib/api/release-summary.ts",
    "src/services/release-summary.ts",
    "src/api/release-summary.ts"
  ]);
});

test("createImplementationTargetProfile includes Svelte, Astro, and Angular target candidates", () => {
  const brief: ProjectBrief = {
    version: 1,
    sourceDocuments: {
      requirementsPath: "docs/requirements.md",
      uiPath: "docs/ui.md",
      apiPath: "docs/api.md"
    },
    stack: {
      packageManager: "npm",
      runtimes: ["Node.js", "TypeScript"],
      frameworks: ["Svelte", "Astro", "Angular"],
      buildTools: ["Angular CLI"],
      styling: ["Sass"],
      testing: ["Jest", "Playwright"],
      scripts: {
        test: "jest"
      },
      sourceDirectories: ["src"],
      configFiles: ["svelte.config.js", "astro.config.mjs", "angular.json", "playwright.config.ts"],
      notes: []
    },
    signals: {
      requirements: [],
      ui: [],
      api: []
    },
    designAssets: [],
    uiStateChecklist: [],
    apiContracts: [
      {
        method: "GET",
        path: "/api/dashboard",
        sourceLine: 7,
        summary: "GET /api/dashboard"
      }
    ],
    apiDataModels: [],
    apiErrorCases: [],
    apiAuthRequirements: [],
    invalidApiDataModels: [],
    frontendTargets: {
      routes: [],
      components: [],
      dataNeeds: [],
      uiStates: []
    },
    userStories: [],
    constraints: [],
    acceptanceCriteria: [],
    deliveryRisks: [],
    openQuestions: [],
    recommendedVerification: ["npm run test"]
  };

  const profile = createImplementationTargetProfile(task, brief);

  assert.ok(profile.componentCandidates.includes("src/routes/+page.svelte"));
  assert.ok(profile.componentCandidates.includes("src/pages/index.astro"));
  assert.ok(profile.componentCandidates.includes("src/app/app.component.ts"));
  assert.ok(profile.componentCandidates.includes("src/app/app.routes.ts"));
  assert.ok(profile.dataCandidates.includes("src/routes/**/+server.ts"));
  assert.ok(profile.dataCandidates.includes("src/routes/**/+page.server.ts"));
  assert.ok(profile.dataCandidates.includes("src/pages/api/"));
  assert.ok(profile.dataCandidates.includes("src/app/**/*.service.ts"));
  assert.ok(profile.styleCandidates.includes("src/routes/+layout.svelte"));
  assert.ok(profile.styleCandidates.includes("src/styles/"));
  assert.ok(profile.styleCandidates.includes("src/app/**/*.scss"));
  assert.ok(profile.testCandidates.includes("src/routes/**/*.test.ts"));
  assert.ok(profile.testCandidates.includes("src/app/**/*.spec.ts"));
  assert.ok(profile.testCandidates.includes("e2e/"));
  assert.ok(profile.notes.some((note) => /Svelte route and lib conventions/.test(note)));
  assert.ok(profile.notes.some((note) => /Astro pages/.test(note)));
  assert.ok(profile.notes.some((note) => /Angular feature/.test(note)));
});
