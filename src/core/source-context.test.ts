import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { collectSourceContext, formatSourceContextForPrompt, sourceContextCandidatePaths } from "./source-context.js";
import type { ImplementationTargetProfile } from "./target-profile.js";
import type { ImplementationUnit } from "./tasks.js";

test("collectSourceContext samples files, directories, globs, and missing paths safely", async (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-source-context-"));

  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  mkdirSync(join(workspace, "src", "components"), { recursive: true });
  writeFileSync(join(workspace, "src", "App.tsx"), "export function App() {\n  return <main>OpsBoard</main>;\n}\n", "utf8");
  writeFileSync(join(workspace, "src", "components", "Panel.tsx"), "export const Panel = () => null;\n", "utf8");
  writeFileSync(join(workspace, "package.json"), "{\"scripts\":{\"check\":\"vitest run\"}}\n", "utf8");

  const context = await collectSourceContext(
    ["src/App.tsx", "src/components/", "src/**/*.test.tsx", "../secret.ts", "missing.ts", "package.json"],
    {
      rootDir: workspace,
      maxFileBytes: 80
    }
  );

  assert.equal(context.entries.find((entry) => entry.path === "src/App.tsx")?.kind, "file");
  assert.equal(context.entries.find((entry) => entry.path === "src/components/")?.kind, "directory");
  assert.equal(context.entries.find((entry) => entry.path === "src/**/*.test.tsx")?.kind, "glob");
  assert.equal(context.entries.find((entry) => entry.path === "missing.ts")?.kind, "missing");
  assert.ok(context.omitted.some((item) => item.includes("../secret.ts")));

  const formatted = formatSourceContextForPrompt(context);
  assert.match(formatted, /Existing Repository Source Context/);
  assert.match(formatted, /OpsBoard/);
  assert.match(formatted, /Panel\.tsx/);
  assert.match(formatted, /Omitted Candidates/);
  assert.equal(formatted.includes(workspace), false);
});

test("sourceContextCandidatePaths includes target profile and resolved design asset paths", () => {
  const profile: ImplementationTargetProfile = {
    sourceRoots: ["src"],
    stackTags: ["React"],
    frontendTargets: {
      routes: [],
      components: [],
      dataNeeds: [],
      uiStates: []
    },
    componentCandidates: ["src/App.tsx"],
    dataCandidates: ["src/lib/api.ts"],
    styleCandidates: ["src/index.css"],
    testCandidates: ["src/**/*.test.tsx"],
    configCandidates: ["package.json"],
    verificationCommands: ["npm run check"],
    notes: []
  };
  const unit: ImplementationUnit = {
    id: "U17",
    kind: "design-asset",
    title: "Dashboard wireframe",
    source: "assets/dashboard.svg",
    details: ["Kind: local", "Resolved path: docs/assets/dashboard.svg"]
  };

  assert.deepEqual(sourceContextCandidatePaths(profile, unit), [
    "assets/dashboard.svg",
    "docs/assets/dashboard.svg",
    "src/App.tsx",
    "src/lib/api.ts",
    "src/index.css",
    "package.json",
    "src/**/*.test.tsx"
  ]);
});
