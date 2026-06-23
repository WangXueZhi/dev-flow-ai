import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileExists } from "./fs.js";
import type { AppliedPatchReport } from "./patch-set.js";

export interface ExecutionLog {
  version: 1;
  entries: AppliedPatchReport[];
}

export async function appendExecutionLog(path: string, entry: AppliedPatchReport): Promise<ExecutionLog> {
  const log = await readExecutionLog(path);
  const next: ExecutionLog = {
    version: 1,
    entries: [...log.entries, entry]
  };

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  return next;
}

async function readExecutionLog(path: string): Promise<ExecutionLog> {
  if (!(await fileExists(path))) {
    return {
      version: 1,
      entries: []
    };
  }

  return JSON.parse(await readFile(path, "utf8")) as ExecutionLog;
}
