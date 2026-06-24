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
      "Package exposes release readiness and preflight scripts",
      input.packageJson.scripts?.["release:readiness"] === "node scripts/release-readiness.mjs" &&
        input.packageJson.scripts?.["release:preflight"] === "node scripts/release-preflight.mjs",
      "release scripts in package.json"
    ),
    check(
      "release-script-packaged",
      "Release readiness script is included in the package file allowlist",
      Array.isArray(input.packageJson.files) && input.packageJson.files.includes("scripts/release-readiness.mjs"),
      "scripts/release-readiness.mjs"
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
      "live-smoke-gate",
      "Release docs describe the optional required live-provider smoke gate",
      /DEVFLOW_REQUIRE_LIVE_SMOKE=true/.test(input.releaseGuide) &&
        /DEVFLOW_AI_API_KEY|OPENAI_API_KEY/.test(input.releaseGuide),
      "docs/release.md live provider gate"
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
