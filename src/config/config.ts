/**
 * Configuration loader
 *
 * Loads configuration from:
 * 1. Default values
 * 2. .mycoder.config.json in current directory (overrides defaults)
 * 3. Environment variables (override everything)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { config as loadDotenv } from "dotenv";
import type { AppConfig, APIKeys, RuntimeConfig, LLMProvider } from "./types.js";

const CONFIG_FILENAME = ".mycoder.config.json";

/** Default configuration */
const DEFAULT_CONFIG: AppConfig = {
  llm: {
    provider: "openai",
    model: "gpt-4o",
    temperature: 0.7,
    maxTokens: 4096,
  },
  approval: {
    fileWrite: true,
    fileEdit: true,
    shellCommand: true,
  },
};

/**
 * Load API keys from environment variables
 */
function loadAPIKeys(): APIKeys {
  return {
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  };
}

/**
 * Load config file from current directory or parents
 */
function loadConfigFile(): Partial<AppConfig> | null {
  let dir = process.cwd();
  const root = path.parse(dir).root;

  while (dir !== root) {
    const configPath = path.join(dir, CONFIG_FILENAME);
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, "utf-8");
        return JSON.parse(content) as Partial<AppConfig>;
      } catch (error) {
        console.warn(`Warning: Failed to parse ${configPath}:`, error);
        return null;
      }
    }
    dir = path.dirname(dir);
  }

  return null;
}

/**
 * Apply environment variable overrides
 */
function applyEnvOverrides(config: AppConfig): AppConfig {
  const result = { ...config };

  // LLM provider override
  const provider = process.env.MYCODER_LLM_PROVIDER;
  if (provider === "openai" || provider === "gemini" || provider === "anthropic") {
    result.llm = { ...result.llm, provider: provider as LLMProvider };
  }

  // Model override
  if (process.env.MYCODER_LLM_MODEL) {
    result.llm = { ...result.llm, model: process.env.MYCODER_LLM_MODEL };
  }

  return result;
}

/**
 * Deep merge two config objects
 */
function mergeConfig(base: AppConfig, override: Partial<AppConfig>): AppConfig {
  return {
    llm: { ...base.llm, ...override.llm },
    approval: { ...base.approval, ...override.approval },
  };
}

/**
 * Load the full runtime configuration
 */
export function loadConfig(): RuntimeConfig {
  // Load .env file if present
  loadDotenv();

  // Start with defaults
  let config = { ...DEFAULT_CONFIG };

  // Apply config file overrides
  const fileConfig = loadConfigFile();
  if (fileConfig) {
    config = mergeConfig(config, fileConfig);
  }

  // Apply environment variable overrides
  config = applyEnvOverrides(config);

  // Load API keys
  const keys = loadAPIKeys();

  return { config, keys };
}

/**
 * Validate that required API keys are present for the configured provider
 */
export function validateConfig(runtime: RuntimeConfig): string[] {
  const errors: string[] = [];
  const { config, keys } = runtime;

  if (config.llm.provider === "openai" && !keys.openai) {
    errors.push("OPENAI_API_KEY environment variable is required for OpenAI provider");
  }

  if (config.llm.provider === "gemini" && !keys.gemini) {
    errors.push("GEMINI_API_KEY environment variable is required for Gemini provider");
  }

  if (config.llm.provider === "anthropic" && !keys.anthropic) {
    errors.push("ANTHROPIC_API_KEY environment variable is required for Anthropic provider");
  }

  return errors;
}

/**
 * Format config for display (hides sensitive data)
 */
export function formatConfigForDisplay(runtime: RuntimeConfig): string {
  const { config, keys } = runtime;

  const lines = [
    "LLM Configuration:",
    `  Provider: ${config.llm.provider}`,
    `  Model: ${config.llm.model}`,
    `  Temperature: ${config.llm.temperature}`,
    `  Max Tokens: ${config.llm.maxTokens}`,
    "",
    "Approval Required:",
    `  File Write: ${config.approval.fileWrite}`,
    `  File Edit: ${config.approval.fileEdit}`,
    `  Shell Command: ${config.approval.shellCommand}`,
    "",
    "API Keys:",
    `  OpenAI: ${keys.openai ? "configured" : "not set"}`,
    `  Gemini: ${keys.gemini ? "configured" : "not set"}`,
    `  Anthropic: ${keys.anthropic ? "configured" : "not set"}`,
  ];

  return lines.join("\n");
}
