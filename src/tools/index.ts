/**
 * Tools module - exports all available tools for the agent
 */

import type { StructuredToolInterface } from "@langchain/core/tools";
import { readFileTool } from "./read.js";
import { globTool } from "./glob.js";

// Export individual tools
export { readFileTool } from "./read.js";
export { globTool } from "./glob.js";

/**
 * All available tools for the agent
 */
export const allTools: StructuredToolInterface[] = [readFileTool, globTool];
