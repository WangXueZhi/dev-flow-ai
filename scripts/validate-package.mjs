#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
});

if (result.status !== 0) {
  throw new Error(
    [
      "npm pack --dry-run --json failed.",
      result.stdout ? `stdout:\n${result.stdout}` : undefined,
      result.stderr ? `stderr:\n${result.stderr}` : undefined
    ]
      .filter(Boolean)
      .join("\n")
  );
}

const [pack] = parseNpmPackJson(result.stdout);
const files = pack.files.map((file) => file.path).sort();

const requiredFiles = [
  "CHANGELOG.md",
  "LICENSE",
  "README.md",
  "dist/cli.js",
  "docs/adoption.md",
  "docs/github-action.md",
  "examples/react-vite-dashboard/README.md",
  "examples/react-vite-dashboard/docs/api.md",
  "examples/react-vite-dashboard/fixtures/patch-set-ai-applied.json",
  "examples/react-vite-dashboard/src/App.jsx",
  "package.json",
  "schemas/patch-set.schema.json",
  "scripts/example-delivery-smoke.mjs",
  "scripts/example-visual-smoke.mjs",
  "scripts/release-readiness.mjs",
  "scripts/release-preflight.mjs",
  "scripts/smoke-github-install.mjs",
  "scripts/live-provider-smoke.mjs",
  "scripts/verify-live-smoke-report.mjs",
  "scripts/summarize-live-smoke-report.mjs",
  "scripts/summarize-manifest.mjs"
];

const forbiddenPatterns = [
  /^dist\/.*\.test\.(d\.ts|js|js\.map)$/,
  /^\.devflow\//,
  /^node_modules\//,
  /^examples\/react-vite-dashboard\/\.devflow\//,
  /^examples\/react-vite-dashboard\/dist\//,
  /^examples\/react-vite-dashboard\/node_modules\//,
  /\.tgz$/
];

const missing = requiredFiles.filter((file) => !files.includes(file));
const forbidden = files.filter(isForbiddenPackageFile);

if (missing.length > 0 || forbidden.length > 0) {
  throw new Error(
    [
      missing.length > 0 ? `Missing expected package files:\n${missing.join("\n")}` : undefined,
      forbidden.length > 0 ? `Forbidden files in package:\n${forbidden.join("\n")}` : undefined
    ]
      .filter(Boolean)
      .join("\n\n")
  );
}

console.log(
  [
    "Package contents check passed.",
    `Tarball: ${pack.filename}`,
    `Package size: ${formatBytes(pack.size)}`,
    `Unpacked size: ${formatBytes(pack.unpackedSize)}`,
    `Files: ${files.length}`
  ].join("\n")
);

function parseNpmPackJson(output) {
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");

  if (start < 0 || end < start) {
    throw new Error(`Could not parse npm pack JSON output:\n${output}`);
  }

  const parsed = JSON.parse(output.slice(start, end + 1));

  if (!Array.isArray(parsed) || !parsed[0]?.filename || !Array.isArray(parsed[0]?.files)) {
    throw new Error(`npm pack JSON output did not include package file details:\n${output}`);
  }

  return parsed;
}

function isForbiddenPackageFile(file) {
  return forbiddenPatterns.some((pattern) => pattern.test(file)) || file.split("/").some(isForbiddenEnvName);
}

function isForbiddenEnvName(name) {
  return name === ".env" || (name.startsWith(".env.") && name !== ".env.example");
}

function formatBytes(value) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} kB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
