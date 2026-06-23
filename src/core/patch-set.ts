import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, normalize, resolve } from "node:path";

export interface PatchSet {
  version: 1;
  taskId: string;
  summary: string;
  operations: PatchOperation[];
}

export type PatchOperation = WritePatchOperation | ReplacePatchOperation | DeletePatchOperation;

export const patchSetLimits = {
  maxOperations: 50,
  maxWriteBytes: 500_000,
  maxSearchBytes: 100_000,
  maxReplaceBytes: 500_000
};

export interface WritePatchOperation {
  type: "write";
  path: string;
  content: string;
  overwrite?: boolean;
}

export interface ReplacePatchOperation {
  type: "replace";
  path: string;
  search: string;
  replace: string;
  expectedReplacements?: number;
}

export interface DeletePatchOperation {
  type: "delete";
  path: string;
  missingOk?: boolean;
}

export interface AppliedPatchReport {
  taskId: string;
  summary: string;
  appliedAt: string;
  status: "applied" | "unchanged";
  backupManifestPath?: string;
  operations: AppliedPatchOperation[];
}

export interface AppliedPatchOperation {
  type: PatchOperation["type"];
  path: string;
  status: "written" | "deleted" | "unchanged";
  bytesWritten: number;
  replacements?: number;
  linesBefore?: number;
  linesAfter?: number;
  lineDelta?: number;
}

export async function applyPatchSet(patchSet: PatchSet, rootDir = "."): Promise<AppliedPatchReport> {
  validatePatchSet(patchSet);

  const operations: AppliedPatchOperation[] = [];

  for (const operation of patchSet.operations) {
    operations.push(await applyPatchOperation(operation, rootDir));
  }

  return {
    taskId: patchSet.taskId,
    summary: patchSet.summary,
    appliedAt: new Date().toISOString(),
    status: operations.every((operation) => operation.status === "unchanged") ? "unchanged" : "applied",
    operations
  };
}

export function parsePatchSet(text: string): PatchSet {
  const json = extractJson(text);
  const parsed = JSON.parse(json) as PatchSet;
  validatePatchSet(parsed);
  return parsed;
}

export function validatePatchSet(patchSet: PatchSet): void {
  if (patchSet.version !== 1) {
    throw new Error("Patch set version must be 1.");
  }

  if (!patchSet.taskId || !patchSet.summary) {
    throw new Error("Patch set requires taskId and summary.");
  }

  if (!Array.isArray(patchSet.operations) || patchSet.operations.length === 0) {
    throw new Error("Patch set requires at least one operation.");
  }

  if (patchSet.operations.length > patchSetLimits.maxOperations) {
    throw new Error(`Patch set has too many operations: ${patchSet.operations.length} > ${patchSetLimits.maxOperations}.`);
  }

  for (const operation of patchSet.operations) {
    const operationType = (operation as { type?: string }).type;

    if (operationType !== "write" && operationType !== "replace" && operationType !== "delete") {
      throw new Error(`Unsupported patch operation: ${operationType}`);
    }

    validatePatchPath(operation.path);

    if (operation.type === "write" && typeof operation.content !== "string") {
      throw new Error(`Patch operation for ${operation.path} requires string content.`);
    }

    if (operation.type === "write" && Buffer.byteLength(operation.content, "utf8") > patchSetLimits.maxWriteBytes) {
      throw new Error(`Patch write for ${operation.path} exceeds ${patchSetLimits.maxWriteBytes} bytes.`);
    }

    if (operation.type === "replace" && (!operation.search || typeof operation.replace !== "string")) {
      throw new Error(`Replace operation for ${operation.path} requires search and replace strings.`);
    }

    if (operation.type === "replace" && Buffer.byteLength(operation.search, "utf8") > patchSetLimits.maxSearchBytes) {
      throw new Error(`Patch search text for ${operation.path} exceeds ${patchSetLimits.maxSearchBytes} bytes.`);
    }

    if (operation.type === "replace" && Buffer.byteLength(operation.replace, "utf8") > patchSetLimits.maxReplaceBytes) {
      throw new Error(`Patch replacement for ${operation.path} exceeds ${patchSetLimits.maxReplaceBytes} bytes.`);
    }
  }
}

export function validatePatchPath(path: string): void {
  if (!path || isAbsolute(path)) {
    throw new Error(`Patch path must be relative: ${path}`);
  }

  const normalized = normalize(path);

  if (normalized.startsWith("..") || normalized.includes("../")) {
    throw new Error(`Patch path must stay inside the project: ${path}`);
  }

  if (normalized === ".git" || normalized.startsWith(".git/")) {
    throw new Error(`Patch path cannot target .git: ${path}`);
  }

  if (normalized === "node_modules" || normalized.startsWith("node_modules/")) {
    throw new Error(`Patch path cannot target node_modules: ${path}`);
  }
}

async function applyPatchOperation(operation: PatchOperation, rootDir: string): Promise<AppliedPatchOperation> {
  if (operation.type === "replace") {
    return applyReplaceOperation(operation, rootDir);
  }

  if (operation.type === "delete") {
    return applyDeleteOperation(operation, rootDir);
  }

  const targetPath = resolve(rootDir, operation.path);
  const existing = await readExisting(targetPath);
  const linesBefore = countLogicalLines(existing ?? "");
  const linesAfter = countLogicalLines(operation.content);

  if (existing !== undefined && operation.overwrite === false) {
    throw new Error(`Refusing to overwrite existing file: ${operation.path}`);
  }

  if (existing === operation.content) {
    return {
      type: operation.type,
      path: operation.path,
      status: "unchanged",
      bytesWritten: Buffer.byteLength(operation.content, "utf8"),
      linesBefore,
      linesAfter,
      lineDelta: linesAfter - linesBefore
    };
  }

  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, operation.content, "utf8");

  return {
    type: operation.type,
    path: operation.path,
    status: "written",
    bytesWritten: Buffer.byteLength(operation.content, "utf8"),
    linesBefore,
    linesAfter,
    lineDelta: linesAfter - linesBefore
  };
}

async function applyDeleteOperation(operation: DeletePatchOperation, rootDir: string): Promise<AppliedPatchOperation> {
  const targetPath = resolve(rootDir, operation.path);
  const existing = await readExisting(targetPath);

  if (existing === undefined) {
    if (operation.missingOk === false) {
      throw new Error(`Cannot delete missing file: ${operation.path}`);
    }

    return {
      type: operation.type,
      path: operation.path,
      status: "unchanged",
      bytesWritten: 0,
      linesBefore: 0,
      linesAfter: 0,
      lineDelta: 0
    };
  }

  const linesBefore = countLogicalLines(existing);
  await rm(targetPath, { force: true });

  return {
    type: operation.type,
    path: operation.path,
    status: "deleted",
    bytesWritten: 0,
    linesBefore,
    linesAfter: 0,
    lineDelta: -linesBefore
  };
}

async function applyReplaceOperation(operation: ReplacePatchOperation, rootDir: string): Promise<AppliedPatchOperation> {
  const targetPath = resolve(rootDir, operation.path);
  const existing = await readExisting(targetPath);

  if (existing === undefined) {
    throw new Error(`Cannot replace content in missing file: ${operation.path}`);
  }

  const linesBefore = countLogicalLines(existing);
  const replacements = countOccurrences(existing, operation.search);

  if (operation.expectedReplacements !== undefined && replacements !== operation.expectedReplacements) {
    throw new Error(
      `Expected ${operation.expectedReplacements} replacements in ${operation.path}, found ${replacements}.`
    );
  }

  if (replacements === 0) {
    if (existing.includes(operation.replace)) {
      return {
        type: operation.type,
        path: operation.path,
        status: "unchanged",
        bytesWritten: Buffer.byteLength(existing, "utf8"),
        replacements: 0,
        linesBefore,
        linesAfter: linesBefore,
        lineDelta: 0
      };
    }

    throw new Error(`Search text was not found in ${operation.path}.`);
  }

  const next = existing.split(operation.search).join(operation.replace);
  const linesAfter = countLogicalLines(next);
  await writeFile(targetPath, next, "utf8");

  return {
    type: operation.type,
    path: operation.path,
    status: "written",
    bytesWritten: Buffer.byteLength(next, "utf8"),
    replacements,
    linesBefore,
    linesAfter,
    lineDelta: linesAfter - linesBefore
  };
}

function countOccurrences(value: string, search: string): number {
  if (!search) {
    return 0;
  }

  return value.split(search).length - 1;
}

function countLogicalLines(value: string): number {
  if (!value) {
    return 0;
  }

  const withoutTrailingNewline = value.endsWith("\n") ? value.slice(0, -1) : value;

  if (!withoutTrailingNewline) {
    return 0;
  }

  return withoutTrailingNewline.split(/\r?\n/).length;
}

async function readExisting(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

function extractJson(text: string): string {
  const trimmed = text.trim();

  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");

  if (first < 0 || last < first) {
    throw new Error("AI response did not contain a JSON patch set.");
  }

  return trimmed.slice(first, last + 1);
}
