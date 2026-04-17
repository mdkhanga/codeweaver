/**
 * Write File Tool
 *
 * Writes content to a file with user approval
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { requestApproval } from "./approval.js";

/** Maximum content size to write (1MB) */
const MAX_CONTENT_SIZE = 1024 * 1024;

/**
 * Write file tool - writes content to a file (requires user approval)
 */
export const writeFileTool = tool(
  async ({ filePath, content, createDirectories }): Promise<string> => {
    try {
      // Resolve to absolute path
      const absolutePath = path.resolve(filePath);

      // Check content size
      if (content.length > MAX_CONTENT_SIZE) {
        return `Error: Content too large (${Math.round(content.length / 1024)}KB). Maximum size is ${MAX_CONTENT_SIZE / 1024}KB.`;
      }

      // Check if file exists
      let fileExists = false;
      try {
        await fs.access(absolutePath);
        fileExists = true;
      } catch {
        fileExists = false;
      }

      // Check if parent directory exists
      const parentDir = path.dirname(absolutePath);
      let parentExists = false;
      try {
        await fs.access(parentDir);
        parentExists = true;
      } catch {
        parentExists = false;
      }

      if (!parentExists && !createDirectories) {
        return `Error: Parent directory does not exist: ${parentDir}. Set createDirectories to true to create it.`;
      }

      // Request user approval
      const description = fileExists
        ? `Overwrite existing file (${content.split("\n").length} lines)`
        : `Create new file (${content.split("\n").length} lines)`;

      const approved = await requestApproval({
        operation: "write",
        target: absolutePath,
        description,
        preview: content,
      });

      if (!approved) {
        return `Operation cancelled: User denied permission to write to ${filePath}`;
      }

      // Create parent directories if needed
      if (!parentExists && createDirectories) {
        await fs.mkdir(parentDir, { recursive: true });
      }

      // Write the file
      await fs.writeFile(absolutePath, content, "utf-8");

      const action = fileExists ? "Updated" : "Created";
      return `${action} file: ${filePath} (${content.split("\n").length} lines, ${content.length} bytes)`;
    } catch (error) {
      return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "write_file",
    description:
      "Write content to a file. Creates the file if it doesn't exist, or overwrites if it does. " +
      "Requires user approval before writing. Use this to create or update source code, " +
      "configuration files, or any text file.",
    schema: z.object({
      filePath: z
        .string()
        .describe("The path to the file to write (relative or absolute)"),
      content: z
        .string()
        .describe("The content to write to the file"),
      createDirectories: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, create parent directories if they don't exist"),
    }),
  }
);
