import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileExists } from "./fs.js";
import { validatePatchPath, validatePatchSet, type PatchSet } from "./patch-set.js";

export interface PatchBackupManifest {
  version: 1;
  taskId: string;
  createdAt: string;
  files: PatchBackupFile[];
}

export interface PatchBackupFile {
  path: string;
  existed: boolean;
  backupFile?: string;
}

export interface RollbackReport {
  rolledBackAt: string;
  status: "rolled-back";
  files: Array<{
    path: string;
    action: "restored" | "removed" | "unchanged";
  }>;
}

export async function createPatchBackup(
  patchSet: PatchSet,
  backupDir: string,
  rootDir = "."
): Promise<{ manifestPath: string; manifest: PatchBackupManifest }> {
  validatePatchSet(patchSet);
  await mkdir(backupDir, { recursive: true });

  const files: PatchBackupFile[] = [];
  const paths = [...new Set(patchSet.operations.map((operation) => operation.path))];

  for (const path of paths) {
    validatePatchPath(path);
    const targetPath = resolve(rootDir, path);

    if (await fileExists(targetPath)) {
      const backupFile = `${Buffer.from(path).toString("base64url")}.bak`;
      await writeFile(join(backupDir, backupFile), await readFile(targetPath, "utf8"), "utf8");
      files.push({ path, existed: true, backupFile });
      continue;
    }

    files.push({ path, existed: false });
  }

  const manifest: PatchBackupManifest = {
    version: 1,
    taskId: patchSet.taskId,
    createdAt: new Date().toISOString(),
    files
  };
  const manifestPath = join(backupDir, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return { manifestPath, manifest };
}

export async function restorePatchBackup(manifestPath: string, rootDir = "."): Promise<RollbackReport> {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as PatchBackupManifest;
  const backupDir = dirname(manifestPath);
  const files: RollbackReport["files"] = [];

  for (const file of manifest.files) {
    validatePatchPath(file.path);
    const targetPath = resolve(rootDir, file.path);

    if (file.existed) {
      if (!file.backupFile) {
        throw new Error(`Backup entry for ${file.path} is missing backupFile.`);
      }

      const content = await readFile(join(backupDir, file.backupFile), "utf8");
      const existing = (await fileExists(targetPath)) ? await readFile(targetPath, "utf8") : undefined;

      if (existing === content) {
        files.push({ path: file.path, action: "unchanged" });
        continue;
      }

      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, content, "utf8");
      files.push({ path: file.path, action: "restored" });
      continue;
    }

    if (await fileExists(targetPath)) {
      await rm(targetPath, { force: true });
      files.push({ path: file.path, action: "removed" });
      continue;
    }

    files.push({ path: file.path, action: "unchanged" });
  }

  return {
    rolledBackAt: new Date().toISOString(),
    status: "rolled-back",
    files
  };
}
