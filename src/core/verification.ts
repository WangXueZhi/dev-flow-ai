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
}

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
      resolve({
        command,
        exitCode,
        durationMs: Date.now() - started,
        stdout,
        stderr
      });
    });
  });
}
