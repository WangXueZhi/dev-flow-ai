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
  fixturePath?: string;
  baseUrl: string;
  model: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export function createAiProviderFromEnv(): AiProvider | undefined {
  const fixturePath = process.env.DEVFLOW_AI_FIXTURE_PATH;

  if (fixturePath) {
    return createFixtureAiProvider(fixturePath);
  }

  const apiKey = process.env.DEVFLOW_AI_API_KEY ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return undefined;
  }

  const baseUrl = process.env.DEVFLOW_AI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.DEVFLOW_AI_MODEL ?? "gpt-4.1";

  async function complete(input: AiCompletionInput): Promise<string> {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
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

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`AI provider request failed (${response.status}): ${body}`);
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
  if (env.DEVFLOW_AI_FIXTURE_PATH) {
    return {
      mode: "fixture",
      ready: true,
      fixturePath: env.DEVFLOW_AI_FIXTURE_PATH,
      baseUrl: env.DEVFLOW_AI_BASE_URL ?? "https://api.openai.com/v1",
      model: env.DEVFLOW_AI_MODEL ?? "gpt-4.1"
    };
  }

  const apiKeyEnvName = env.DEVFLOW_AI_API_KEY
    ? "DEVFLOW_AI_API_KEY"
    : env.OPENAI_API_KEY
      ? "OPENAI_API_KEY"
      : undefined;

  return {
    mode: apiKeyEnvName ? "live" : "fallback",
    ready: Boolean(apiKeyEnvName),
    apiKeyEnvName,
    baseUrl: env.DEVFLOW_AI_BASE_URL ?? "https://api.openai.com/v1",
    model: env.DEVFLOW_AI_MODEL ?? "gpt-4.1"
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
