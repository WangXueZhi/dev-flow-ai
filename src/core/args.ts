export type FlagMap = Record<string, string | undefined>;

export interface ParsedArgs {
  command?: string;
  flags: FlagMap;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const flags: FlagMap = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const withoutPrefix = token.slice(2);
    const inlineValueIndex = withoutPrefix.indexOf("=");

    if (inlineValueIndex >= 0) {
      const key = withoutPrefix.slice(0, inlineValueIndex);
      flags[key] = withoutPrefix.slice(inlineValueIndex + 1);
      continue;
    }

    const next = rest[index + 1];
    if (next && !next.startsWith("--")) {
      flags[withoutPrefix] = next;
      index += 1;
      continue;
    }

    flags[withoutPrefix] = "true";
  }

  return { command: normalizeCommand(command), flags };
}

function normalizeCommand(command: string | undefined): string | undefined {
  if (command === "--help" || command === "-h") {
    return "help";
  }

  if (command === "--version" || command === "-v") {
    return "version";
  }

  return command;
}
