#!/usr/bin/env node
import { access, cp, mkdir, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(rootDir, "dist", "cli.js");
const sourceExampleDir = join(rootDir, "examples", "react-vite-dashboard");
const smokeRoot = join(rootDir, ".devflow", "example-smoke");
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

run(
  process.execPath,
  [
    cliPath,
    "deliver",
    "--requirements",
    "docs/requirements.md",
    "--ui",
    "docs/ui.md",
    "--api",
    "docs/api.md"
  ],
  smokeExampleDir
);

run(
  process.execPath,
  [
    cliPath,
    "execute",
    "--validate",
    "--patch-set",
    fixturePatchSetPath
  ],
  smokeExampleDir
);

run(
  process.execPath,
  [
    cliPath,
    "deliver",
    "--apply",
    "--yes",
    "--unit",
    "U18",
    "--requirements",
    "docs/requirements.md",
    "--ui",
    "docs/ui.md",
    "--api",
    "docs/api.md"
  ],
  smokeExampleDir,
  {
    DEVFLOW_AI_FIXTURE_PATH: fixturePatchSetPath
  }
);

const appSource = await readFile(join(smokeExampleDir, "src", "App.jsx"), "utf8");
if (!appSource.includes("AI applied")) {
  throw new Error("Example smoke did not apply the fixture-backed AI patch set.");
}

await access(join(smokeExampleDir, ".devflow", "artifacts", "project-brief.json"));
await access(join(smokeExampleDir, ".devflow", "artifacts", "tasks.json"));
await access(join(smokeExampleDir, ".devflow", "artifacts", "delivery-report.md"));

console.log(
  [
    "Example delivery smoke passed.",
    `Workspace: ${smokeExampleDir}`,
    "Verified: build, non-destructive delivery, patch-set validation, fixture-backed apply, delivery report."
  ].join("\n")
);

async function ensureCli() {
  try {
    await access(cliPath);
  } catch {
    run(npmCommand, ["run", "build"], rootDir);
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
