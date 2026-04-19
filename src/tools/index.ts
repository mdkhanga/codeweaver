/**
 * Tools module - exports all available tools for the agent
 */

import type { StructuredToolInterface } from "@langchain/core/tools";
import { readFileTool } from "./read.js";
import { globTool } from "./glob.js";
import { writeFileTool } from "./write.js";
import { editFileTool } from "./edit.js";

// Export individual tools
export { readFileTool } from "./read.js";
export { globTool } from "./glob.js";
export { writeFileTool } from "./write.js";
export { editFileTool } from "./edit.js";

// Export approval utilities
export {
  setReadlineInterface,
  requestApproval,
  type ApprovalRequest,
  type ApprovalCallback,
} from "./approval.js";

/**
 * All available tools for the agent
 */
export const allTools: StructuredToolInterface[] = [readFileTool, globTool, writeFileTool, editFileTool];
