#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const commands = [
  [npmCommand, ["run", "release:readiness"]],
  [npmCommand, ["run", "check"]],
  [npmCommand, ["run", "pack:smoke"]],
  [npmCommand, ["run", "github:smoke"]],
  [npmCommand, ["run", "example:smoke"]],
  [npmCommand, ["run", "smoke:live"]]
];

for (const [command, args] of commands) {
  console.log(`\n==> ${command} ${args.join(" ")}`);
  run(command, args);
}

const forbidden = await findForbiddenFiles(rootDir, 4);
if (forbidden.length > 0) {
  throw new Error(`Release preflight found forbidden local files:\n${forbidden.join("\n")}`);
}

console.log("\nRelease preflight passed.");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

async function findForbiddenFiles(root, maxDepth) {
  const results = [];
  await visit(root, maxDepth, results);
  return results;
}

async function visit(dir, depth, results) {
  if (depth < 0) {
    return;
  }

  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "dist") {
      continue;
    }

    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      await visit(path, depth - 1, results);
      continue;
    }

    if (entry.isFile() && isForbiddenLocalFile(entry.name)) {
      results.push(relative(rootDir, path));
    }
  }
}

function isForbiddenLocalFile(name) {
  return name === ".env" || (name.startsWith(".env.") && name !== ".env.example") || name.endsWith(".tgz");
}
