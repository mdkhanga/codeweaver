/**
 * LangGraph Agent
 *
 * Creates a ReAct-style agent that can use tools to explore codebases
 */

import { StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SystemMessage, HumanMessage, AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AgentState, type AgentStateType } from "./state.js";
import { AGENT_SYSTEM_PROMPT } from "./prompts.js";
import { allTools } from "../tools/index.js";

/** Token usage tracking */
export interface AgentTokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Result from agent execution */
export interface AgentResult {
  response: string;
  usage: AgentTokenUsage;
}

/**
 * Create a LangGraph agent with tools
 */
export function createAgent(model: BaseChatModel) {
  // Bind tools to the model
  if (!model.bindTools) {
    throw new Error("Model does not support tool binding");
  }
  const modelWithTools = model.bindTools(allTools);

  /**
   * Agent node - calls the LLM to decide what to do
   */
  async function agentNode(state: AgentStateType) {
    const messages = state.messages;

    // Add system prompt if not present
    const hasSystemPrompt = messages.some((m) => m._getType() === "system");
    const messagesWithSystem = hasSystemPrompt
      ? messages
      : [new SystemMessage(AGENT_SYSTEM_PROMPT), ...messages];

    // Call the model
    const response = await modelWithTools.invoke(messagesWithSystem);

    return { messages: [response] };
  }

  /**
   * Determine whether to continue to tools or end
   */
  function shouldContinue(state: AgentStateType): "tools" | "__end__" {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];

    // If the last message has tool calls, route to tools
    if (
      lastMessage &&
      "tool_calls" in lastMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls.length > 0
    ) {
      return "tools";
    }

    // Otherwise, we're done
    return "__end__";
  }

  // Create the tool node
  const toolNode = new ToolNode(allTools);

  // Build the graph
  const workflow = new StateGraph(AgentState)
    .addNode("agent", agentNode)
    .addNode("tools", toolNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  // Compile the graph
  const graph = workflow.compile();

  return graph;
}

/**
 * Agent runner - provides a simple interface to run the agent
 */
export class AgentRunner {
  private graph: ReturnType<typeof createAgent>;
  private conversationHistory: BaseMessage[] = [];
  private _totalUsage: AgentTokenUsage = { inputTokens: 0, outputTokens: 0 };

  constructor(model: BaseChatModel) {
    this.graph = createAgent(model);
  }

  /**
   * Run the agent with a user message
   */
  async run(userMessage: string): Promise<AgentResult> {
    // Add user message to history
    this.conversationHistory.push(new HumanMessage(userMessage));

    // Run the agent
    const result = await this.graph.invoke({
      messages: this.conversationHistory,
    });

    // Extract the final response
    const messages = result.messages as BaseMessage[];
    const lastMessage = messages[messages.length - 1];

    // Update conversation history with all new messages
    // (including tool calls and tool responses)
    this.conversationHistory = messages;

    // Extract usage from the last AI message
    let usage: AgentTokenUsage = { inputTokens: 0, outputTokens: 0 };

    // Sum up usage from all AI messages in this turn
    for (const msg of messages) {
      if (msg._getType() === "ai" && "usage_metadata" in msg) {
        const meta = msg.usage_metadata as { input_tokens?: number; output_tokens?: number } | undefined;
        if (meta) {
          usage.inputTokens += meta.input_tokens ?? 0;
          usage.outputTokens += meta.output_tokens ?? 0;
        }
      }
    }

    // Update totals
    this._totalUsage.inputTokens += usage.inputTokens;
    this._totalUsage.outputTokens += usage.outputTokens;

    // Get response content
    const response = typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

    return { response, usage };
  }

  /**
   * Run the agent with streaming output
   */
  async runStream(
    userMessage: string,
    onToken: (token: string) => void
  ): Promise<AgentResult> {
    // Add user message to history
    this.conversationHistory.push(new HumanMessage(userMessage));

    let fullResponse = "";
    let usage: AgentTokenUsage = { inputTokens: 0, outputTokens: 0 };
    let allMessages: BaseMessage[] = [...this.conversationHistory];

    // Stream the agent execution
    const stream = await this.graph.stream(
      { messages: this.conversationHistory },
      { streamMode: "values" }
    );

    for await (const state of stream) {
      const messages = state.messages as BaseMessage[];
      allMessages = messages;

      // Get the last message
      const lastMessage = messages[messages.length - 1];

      // If it's an AI message with content, stream it
      if (lastMessage._getType() === "ai") {
        const content = typeof lastMessage.content === "string"
          ? lastMessage.content
          : "";

        // Stream new content
        if (content.length > fullResponse.length) {
          const newContent = content.slice(fullResponse.length);
          onToken(newContent);
          fullResponse = content;
        }

        // Collect usage
        if ("usage_metadata" in lastMessage) {
          const meta = lastMessage.usage_metadata as { input_tokens?: number; output_tokens?: number } | undefined;
          if (meta) {
            usage.inputTokens = meta.input_tokens ?? 0;
            usage.outputTokens = meta.output_tokens ?? 0;
          }
        }
      }
    }

    // Update conversation history
    this.conversationHistory = allMessages;

    // Update totals
    this._totalUsage.inputTokens += usage.inputTokens;
    this._totalUsage.outputTokens += usage.outputTokens;

    return { response: fullResponse, usage };
  }

  /**
   * Clear conversation history
   */
  clear(): void {
    this.conversationHistory = [];
    this._totalUsage = { inputTokens: 0, outputTokens: 0 };
  }

  /**
   * Get total token usage
   */
  get totalUsage(): AgentTokenUsage {
    return { ...this._totalUsage };
  }
}
