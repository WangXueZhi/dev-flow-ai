#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultReportPath = join(rootDir, ".devflow", "artifacts", "live-provider-smoke.json");
const heading = "### DevFlow Live Provider Smoke";

export function formatLiveSmokeSummary(report, reportPath) {
  if (!isRecord(report)) {
    return formatInvalidLiveSmokeSummary(reportPath, "report must be a JSON object");
  }

  const provider = isRecord(report.provider) ? report.provider : {};
  const keySource = report.apiKeyEnvName ?? provider.apiKeyEnvName ?? provider.liveApiKeyEnvName ?? "none";
  const required = report.required === true ? "yes" : report.required === false ? "no" : "unknown";
  const lines = [
    heading,
    "",
    `- Report: \`${reportPath || "unknown"}\``,
    `- Status: **${report.status ?? "unknown"}**`,
    `- Required gate: ${required}`,
    `- Provider: \`${provider.mode ?? "unknown"}\``,
    `- Model: \`${provider.model ?? "unknown"}\``,
    `- Endpoint: \`${provider.chatCompletionsUrl ?? "unknown"}\``,
    `- Key source: \`${keySource}\``,
    `- Generated: ${report.generatedAt ?? "unknown"}`,
    `- Message: ${formatOneLineExcerpt(String(report.message ?? "missing"))}`
  ];

  if (typeof report.responseExcerpt === "string" && report.responseExcerpt.trim().length > 0) {
    lines.push(`- Response excerpt: ${formatOneLineExcerpt(report.responseExcerpt)}`);
  }

  return lines.join("\n");
}

export function formatMissingLiveSmokeSummary(reportPath) {
  return `${heading}\n\nLive provider smoke report not found at \`${reportPath || "unknown"}\`.`;
}

export function formatInvalidLiveSmokeSummary(reportPath, message) {
  return [
    heading,
    "",
    `- Report: \`${reportPath || "unknown"}\``,
    "- Status: **invalid**",
    `- Error: ${formatOneLineExcerpt(message)}`
  ].join("\n");
}

export function writeLiveSmokeSummary({ reportPath, summaryPath }) {
  if (!summaryPath) {
    console.log("GITHUB_STEP_SUMMARY is not available; skipping live provider smoke summary.");
    return "skipped";
  }

  if (!reportPath || !existsSync(reportPath)) {
    appendFileSync(summaryPath, `${formatMissingLiveSmokeSummary(reportPath)}\n`);
    return "missing";
  }

  try {
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    appendFileSync(summaryPath, `${formatLiveSmokeSummary(report, reportPath)}\n`);
    return "written";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendFileSync(summaryPath, `${formatInvalidLiveSmokeSummary(reportPath, message)}\n`);
    return "invalid";
  }
}

function formatOneLineExcerpt(value) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeLiveSmokeSummary({
    reportPath: process.env.DEVFLOW_LIVE_SMOKE_REPORT ?? defaultReportPath,
    summaryPath: process.env.GITHUB_STEP_SUMMARY
  });
}
