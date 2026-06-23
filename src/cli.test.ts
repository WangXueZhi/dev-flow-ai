import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("./cli.js", import.meta.url));
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
};

test("dev-flow version prints the package version", () => {
  const result = spawnSync(process.execPath, [cliPath, "version"], { encoding: "utf8" });

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), `dev-flow ${packageJson.version}`);
});

test("dev-flow --version prints the package version", () => {
  const result = spawnSync(process.execPath, [cliPath, "--version"], { encoding: "utf8" });

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), `dev-flow ${packageJson.version}`);
});
