/**
 * Approval System
 *
 * Provides a mechanism for tools to request user approval before
 * performing potentially destructive operations.
 */

import type { Interface as ReadlineInterface } from "node:readline";

/** Approval request details */
export interface ApprovalRequest {
  /** Type of operation */
  operation: "write" | "delete" | "execute";
  /** Target file or command */
  target: string;
  /** Description of what will happen */
  description: string;
  /** Content preview (for write operations) */
  preview?: string;
}

/** Approval callback function type */
export type ApprovalCallback = (request: ApprovalRequest) => Promise<boolean>;

/** Global readline interface - set by the REPL */
let readlineInterface: ReadlineInterface | null = null;

/**
 * Set the readline interface for approval prompts
 * Called by the REPL to share its readline instance
 */
export function setReadlineInterface(rl: ReadlineInterface | null): void {
  readlineInterface = rl;
}

/**
 * Display approval request info
 */
function displayApprovalRequest(request: ApprovalRequest): void {
  console.log("\n┌─────────────────────────────────────────────────────────────");
  console.log(`│ Approval Required: ${request.operation.toUpperCase()}`);
  console.log("├─────────────────────────────────────────────────────────────");
  console.log(`│ Target: ${request.target}`);
  console.log(`│ Action: ${request.description}`);

  if (request.preview) {
    console.log("├─────────────────────────────────────────────────────────────");
    console.log("│ Preview:");
    const previewLines = request.preview.split("\n").slice(0, 10);
    for (const line of previewLines) {
      console.log(`│   ${line}`);
    }
    if (request.preview.split("\n").length > 10) {
      console.log(`│   ... (${request.preview.split("\n").length - 10} more lines)`);
    }
  }

  console.log("└─────────────────────────────────────────────────────────────");
}

/**
 * Request approval for an operation
 * Returns true if approved, false if denied
 */
export async function requestApproval(request: ApprovalRequest): Promise<boolean> {
  displayApprovalRequest(request);

  if (!readlineInterface) {
    // No readline available, auto-deny for safety
    console.log("No interactive session - auto-denying for safety\n");
    return false;
  }

  return new Promise((resolve) => {
    readlineInterface!.question("Allow this operation? [y/N]: ", (answer) => {
      const approved = answer.toLowerCase().trim() === "y" || answer.toLowerCase().trim() === "yes";
      if (approved) {
        console.log("Approved\n");
      } else {
        console.log("Denied\n");
      }
      resolve(approved);
    });
  });
}
