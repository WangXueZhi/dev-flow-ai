#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fallbackPackageName = "dev-flow-ai";
const fallbackReleaseTag = "v0.1.0";
const fallbackRepository = "WangXueZhi/dev-flow-ai";
const commandTimeoutMs = 30_000;
const providerSecrets = ["DEVFLOW_AI_API_KEY", "OPENAI_API_KEY"];

export function evaluateExternalReleaseStatus(input) {
  const checks = [
    evaluateNpmAuth(input.packageName, input.npmWhoami),
    evaluateNpmPackage(input.packageName, input.npmView),
    evaluateGitHubRelease(input.releaseTag, input.githubReleases),
    evaluateGitHubSecrets(input.githubSecrets)
  ];

  return {
    packageName: input.packageName,
    releaseTag: input.releaseTag,
    repository: input.repository,
    generatedAt: input.generatedAt,
    passed: checks.every((check) => check.status === "passed"),
    checks,
    nextActions: checks.filter((check) => check.status !== "passed").map((check) => check.nextAction)
  };
}

export function formatExternalReleaseStatusReport(report) {
  const lines = [
    `External release status for ${report.packageName} ${report.releaseTag}`,
    `Repository: ${report.repository}`,
    `Generated: ${report.generatedAt}`,
    "",
    ...report.checks.map((check) => `${statusLabel(check.status)} ${check.label}: ${check.detail}`)
  ];

  if (report.nextActions.length > 0) {
    lines.push("", "Next actions:", ...report.nextActions.map((action) => `- ${action}`));
  }

  lines.push("", report.passed ? "External release status passed." : "External release status has blockers.");

  return lines.join("\n");
}

export function derivePackageDefaults(packageJson) {
  const packageName =
    typeof packageJson?.name === "string" && packageJson.name.trim() ? packageJson.name.trim() : fallbackPackageName;
  const version =
    typeof packageJson?.version === "string" && packageJson.version.trim() ? packageJson.version.trim() : "";
  const releaseTag = version ? `v${version}` : fallbackReleaseTag;
  const repository = normalizeRepository(packageJson?.repository) ?? fallbackRepository;

  return {
    packageName,
    releaseTag,
    repository
  };
}

function evaluateNpmAuth(packageName, result) {
  if (result.exitCode === 0 && result.stdout.trim()) {
    return check(
      "npm-auth",
      "npm authentication",
      "passed",
      `authenticated as ${result.stdout.trim()}`,
      "No action needed."
    );
  }

  return check(
    "npm-auth",
    "npm authentication",
    "failed",
    `npm whoami failed: ${formatCommandFailure(result)}`,
    `Run \`npm adduser\` or configure an npm token with publish rights for ${packageName}.`
  );
}

function evaluateNpmPackage(packageName, result) {
  if (result.exitCode === 0) {
    const parsed = parseJson(result.stdout);

    if (parsed && parsed.name === packageName && parsed.version) {
      return check(
        "npm-package",
        "npm package published",
        "passed",
        `${parsed.name}@${parsed.version} is available on npm`,
        "No action needed."
      );
    }
  }

  const parsedError = parseJson(result.stdout)?.error;
  const notFound = parsedError?.code === "E404" || /E404|not found/i.test(`${result.stdout}\n${result.stderr}`);

  return check(
    "npm-package",
    "npm package published",
    "failed",
    notFound ? `${packageName} is not published on npm` : `npm view failed: ${formatCommandFailure(result)}`,
    "Publish the package with `npm publish --provenance --access public` from the Release workflow."
  );
}

function evaluateGitHubRelease(releaseTag, result) {
  if (result.exitCode !== 0) {
    return check(
      "github-release",
      "GitHub Release published",
      "unknown",
      `could not query releases: ${formatCommandFailure(result)}`,
      `Authenticate GitHub CLI access, then publish the ${releaseTag} GitHub Release.`
    );
  }

  const releases = parseJson(result.stdout);

  if (!Array.isArray(releases)) {
    return check(
      "github-release",
      "GitHub Release published",
      "unknown",
      "GitHub releases response was not a JSON array",
      "Inspect the GitHub Release page and publish the v0.1.0 release when ready."
    );
  }

  const release = releases.find((item) => item?.tag_name === releaseTag);

  if (!release) {
    return check(
      "github-release",
      "GitHub Release published",
      "failed",
      `${releaseTag} release was not found`,
      `Create and publish the ${releaseTag} GitHub Release.`
    );
  }

  if (release.draft) {
    return check(
      "github-release",
      "GitHub Release published",
      "failed",
      `${releaseTag} is still a draft (${release.html_url ?? "no URL"})`,
      "Publish the draft GitHub Release after npm and live-provider gates are ready."
    );
  }

  if (!release.published_at) {
    return check(
      "github-release",
      "GitHub Release published",
      "failed",
      `${releaseTag} has no published_at timestamp`,
      "Publish the GitHub Release so release automation can run from a published event."
    );
  }

  return check(
    "github-release",
    "GitHub Release published",
    "passed",
    `${releaseTag} published at ${release.published_at}`,
    "No action needed."
  );
}

function evaluateGitHubSecrets(result) {
  if (result.exitCode !== 0) {
    return check(
      "github-secrets",
      "GitHub Actions release secrets",
      "unknown",
      `could not query Actions secrets: ${formatCommandFailure(result)}`,
      "Authenticate GitHub CLI access, then configure NPM_TOKEN and a live provider secret."
    );
  }

  const parsed = parseJson(result.stdout);
  const names = Array.isArray(parsed?.secrets) ? parsed.secrets.map((secret) => secret.name).filter(Boolean) : [];
  const missing = [];

  if (!names.includes("NPM_TOKEN")) {
    missing.push("NPM_TOKEN");
  }

  if (!providerSecrets.some((name) => names.includes(name))) {
    missing.push("DEVFLOW_AI_API_KEY or OPENAI_API_KEY");
  }

  if (missing.length > 0) {
    return check(
      "github-secrets",
      "GitHub Actions release secrets",
      "failed",
      `missing ${missing.join(", ")} (configured secrets: ${names.length})`,
      "Add NPM_TOKEN plus DEVFLOW_AI_API_KEY or OPENAI_API_KEY as repository Actions secrets."
    );
  }

  return check(
    "github-secrets",
    "GitHub Actions release secrets",
    "passed",
    `required release secrets are configured (${names.length} total)`,
    "No action needed."
  );
}

function check(id, label, status, detail, nextAction) {
  return { id, label, status, detail, nextAction };
}

function statusLabel(status) {
  if (status === "passed") {
    return "PASS";
  }

  if (status === "failed") {
    return "FAIL";
  }

  return "UNKNOWN";
}

function formatCommandFailure(result) {
  if (result.error) {
    return result.error;
  }

  const combined = `${result.stderr}\n${result.stdout}`.trim();
  const lines = combined.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const codeLine = lines.find((line) => /(?:^|\s)(?:E[A-Z0-9]+|HTTP\s+\d{3})(?:\s|$)/.test(line));

  return codeLine ?? lines[0] ?? `exit ${result.exitCode}`;
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: commandTimeoutMs
  });

  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error?.message
  };
}

function parseArgs(argv, defaults = readPackageDefaults()) {
  const options = {
    json: false,
    requirePassed: false,
    packageName: defaults.packageName,
    releaseTag: defaults.releaseTag,
    repository: defaults.repository
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--require-passed") {
      options.requirePassed = true;
    } else if (arg === "--package") {
      options.packageName = argv[++index] ?? options.packageName;
    } else if (arg === "--tag") {
      options.releaseTag = argv[++index] ?? options.releaseTag;
    } else if (arg === "--repo") {
      options.repository = argv[++index] ?? options.repository;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function readPackageDefaults() {
  try {
    return derivePackageDefaults(JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8")));
  } catch {
    return {
      packageName: fallbackPackageName,
      releaseTag: fallbackReleaseTag,
      repository: fallbackRepository
    };
  }
}

function normalizeRepository(repository) {
  const value = typeof repository === "string" ? repository : repository?.url;

  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  return value
    .trim()
    .replace(/^git\+/, "")
    .replace(/^https:\/\/github\.com\//, "")
    .replace(/^git@github\.com:/, "")
    .replace(/\.git$/, "");
}

function collectExternalStatus(options) {
  return evaluateExternalReleaseStatus({
    packageName: options.packageName,
    releaseTag: options.releaseTag,
    repository: options.repository,
    generatedAt: new Date().toISOString(),
    npmWhoami: runCommand("npm", ["whoami"]),
    npmView: runCommand("npm", ["view", options.packageName, "name", "version", "description", "--json"]),
    githubReleases: runCommand("gh", ["api", "--method", "GET", `repos/${options.repository}/releases`, "-F", "per_page=20"]),
    githubSecrets: runCommand("gh", ["api", "--method", "GET", `repos/${options.repository}/actions/secrets`])
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = collectExternalStatus(options);

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatExternalReleaseStatusReport(report));
    }

    if (options.requirePassed && !report.passed) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
