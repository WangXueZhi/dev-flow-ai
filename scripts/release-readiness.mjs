#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function evaluateReleaseReadiness(input) {
  const version = input.packageJson.version;
  const name = input.packageJson.name;
  const releaseTag = `v${version}`;
  const rootPackage = input.packageLock.packages?.[""];
  const normalizedReleaseNotesPath = input.releaseNotesPath.replaceAll("\\", "/");
  const checks = [
    check("package-name", "Package name is dev-flow-ai", name === "dev-flow-ai", name),
    check("package-version", "Package version is semver-like", isSemverLike(version), version),
    check(
      "package-lock-version",
      "package-lock root package matches package.json",
      input.packageLock.name === name &&
        input.packageLock.version === version &&
        rootPackage?.name === name &&
        rootPackage?.version === version,
      `package-lock ${input.packageLock.name ?? "unknown"}@${input.packageLock.version ?? "unknown"}`
    ),
    check(
      "public-publish-config",
      "Package is configured for public npm publish",
      input.packageJson.publishConfig?.access === "public",
      `publishConfig.access=${input.packageJson.publishConfig?.access ?? "missing"}`
    ),
    check(
      "cli-bin",
      "Package exposes the dev-flow CLI bin",
      input.packageJson.bin?.["dev-flow"] === "./dist/cli.js",
      `bin.dev-flow=${input.packageJson.bin?.["dev-flow"] ?? "missing"}`
    ),
    check(
      "release-script",
      "Package exposes release readiness, preflight, and live-smoke report scripts",
      input.packageJson.scripts?.["release:readiness"] === "node scripts/release-readiness.mjs" &&
        input.packageJson.scripts?.["release:preflight"] === "node scripts/release-preflight.mjs" &&
        input.packageJson.scripts?.["smoke:live:report"] === "node scripts/verify-live-smoke-report.mjs" &&
        input.packageJson.scripts?.["smoke:live:summary"] === "node scripts/summarize-live-smoke-report.mjs",
      "release scripts in package.json"
    ),
    check(
      "release-script-packaged",
      "Release support scripts are included in the package file allowlist",
      Array.isArray(input.packageJson.files) &&
        input.packageJson.files.includes("scripts/release-readiness.mjs") &&
        input.packageJson.files.includes("scripts/verify-live-smoke-report.mjs") &&
        input.packageJson.files.includes("scripts/summarize-live-smoke-report.mjs"),
      "release readiness, live-smoke report, and live-smoke summary scripts"
    ),
    check(
      "changelog-entry",
      "CHANGELOG has an entry for the package version",
      new RegExp(`^##\\s+v?${escapeRegExp(version)}(?:\\s|$)`, "m").test(input.changelog),
      `CHANGELOG.md ${version}`
    ),
    check(
      "release-notes",
      "Versioned release notes exist for the release tag",
      normalizedReleaseNotesPath.endsWith(`docs/releases/${releaseTag}.md`) && input.releaseNotes.includes(releaseTag),
      input.releaseNotesPath
    ),
    check(
      "release-workflow-trigger",
      "Release workflow can publish from a GitHub Release or manual dispatch",
      /release:\s*\n\s*types:\s*\[published\]/.test(input.releaseWorkflow) &&
        /workflow_dispatch:/.test(input.releaseWorkflow),
      ".github/workflows/release.yml triggers"
    ),
    check(
      "release-workflow-provenance",
      "Release workflow publishes to npm with provenance",
      /id-token:\s*write/.test(input.releaseWorkflow) &&
        /NPM_TOKEN/.test(input.releaseWorkflow) &&
        /npm publish\b[^\n]*--provenance\b[^\n]*--access public/.test(input.releaseWorkflow),
      "npm publish --provenance --access public"
    ),
    check(
      "release-workflow-readiness",
      "Release workflow runs static release readiness before publish",
      /npm run release:readiness/.test(input.releaseWorkflow),
      "npm run release:readiness"
    ),
    check(
      "release-workflow-live-smoke",
      "Release workflow can require live provider smoke with provider secrets",
      /Required live provider smoke/.test(input.releaseWorkflow) &&
        /DEVFLOW_REQUIRE_LIVE_SMOKE:\s*"true"/.test(input.releaseWorkflow) &&
        /DEVFLOW_AI_API_KEY:\s*\$\{\{\s*secrets\.DEVFLOW_AI_API_KEY\s*\}\}/.test(input.releaseWorkflow) &&
        /OPENAI_API_KEY:\s*\$\{\{\s*secrets\.OPENAI_API_KEY\s*\}\}/.test(input.releaseWorkflow),
      "required live smoke with provider secrets"
    ),
    check(
      "release-workflow-live-smoke-artifact",
      "Release workflow uploads the live provider smoke JSON report",
      /DEVFLOW_LIVE_SMOKE_REPORT:\s*\.devflow\/artifacts\/live-provider-smoke\.json/.test(input.releaseWorkflow) &&
        /Upload live provider smoke report/.test(input.releaseWorkflow) &&
        /uses:\s*actions\/upload-artifact@v7/.test(input.releaseWorkflow) &&
        /if:\s*\$\{\{\s*always\(\)\s*\}\}/.test(input.releaseWorkflow) &&
        /name:\s*live-provider-smoke-report/.test(input.releaseWorkflow) &&
        /path:\s*\.devflow\/artifacts\/live-provider-smoke\.json/.test(input.releaseWorkflow),
      ".devflow/artifacts/live-provider-smoke.json artifact upload"
    ),
    check(
      "release-workflow-live-smoke-report-gate",
      "Release workflow validates live provider smoke report status before publish",
      /Verify optional live provider smoke report/.test(input.releaseWorkflow) &&
        /run:\s*npm run smoke:live:report/.test(input.releaseWorkflow) &&
        /Verify required live provider smoke report/.test(input.releaseWorkflow) &&
        /run:\s*npm run smoke:live:report -- --require-passed/.test(input.releaseWorkflow),
      "smoke:live:report with --require-passed for required release gates"
    ),
    check(
      "release-workflow-live-smoke-summary",
      "Release workflow writes a live provider smoke job summary",
      /Summarize live provider smoke report[\s\S]*?if:\s*\$\{\{\s*always\(\)\s*\}\}[\s\S]*?run:\s*npm run smoke:live:summary/.test(
        input.releaseWorkflow
      ),
      "smoke:live:summary with always()"
    ),
    check(
      "live-smoke-gate",
      "Release docs describe the required live-provider smoke gate and JSON evidence",
      /DEVFLOW_REQUIRE_LIVE_SMOKE=true/.test(input.releaseGuide) &&
        /DEVFLOW_AI_API_KEY|OPENAI_API_KEY/.test(input.releaseGuide) &&
        /live-provider-smoke\.json/.test(input.releaseGuide) &&
        /smoke:live:report/.test(input.releaseGuide) &&
        /Upload live provider smoke report|workflow artifact/i.test(input.releaseGuide),
      "docs/release.md live provider gate and JSON artifact evidence"
    )
  ];

  return {
    packageName: name,
    version,
    releaseTag,
    passed: checks.every((item) => item.passed),
    checks
  };
}

export function formatReleaseReadinessReport(report) {
  const lines = [
    `Release readiness for ${report.packageName}@${report.version} (${report.releaseTag})`,
    "",
    ...report.checks.map((item) => `${item.passed ? "PASS" : "FAIL"} ${item.label}: ${item.details}`),
    "",
    report.passed ? "Release readiness passed." : "Release readiness failed."
  ];

  return lines.join("\n");
}

function check(id, label, passed, details) {
  return {
    id,
    label,
    passed,
    details
  };
}

function isSemverLike(value) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readRequiredText(path) {
  if (!existsSync(path)) {
    return "";
  }

  return readFileSync(path, "utf8");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const packageJson = readJson(join(rootDir, "package.json"));
  const releaseNotesPath = join(rootDir, "docs", "releases", `v${packageJson.version}.md`);
  const report = evaluateReleaseReadiness({
    packageJson,
    packageLock: readJson(join(rootDir, "package-lock.json")),
    changelog: readRequiredText(join(rootDir, "CHANGELOG.md")),
    releaseNotes: readRequiredText(releaseNotesPath),
    releaseNotesPath,
    releaseWorkflow: readRequiredText(join(rootDir, ".github", "workflows", "release.yml")),
    releaseGuide: readRequiredText(join(rootDir, "docs", "release.md"))
  });

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReleaseReadinessReport(report));
  }

  if (!report.passed) {
    process.exit(1);
  }
}
