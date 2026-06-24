#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { access, cp, mkdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, relative, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(rootDir, "dist", "cli.js");
const sourceExampleDir = join(rootDir, "examples", "react-vite-dashboard");
const smokeRoot = join(rootDir, ".devflow", "example-visual-smoke");
const smokeExampleDir = join(smokeRoot, "react-vite-dashboard");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const fixturePatchSetPath = "fixtures/patch-set-ai-applied.json";

await ensureCli();
await rm(smokeExampleDir, { recursive: true, force: true });
await mkdir(smokeRoot, { recursive: true });
await cp(sourceExampleDir, smokeExampleDir, {
  recursive: true,
  filter: (source) => {
    const parts = relative(sourceExampleDir, source).split(/[\\/]/);
    return !parts.includes("node_modules") && !parts.includes("dist") && !parts.includes(".devflow");
  }
});

run(npmCommand, ["ci", "--silent"], smokeExampleDir);
run(npmCommand, ["run", "build", "--silent"], smokeExampleDir);
run(process.execPath, [cliPath, "execute", "--validate", "--patch-set", fixturePatchSetPath], smokeExampleDir);

await withPreviewServer(smokeExampleDir, async (previewUrl) => {
  run(
    process.execPath,
    [
      cliPath,
      "deliver",
      "--apply",
      "--yes",
      "--patch-set",
      fixturePatchSetPath,
      "--requirements",
      "docs/requirements.md",
      "--ui",
      "docs/ui.md",
      "--api",
      "docs/api.md",
      "--preview-url",
      previewUrl,
      "--visual-text",
      "OpsBoard,Checkout,AI applied"
    ],
    smokeExampleDir
  );
});

await assertVisualDeliveryStatus(smokeExampleDir);

const appSource = await readFile(join(smokeExampleDir, "src", "App.jsx"), "utf8");
if (!appSource.includes("AI applied")) {
  throw new Error("Example visual smoke did not apply the fixture-backed AI patch set.");
}

console.log(
  [
    "Example visual smoke passed.",
    `Workspace: ${smokeExampleDir}`,
    "Verified: preview server, source-changing delivery, visual screenshots, required visual text, delivery gates, and manifest evidence."
  ].join("\n")
);

async function ensureCli() {
  try {
    await access(cliPath);
  } catch {
    run(npmCommand, ["run", "build"], rootDir);
  }
}

async function withPreviewServer(workspaceDir, callback) {
  const port = await getFreePort();
  const previewUrl = `http://127.0.0.1:${port}`;
  const server = spawn(
    npmCommand,
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: workspaceDir,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  let logs = "";
  const appendLog = (chunk) => {
    logs = `${logs}${chunk.toString()}`.slice(-8_000);
  };

  server.stdout.on("data", appendLog);
  server.stderr.on("data", appendLog);

  try {
    await waitForPreview(previewUrl, server, () => logs);
    await callback(previewUrl);
  } finally {
    await stopServer(server);
  }
}

async function waitForPreview(url, server, logs) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Preview server exited before ${url} was ready.\n${logs()}`);
    }

    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until Vite is ready.
    }

    await delay(500);
  }

  throw new Error(`Preview server did not respond at ${url}.\n${logs()}`);
}

async function stopServer(server) {
  if (server.exitCode !== null) {
    return;
  }

  const exited = new Promise((resolve) => {
    server.once("exit", resolve);
  });

  server.kill("SIGTERM");
  await Promise.race([
    exited,
    delay(3_000).then(() => {
      if (server.exitCode === null) {
        server.kill("SIGKILL");
      }
    })
  ]);

  if (server.exitCode === null) {
    await Promise.race([exited, delay(1_000)]);
  }
}

async function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a local preview port."));
        return;
      }

      server.close(() => resolvePort(address.port));
    });
  });
}

async function assertVisualDeliveryStatus(workspaceDir) {
  const summary = run(
    process.execPath,
    [
      cliPath,
      "status",
      "--fail-on-attention",
      "--fail-on-failed-verification",
      "--fail-on-failed-visual",
      "--fail-on-missing-artifacts"
    ],
    workspaceDir
  ).stdout;

  const expectedSummary = [
    "Readiness: ready for review",
    "Verification: passed",
    "Visual: passed",
    "Source changes: applied"
  ];

  for (const text of expectedSummary) {
    if (!summary.includes(text)) {
      throw new Error(`Example visual smoke status summary is missing: ${text}`);
    }
  }

  const manifest = JSON.parse(run(process.execPath, [cliPath, "status", "--json"], workspaceDir).stdout);

  if (manifest.status.visual !== "passed") {
    throw new Error(`Expected visual status to pass, got ${manifest.status.visual}.`);
  }

  if (!Array.isArray(manifest.evidence?.visualScreenshots) || manifest.evidence.visualScreenshots.length < 3) {
    throw new Error("Expected at least three visual screenshots in the delivery manifest.");
  }

  const missingText = (manifest.evidence?.visualRequiredText ?? []).filter((check) => !check.found).map((check) => check.text);
  if (missingText.length > 0) {
    throw new Error(`Expected all required visual text checks to pass. Missing: ${missingText.join(", ")}`);
  }

  await access(join(workspaceDir, ".devflow", "artifacts", "visual", "visual-report.json"));

  for (const screenshot of manifest.evidence.visualScreenshots) {
    await access(join(workspaceDir, screenshot.path));
  }
}

function run(command, args, cwd, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      ...env
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        `cwd: ${cwd}`,
        `exit: ${result.status}`,
        result.stdout ? `stdout:\n${result.stdout}` : undefined,
        result.stderr ? `stderr:\n${result.stderr}` : undefined
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr
  };
}
