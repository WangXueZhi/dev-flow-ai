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
  "REQUIRE_CLEAN: ${{ inputs.require-clean }}",
  "args+=(--require-clean)",
  "SOURCE_CONTEXT: ${{ inputs.source-context }}",
  "args+=(--no-source-context)",
  "case \"$package_spec\" in",
  "dev-flow-ai|dev-flow-ai@*|*:*|*/*|*.tgz) ;;",
  "package_spec=\"dev-flow-ai@$package_spec\"",
  "dev-flow execute --validate --patch-set \"$PATCH_SET\"",
  "npx --yes --package \"$package_spec\" dev-flow \"${args[@]}\"",
  "if: ${{ inputs.job-summary == 'true' && always() }}",
  "MANIFEST_PATH: ${{ inputs.artifacts-path }}/delivery-manifest.json",
  "node \"$GITHUB_ACTION_PATH/scripts/summarize-manifest.mjs\"",
  "if: ${{ inputs.upload-artifacts == 'true' && always() }}",
  "uses: actions/upload-artifact@v7",
  "Gate DevFlow delivery status",
  "STATUS_MANIFEST_PATH: ${{ inputs.artifacts-path }}/delivery-manifest.json",
  "FAIL_ON_FAILED_VISUAL: ${{ inputs.fail-on-failed-visual }}",
  "args=(status --manifest \"$STATUS_MANIFEST_PATH\")",
  "args+=(--fail-on-attention)",
  "args+=(--fail-on-failed-verification)",
  "args+=(--fail-on-failed-visual)",
  "dev-flow \"${args[@]}\""
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
  "require-clean",
  "patch-set",
  "save-patch-set",
  "source-context",
  "upload-artifacts",
  "artifact-name",
  "artifacts-path",
  "job-summary",
  "fail-on-attention",
  "fail-on-failed-verification",
  "fail-on-failed-visual"
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
