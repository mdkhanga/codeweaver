/**
 * REPL (Read-Eval-Print Loop) for the coding agent
 */

import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { display } from "./display.js";
import {
  loadConfig,
  validateConfig,
  formatConfigForDisplay,
  type RuntimeConfig,
} from "../config/index.js";
import { createLLM } from "../llm/index.js";
import { AgentRunner, type ProjectContext } from "../agent/index.js";
import { scanDirectory, formatFileTree, detectProject } from "../context/index.js";
import { setReadlineInterface } from "../tools/index.js";

const VERSION = "0.1.0";

/** Runtime configuration - loaded at startup */
let runtimeConfig: RuntimeConfig;

/** Agent runner instance - handles tool-augmented conversations */
let agent: AgentRunner | null = null;

/** Built-in commands that the REPL handles directly */
const COMMANDS: Record<string, { description: string; handler: () => boolean }> = {
  "/help": {
    description: "Show available commands",
    handler: () => {
      display.section("Available Commands");
      for (const [cmd, { description }] of Object.entries(COMMANDS)) {
        console.log(`  ${cmd.padEnd(12)} - ${description}`);
      }
      display.newline();
      display.dim("Type any other text to chat with the agent.");
      display.dim("The agent can use tools to read files and explore the codebase.");
      return true; // continue REPL
    },
  },
  "/config": {
    description: "Show current configuration",
    handler: () => {
      display.section("Configuration");
      console.log(formatConfigForDisplay(runtimeConfig));
      return true;
    },
  },
  "/usage": {
    description: "Show token usage for this session",
    handler: () => {
      if (agent) {
        const usage = agent.totalUsage;
        display.section("Session Token Usage");
        console.log(`  Input tokens:  ${usage.inputTokens.toLocaleString()}`);
        console.log(`  Output tokens: ${usage.outputTokens.toLocaleString()}`);
        console.log(`  Total tokens:  ${(usage.inputTokens + usage.outputTokens).toLocaleString()}`);
      } else {
        display.warn("No active agent.");
      }
      return true;
    },
  },
  "/clear": {
    description: "Clear conversation history",
    handler: () => {
      if (agent) {
        agent.clear();
        display.success("Conversation history cleared.");
      } else {
        display.warn("No active agent.");
      }
      return true;
    },
  },
  "/quit": {
    description: "Exit the agent",
    handler: () => {
      // Show final usage before exit
      if (agent) {
        const usage = agent.totalUsage;
        if (usage.inputTokens > 0 || usage.outputTokens > 0) {
          display.dim(`Session total: ${usage.inputTokens.toLocaleString()} in / ${usage.outputTokens.toLocaleString()} out tokens`);
        }
      }
      display.info("Goodbye!");
      return false; // exit REPL
    },
  },
  "/exit": {
    description: "Exit the agent (alias for /quit)",
    handler: () => COMMANDS["/quit"].handler(),
  },
};

/**
 * Handle user input - either a command or a message for the agent
 * Returns false if the REPL should exit
 */
async function handleInput(userInput: string): Promise<boolean> {
  const trimmed = userInput.trim();

  if (!trimmed) {
    return true; // empty input, continue
  }

  // Check for built-in commands
  if (trimmed.startsWith("/")) {
    const command = COMMANDS[trimmed.toLowerCase()];
    if (command) {
      return command.handler();
    } else {
      display.warn(`Unknown command: ${trimmed}`);
      display.dim("Type /help for available commands.");
      return true;
    }
  }

  // Send to agent
  if (!agent) {
    display.error("Agent not configured. Check your API keys with /config");
    return true;
  }

  try {
    display.newline();

    // Run agent (non-streaming for now due to tool calls)
    const result = await agent.run(trimmed);

    // Display response
    console.log(result.response);
    display.newline();
    display.dim(`[tokens: ${result.usage.inputTokens.toLocaleString()} in / ${result.usage.outputTokens.toLocaleString()} out]`);
    display.newline();
  } catch (error) {
    display.newline();
    display.error(`Agent error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return true;
}

/**
 * Start the interactive REPL
 */
export async function startRepl(): Promise<void> {
  // Load configuration
  runtimeConfig = loadConfig();

  display.banner(`mycoder-agent v${VERSION}`);
  display.newline();

  // Validate configuration and show warnings
  const errors = validateConfig(runtimeConfig);
  if (errors.length > 0) {
    for (const error of errors) {
      display.warn(error);
    }
    display.newline();
  }

  // Scan project structure
  const cwd = process.cwd();
  display.dim("Scanning project structure...");
  const projectInfo = detectProject(cwd);
  const fileTree = scanDirectory(cwd, { maxDepth: 3, maxFiles: 100 });
  const fileTreeStr = formatFileTree(fileTree);

  const projectContext: ProjectContext = {
    workingDirectory: cwd,
    projectInfo,
    fileTree: fileTreeStr,
  };

  // Show detected project info
  if (projectInfo.name) {
    display.info(`Project: ${projectInfo.name}`);
  }
  if (projectInfo.types.length > 0 && projectInfo.types[0] !== "unknown") {
    display.dim(`Type: ${projectInfo.types.join(", ")} | Languages: ${projectInfo.languages.join(", ")}`);
  }
  if (projectInfo.frameworks.length > 0) {
    display.dim(`Frameworks: ${projectInfo.frameworks.join(", ")}`);
  }
  display.newline();

  // Try to create LLM and agent
  try {
    const llm = createLLM(runtimeConfig);
    agent = new AgentRunner(llm, projectContext);
    display.success(`Agent ready: ${runtimeConfig.config.llm.provider}/${runtimeConfig.config.llm.model}`);
    display.dim("Tools available: read_file, glob, write_file, edit_file");
  } catch (error) {
    display.warn(`Agent not available: ${error instanceof Error ? error.message : String(error)}`);
    display.dim("You can still use commands. Set API keys in .env to enable the agent.");
  }

  display.newline();
  display.info("AI coding agent ready. Type /help for commands.");
  display.newline();

  const rl = readline.createInterface({
    input,
    output,
    prompt: "you> ",
  });

  // Share readline with approval system
  setReadlineInterface(rl);

  rl.prompt();

  rl.on("line", async (line) => {
    const shouldContinue = await handleInput(line);
    if (shouldContinue) {
      rl.prompt();
    } else {
      rl.close();
    }
  });

  rl.on("close", () => {
    process.exit(0);
  });

  // Handle Ctrl+C gracefully
  rl.on("SIGINT", () => {
    display.newline();
    display.info("Interrupted. Goodbye!");
    rl.close();
  });
}
