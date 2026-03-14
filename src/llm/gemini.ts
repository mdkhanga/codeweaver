/**
 * Google Gemini LLM provider using LangChain
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { LLMConfig } from "../config/types.js";

export function createGeminiModel(config: LLMConfig, apiKey: string): BaseChatModel {
  return new ChatGoogleGenerativeAI({
    model: config.model,
    temperature: config.temperature ?? 0.7,
    maxOutputTokens: config.maxTokens,
    apiKey,
  });
}
