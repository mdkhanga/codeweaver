/**
 * Edit File Tool
 *
 * Edits files using search/replace with diff preview and user approval
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { requestApproval } from "./approval.js";

/**
 * Generate a simple unified diff between two strings
 */
function generateDiff(
  filePath: string,
  oldContent: string,
  newContent: string
): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  const lines: string[] = [];
  lines.push(`--- a/${filePath}`);
  lines.push(`+++ b/${filePath}`);

  // Find the changed region
  let startLine = 0;
  let endLineOld = oldLines.length;
  let endLineNew = newLines.length;

  // Find first different line
  while (
    startLine < oldLines.length &&
    startLine < newLines.length &&
    oldLines[startLine] === newLines[startLine]
  ) {
    startLine++;
  }

  // Find last different line (from end)
  while (
    endLineOld > startLine &&
    endLineNew > startLine &&
    oldLines[endLineOld - 1] === newLines[endLineNew - 1]
  ) {
    endLineOld--;
    endLineNew--;
  }

  // Add context lines (up to 3 before and after)
  const contextBefore = Math.max(0, startLine - 3);
  const contextAfterOld = Math.min(oldLines.length, endLineOld + 3);
  const contextAfterNew = Math.min(newLines.length, endLineNew + 3);

  // Generate hunk header
  const oldStart = contextBefore + 1;
  const oldCount = contextAfterOld - contextBefore;
  const newStart = contextBefore + 1;
  const newCount = contextAfterNew - contextBefore;
  lines.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);

  // Context before
  for (let i = contextBefore; i < startLine; i++) {
    lines.push(` ${oldLines[i]}`);
  }

  // Removed lines
  for (let i = startLine; i < endLineOld; i++) {
    lines.push(`-${oldLines[i]}`);
  }

  // Added lines
  for (let i = startLine; i < endLineNew; i++) {
    lines.push(`+${newLines[i]}`);
  }

  // Context after
  for (let i = endLineOld; i < contextAfterOld; i++) {
    lines.push(` ${oldLines[i]}`);
  }

  return lines.join("\n");
}

/**
 * Edit file tool - edits a file using search/replace (requires user approval)
 */
export const editFileTool = tool(
  async ({ filePath, searchString, replaceString }): Promise<string> => {
    try {
      // Resolve to absolute path
      const absolutePath = path.resolve(filePath);

      // Check if file exists
      try {
        await fs.access(absolutePath);
      } catch {
        return `Error: File not found: ${filePath}`;
      }

      // Read current content
      const currentContent = await fs.readFile(absolutePath, "utf-8");

      // Check if search string exists in file
      if (!currentContent.includes(searchString)) {
        return `Error: Search string not found in ${filePath}. Make sure the search string matches exactly, including whitespace and indentation.`;
      }

      // Check for multiple occurrences
      const occurrences = currentContent.split(searchString).length - 1;
      if (occurrences > 1) {
        return `Error: Search string found ${occurrences} times in ${filePath}. Please provide a more specific search string that matches exactly once.`;
      }

      // Apply the replacement
      const newContent = currentContent.replace(searchString, replaceString);

      // Generate diff for preview
      const diff = generateDiff(filePath, currentContent, newContent);

      // Request user approval with diff preview
      const approved = await requestApproval({
        operation: "write",
        target: absolutePath,
        description: `Edit file (replace ${searchString.split("\n").length} lines with ${replaceString.split("\n").length} lines)`,
        preview: diff,
      });

      if (!approved) {
        return `Operation cancelled: User denied permission to edit ${filePath}`;
      }

      // Write the modified content
      await fs.writeFile(absolutePath, newContent, "utf-8");

      return `Successfully edited ${filePath}`;
    } catch (error) {
      return `Error editing file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "edit_file",
    description:
      "Edit a file by replacing a specific string with new content. " +
      "The search string must match exactly once in the file (including whitespace and indentation). " +
      "Use this for precise edits to existing files. A diff will be shown for user approval before changes are applied.",
    schema: z.object({
      filePath: z
        .string()
        .describe("The path to the file to edit (relative or absolute)"),
      searchString: z
        .string()
        .describe(
          "The exact string to search for and replace. Must match exactly once in the file, including all whitespace and indentation."
        ),
      replaceString: z
        .string()
        .describe("The string to replace the search string with"),
    }),
  }
);
