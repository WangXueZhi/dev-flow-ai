import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileExists } from "./fs.js";

export interface DevFlowConfig {
  requirementsPath: string;
  uiPath: string;
  apiPath: string;
  artifactsDir: string;
}

export const configPath = ".devflow/config.json";

export function defaultConfig(): DevFlowConfig {
  return {
    requirementsPath: "docs/requirements.md",
    uiPath: "docs/ui.md",
    apiPath: "docs/api.md",
    artifactsDir: ".devflow/artifacts"
  };
}

export async function loadConfig(): Promise<DevFlowConfig> {
  if (!(await fileExists(configPath))) {
    return defaultConfig();
  }

  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<DevFlowConfig>;

  return {
    ...defaultConfig(),
    ...parsed
  };
}

export async function writeConfig(config: DevFlowConfig): Promise<void> {
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}
