#!/usr/bin/env node
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const binName = process.platform === "win32" ? "dev-flow.cmd" : "dev-flow";
const tempRoot = await mkdtemp(join(tmpdir(), "dev-flow-pack-smoke-"));

try {
  const packDir = join(tempRoot, "pack");
  const installDir = join(tempRoot, "install");
  const projectDir = join(tempRoot, "project");

  await mkdir(packDir, { recursive: true });
  await mkdir(installDir, { recursive: true });
  await mkdir(projectDir, { recursive: true });

  const packOutput = run(npmCommand, ["pack", "--json", "--silent", "--pack-destination", packDir], rootDir).stdout;
  const [pack] = parseNpmPackJson(packOutput);
  const tarballPath = join(packDir, pack.filename);

  await access(tarballPath);
  run(npmCommand, ["install", tarballPath, "--silent"], installDir);

  const devFlowBin = join(installDir, "node_modules", ".bin", binName);
  const help = run(devFlowBin, ["help"], projectDir).stdout;

  if (!help.includes("DevFlow") || !help.includes("dev-flow deliver")) {
    throw new Error("Installed dev-flow binary did not print the expected help output.");
  }

  run(devFlowBin, ["init"], projectDir);
  await access(join(projectDir, ".devflow", "config.json"));
  await access(join(projectDir, "docs", "requirements.md"));
  await access(join(projectDir, "docs", "ui.md"));
  await access(join(projectDir, "docs", "api.md"));

  console.log(`Pack smoke passed: installed ${pack.filename} and ran dev-flow help/init.`);
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

function parseNpmPackJson(output) {
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");

  if (start < 0 || end < start) {
    throw new Error(`Could not parse npm pack JSON output:\n${output}`);
  }

  const parsed = JSON.parse(output.slice(start, end + 1));

  if (!Array.isArray(parsed) || !parsed[0]?.filename) {
    throw new Error(`npm pack JSON output did not include a filename:\n${output}`);
  }

  return parsed;
}
