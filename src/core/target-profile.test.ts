import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProjectBrief } from "./brief.js";
import { createImplementationTargetProfile } from "./target-profile.js";
import type { ImplementationTask, ImplementationUnit } from "./tasks.js";

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
      frameworks: ["React", "React Router"],
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
    "src/router/index.tsx",
    "src/router/index.ts",
    "src/routes.tsx"
  ]);
  assert.ok(profile.componentCandidates.includes("src/routes.ts"));
  assert.ok(profile.componentCandidates.includes("src/AppRoutes.tsx"));
  assert.ok(profile.componentCandidates.includes("src/components/RetryBanner.tsx"));
  assert.deepEqual(profile.dataCandidates.slice(0, 3), [
    "src/lib/api/release-summary.ts",
    "src/services/release-summary.ts",
    "src/api/release-summary.ts"
  ]);
});

test("createImplementationTargetProfile prioritizes candidates from selected frontend units", () => {
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
      frameworks: ["React", "React Router"],
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
    apiContracts: [],
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
        },
        {
          source: "requirements",
          summary: "Route path /settings/security",
          evidence: ["Acceptance criterion"]
        }
      ],
      components: [
        {
          source: "ui",
          summary: "Component RetryBanner",
          evidence: ["UI signal"]
        },
        {
          source: "ui",
          summary: "Component AuditPanel",
          evidence: ["UI signal"]
        }
      ],
      dataNeeds: [
        {
          source: "api",
          summary: "Integrate GET /api/release/summary",
          evidence: ["GET /api/release/summary"]
        }
      ],
      uiStates: []
    },
    userStories: [],
    constraints: [],
    acceptanceCriteria: [],
    deliveryRisks: [],
    openQuestions: [],
    recommendedVerification: ["npm run test"]
  };
  const routeUnit: ImplementationUnit = {
    id: "U01",
    kind: "frontend-route",
    title: "Route path /settings/security",
    source: "docs/requirements.md",
    details: ["Target source: requirements"]
  };
  const componentUnit: ImplementationUnit = {
    id: "U02",
    kind: "frontend-component",
    title: "Component AuditPanel",
    source: "docs/ui.md",
    details: ["Target source: ui"]
  };
  const dataUnit: ImplementationUnit = {
    id: "U03",
    kind: "frontend-data",
    title: "Integrate GET /api/release/summary",
    source: "docs/api.md",
    details: ["Target source: api", "Evidence: GET /api/release/summary"]
  };
  const tokenUnit: ImplementationUnit = {
    id: "U04",
    kind: "design-token",
    title: "Primary color: #2563eb",
    source: "docs/ui.md:22",
    details: ["Category: color", "Value: #2563eb"]
  };

  const routeProfile = createImplementationTargetProfile(task, brief, routeUnit);
  const componentProfile = createImplementationTargetProfile(task, brief, componentUnit);
  const dataProfile = createImplementationTargetProfile(task, brief, dataUnit);
  const tokenProfile = createImplementationTargetProfile(task, brief, tokenUnit);

  assert.deepEqual(routeProfile.componentCandidates.slice(0, 3), [
    "src/pages/SettingsSecurity.tsx",
    "src/routes/SettingsSecurity.tsx",
    "src/features/settings-security/"
  ]);
  assert.ok(routeProfile.componentCandidates.includes("src/router/index.tsx"));
  assert.ok(routeProfile.componentCandidates.includes("src/AppRoutes.tsx"));
  assert.ok(
    routeProfile.componentCandidates.indexOf("src/pages/SettingsSecurity.tsx") <
      routeProfile.componentCandidates.indexOf("src/pages/SettingsProfile.tsx")
  );
  assert.deepEqual(componentProfile.componentCandidates.slice(0, 2), [
    "src/components/AuditPanel.tsx",
    "src/features/audit-panel/AuditPanel.tsx"
  ]);
  assert.ok(
    componentProfile.componentCandidates.indexOf("src/components/AuditPanel.tsx") <
      componentProfile.componentCandidates.indexOf("src/components/RetryBanner.tsx")
  );
  assert.deepEqual(dataProfile.dataCandidates.slice(0, 3), [
    "src/lib/api/release-summary.ts",
    "src/services/release-summary.ts",
    "src/api/release-summary.ts"
  ]);
  assert.ok(tokenProfile.notes.some((note) => note.includes("design token")));
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
