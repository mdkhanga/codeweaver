/**
 * Configuration type definitions
 */

/** Supported LLM providers */
export type LLMProvider = "openai" | "gemini" | "anthropic";

/** Supported models by provider */
export type OpenAIModel = "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo" | "gpt-3.5-turbo";
export type GeminiModel = "gemini-1.5-pro" | "gemini-1.5-flash" | "gemini-2.0-flash";
export type AnthropicModel = "claude-sonnet-4-20250514" | "claude-3-5-sonnet-20241022" | "claude-3-5-haiku-20241022";

/** LLM configuration */
export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

/** Approval settings for different operations */
export interface ApprovalConfig {
  fileWrite: boolean;
  fileEdit: boolean;
  shellCommand: boolean;
}

/** Full application configuration */
export interface AppConfig {
  llm: LLMConfig;
  approval: ApprovalConfig;
}

/** API keys loaded from environment */
export interface APIKeys {
  openai?: string;
  gemini?: string;
  anthropic?: string;
}

/** Runtime configuration (config + keys) */
export interface RuntimeConfig {
  config: AppConfig;
  keys: APIKeys;
}
