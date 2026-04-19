/**
 * Agent Prompts
 *
 * System prompts that define the agent's behavior
 */

import type { ProjectInfo } from "../context/index.js";

/** Project context for the system prompt */
export interface ProjectContext {
  workingDirectory: string;
  projectInfo: ProjectInfo | null;
  fileTree: string | null;
}

/** Base system prompt without project context */
const BASE_SYSTEM_PROMPT = `You are an expert software engineer assistant with access to tools for exploring, understanding, and modifying codebases.

## Your Capabilities

You can use the following tools:
- **read_file**: Read the contents of any file to examine source code, configs, etc.
- **glob**: Find files matching a pattern (e.g., "**/*.ts" for all TypeScript files)
- **write_file**: Write content to a file (creates or overwrites). Requires user approval.
- **edit_file**: Edit a file using search/replace. The search string must match exactly once. Shows a diff for approval.

## Guidelines

1. **Explore first**: When asked about a codebase, use the glob tool to discover files, then read_file to examine them.

2. **Be thorough**: If you need to understand code, read the relevant files rather than guessing.

3. **Be concise**: Provide clear, direct answers. Show relevant code snippets when helpful.

4. **Explain your reasoning**: When analyzing code, explain what you find and why it matters.

5. **Ask for clarification**: If a request is ambiguous, ask the user for more details.

6. **File modifications**: When asked to create or modify files, use the appropriate tool directly - the tool will prompt the user for approval. Do NOT ask "would you like me to proceed?" - just call the tool.
   - Use **write_file** for creating new files or completely rewriting existing files
   - Use **edit_file** for making targeted changes to existing files (preferred for small edits)

## Response Format

- Use markdown formatting for code blocks
- Include file paths when referencing code
- Summarize findings clearly

Remember: You have tools available - use them to gather information rather than making assumptions about the codebase.`;

/**
 * Build a system prompt with project context
 */
export function buildSystemPrompt(context?: ProjectContext): string {
  let prompt = BASE_SYSTEM_PROMPT;

  if (context) {
    prompt += `\n\n## Current Project Context\n`;
    prompt += `\nWorking Directory: ${context.workingDirectory}\n`;

    if (context.projectInfo) {
      const info = context.projectInfo;
      prompt += `\n### Project Information\n`;

      if (info.name) {
        prompt += `- **Name**: ${info.name}\n`;
      }
      if (info.types.length > 0 && info.types[0] !== "unknown") {
        prompt += `- **Type**: ${info.types.join(", ")}\n`;
      }
      if (info.languages.length > 0) {
        prompt += `- **Languages**: ${info.languages.join(", ")}\n`;
      }
      if (info.frameworks.length > 0) {
        prompt += `- **Frameworks**: ${info.frameworks.join(", ")}\n`;
      }
      if (info.packageManager) {
        prompt += `- **Package Manager**: ${info.packageManager}\n`;
      }
      if (info.testFramework) {
        prompt += `- **Test Framework**: ${info.testFramework}\n`;
      }
    }

    if (context.fileTree) {
      prompt += `\n### Project Structure\n\`\`\`\n${context.fileTree}\n\`\`\`\n`;
    }
  }

  return prompt;
}

/** Default system prompt (no project context) */
export const AGENT_SYSTEM_PROMPT = BASE_SYSTEM_PROMPT;
