#!/usr/bin/env node
import { access, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const binName = process.platform === "win32" ? "dev-flow.cmd" : "dev-flow";
const packageSpec = process.env.DEVFLOW_GITHUB_SPEC ?? "github:WangXueZhi/dev-flow-ai#main";
const tempRoot = await mkdtemp(join(tmpdir(), "dev-flow-github-smoke-"));

try {
  const installDir = join(tempRoot, "install");
  const projectDir = join(tempRoot, "project");

  await mkdir(installDir, { recursive: true });
  await mkdir(projectDir, { recursive: true });

  run(npmCommand, ["install", packageSpec, "--silent"], installDir);

  const packageJson = JSON.parse(await readFile(join(installDir, "node_modules", "dev-flow-ai", "package.json"), "utf8"));
  const devFlowBin = join(installDir, "node_modules", ".bin", binName);
  const help = run(devFlowBin, ["help"], projectDir).stdout;
  const version = run(devFlowBin, ["version"], projectDir).stdout.trim();

  if (!help.includes("DevFlow") || !help.includes("dev-flow deliver")) {
    throw new Error("GitHub-installed dev-flow binary did not print the expected help output.");
  }

  if (version !== `dev-flow ${packageJson.version}`) {
    throw new Error(`GitHub-installed dev-flow binary printed unexpected version: ${version}`);
  }

  run(devFlowBin, ["init"], projectDir);
  await access(join(projectDir, ".devflow", "config.json"));
  await access(join(projectDir, "docs", "requirements.md"));
  await access(join(projectDir, "docs", "ui.md"));
  await access(join(projectDir, "docs", "api.md"));

  console.log(`GitHub install smoke passed: installed ${packageSpec} and ran dev-flow help/version/init.`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
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
