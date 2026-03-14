/**
 * LLM Provider factory
 *
 * Creates the appropriate LLM model based on configuration
 */

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { SystemMessage, HumanMessage, AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { RuntimeConfig } from "../config/types.js";
import { createOpenAIModel } from "./openai.js";
import { createGeminiModel } from "./gemini.js";
import { createAnthropicModel } from "./anthropic.js";

/** System prompt for the coding agent */
const SYSTEM_PROMPT = `You are an expert software engineer assistant. Your role is to help users with coding tasks including:

- Understanding and explaining code
- Writing new code and features
- Debugging and fixing bugs
- Refactoring and improving code quality
- Answering programming questions

Guidelines:
- Be concise and direct in your responses
- When showing code, use proper formatting with language identifiers
- If you need more context about the codebase, ask the user
- Explain your reasoning when making suggestions
- If you're unsure about something, say so

You are currently operating in chat mode. In future updates, you will have access to tools for reading and modifying files.`;

/** Token usage for a single request */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Response from a chat request including token usage */
export interface ChatResponse {
  content: string;
  usage: TokenUsage;
}

/** Streaming response - yields content chunks, returns usage at end */
export interface StreamingChatResponse {
  content: string;
  usage: TokenUsage;
}

/** Cumulative token usage for a session */
export interface SessionUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  requestCount: number;
}

/**
 * Create an LLM model based on the runtime configuration
 */
export function createLLM(runtime: RuntimeConfig): BaseChatModel {
  const { config, keys } = runtime;
  const { provider } = config.llm;

  switch (provider) {
    case "openai": {
      if (!keys.openai) {
        throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY in .env");
      }
      return createOpenAIModel(config.llm, keys.openai);
    }

    case "gemini": {
      if (!keys.gemini) {
        throw new Error("Gemini API key not configured. Set GEMINI_API_KEY in .env");
      }
      return createGeminiModel(config.llm, keys.gemini);
    }

    case "anthropic": {
      if (!keys.anthropic) {
        throw new Error("Anthropic API key not configured. Set ANTHROPIC_API_KEY in .env");
      }
      return createAnthropicModel(config.llm, keys.anthropic);
    }

    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * Conversation manager - maintains chat history and tracks token usage
 */
export class Conversation {
  private history: BaseMessage[] = [];
  private model: BaseChatModel;
  private _sessionUsage: SessionUsage = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    requestCount: 0,
  };

  constructor(model: BaseChatModel) {
    this.model = model;
    // Initialize with system prompt
    this.history.push(new SystemMessage(SYSTEM_PROMPT));
  }

  /**
   * Send a message and get a response, maintaining conversation history
   */
  async chat(userMessage: string): Promise<ChatResponse> {
    // Add user message to history
    this.history.push(new HumanMessage(userMessage));

    // Get response from LLM
    const response = await this.model.invoke(this.history);
    const content = response.content as string;

    // Extract token usage from response metadata
    const usageMetadata = response.usage_metadata;
    const usage: TokenUsage = {
      inputTokens: usageMetadata?.input_tokens ?? 0,
      outputTokens: usageMetadata?.output_tokens ?? 0,
    };

    // Update session totals
    this._sessionUsage.totalInputTokens += usage.inputTokens;
    this._sessionUsage.totalOutputTokens += usage.outputTokens;
    this._sessionUsage.requestCount += 1;

    // Add assistant response to history
    this.history.push(new AIMessage(content));

    return { content, usage };
  }

  /**
   * Send a message and stream the response token by token
   * @param userMessage The user's message
   * @param onToken Callback called for each token received
   * @returns The complete response with usage stats
   */
  async chatStream(
    userMessage: string,
    onToken: (token: string) => void
  ): Promise<StreamingChatResponse> {
    // Add user message to history
    this.history.push(new HumanMessage(userMessage));

    // Stream response from LLM
    const stream = await this.model.stream(this.history);

    let fullContent = "";
    let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

    for await (const chunk of stream) {
      // Extract text content from chunk
      const chunkContent = typeof chunk.content === "string"
        ? chunk.content
        : "";

      if (chunkContent) {
        fullContent += chunkContent;
        onToken(chunkContent);
      }

      // Check for usage metadata (usually in the last chunk)
      if (chunk.usage_metadata) {
        usage = {
          inputTokens: chunk.usage_metadata.input_tokens ?? 0,
          outputTokens: chunk.usage_metadata.output_tokens ?? 0,
        };
      }
    }

    // Update session totals
    this._sessionUsage.totalInputTokens += usage.inputTokens;
    this._sessionUsage.totalOutputTokens += usage.outputTokens;
    this._sessionUsage.requestCount += 1;

    // Add assistant response to history
    this.history.push(new AIMessage(fullContent));

    return { content: fullContent, usage };
  }

  /**
   * Clear conversation history (keeps system prompt, resets token counts)
   */
  clear(): void {
    this.history = [new SystemMessage(SYSTEM_PROMPT)];
    this._sessionUsage = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      requestCount: 0,
    };
  }

  /**
   * Get the number of messages in history (excluding system prompt)
   */
  get messageCount(): number {
    return this.history.length - 1;
  }

  /**
   * Get cumulative session usage
   */
  get sessionUsage(): SessionUsage {
    return { ...this._sessionUsage };
  }
}

/**
 * Simple chat function - sends a message and returns the response (no history)
 */
export async function chat(
  model: BaseChatModel,
  message: string
): Promise<string> {
  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(message),
  ];
  const response = await model.invoke(messages);
  return response.content as string;
}
