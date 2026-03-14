#!/usr/bin/env node

/**
 * mycoder-agent - AI coding agent
 *
 * An AI agent that understands codebases, answers questions,
 * and generates/modifies code based on user instructions.
 */

import { startRepl } from "./cli/repl.js";

async function main(): Promise<void> {
  await startRepl();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
