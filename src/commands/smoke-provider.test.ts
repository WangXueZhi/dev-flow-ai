import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { runSmokeProvider } from "./smoke-provider.js";

test("runSmokeProvider writes a skipped report when no live key is configured", async (t) => {
  const workspace = await createWorkspace(t);
  const reportPath = join(workspace, "live-provider-smoke.json");

  await runQuietly(() => runSmokeProvider({ out: reportPath }, {}));

  const report = await readReport(reportPath);

  assert.equal(report.status, "skipped");
  assert.equal(report.required, false);
  assert.equal(report.provider.mode, "fallback");
  assert.equal(report.provider.ready, false);
  assert.equal(report.apiKeyEnvName, undefined);
});

test("runSmokeProvider can require a live provider", async (t) => {
  const workspace = await createWorkspace(t);
  const reportPath = join(workspace, "live-provider-smoke.json");

  await assert.rejects(
    runQuietly(() => runSmokeProvider({ out: reportPath, "require-live": "true" }, {})),
    /--require-live was set/
  );

  const report = await readReport(reportPath);

  assert.equal(report.status, "failed");
  assert.equal(report.required, true);
  assert.equal(report.provider.mode, "fallback");
});

test("runSmokeProvider sends a live OpenAI-compatible smoke request", async (t) => {
  const workspace = await createWorkspace(t);
  const reportPath = join(workspace, "live-provider-smoke.json");
  const requests: Array<{ headers: IncomingMessage["headers"]; body: unknown }> = [];
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    requests.push({
      headers: request.headers,
      body: JSON.parse(await readRequestBody(request)) as unknown
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: "devflow smoke ok" } }] }));
  });

  try {
    const baseUrl = await listen(server);

    await runQuietly(() =>
      runSmokeProvider(
        {
          out: reportPath,
          "require-live": "true"
        },
        {
          DEVFLOW_AI_API_KEY: "test-key",
          DEVFLOW_AI_BASE_URL: baseUrl,
          DEVFLOW_AI_MODEL: "mock-model"
        }
      )
    );

    const report = await readReport(reportPath);

    assert.equal(report.status, "passed");
    assert.equal(report.required, true);
    assert.equal(report.apiKeyEnvName, "DEVFLOW_AI_API_KEY");
    assert.equal(report.provider.mode, "live");
    assert.equal(report.provider.ready, true);
    assert.equal(report.provider.fixtureOverridesLive, false);
    assert.equal(report.responseExcerpt, "devflow smoke ok");
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.headers.authorization, "Bearer test-key");
    assert.deepEqual(requests[0]?.body, {
      model: "mock-model",
      messages: [
        {
          role: "system",
          content: "You are DevFlow's AI provider smoke test. Reply briefly so the CLI can confirm the provider responds."
        },
        {
          role: "user",
          content: "Return a short confirmation that the DevFlow provider smoke request reached the model."
        }
      ],
      temperature: 0
    });
  } finally {
    await close(server);
  }
});

test("runSmokeProvider writes a failed report when the provider request fails", async (t) => {
  const workspace = await createWorkspace(t);
  const reportPath = join(workspace, "live-provider-smoke.json");
  const server = createServer((_request, response) => {
    response.writeHead(429, { "content-type": "text/plain" });
    response.end("rate limited");
  });

  try {
    const baseUrl = await listen(server);

    await assert.rejects(
      runQuietly(() =>
        runSmokeProvider(
          { out: reportPath },
          {
            OPENAI_API_KEY: "test-openai-key",
            DEVFLOW_AI_BASE_URL: baseUrl
          }
        )
      ),
      /rate limited/
    );

    const report = await readReport(reportPath);

    assert.equal(report.status, "failed");
    assert.equal(report.required, false);
    assert.equal(report.apiKeyEnvName, "OPENAI_API_KEY");
    assert.equal(report.provider.mode, "live");
    assert.doesNotMatch(JSON.stringify(report), /test-openai-key/);
  } finally {
    await close(server);
  }
});

async function createWorkspace(t: TestContext): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), "dev-flow-smoke-provider-"));

  t.after(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  return workspace;
}

async function runQuietly(action: () => Promise<void>): Promise<void> {
  const originalLog = console.log;

  console.log = () => undefined;

  try {
    await action();
  } finally {
    console.log = originalLog;
  }
}

async function readReport(path: string): Promise<{
  status: string;
  required: boolean;
  apiKeyEnvName?: string;
  provider: {
    mode: string;
    ready: boolean;
    fixtureOverridesLive: boolean;
  };
  responseExcerpt?: string;
}> {
  return JSON.parse(await readFile(path, "utf8")) as {
    status: string;
    required: boolean;
    apiKeyEnvName?: string;
    provider: {
      mode: string;
      ready: boolean;
      fixtureOverridesLive: boolean;
    };
    responseExcerpt?: string;
  };
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  let body = "";
  request.setEncoding("utf8");

  for await (const chunk of request) {
    body += chunk;
  }

  return body;
}

async function listen(server: ReturnType<typeof createServer>): Promise<string> {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;

  return `http://127.0.0.1:${address.port}/v1`;
}

async function close(server: ReturnType<typeof createServer>): Promise<void> {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
