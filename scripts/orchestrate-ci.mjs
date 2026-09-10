#!/usr/bin/env node
/**
 * Headless CI orchestrator — runs tests and validates demo-novel fixture.
 */
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}:`, err.message || err);
    failed++;
  }
}

check("npm test", () => {
  execSync("npm test", { cwd: root, stdio: "inherit" });
});

check("demo-novel studio.json", () => {
  const p = join(root, "examples/demo-novel/studio.json");
  if (!existsSync(p)) throw new Error("missing");
  JSON.parse(readFileSync(p, "utf8"));
});

check("demo-novel draft", () => {
  const p = join(root, "examples/demo-novel/drafts/ch01.md");
  if (!existsSync(p)) throw new Error("missing");
  if (!readFileSync(p, "utf8").includes("Chapter")) throw new Error("unexpected content");
});

check("package version", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (!pkg.version?.match(/^\d+\.\d+\.\d+$/)) throw new Error(`bad version ${pkg.version}`);
});

if (failed) {
  console.error(`\nOrchestrator CI: ${failed} check(s) failed`);
  process.exit(1);
}

console.log("\nOrchestrator CI: all checks passed");
