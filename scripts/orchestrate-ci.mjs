#!/usr/bin/env node
/**
 * Headless CI orchestrator — runs tests and validates demo-novel fixture.
 */
import { execSync } from "child_process";
import { readFileSync, existsSync, readdirSync } from "fs";
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

check("demo-novel contract", () => {
  const p = join(root, "examples/demo-novel/drafts/contracts/ch01.json");
  if (!existsSync(p)) throw new Error("missing contract");
  const c = JSON.parse(readFileSync(p, "utf8"));
  if (!c.goal || !c.conflict || !c.turn || !c.exit) throw new Error("incomplete contract");
});

check("demo-novel wiki audit", () => {
  const demo = join(root, "examples/demo-novel");
  const files = [];
  function walk(dir, prefix = "") {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const abs = join(dir, e.name);
      if (e.isDirectory()) walk(abs, rel);
      else if (e.name.endsWith(".md")) files.push({ rel, text: readFileSync(abs, "utf8") });
    }
  }
  walk(demo);
  const defined = new Set();
  for (const f of files) {
    const stem = f.rel.replace(/^.*\//, "").replace(/\.md$/i, "");
    defined.add(stem.replace(/[_-]+/g, " ").toLowerCase());
    for (const m of f.text.matchAll(/^#{1,3}\s+(.+)$/gm)) defined.add(m[1].trim().toLowerCase());
  }
  const broken = [];
  for (const f of files) {
    for (const m of f.text.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g)) {
      const t = m[1].trim();
      if (!defined.has(t.toLowerCase())) broken.push(`${f.rel}:[[${t}]]`);
    }
  }
  if (broken.length) throw new Error(`broken wiki links: ${broken.join(", ")}`);
  if (!defined.has("iskra")) throw new Error("Iskra should be defined in codex");
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
