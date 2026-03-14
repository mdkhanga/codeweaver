/**
 * Quick test script for tools
 * Run with: npx ts-node src/tools/test-tools.ts
 * Or after build: node dist/tools/test-tools.js
 */

import { readFileTool, globTool } from "./index.js";

async function testTools() {
  console.log("=== Testing Read File Tool ===\n");

  // Test reading package.json
  const readResult = await readFileTool.invoke({
    filePath: "package.json",
  });
  console.log("Reading package.json (first 10 lines shown):");
  console.log(readResult.split("\n").slice(0, 12).join("\n"));
  console.log("\n");

  // Test reading with line range
  const readRangeResult = await readFileTool.invoke({
    filePath: "package.json",
    startLine: 1,
    endLine: 5,
  });
  console.log("Reading package.json lines 1-5:");
  console.log(readRangeResult);
  console.log("\n");

  console.log("=== Testing Glob Tool ===\n");

  // Test finding TypeScript files
  const globResult = await globTool.invoke({
    pattern: "src/**/*.ts",
  });
  console.log("Finding src/**/*.ts:");
  console.log(globResult);
  console.log("\n");

  // Test finding JSON files
  const jsonResult = await globTool.invoke({
    pattern: "*.json",
  });
  console.log("Finding *.json:");
  console.log(jsonResult);

  console.log("\n=== All tests passed! ===");
}

testTools().catch(console.error);
