import { readFile } from "node:fs/promises";

export interface ContextInput {
  requirementsPath: string;
  uiPath: string;
  apiPath: string;
}

export interface ProjectContext {
  requirementsPath: string;
  requirements: string;
  uiPath: string;
  ui: string;
  apiPath: string;
  api: string;
}

export async function loadProjectContext(input: ContextInput): Promise<ProjectContext> {
  const [requirements, ui, api] = await Promise.all([
    readRequiredText(input.requirementsPath),
    readRequiredText(input.uiPath),
    readRequiredText(input.apiPath)
  ]);

  return {
    requirementsPath: input.requirementsPath,
    requirements,
    uiPath: input.uiPath,
    ui,
    apiPath: input.apiPath,
    api
  };
}

async function readRequiredText(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`Unable to read ${path}. Run "dev-flow init" or pass an explicit path.`);
  }
}
