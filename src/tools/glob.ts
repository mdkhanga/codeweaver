/**
 * Glob Tool
 *
 * Finds files matching a glob pattern
 */

import * as path from "node:path";
import { glob } from "glob";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

/** Maximum number of results to return */
const MAX_RESULTS = 100;

/**
 * Glob tool - finds files matching a pattern
 */
export const globTool = tool(
  async ({ pattern, cwd }): Promise<string> => {
    try {
      // Resolve working directory
      const workingDir = cwd ? path.resolve(cwd) : process.cwd();

      // Find matching files
      const matches = await glob(pattern, {
        cwd: workingDir,
        nodir: false,
        dot: false, // Exclude dotfiles by default
        ignore: [
          "**/node_modules/**",
          "**/.git/**",
          "**/dist/**",
          "**/build/**",
          "**/__pycache__/**",
          "**/.venv/**",
          "**/venv/**",
        ],
      });

      if (matches.length === 0) {
        return `No files found matching pattern: ${pattern}`;
      }

      // Sort matches alphabetically
      matches.sort();

      // Truncate if too many results
      let truncated = false;
      let results = matches;
      if (results.length > MAX_RESULTS) {
        results = results.slice(0, MAX_RESULTS);
        truncated = true;
      }

      // Format output
      let output = `Found ${matches.length} file(s) matching "${pattern}":\n\n`;
      output += results.join("\n");

      if (truncated) {
        output += `\n\n... (showing first ${MAX_RESULTS} of ${matches.length} results)`;
      }

      return output;
    } catch (error) {
      return `Error searching files: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "glob",
    description:
      "Find files matching a glob pattern. Use this to discover files in the codebase. " +
      "Common patterns: '**/*.ts' (all TypeScript files), 'src/**/*' (all files in src), " +
      "'*.json' (JSON files in current directory).",
    schema: z.object({
      pattern: z
        .string()
        .describe(
          "The glob pattern to match files against (e.g., '**/*.ts', 'src/**/*.js')"
        ),
      cwd: z
        .string()
        .optional()
        .describe(
          "Optional: The directory to search in (defaults to current working directory)"
        ),
    }),
  }
);
