/**
 * Project Type Detection
 *
 * Detects the type of project based on marker files and structure.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** Detected project information */
export interface ProjectInfo {
  /** Project name (from package.json, pyproject.toml, etc.) */
  name: string | null;
  /** Detected project type(s) */
  types: ProjectType[];
  /** Primary language(s) */
  languages: string[];
  /** Detected frameworks */
  frameworks: string[];
  /** Package manager (npm, yarn, pnpm, pip, cargo, etc.) */
  packageManager: string | null;
  /** Entry points found */
  entryPoints: string[];
  /** Test framework detected */
  testFramework: string | null;
}

/** Project type identifiers */
export type ProjectType =
  | "node"
  | "python"
  | "rust"
  | "go"
  | "java"
  | "typescript"
  | "react"
  | "vue"
  | "angular"
  | "nextjs"
  | "express"
  | "fastapi"
  | "django"
  | "flask"
  | "unknown";

/** Marker files that indicate project types */
const PROJECT_MARKERS: Record<string, { types: ProjectType[]; languages: string[] }> = {
  "package.json": { types: ["node"], languages: ["javascript"] },
  "tsconfig.json": { types: ["typescript"], languages: ["typescript"] },
  "pyproject.toml": { types: ["python"], languages: ["python"] },
  "setup.py": { types: ["python"], languages: ["python"] },
  "requirements.txt": { types: ["python"], languages: ["python"] },
  "Cargo.toml": { types: ["rust"], languages: ["rust"] },
  "go.mod": { types: ["go"], languages: ["go"] },
  "pom.xml": { types: ["java"], languages: ["java"] },
  "build.gradle": { types: ["java"], languages: ["java"] },
  "Gemfile": { types: ["unknown"], languages: ["ruby"] },
  "composer.json": { types: ["unknown"], languages: ["php"] },
};

/** Framework markers in package.json dependencies */
const FRAMEWORK_MARKERS: Record<string, { framework: string; types: ProjectType[] }> = {
  react: { framework: "React", types: ["react"] },
  "react-dom": { framework: "React", types: ["react"] },
  vue: { framework: "Vue", types: ["vue"] },
  "@angular/core": { framework: "Angular", types: ["angular"] },
  next: { framework: "Next.js", types: ["nextjs", "react"] },
  express: { framework: "Express", types: ["express"] },
  fastify: { framework: "Fastify", types: ["node"] },
  koa: { framework: "Koa", types: ["node"] },
  nestjs: { framework: "NestJS", types: ["node", "typescript"] },
  "@nestjs/core": { framework: "NestJS", types: ["node", "typescript"] },
};

/** Python framework markers */
const PYTHON_FRAMEWORK_MARKERS: Record<string, string> = {
  fastapi: "FastAPI",
  django: "Django",
  flask: "Flask",
  starlette: "Starlette",
  tornado: "Tornado",
  aiohttp: "aiohttp",
};

/** Test framework markers */
const TEST_MARKERS: Record<string, string> = {
  jest: "Jest",
  mocha: "Mocha",
  vitest: "Vitest",
  pytest: "pytest",
  unittest: "unittest",
  "testing-library": "Testing Library",
  "@testing-library/react": "Testing Library",
  playwright: "Playwright",
  cypress: "Cypress",
};

/**
 * Detect project type and info from a directory
 */
export function detectProject(rootPath: string): ProjectInfo {
  const info: ProjectInfo = {
    name: null,
    types: [],
    languages: [],
    frameworks: [],
    packageManager: null,
    entryPoints: [],
    testFramework: null,
  };

  // Check for marker files
  for (const [file, markers] of Object.entries(PROJECT_MARKERS)) {
    if (fs.existsSync(path.join(rootPath, file))) {
      info.types.push(...markers.types);
      info.languages.push(...markers.languages);
    }
  }

  // Analyze package.json if it exists
  const packageJsonPath = path.join(rootPath, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

      // Get project name
      info.name = packageJson.name || null;

      // Check for entry points
      if (packageJson.main) info.entryPoints.push(packageJson.main);
      if (packageJson.bin) {
        if (typeof packageJson.bin === "string") {
          info.entryPoints.push(packageJson.bin);
        } else {
          info.entryPoints.push(...Object.values(packageJson.bin as Record<string, string>));
        }
      }

      // Check dependencies for frameworks
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      for (const [dep, markers] of Object.entries(FRAMEWORK_MARKERS)) {
        if (dep in allDeps) {
          if (!info.frameworks.includes(markers.framework)) {
            info.frameworks.push(markers.framework);
          }
          info.types.push(...markers.types);
        }
      }

      // Check for test frameworks
      for (const [dep, testFramework] of Object.entries(TEST_MARKERS)) {
        if (dep in allDeps) {
          info.testFramework = testFramework;
          break;
        }
      }

      // Detect package manager
      if (fs.existsSync(path.join(rootPath, "pnpm-lock.yaml"))) {
        info.packageManager = "pnpm";
      } else if (fs.existsSync(path.join(rootPath, "yarn.lock"))) {
        info.packageManager = "yarn";
      } else if (fs.existsSync(path.join(rootPath, "bun.lockb"))) {
        info.packageManager = "bun";
      } else if (fs.existsSync(path.join(rootPath, "package-lock.json"))) {
        info.packageManager = "npm";
      }
    } catch {
      // Invalid package.json
    }
  }

  // Analyze pyproject.toml if it exists
  const pyprojectPath = path.join(rootPath, "pyproject.toml");
  if (fs.existsSync(pyprojectPath)) {
    try {
      const content = fs.readFileSync(pyprojectPath, "utf-8");

      // Extract project name (basic TOML parsing)
      const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
      if (nameMatch && !info.name) {
        info.name = nameMatch[1];
      }

      // Check for Python frameworks
      for (const [marker, framework] of Object.entries(PYTHON_FRAMEWORK_MARKERS)) {
        if (content.includes(marker)) {
          if (!info.frameworks.includes(framework)) {
            info.frameworks.push(framework);
          }
        }
      }

      // Check for pytest
      if (content.includes("pytest")) {
        info.testFramework = "pytest";
      }

      info.packageManager = "pip";
    } catch {
      // Invalid pyproject.toml
    }
  }

  // Check requirements.txt for Python frameworks
  const requirementsPath = path.join(rootPath, "requirements.txt");
  if (fs.existsSync(requirementsPath)) {
    try {
      const content = fs.readFileSync(requirementsPath, "utf-8").toLowerCase();
      for (const [marker, framework] of Object.entries(PYTHON_FRAMEWORK_MARKERS)) {
        if (content.includes(marker)) {
          if (!info.frameworks.includes(framework)) {
            info.frameworks.push(framework);
          }
        }
      }
      if (!info.packageManager) {
        info.packageManager = "pip";
      }
    } catch {
      // Invalid requirements.txt
    }
  }

  // Deduplicate
  info.types = [...new Set(info.types)];
  info.languages = [...new Set(info.languages)];

  // Set unknown if no types detected
  if (info.types.length === 0) {
    info.types.push("unknown");
  }

  return info;
}

/**
 * Format project info as a readable string
 */
export function formatProjectInfo(info: ProjectInfo): string {
  const lines: string[] = [];

  if (info.name) {
    lines.push(`Project: ${info.name}`);
  }

  if (info.types.length > 0 && info.types[0] !== "unknown") {
    lines.push(`Type: ${info.types.join(", ")}`);
  }

  if (info.languages.length > 0) {
    lines.push(`Languages: ${info.languages.join(", ")}`);
  }

  if (info.frameworks.length > 0) {
    lines.push(`Frameworks: ${info.frameworks.join(", ")}`);
  }

  if (info.packageManager) {
    lines.push(`Package Manager: ${info.packageManager}`);
  }

  if (info.testFramework) {
    lines.push(`Test Framework: ${info.testFramework}`);
  }

  if (info.entryPoints.length > 0) {
    lines.push(`Entry Points: ${info.entryPoints.join(", ")}`);
  }

  return lines.join("\n");
}
