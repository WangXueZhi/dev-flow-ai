import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function writePromptArtifact(path: string, prompt: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, prompt.endsWith("\n") ? prompt : `${prompt}\n`, "utf8");
}
