import { lstat, readFile, readdir } from "node:fs/promises";
import { isAbsolute, normalize, relative, resolve, sep } from "node:path";
import type { ImplementationTargetProfile } from "./target-profile.js";
import type { ImplementationUnit } from "./tasks.js";

export interface SourceContext {
  rootDir: string;
  entries: SourceContextEntry[];
  omitted: string[];
  limits: {
    maxEntries: number;
    maxFileBytes: number;
    maxTotalBytes: number;
    maxDirectoryEntries: number;
  };
}

export type SourceContextEntry =
  | SourceFileContextEntry
  | SourceDirectoryContextEntry
  | SourceMissingContextEntry
  | SourceGlobContextEntry
  | SourceBinaryContextEntry;

export interface SourceFileContextEntry {
  kind: "file";
  path: string;
  sizeBytes: number;
  content: string;
  truncated: boolean;
}

export interface SourceDirectoryContextEntry {
  kind: "directory";
  path: string;
  entries: string[];
  truncated: boolean;
}

export interface SourceMissingContextEntry {
  kind: "missing";
  path: string;
}

export interface SourceGlobContextEntry {
  kind: "glob";
  path: string;
}

export interface SourceBinaryContextEntry {
  kind: "binary";
  path: string;
  sizeBytes: number;
}

export interface CollectSourceContextOptions {
  rootDir?: string;
  maxEntries?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  maxDirectoryEntries?: number;
}

const defaultLimits = {
  maxEntries: 14,
  maxFileBytes: 12_000,
  maxTotalBytes: 48_000,
  maxDirectoryEntries: 30
};

export async function collectSourceContext(
  candidatePaths: string[],
  options: CollectSourceContextOptions = {}
): Promise<SourceContext> {
  const rootDir = resolve(options.rootDir ?? ".");
  const limits = {
    maxEntries: options.maxEntries ?? defaultLimits.maxEntries,
    maxFileBytes: options.maxFileBytes ?? defaultLimits.maxFileBytes,
    maxTotalBytes: options.maxTotalBytes ?? defaultLimits.maxTotalBytes,
    maxDirectoryEntries: options.maxDirectoryEntries ?? defaultLimits.maxDirectoryEntries
  };
  const entries: SourceContextEntry[] = [];
  const omitted: string[] = [];
  let totalBytes = 0;

  for (const candidate of unique(candidatePaths.map(normalizeCandidatePath))) {
    if (!candidate) {
      continue;
    }

    if (entries.length >= limits.maxEntries) {
      omitted.push(`${candidate} (entry limit reached)`);
      continue;
    }

    if (isGlobCandidate(candidate)) {
      entries.push({ kind: "glob", path: candidate });
      continue;
    }

    if (isUnsafeSourcePath(candidate)) {
      omitted.push(`${candidate} (unsafe or generated path)`);
      continue;
    }

    const resolved = resolve(rootDir, candidate);

    if (!isInsideRoot(rootDir, resolved)) {
      omitted.push(`${candidate} (outside project root)`);
      continue;
    }

    try {
      const stat = await lstat(resolved);

      if (stat.isDirectory()) {
        entries.push(await readDirectoryContext(candidate, resolved, limits.maxDirectoryEntries));
        continue;
      }

      if (!stat.isFile()) {
        omitted.push(`${candidate} (not a regular file)`);
        continue;
      }

      const remainingBytes = limits.maxTotalBytes - totalBytes;

      if (remainingBytes <= 0) {
        omitted.push(`${candidate} (byte limit reached)`);
        continue;
      }

      const entry = await readFileContext(candidate, resolved, stat.size, Math.min(limits.maxFileBytes, remainingBytes));
      entries.push(entry);

      if (entry.kind === "file") {
        totalBytes += Buffer.byteLength(entry.content, "utf8");
      }
    } catch {
      entries.push({ kind: "missing", path: candidate });
    }
  }

  return {
    rootDir,
    entries,
    omitted,
    limits
  };
}

export function sourceContextCandidatePaths(
  profile: ImplementationTargetProfile,
  unit?: ImplementationUnit
): string[] {
  return unique([
    ...sourcePathsFromUnit(unit),
    ...profile.componentCandidates,
    ...profile.dataCandidates,
    ...profile.styleCandidates,
    ...profile.configCandidates,
    ...profile.testCandidates
  ]);
}

export function formatSourceContextForPrompt(context: SourceContext): string {
  if (context.entries.length === 0) {
    return "## Existing Repository Source Context\n\nNo existing source files were sampled. Treat this as incomplete context and keep any patch set conservative.\n";
  }

  return `## Existing Repository Source Context

The following repository files and directories were sampled from the project root. Treat this as useful but not exhaustive context.

${context.entries.map(formatSourceContextEntry).join("\n\n")}
${context.omitted.length ? `\n\n### Omitted Candidates\n\n${context.omitted.map((item) => `- ${item}`).join("\n")}` : ""}
`;
}

function sourcePathsFromUnit(unit: ImplementationUnit | undefined): string[] {
  if (!unit) {
    return [];
  }

  const resolvedAssetPaths = unit.details
    .map((detail) => /^Resolved path:\s+(.+)$/i.exec(detail)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));

  if (unit.source.includes(":")) {
    return resolvedAssetPaths;
  }

  return [unit.source, ...resolvedAssetPaths];
}

async function readDirectoryContext(
  path: string,
  resolved: string,
  maxDirectoryEntries: number
): Promise<SourceDirectoryContextEntry> {
  const children = (await readdir(resolved, { withFileTypes: true }))
    .filter((entry) => !isIgnoredDirectoryEntry(entry.name))
    .map((entry) => `${entry.name}${entry.isDirectory() ? "/" : ""}`)
    .sort((left, right) => left.localeCompare(right));

  return {
    kind: "directory",
    path,
    entries: children.slice(0, maxDirectoryEntries),
    truncated: children.length > maxDirectoryEntries
  };
}

async function readFileContext(
  path: string,
  resolved: string,
  sizeBytes: number,
  readLimit: number
): Promise<SourceFileContextEntry | SourceBinaryContextEntry> {
  const bytes = await readFile(resolved);

  if (bytes.includes(0)) {
    return {
      kind: "binary",
      path,
      sizeBytes
    };
  }

  return {
    kind: "file",
    path,
    sizeBytes,
    content: bytes.subarray(0, readLimit).toString("utf8"),
    truncated: bytes.length > readLimit
  };
}

function formatSourceContextEntry(entry: SourceContextEntry): string {
  if (entry.kind === "file") {
    return `### ${entry.path}

- Kind: file
- Size: ${entry.sizeBytes} bytes${entry.truncated ? " (truncated)" : ""}

\`\`\`\`
${entry.content}
\`\`\`\``;
  }

  if (entry.kind === "directory") {
    return `### ${entry.path}

- Kind: directory${entry.truncated ? " (truncated)" : ""}
- Entries: ${entry.entries.length ? entry.entries.map((item) => `\`${item}\``).join(", ") : "empty"}`;
  }

  if (entry.kind === "binary") {
    return `### ${entry.path}

- Kind: binary file
- Size: ${entry.sizeBytes} bytes
- Content omitted.`;
  }

  if (entry.kind === "glob") {
    return `### ${entry.path}

- Kind: glob candidate
- Content omitted. Expand manually if this path is important.`;
  }

  return `### ${entry.path}

- Kind: missing path
- Content omitted because the path does not exist.`;
}

function normalizeCandidatePath(path: string | undefined): string {
  return (path ?? "").replace(/\\/g, "/").trim();
}

function isGlobCandidate(path: string): boolean {
  return /[*?[\]]/.test(path);
}

function isUnsafeSourcePath(path: string): boolean {
  if (!path || isAbsolute(path)) {
    return true;
  }

  const normalized = normalize(path);

  if (normalized.startsWith("..") || normalized.includes(`..${sep}`)) {
    return true;
  }

  return [
    ".git",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".devflow",
    ".next",
    ".nuxt",
    ".svelte-kit"
  ].some((blocked) => normalized === blocked || normalized.startsWith(`${blocked}${sep}`));
}

function isInsideRoot(rootDir: string, path: string): boolean {
  const relativePath = relative(rootDir, path);

  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function isIgnoredDirectoryEntry(name: string): boolean {
  return [".git", "node_modules", "dist", "build", "coverage", ".devflow"].includes(name);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
