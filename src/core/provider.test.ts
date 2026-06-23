import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createAiProviderFromEnv, createFixtureAiProvider, getAiProviderStatus } from "./provider.js";

test("createFixtureAiProvider replays file content", async () => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-provider-"));
  const path = join(root, "response.txt");
  await writeFile(path, "fixture response", "utf8");

  const provider = createFixtureAiProvider(path);
  const response = await provider.complete({
    system: "system",
    prompt: "prompt"
  });

  assert.equal(response, "fixture response");
});

test("getAiProviderStatus reports fixture mode first", () => {
  assert.deepEqual(
    getAiProviderStatus({
      DEVFLOW_AI_FIXTURE_PATH: "fixtures/patch-set.json",
      DEVFLOW_AI_API_KEY: "live-key"
    }),
    {
      mode: "fixture",
      ready: true,
      fixturePath: "fixtures/patch-set.json",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4.1"
    }
  );
});

test("getAiProviderStatus falls back to OPENAI_API_KEY", () => {
  assert.deepEqual(
    getAiProviderStatus({
      OPENAI_API_KEY: "openai-key",
      DEVFLOW_AI_BASE_URL: "https://gateway.example/v1",
      DEVFLOW_AI_MODEL: "example-model"
    }),
    {
      mode: "live",
      ready: true,
      apiKeyEnvName: "OPENAI_API_KEY",
      baseUrl: "https://gateway.example/v1",
      model: "example-model"
    }
  );
});

test("getAiProviderStatus reports fallback mode without a provider", () => {
  assert.deepEqual(getAiProviderStatus({}), {
    mode: "fallback",
    ready: false,
    apiKeyEnvName: undefined,
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1"
  });
});

test("createAiProviderFromEnv calls an OpenAI-compatible chat completions endpoint", async () => {
  const requests: Array<{ method: string | undefined; url: string | undefined; headers: IncomingMessage["headers"]; body: unknown }> = [];
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    requests.push({
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: JSON.parse(await readRequestBody(request)) as unknown
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: "provider response" } }] }));
  });
  const restoreEnv = setProviderEnv({
    DEVFLOW_AI_API_KEY: "test-key",
    DEVFLOW_AI_BASE_URL: await listen(server),
    DEVFLOW_AI_MODEL: "mock-model"
  });

  try {
    const provider = createAiProviderFromEnv();
    assert.ok(provider);

    const response = await provider.complete({
      system: "system message",
      prompt: "user prompt",
      temperature: 0.7
    });

    assert.equal(response, "provider response");
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.url, "/v1/chat/completions");
    assert.equal(requests[0]?.headers.authorization, "Bearer test-key");
    assert.deepEqual(requests[0]?.body, {
      model: "mock-model",
      messages: [
        {
          role: "system",
          content: "system message"
        },
        {
          role: "user",
          content: "user prompt"
        }
      ],
      temperature: 0.7
    });
  } finally {
    restoreEnv();
    await close(server);
  }
});

test("createAiProviderFromEnv surfaces provider HTTP failures", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(429, { "content-type": "text/plain" });
    response.end("rate limited");
  });
  const restoreEnv = setProviderEnv({
    DEVFLOW_AI_API_KEY: "test-key",
    DEVFLOW_AI_BASE_URL: await listen(server)
  });

  try {
    const provider = createAiProviderFromEnv();
    assert.ok(provider);

    await assert.rejects(
      provider.complete({
        system: "system",
        prompt: "prompt"
      }),
      /AI provider request failed \(429\): rate limited/
    );
  } finally {
    restoreEnv();
    await close(server);
  }
});

test("createAiProviderFromEnv rejects empty provider responses", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: "" } }] }));
  });
  const restoreEnv = setProviderEnv({
    DEVFLOW_AI_API_KEY: "test-key",
    DEVFLOW_AI_BASE_URL: await listen(server)
  });

  try {
    const provider = createAiProviderFromEnv();
    assert.ok(provider);

    await assert.rejects(
      provider.complete({
        system: "system",
        prompt: "prompt",
        emptyResponseMessage: "empty test response"
      }),
      /empty test response/
    );
  } finally {
    restoreEnv();
    await close(server);
  }
});

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

function setProviderEnv(next: NodeJS.ProcessEnv): () => void {
  const keys = [
    "DEVFLOW_AI_API_KEY",
    "OPENAI_API_KEY",
    "DEVFLOW_AI_BASE_URL",
    "DEVFLOW_AI_MODEL",
    "DEVFLOW_AI_FIXTURE_PATH"
  ];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));

  for (const key of keys) {
    delete process.env[key];
  }

  Object.assign(process.env, next);

  return () => {
    for (const key of keys) {
      const value = previous.get(key);

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}
