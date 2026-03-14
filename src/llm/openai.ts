/**
 * OpenAI LLM provider using LangChain
 */

import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { LLMConfig } from "../config/types.js";

export function createOpenAIModel(config: LLMConfig, apiKey: string): BaseChatModel {
  return new ChatOpenAI({
    model: config.model,
    temperature: config.temperature ?? 0.7,
    maxTokens: config.maxTokens,
    apiKey,
  });
}
