import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runExecute } from "./execute.js";
import type { ProjectBrief } from "../core/brief.js";
import type { TaskPlan } from "../core/tasks.js";

test("runExecute sends sampled source context to AI dry-run providers", async (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-execute-"));
  const originalCwd = process.cwd();
  const originalLog = console.log;
  const originalEnv = {
    DEVFLOW_AI_API_KEY: process.env.DEVFLOW_AI_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    DEVFLOW_AI_BASE_URL: process.env.DEVFLOW_AI_BASE_URL,
    DEVFLOW_AI_MODEL: process.env.DEVFLOW_AI_MODEL,
    DEVFLOW_AI_FIXTURE_PATH: process.env.DEVFLOW_AI_FIXTURE_PATH,
    DEVFLOW_SOURCE_CONTEXT: process.env.DEVFLOW_SOURCE_CONTEXT
  };
  const requests: unknown[] = [];
  const server = await startProviderServer(requests);
  const address = server.address() as AddressInfo;

  assert.equal(typeof address.port, "number");

  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log = originalLog;
    restoreEnv(originalEnv);
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  });

  console.log = () => undefined;
  process.chdir(workspace);
  writeProject(workspace);

  process.env.DEVFLOW_AI_API_KEY = "test-key";
  delete process.env.OPENAI_API_KEY;
  process.env.DEVFLOW_AI_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
  process.env.DEVFLOW_AI_MODEL = "test-model";
  delete process.env.DEVFLOW_AI_FIXTURE_PATH;

  await runExecute({ "dry-run": "true", task: "T03-code-implementation" });

  assert.equal(requests.length, 1);
  const request = requests[0] as { messages?: Array<{ role: string; content: string }> };
  const prompt = request.messages?.find((message) => message.role === "user")?.content ?? "";
  const proposal = readFileSync(".devflow/artifacts/patch-proposals/T03-code-implementation.md", "utf8");

  assert.match(prompt, /Existing Repository Source Context/);
  assert.match(prompt, /src\/App\.tsx/);
  assert.match(prompt, /Existing App Shell/);
  assert.match(proposal, /AI proposal from test provider/);
});

test("runExecute can disable sampled source context for AI dry-run providers", async (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-execute-no-source-context-"));
  const originalCwd = process.cwd();
  const originalLog = console.log;
  const originalEnv = {
    DEVFLOW_AI_API_KEY: process.env.DEVFLOW_AI_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    DEVFLOW_AI_BASE_URL: process.env.DEVFLOW_AI_BASE_URL,
    DEVFLOW_AI_MODEL: process.env.DEVFLOW_AI_MODEL,
    DEVFLOW_AI_FIXTURE_PATH: process.env.DEVFLOW_AI_FIXTURE_PATH,
    DEVFLOW_SOURCE_CONTEXT: process.env.DEVFLOW_SOURCE_CONTEXT
  };
  const requests: unknown[] = [];
  const server = await startProviderServer(requests);
  const address = server.address() as AddressInfo;

  assert.equal(typeof address.port, "number");

  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log = originalLog;
    restoreEnv(originalEnv);
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  });

  console.log = () => undefined;
  process.chdir(workspace);
  writeProject(workspace);

  process.env.DEVFLOW_AI_API_KEY = "test-key";
  delete process.env.OPENAI_API_KEY;
  process.env.DEVFLOW_AI_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
  process.env.DEVFLOW_AI_MODEL = "test-model";
  delete process.env.DEVFLOW_AI_FIXTURE_PATH;

  await runExecute({ "dry-run": "true", task: "T03-code-implementation", "no-source-context": "true" });

  process.env.DEVFLOW_SOURCE_CONTEXT = "none";
  await runExecute({ "dry-run": "true", task: "T03-code-implementation" });

  assert.equal(requests.length, 2);
  for (const request of requests as Array<{ messages?: Array<{ role: string; content: string }> }>) {
    const prompt = request.messages?.find((message) => message.role === "user")?.content ?? "";

    assert.doesNotMatch(prompt, /Existing Repository Source Context/);
    assert.doesNotMatch(prompt, /Existing App Shell/);
    assert.match(prompt, /Project Brief/);
    assert.match(prompt, /T03-code-implementation/);
  }
});

test("runExecute restores the backup when apply fails after partial writes", async (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-execute-rollback-"));
  const originalCwd = process.cwd();
  const originalLog = console.log;

  t.after(() => {
    console.log = originalLog;
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  });

  console.log = () => undefined;
  process.chdir(workspace);
  mkdirSync(join(workspace, ".devflow", "artifacts"), { recursive: true });
  mkdirSync(join(workspace, "src"), { recursive: true });
  writeFileSync(join(workspace, "src", "existing.txt"), "before\n", "utf8");
  writeFileSync(join(workspace, "src", "deleted.txt"), "delete me\n", "utf8");
  writeFileSync(
    join(workspace, "bad-patch.json"),
    `${JSON.stringify(
      {
        version: 1,
        taskId: "T03-code-implementation",
        summary: "Partially failing patch set.",
        operations: [
          {
            type: "replace",
            path: "src/existing.txt",
            search: "before",
            replace: "after",
            expectedReplacements: 1
          },
          {
            type: "write",
            path: "src/generated.txt",
            content: "generated\n"
          },
          {
            type: "delete",
            path: "src/deleted.txt"
          },
          {
            type: "replace",
            path: "src/missing.txt",
            search: "missing",
            replace: "still missing"
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  await assert.rejects(
    () => runExecute({ apply: "true", "patch-set": "bad-patch.json" }),
    /Patch set apply failed and backup was restored/
  );

  assert.equal(readFileSync(join(workspace, "src", "existing.txt"), "utf8"), "before\n");
  assert.equal(readFileSync(join(workspace, "src", "deleted.txt"), "utf8"), "delete me\n");
  assert.equal(existsSync(join(workspace, "src", "generated.txt")), false);

  const rollbackReport = JSON.parse(readFileSync(join(workspace, ".devflow", "artifacts", "rollback-report.json"), "utf8")) as {
    files: Array<{ path: string; action: string }>;
  };
  assert.deepEqual(rollbackReport.files, [
    { path: "src/existing.txt", action: "restored" },
    { path: "src/generated.txt", action: "removed" },
    { path: "src/deleted.txt", action: "restored" },
    { path: "src/missing.txt", action: "unchanged" }
  ]);
});

test("runExecute validates patch sets without changing source files", async (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-execute-validate-"));
  const originalCwd = process.cwd();
  const originalLog = console.log;
  const logs: string[] = [];

  t.after(() => {
    console.log = originalLog;
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  });

  console.log = (message?: unknown) => {
    logs.push(String(message));
  };
  process.chdir(workspace);
  mkdirSync(join(workspace, "src"), { recursive: true });
  writeFileSync(join(workspace, "patch.json"), `${JSON.stringify(
    {
      version: 1,
      taskId: "T03-code-implementation",
      summary: "Validate only.",
      operations: [
        {
          type: "write",
          path: "src/generated.txt",
          content: "generated\n"
        },
        {
          type: "delete",
          path: "src/old.txt",
          missingOk: true
        }
      ]
    },
    null,
    2
  )}\n`, "utf8");

  await runExecute({ validate: "true", "patch-set": "patch.json" });

  assert.equal(existsSync(join(workspace, "src", "generated.txt")), false);
  assert.match(logs.join("\n"), /Patch set is valid/);
  assert.match(logs.join("\n"), /Operations: 2/);
  assert.match(logs.join("\n"), /Writes: 1/);
  assert.match(logs.join("\n"), /Deletes: 1/);
});

function writeProject(workspace: string): void {
  mkdirSync(join(workspace, ".devflow", "artifacts"), { recursive: true });
  mkdirSync(join(workspace, "src"), { recursive: true });
  writeFileSync(join(workspace, "src", "App.tsx"), "export function App() {\n  return <main>Existing App Shell</main>;\n}\n", "utf8");
  writeFileSync(join(workspace, "package.json"), "{\"scripts\":{\"check\":\"tsc --noEmit\"}}\n", "utf8");

  const brief: ProjectBrief = {
    version: 1,
    sourceDocuments: {
      requirementsPath: "docs/requirements.md",
      uiPath: "docs/ui.md",
      apiPath: "docs/api.md"
    },
    stack: {
      packageManager: "npm",
      runtimes: ["Node.js", "TypeScript"],
      frameworks: ["React"],
      buildTools: ["Vite"],
      styling: [],
      testing: ["Vitest"],
      scripts: {
        check: "tsc --noEmit"
      },
      sourceDirectories: ["src"],
      configFiles: [],
      notes: []
    },
    signals: {
      requirements: ["Existing app shell should be preserved."],
      ui: [],
      api: []
    },
    designAssets: [],
    uiStateChecklist: [],
    apiContracts: [],
    apiDataModels: [],
    apiErrorCases: [],
    apiAuthRequirements: [],
    invalidApiDataModels: [],
    userStories: ["As a user, I want the existing shell to remain visible so that navigation stays stable."],
    constraints: ["Keep the existing React shell mounted."],
    acceptanceCriteria: ["Existing shell remains visible."],
    deliveryRisks: [],
    openQuestions: [],
    recommendedVerification: ["npm run check"]
  };
  const taskPlan: TaskPlan = {
    version: 1,
    source: {
      projectBriefPath: ".devflow/artifacts/project-brief.json",
      implementationPlanPath: ".devflow/artifacts/implementation-plan.md"
    },
    implementationUnits: [],
    tasks: [
      {
        id: "T03-code-implementation",
        phase: "Implementation",
        title: "Implement the planned frontend changes",
        objective: "Update the app shell.",
        mode: "ai-assisted",
        risk: "high",
        dependsOn: [],
        inputs: [".devflow/artifacts/project-brief.json"],
        expectedOutputs: ["Updated source files"],
        acceptanceCriteria: ["Existing shell remains visible."],
        verification: ["npm run check"]
      }
    ],
    notes: []
  };

  writeFileSync(join(workspace, ".devflow", "artifacts", "project-brief.json"), `${JSON.stringify(brief, null, 2)}\n`, "utf8");
  writeFileSync(join(workspace, ".devflow", "artifacts", "tasks.json"), `${JSON.stringify(taskPlan, null, 2)}\n`, "utf8");
}

function startProviderServer(requests: unknown[]): Promise<Server> {
  const server = createServer((request, response) => {
    let body = "";

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      requests.push(JSON.parse(body) as unknown);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ choices: [{ message: { content: "# AI proposal from test provider\n" } }] }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function restoreEnv(env: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}
