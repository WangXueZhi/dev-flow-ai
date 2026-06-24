#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultReportPath = join(rootDir, ".devflow", "artifacts", "live-provider-smoke.json");
const statusValues = new Set(["passed", "skipped", "failed"]);

export function evaluateLiveSmokeReport(report, options = {}) {
  const errors = [];

  if (!isRecord(report)) {
    return {
      passed: false,
      errors: ["Live provider smoke report must be a JSON object."]
    };
  }

  if (report.version !== 1) {
    errors.push(`Expected version 1, received ${formatValue(report.version)}.`);
  }

  for (const field of ["generatedAt", "startedAt", "finishedAt"]) {
    if (!isIsoTimestamp(report[field])) {
      errors.push(`Expected ${field} to be an ISO timestamp string.`);
    }
  }

  if (!statusValues.has(report.status)) {
    errors.push(`Expected status to be passed, skipped, or failed; received ${formatValue(report.status)}.`);
  }

  if (typeof report.required !== "boolean") {
    errors.push("Expected required to be a boolean.");
  }

  if (report.apiKeyEnvName !== undefined && typeof report.apiKeyEnvName !== "string") {
    errors.push("Expected apiKeyEnvName to be a string when present.");
  }

  if (!isRecord(report.provider)) {
    errors.push("Expected provider diagnostics to be present.");
  } else {
    if (typeof report.provider.mode !== "string") {
      errors.push("Expected provider.mode to be a string.");
    }

    if (typeof report.provider.ready !== "boolean") {
      errors.push("Expected provider.ready to be a boolean.");
    }

    if (typeof report.provider.fixtureOverridesLive !== "boolean") {
      errors.push("Expected provider.fixtureOverridesLive to be a boolean.");
    }
  }

  if (typeof report.message !== "string" || report.message.trim().length === 0) {
    errors.push("Expected message to be a non-empty string.");
  }

  if (report.status === "failed") {
    errors.push(`Live provider smoke report status is failed: ${report.message ?? "missing failure message"}`);
  }

  if (options.requirePassed) {
    if (report.status !== "passed") {
      errors.push(`Required live provider smoke must have status passed; received ${formatValue(report.status)}.`);
    }

    if (report.required !== true) {
      errors.push("Required live provider smoke report must record required=true.");
    }
  }

  if (report.status === "passed") {
    if (report.provider?.mode !== "live") {
      errors.push("Passed live provider smoke report must record provider.mode=live.");
    }

    if (report.provider?.ready !== true) {
      errors.push("Passed live provider smoke report must record provider.ready=true.");
    }

    if (report.provider?.fixtureOverridesLive !== false) {
      errors.push("Passed live provider smoke report must record provider.fixtureOverridesLive=false.");
    }

    if (typeof report.apiKeyEnvName !== "string" || report.apiKeyEnvName.trim().length === 0) {
      errors.push("Passed live provider smoke report must record the provider key environment name.");
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    summary: formatReportSummary(report)
  };
}

function parseArgs(args) {
  let reportPath = process.env.DEVFLOW_LIVE_SMOKE_REPORT ?? defaultReportPath;
  let requirePassed = process.env.DEVFLOW_REQUIRE_LIVE_SMOKE === "true";
  let positionalPathSeen = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--require-passed") {
      requirePassed = true;
      continue;
    }

    if (arg === "--report") {
      const next = args[index + 1];

      if (!next) {
        throw new Error("--report requires a path.");
      }

      reportPath = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("--report=")) {
      reportPath = arg.slice("--report=".length);
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (positionalPathSeen) {
      throw new Error(`Unexpected extra argument: ${arg}`);
    }

    reportPath = arg;
    positionalPathSeen = true;
  }

  return {
    reportPath,
    requirePassed
  };
}

function readReport(path) {
  if (!existsSync(path)) {
    throw new Error(`Live provider smoke report does not exist: ${path}`);
  }

  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not parse live provider smoke report ${path}: ${message}`);
  }
}

function formatReportSummary(report) {
  if (!isRecord(report)) {
    return "invalid report";
  }

  const providerMode = isRecord(report.provider) ? report.provider.mode : "unknown";
  const required = typeof report.required === "boolean" ? report.required : "unknown";

  return `status=${report.status ?? "unknown"} required=${required} provider=${providerMode ?? "unknown"}`;
}

function printHelp() {
  console.log(
    [
      "Usage: node scripts/verify-live-smoke-report.mjs [report-path] [--require-passed]",
      "",
      "Validates .devflow/artifacts/live-provider-smoke.json by default.",
      "Use --require-passed when release publication must prove a real provider smoke passed."
    ].join("\n")
  );
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function formatValue(value) {
  return value === undefined ? "undefined" : JSON.stringify(value);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = readReport(options.reportPath);
    const result = evaluateLiveSmokeReport(report, {
      requirePassed: options.requirePassed
    });

    if (!result.passed) {
      console.error("Live provider smoke report validation failed:");

      for (const error of result.errors) {
        console.error(`- ${error}`);
      }

      process.exit(1);
    }

    console.log(`Live provider smoke report validation passed: ${result.summary}`);
    console.log(`Report: ${options.reportPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(message);
    process.exit(1);
  }
}
