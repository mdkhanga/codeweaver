/**
 * Read File Tool
 *
 * Reads the contents of a file from the filesystem
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

/** Maximum file size to read (1MB) */
const MAX_FILE_SIZE = 1024 * 1024;

/** Maximum number of lines to return */
const MAX_LINES = 500;

/**
 * Read file tool - reads contents of a file
 */
export const readFileTool = tool(
  async ({ filePath, startLine, endLine }): Promise<string> => {
    try {
      // Resolve to absolute path
      const absolutePath = path.resolve(filePath);

      // Check if file exists
      try {
        await fs.access(absolutePath);
      } catch {
        return `Error: File not found: ${filePath}`;
      }

      // Check file size
      const stats = await fs.stat(absolutePath);
      if (stats.size > MAX_FILE_SIZE) {
        return `Error: File too large (${Math.round(stats.size / 1024)}KB). Maximum size is ${MAX_FILE_SIZE / 1024}KB.`;
      }

      // Read file contents
      const content = await fs.readFile(absolutePath, "utf-8");
      const lines = content.split("\n");

      // Apply line range if specified
      const start = startLine ? Math.max(0, startLine - 1) : 0;
      const end = endLine ? Math.min(lines.length, endLine) : lines.length;

      let selectedLines = lines.slice(start, end);

      // Truncate if too many lines
      let truncated = false;
      if (selectedLines.length > MAX_LINES) {
        selectedLines = selectedLines.slice(0, MAX_LINES);
        truncated = true;
      }

      // Format output with line numbers
      const numberedLines = selectedLines.map(
        (line, i) => `${String(start + i + 1).padStart(4, " ")} | ${line}`
      );

      let result = numberedLines.join("\n");

      if (truncated) {
        result += `\n\n... (truncated, showing first ${MAX_LINES} lines)`;
      }

      return result;
    } catch (error) {
      return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "read_file",
    description:
      "Read the contents of a file. Returns the file content with line numbers. " +
      "Use this to examine source code, configuration files, or any text file.",
    schema: z.object({
      filePath: z
        .string()
        .describe("The path to the file to read (relative or absolute)"),
      startLine: z
        .number()
        .optional()
        .describe("Optional: Start reading from this line number (1-indexed)"),
      endLine: z
        .number()
        .optional()
        .describe("Optional: Stop reading at this line number (inclusive)"),
    }),
  }
);
