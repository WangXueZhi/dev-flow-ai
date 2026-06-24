import { readFile } from "node:fs/promises";
import type { ProjectContext } from "./context.js";

export interface AiProvider {
  complete(input: AiCompletionInput): Promise<string>;
  completePlan(context: ProjectContext, prompt: string): Promise<string>;
}

export interface AiCompletionInput {
  system: string;
  prompt: string;
  temperature?: number;
  emptyResponseMessage?: string;
}

export interface AiProviderStatus {
  mode: "fixture" | "live" | "fallback";
  ready: boolean;
  apiKeyEnvName?: "DEVFLOW_AI_API_KEY" | "OPENAI_API_KEY";
  liveApiKeyEnvName?: "DEVFLOW_AI_API_KEY" | "OPENAI_API_KEY";
  fixturePath?: string;
  fixtureOverridesLive: boolean;
  baseUrl: string;
  baseUrlSource: "default" | "env";
  chatCompletionsUrl: string;
  model: string;
  modelSource: "default" | "env";
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const defaultBaseUrl = "https://api.openai.com/v1";
const defaultModel = "gpt-4.1";

export function createAiProviderFromEnv(env: NodeJS.ProcessEnv = process.env): AiProvider | undefined {
  const config = readAiProviderConfig(env);
  const fixturePath = config.fixturePath;

  if (fixturePath) {
    return createFixtureAiProvider(fixturePath);
  }

  const apiKey = config.apiKey;

  if (!apiKey) {
    return undefined;
  }

  async function complete(input: AiCompletionInput): Promise<string> {
    let response: Response;

    try {
      response = await fetch(config.chatCompletionsUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: "system",
              content: input.system
            },
            {
              role: "user",
              content: input.prompt
            }
          ],
          temperature: input.temperature ?? 0.2
        })
      });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      throw new Error(`AI provider request failed before a response was received (${formatProviderTarget(config)}): ${details}`);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`AI provider request failed (${response.status}) (${formatProviderTarget(config)}): ${body}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error(input.emptyResponseMessage ?? "AI provider returned an empty response.");
    }

    return content;
  }

  return {
    complete,
    async completePlan(_context, prompt) {
      return complete({
        system:
          "You are DevFlow, an expert frontend delivery planner. Produce concise, actionable Markdown plans grounded in the provided documents.",
        prompt,
        temperature: 0.2,
        emptyResponseMessage: "AI provider returned an empty plan."
      });
    }
  };
}

export function getAiProviderStatus(env: NodeJS.ProcessEnv = process.env): AiProviderStatus {
  const config = readAiProviderConfig(env);

  if (config.fixturePath) {
    return {
      mode: "fixture",
      ready: true,
      liveApiKeyEnvName: config.apiKeyEnvName,
      fixturePath: config.fixturePath,
      fixtureOverridesLive: Boolean(config.apiKeyEnvName),
      baseUrl: config.baseUrl,
      baseUrlSource: config.baseUrlSource,
      chatCompletionsUrl: config.chatCompletionsUrl,
      model: config.model,
      modelSource: config.modelSource
    };
  }

  return {
    mode: config.apiKeyEnvName ? "live" : "fallback",
    ready: Boolean(config.apiKeyEnvName),
    apiKeyEnvName: config.apiKeyEnvName,
    liveApiKeyEnvName: config.apiKeyEnvName,
    fixtureOverridesLive: false,
    baseUrl: config.baseUrl,
    baseUrlSource: config.baseUrlSource,
    chatCompletionsUrl: config.chatCompletionsUrl,
    model: config.model,
    modelSource: config.modelSource
  };
}

export function createFixtureAiProvider(path: string): AiProvider {
  async function complete(_input: AiCompletionInput): Promise<string> {
    return readFile(path, "utf8");
  }

  return {
    complete,
    async completePlan(_context, _prompt) {
      return complete({
        system: "Fixture provider",
        prompt: "Fixture provider"
      });
    }
  };
}

interface AiProviderConfig {
  apiKey?: string;
  apiKeyEnvName?: "DEVFLOW_AI_API_KEY" | "OPENAI_API_KEY";
  fixturePath?: string;
  baseUrl: string;
  baseUrlSource: "default" | "env";
  chatCompletionsUrl: string;
  model: string;
  modelSource: "default" | "env";
}

function readAiProviderConfig(env: NodeJS.ProcessEnv): AiProviderConfig {
  const apiKeyEnvName = readEnvValue(env, "DEVFLOW_AI_API_KEY")
    ? "DEVFLOW_AI_API_KEY"
    : readEnvValue(env, "OPENAI_API_KEY")
      ? "OPENAI_API_KEY"
      : undefined;
  const baseUrl = readEnvValue(env, "DEVFLOW_AI_BASE_URL");
  const model = readEnvValue(env, "DEVFLOW_AI_MODEL");

  return {
    apiKey: apiKeyEnvName ? readEnvValue(env, apiKeyEnvName) : undefined,
    apiKeyEnvName,
    fixturePath: readEnvValue(env, "DEVFLOW_AI_FIXTURE_PATH"),
    baseUrl: baseUrl ?? defaultBaseUrl,
    baseUrlSource: baseUrl ? "env" : "default",
    chatCompletionsUrl: buildChatCompletionsUrl(baseUrl ?? defaultBaseUrl),
    model: model ?? defaultModel,
    modelSource: model ? "env" : "default"
  };
}

function buildChatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function formatProviderTarget(config: Pick<AiProviderConfig, "apiKeyEnvName" | "chatCompletionsUrl" | "model">): string {
  const keySource = config.apiKeyEnvName ? ` using ${config.apiKeyEnvName}` : "";

  return `${config.chatCompletionsUrl}, model ${config.model}${keySource}`;
}

function readEnvValue(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim();

  return value ? value : undefined;
}
