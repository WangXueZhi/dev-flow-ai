import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { detectStack } from "./stack.js";

test("detectStack identifies common frontend repository signals", async () => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-stack-"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "package-lock.json"), "{}", "utf8");
  await writeFile(
    join(root, "package.json"),
    JSON.stringify(
      {
        type: "module",
        scripts: {
          dev: "vite",
          check: "vitest run && tsc --noEmit"
        },
        dependencies: {
          "@vitejs/plugin-react": "^latest",
          react: "^latest",
          vite: "^latest"
        },
        devDependencies: {
          tailwindcss: "^latest",
          typescript: "^latest",
          vitest: "^latest"
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(join(root, "tsconfig.json"), "{}", "utf8");
  await writeFile(join(root, "vite.config.ts"), "export default {}", "utf8");

  const stack = await detectStack(root);

  assert.equal(stack.packageManager, "npm");
  assert.ok(stack.runtimes.includes("TypeScript"));
  assert.ok(stack.frameworks.includes("React"));
  assert.ok(stack.buildTools.includes("Vite"));
  assert.ok(stack.styling.includes("Tailwind CSS"));
  assert.ok(stack.testing.includes("Vitest"));
  assert.ok(stack.sourceDirectories.includes("src"));
  assert.ok(stack.configFiles.includes("vite.config.ts"));
});

test("detectStack identifies framework conventions from config files and package manager metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-stack-config-"));
  await mkdir(join(root, "src", "app"), { recursive: true });
  await mkdir(join(root, "src", "routes"), { recursive: true });
  await writeFile(
    join(root, "package.json"),
    JSON.stringify(
      {
        packageManager: "pnpm@9.12.0",
        devDependencies: {
          "@biomejs/biome": "^latest",
          "@vitejs/plugin-react-swc": "^latest",
          eslint: "^latest",
          prettier: "^latest",
          "svelte-check": "^latest",
          typescript: "^latest",
          "vue-tsc": "^latest"
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(join(root, "next.config.mjs"), "export default {}", "utf8");
  await writeFile(join(root, "nuxt.config.ts"), "export default {}", "utf8");
  await writeFile(join(root, "vue.config.js"), "module.exports = {}", "utf8");
  await writeFile(join(root, "svelte.config.mjs"), "export default {}", "utf8");
  await writeFile(join(root, "astro.config.ts"), "export default {}", "utf8");
  await writeFile(join(root, "angular.json"), "{}", "utf8");
  await writeFile(join(root, "tailwind.config.mjs"), "export default {}", "utf8");
  await writeFile(join(root, "vitest.config.mjs"), "export default {}", "utf8");
  await writeFile(join(root, "playwright.config.js"), "module.exports = {}", "utf8");
  await writeFile(join(root, "cypress.config.ts"), "export default {}", "utf8");
  await writeFile(join(root, "jest.config.js"), "module.exports = {}", "utf8");
  await writeFile(join(root, "eslint.config.js"), "export default []", "utf8");
  await writeFile(join(root, ".prettierrc"), "{}", "utf8");
  await writeFile(join(root, "biome.json"), "{}", "utf8");

  const stack = await detectStack(root);

  assert.equal(stack.packageManager, "pnpm");
  assert.ok(stack.runtimes.includes("TypeScript"));
  assert.deepEqual(stack.frameworks, ["Next.js", "React", "Vue", "Nuxt", "Svelte", "Angular", "Astro"]);
  assert.ok(stack.buildTools.includes("Angular CLI"));
  assert.ok(stack.buildTools.includes("vue-tsc"));
  assert.ok(stack.buildTools.includes("svelte-check"));
  assert.ok(stack.buildTools.includes("Biome"));
  assert.ok(stack.buildTools.includes("ESLint"));
  assert.ok(stack.buildTools.includes("Prettier"));
  assert.ok(stack.styling.includes("Tailwind CSS"));
  assert.ok(stack.testing.includes("Vitest"));
  assert.ok(stack.testing.includes("Playwright"));
  assert.ok(stack.testing.includes("Cypress"));
  assert.ok(stack.testing.includes("Jest"));
  assert.ok(stack.sourceDirectories.includes("src/app"));
  assert.ok(stack.sourceDirectories.includes("src/routes"));
  assert.ok(stack.configFiles.includes("next.config.mjs"));
  assert.ok(stack.configFiles.includes("vue.config.js"));
  assert.ok(stack.configFiles.includes("eslint.config.js"));
  assert.ok(stack.configFiles.includes(".prettierrc"));
  assert.ok(stack.configFiles.includes("biome.json"));
  assert.ok(!stack.notes.some((note) => /No lockfile/.test(note)));
});

test("detectStack identifies workspace package scripts and frontend signals", async () => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-stack-workspace-"));
  await mkdir(join(root, "apps", "web", "src"), { recursive: true });
  await mkdir(join(root, "packages", "ui", "src"), { recursive: true });
  await mkdir(join(root, "packages", "utils"), { recursive: true });
  await writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");
  await writeFile(
    join(root, "package.json"),
    JSON.stringify(
      {
        private: true,
        workspaces: ["apps/*"]
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(join(root, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n  - packages/*\n", "utf8");
  await writeFile(
    join(root, "apps", "web", "package.json"),
    JSON.stringify(
      {
        name: "@acme/web",
        scripts: {
          lint: "eslint .",
          typecheck: "tsc --noEmit",
          "test:e2e": "playwright test",
          build: "vite build"
        },
        dependencies: {
          "@playwright/test": "^latest",
          react: "^latest",
          "react-dom": "^latest",
          vite: "^latest"
        },
        devDependencies: {
          eslint: "^latest",
          typescript: "^latest"
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    join(root, "packages", "ui", "package.json"),
    JSON.stringify(
      {
        name: "@acme/ui",
        scripts: {
          test: "node --test",
          build: "tsc -p tsconfig.json"
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    join(root, "packages", "utils", "package.json"),
    JSON.stringify(
      {
        name: "@acme/utils",
        dependencies: {
          vue: "^latest"
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(join(root, "apps", "web", "vite.config.ts"), "export default {}", "utf8");
  await writeFile(join(root, "apps", "web", "tsconfig.json"), "{}", "utf8");

  const stack = await detectStack(root);

  assert.equal(stack.packageManager, "pnpm");
  assert.deepEqual(stack.workspacePackages?.map((workspacePackage) => workspacePackage.path), [
    "apps/web",
    "packages/ui",
    "packages/utils"
  ]);
  assert.ok(stack.frameworks.includes("React"));
  assert.ok(stack.frameworks.includes("Vue"));
  assert.ok(stack.buildTools.includes("Vite"));
  assert.ok(stack.buildTools.includes("tsc"));
  assert.ok(stack.buildTools.includes("ESLint"));
  assert.ok(stack.testing.includes("Playwright"));
  assert.ok(stack.testing.includes("node:test"));
  assert.ok(stack.sourceDirectories.includes("apps/web/src"));
  assert.ok(stack.sourceDirectories.includes("packages/ui/src"));
  assert.ok(stack.configFiles.includes("apps/web/vite.config.ts"));
  assert.ok(stack.configFiles.includes("apps/web/tsconfig.json"));
  assert.ok(stack.notes.some((note) => /Workspace packages detected: apps\/web, packages\/ui, packages\/utils/.test(note)));
  assert.ok(!stack.notes.some((note) => /No package scripts detected/.test(note)));
});
