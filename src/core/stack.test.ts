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
