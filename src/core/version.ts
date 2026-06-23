import { readFile } from "node:fs/promises";

export async function getCliVersion(): Promise<string> {
  const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as {
    version?: string;
  };

  return packageJson.version ?? "unknown";
}

export async function formatCliVersion(): Promise<string> {
  return `dev-flow ${await getCliVersion()}`;
}
