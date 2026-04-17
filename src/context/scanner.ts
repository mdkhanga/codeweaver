/**
 * Project Scanner
 *
 * Walks directory tree to build a file structure overview.
 * Respects .gitignore patterns.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** Represents a file or directory in the tree */
export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

/** Scanner configuration */
export interface ScannerOptions {
  /** Maximum depth to scan (default: 5) */
  maxDepth?: number;
  /** Maximum files to include (default: 500) */
  maxFiles?: number;
  /** Additional patterns to ignore */
  ignorePatterns?: string[];
}

/** Default patterns to always ignore */
const DEFAULT_IGNORE_PATTERNS = [
  "node_modules",
  ".git",
  ".DS_Store",
  "__pycache__",
  ".pytest_cache",
  ".venv",
  "venv",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "coverage",
  ".nyc_output",
  ".cache",
  "*.log",
  "*.pyc",
  ".env",
  ".env.*",
];

/**
 * Parse .gitignore file and return patterns
 */
function parseGitignore(gitignorePath: string): string[] {
  try {
    if (!fs.existsSync(gitignorePath)) {
      return [];
    }
    const content = fs.readFileSync(gitignorePath, "utf-8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  } catch {
    return [];
  }
}

/**
 * Check if a file/directory should be ignored
 */
function shouldIgnore(name: string, ignorePatterns: string[]): boolean {
  for (const pattern of ignorePatterns) {
    // Simple pattern matching (not full gitignore spec)
    if (pattern.endsWith("/")) {
      // Directory pattern
      if (name === pattern.slice(0, -1)) return true;
    } else if (pattern.startsWith("*.")) {
      // Extension pattern
      if (name.endsWith(pattern.slice(1))) return true;
    } else if (pattern.includes("*")) {
      // Wildcard pattern - basic support
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
      if (regex.test(name)) return true;
    } else {
      // Exact match
      if (name === pattern) return true;
    }
  }
  return false;
}

/**
 * Scan a directory and build a file tree
 */
export function scanDirectory(
  rootPath: string,
  options: ScannerOptions = {}
): FileNode {
  const {
    maxDepth = 5,
    maxFiles = 500,
    ignorePatterns: extraPatterns = [],
  } = options;

  // Load .gitignore patterns
  const gitignorePath = path.join(rootPath, ".gitignore");
  const gitignorePatterns = parseGitignore(gitignorePath);
  const allIgnorePatterns = [
    ...DEFAULT_IGNORE_PATTERNS,
    ...gitignorePatterns,
    ...extraPatterns,
  ];

  let fileCount = 0;

  function scan(dirPath: string, depth: number): FileNode {
    const name = path.basename(dirPath) || dirPath;
    const node: FileNode = {
      name,
      path: dirPath,
      type: "directory",
      children: [],
    };

    if (depth > maxDepth || fileCount >= maxFiles) {
      return node;
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      // Sort: directories first, then files, alphabetically
      entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const entry of entries) {
        if (fileCount >= maxFiles) break;
        if (shouldIgnore(entry.name, allIgnorePatterns)) continue;

        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          const childNode = scan(entryPath, depth + 1);
          node.children!.push(childNode);
        } else if (entry.isFile()) {
          fileCount++;
          node.children!.push({
            name: entry.name,
            path: entryPath,
            type: "file",
          });
        }
      }
    } catch {
      // Permission denied or other error - skip
    }

    return node;
  }

  return scan(rootPath, 0);
}

/**
 * Convert file tree to a readable string representation
 */
export function formatFileTree(node: FileNode, indent: string = ""): string {
  const lines: string[] = [];

  if (indent === "") {
    // Root directory
    lines.push(node.name + "/");
  }

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const isLast = i === node.children.length - 1;
      const prefix = isLast ? "└── " : "├── ";
      const childIndent = isLast ? "    " : "│   ";

      if (child.type === "directory") {
        lines.push(indent + prefix + child.name + "/");
        lines.push(formatFileTree(child, indent + childIndent));
      } else {
        lines.push(indent + prefix + child.name);
      }
    }
  }

  return lines.filter((l) => l).join("\n");
}

/**
 * Get a flat list of all files in the tree
 */
export function getFileList(node: FileNode): string[] {
  const files: string[] = [];

  function collect(n: FileNode) {
    if (n.type === "file") {
      files.push(n.path);
    }
    if (n.children) {
      for (const child of n.children) {
        collect(child);
      }
    }
  }

  collect(node);
  return files;
}
