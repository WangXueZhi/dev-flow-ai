#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const action = await readFile(resolve(rootDir, "action.yml"), "utf8");

const requiredSnippets = [
  "name: DevFlow Delivery",
  "using: composite",
  "working-directory: ${{ inputs.working-directory }}",
  "DevFlow source-changing delivery requires confirm-apply=true.",
  "default: github:WangXueZhi/dev-flow-ai#main",
  "case \"$package_spec\" in",
  "dev-flow-ai|dev-flow-ai@*|*:*|*/*|*.tgz) ;;",
  "package_spec=\"dev-flow-ai@$package_spec\"",
  "npx --yes --package \"$package_spec\" dev-flow \"${args[@]}\"",
  "uses: actions/upload-artifact@v4",
  "if: ${{ inputs.upload-artifacts == 'true' }}"
];
const requiredInputs = [
  "version",
  "working-directory",
  "requirements",
  "ui",
  "api",
  "task",
  "unit",
  "preview-url",
  "visual-text",
  "viewport",
  "verify-command",
  "install-chromium",
  "apply",
  "confirm-apply",
  "patch-set",
  "save-patch-set",
  "upload-artifacts",
  "artifact-name",
  "artifacts-path"
];

for (const snippet of requiredSnippets) {
  assertIncludes(action, snippet);
}

for (const input of requiredInputs) {
  assertIncludes(action, `  ${input}:`);
}

console.log("Action metadata check passed.");

function assertIncludes(value, expected) {
  if (!value.includes(expected)) {
    throw new Error(`action.yml is missing expected content: ${expected}`);
  }
}
