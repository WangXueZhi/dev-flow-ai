import { spawn } from "node:child_process";

export interface VerificationReport {
  startedAt: string;
  finishedAt: string;
  status: "passed" | "failed" | "skipped";
  results: VerificationResult[];
}

export interface VerificationResult {
  command: string;
  exitCode: number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  outputExcerpt?: VerificationOutputExcerpt;
}

export interface VerificationOutputExcerpt {
  stdout?: string;
  stderr?: string;
  truncatedStdout?: boolean;
  truncatedStderr?: boolean;
}

const excerptMaxLines = 12;
const excerptMaxCharacters = 600;

export async function runVerificationCommands(commands: string[], cwd = "."): Promise<VerificationReport> {
  const startedAt = new Date().toISOString();

  if (commands.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      status: "skipped",
      results: []
    };
  }

  const results: VerificationResult[] = [];

  for (const command of commands) {
    results.push(await runCommand(command, cwd));
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    status: results.every((result) => result.exitCode === 0) ? "passed" : "failed",
    results
  };
}

function runCommand(command: string, cwd: string): Promise<VerificationResult> {
  const started = Date.now();

  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      env: process.env,
      shell: true
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (exitCode) => {
      const result: VerificationResult = {
        command,
        exitCode,
        durationMs: Date.now() - started,
        stdout,
        stderr
      };
      const outputExcerpt = createFailureOutputExcerpt(exitCode, stdout, stderr);

      if (outputExcerpt) {
        result.outputExcerpt = outputExcerpt;
      }

      resolve(result);
    });
  });
}

function createFailureOutputExcerpt(
  exitCode: number | null,
  stdout: string,
  stderr: string
): VerificationOutputExcerpt | undefined {
  if (exitCode === 0) {
    return undefined;
  }

  const stdoutExcerpt = excerptOutput(stdout);
  const stderrExcerpt = excerptOutput(stderr);

  if (!stdoutExcerpt && !stderrExcerpt) {
    return undefined;
  }

  return {
    stdout: stdoutExcerpt?.text,
    stderr: stderrExcerpt?.text,
    truncatedStdout: stdoutExcerpt?.truncated || undefined,
    truncatedStderr: stderrExcerpt?.truncated || undefined
  };
}

function excerptOutput(output: string): { text: string; truncated: boolean } | undefined {
  const trimmed = output.trim();

  if (!trimmed) {
    return undefined;
  }

  const lines = trimmed.split(/\r?\n/);
  const lineLimited = lines.slice(-excerptMaxLines).join("\n");
  const characterLimited = lineLimited.length > excerptMaxCharacters
    ? lineLimited.slice(lineLimited.length - excerptMaxCharacters)
    : lineLimited;

  return {
    text: characterLimited,
    truncated: lines.length > excerptMaxLines || lineLimited.length > excerptMaxCharacters
  };
}
