/**
 * Display utilities for CLI output formatting
 */

import chalk from "chalk";

export const display = {
  /** Print a banner/header */
  banner(text: string): void {
    const line = "=".repeat(60);
    console.log(chalk.cyan(line));
    console.log(chalk.cyan.bold(`  ${text}`));
    console.log(chalk.cyan(line));
  },

  /** Print an info message */
  info(text: string): void {
    console.log(chalk.blue(`ℹ ${text}`));
  },

  /** Print a success message */
  success(text: string): void {
    console.log(chalk.green(`✓ ${text}`));
  },

  /** Print a warning message */
  warn(text: string): void {
    console.log(chalk.yellow(`⚠ ${text}`));
  },

  /** Print an error message */
  error(text: string): void {
    console.log(chalk.red(`✗ ${text}`));
  },

  /** Print agent response */
  agent(text: string): void {
    console.log(chalk.white(text));
  },

  /** Print a section header */
  section(title: string): void {
    console.log();
    console.log(chalk.bold.underline(title));
  },

  /** Print a subtle/dimmed message */
  dim(text: string): void {
    console.log(chalk.dim(text));
  },

  /** Print a newline */
  newline(): void {
    console.log();
  },
};
