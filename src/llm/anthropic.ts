/**
 * Anthropic (Claude) LLM provider using LangChain
 */

import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { LLMConfig } from "../config/types.js";

export function createAnthropicModel(config: LLMConfig, apiKey: string): BaseChatModel {
  return new ChatAnthropic({
    model: config.model,
    temperature: config.temperature ?? 0.7,
    maxTokens: config.maxTokens,
    apiKey,
  });
}
