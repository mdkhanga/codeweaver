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
import { createLLM, Conversation } from "../llm/index.js";

const VERSION = "0.1.0";

/** Runtime configuration - loaded at startup */
let runtimeConfig: RuntimeConfig;

/** Conversation instance - maintains chat history */
let conversation: Conversation | null = null;

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
      if (conversation) {
        const usage = conversation.sessionUsage;
        display.section("Session Token Usage");
        console.log(`  Requests:      ${usage.requestCount}`);
        console.log(`  Input tokens:  ${usage.totalInputTokens.toLocaleString()}`);
        console.log(`  Output tokens: ${usage.totalOutputTokens.toLocaleString()}`);
        console.log(`  Total tokens:  ${(usage.totalInputTokens + usage.totalOutputTokens).toLocaleString()}`);
      } else {
        display.warn("No active conversation.");
      }
      return true;
    },
  },
  "/clear": {
    description: "Clear conversation history",
    handler: () => {
      if (conversation) {
        conversation.clear();
        display.success("Conversation history cleared.");
      } else {
        display.warn("No active conversation.");
      }
      return true;
    },
  },
  "/quit": {
    description: "Exit the agent",
    handler: () => {
      // Show final usage before exit
      if (conversation) {
        const usage = conversation.sessionUsage;
        if (usage.requestCount > 0) {
          display.dim(`Session total: ${usage.totalInputTokens.toLocaleString()} in / ${usage.totalOutputTokens.toLocaleString()} out tokens`);
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

  // Send to LLM with streaming
  if (!conversation) {
    display.error("LLM not configured. Check your API keys with /config");
    return true;
  }

  try {
    display.newline();

    // Stream response token by token
    const response = await conversation.chatStream(trimmed, (token) => {
      process.stdout.write(token);
    });

    // End the streamed line and show usage
    display.newline();
    display.newline();
    display.dim(`[tokens: ${response.usage.inputTokens.toLocaleString()} in / ${response.usage.outputTokens.toLocaleString()} out]`);
    display.newline();
  } catch (error) {
    display.newline();
    display.error(`LLM error: ${error instanceof Error ? error.message : String(error)}`);
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

  // Try to create LLM and conversation
  try {
    const llm = createLLM(runtimeConfig);
    conversation = new Conversation(llm);
    display.success(`LLM ready: ${runtimeConfig.config.llm.provider}/${runtimeConfig.config.llm.model}`);
  } catch (error) {
    display.warn(`LLM not available: ${error instanceof Error ? error.message : String(error)}`);
    display.dim("You can still use commands. Set API keys in .env to enable chat.");
  }

  display.newline();
  display.info("AI coding agent ready. Type /help for commands.");
  display.newline();

  const rl = readline.createInterface({
    input,
    output,
    prompt: "you> ",
  });

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
