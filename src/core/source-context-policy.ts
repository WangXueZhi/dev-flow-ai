import type { FlagMap } from "./args.js";

export interface SourceContextPolicy {
  enabled: boolean;
  source: "flag" | "env" | "default";
  value?: string;
}

const disabledValues = new Set(["0", "false", "none", "off", "disabled"]);

export function getSourceContextPolicy(flags: FlagMap = {}, env: NodeJS.ProcessEnv = process.env): SourceContextPolicy {
  if (flags["no-source-context"] === "true") {
    return {
      enabled: false,
      source: "flag",
      value: "--no-source-context"
    };
  }

  const envValue = env.DEVFLOW_SOURCE_CONTEXT?.trim().toLowerCase();
  if (envValue && disabledValues.has(envValue)) {
    return {
      enabled: false,
      source: "env",
      value: env.DEVFLOW_SOURCE_CONTEXT
    };
  }

  return {
    enabled: true,
    source: envValue ? "env" : "default",
    value: env.DEVFLOW_SOURCE_CONTEXT
  };
}

export function shouldIncludeSourceContext(flags: FlagMap = {}, env: NodeJS.ProcessEnv = process.env): boolean {
  return getSourceContextPolicy(flags, env).enabled;
}
