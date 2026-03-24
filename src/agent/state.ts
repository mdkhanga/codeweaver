/**
 * Agent State Definition
 *
 * Defines the state that flows through the LangGraph agent
 */

import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

/**
 * Agent state - tracks conversation messages
 *
 * The `messages` field uses a reducer that appends new messages
 * to the existing list, maintaining conversation history.
 */
export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});

/** Type for the agent state */
export type AgentStateType = typeof AgentState.State;
