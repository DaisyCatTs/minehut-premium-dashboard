#!/usr/bin/env node
// check-css.js — structural sanity for the userstyle. No build tooling in this repo,
// so this covers the failure modes an editor would otherwise catch silently:
// unbalanced braces/parens, an unterminated comment or string, a stray declaration
// outside any rule, and unknown at-rules.
//
// Usage: node check-css.js <file.css>

const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("usage: node check-css.js <file.css>");
  process.exit(2);
}
const src = fs.readFileSync(file, "utf8");

const errors = [];
const warn = [];

let line = 1;
let depth = 0;
let paren = 0;
let inComment = false;
let commentStart = 0;
let quote = null;
let quoteStart = 0;
const braceStack = [];

for (let i = 0; i < src.length; i++) {
  const c = src[i];
  const next = src[i + 1];
  if (c === "\n") line++;

  if (inComment) {
    if (c === "*" && next === "/") {
      inComment = false;
      i++;
    }
    continue;
  }
  if (quote) {
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === quote) quote = null;
    else if (c === "\n") {
      errors.push(`line ${line}: newline inside ${quote}-quoted string opened at line ${quoteStart}`);
      quote = null;
    }
    continue;
  }

  if (c === "/" && next === "*") {
    inComment = true;
    commentStart = line;
    i++;
    continue;
  }
  if (c === '"' || c === "'") {
    quote = c;
    quoteStart = line;
    continue;
  }
  if (c === "\\") {
    i++;
    continue;
  }

  if (c === "(") paren++;
  else if (c === ")") {
    paren--;
    if (paren < 0) {
      errors.push(`line ${line}: unmatched ')'`);
      paren = 0;
    }
  } else if (c === "{") {
    braceStack.push(line);
    depth++;
  } else if (c === "}") {
    depth--;
    braceStack.pop();
    if (depth < 0) {
      errors.push(`line ${line}: unmatched '}'`);
      depth = 0;
    }
  }
}

if (inComment) errors.push(`unterminated /* comment opened at line ${commentStart}`);
if (quote) errors.push(`unterminated ${quote}-quoted string opened at line ${quoteStart}`);
if (paren !== 0) errors.push(`unbalanced parentheses: ${paren > 0 ? paren + " unclosed '('" : "extra ')'"}`);
if (depth !== 0) {
  errors.push(`unbalanced braces: ${depth} unclosed '{' (outermost opened at line ${braceStack[0]})`);
}

// Strip comments/strings, then look for structural smells.
const bare = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/"(?:\\.|[^"\\])*"/g, '""')
  .replace(/'(?:\\.|[^'\\])*'/g, "''");

// at-rules used, so a typo like @suports shows up
const atRules = [...new Set([...bare.matchAll(/@([a-zA-Z-]+)/g)].map((m) => m[1]))];
const known = new Set([
  "-moz-document", "media", "supports", "keyframes", "font-face", "import",
  "charset", "namespace", "page", "layer", "property", "container", "scope",
]);
for (const a of atRules) if (!known.has(a)) warn.push(`unknown at-rule: @${a}`);

// A declaration sitting at depth 0 (outside every block) is almost always a
// mis-placed brace rather than intent.
let d = 0;
let ln = 1;
for (let i = 0; i < bare.length; i++) {
  const c = bare[i];
  if (c === "\n") ln++;
  else if (c === "{") d++;
  else if (c === "}") d--;
  else if (c === ";" && d === 0) {
    const seg = bare.slice(Math.max(0, i - 90), i).split(/[{}]/).pop().trim();
    if (seg && !seg.startsWith("@")) warn.push(`line ~${ln}: declaration outside any block: "${seg.slice(0, 60)}"`);
  }
}

// Counts must come from real CSS, not prose. Documenting a removed construct
// ("the six :has() rules are gone") would otherwise keep reporting it forever.
const code = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
const rules = (bare.match(/\{/g) || []).length;
const imp = (code.match(/!important/g) || []).length;
const risk = (src.match(/@risk\s+[DSFX]/g) || []).length;
const has = (code.match(/:has\(/g) || []).length;
const substr = (code.match(/\[class\*=/g) || []).length;

// A declaration carrying !important must have a policy tag on the same line.
let untagged = 0;
const codeLines = code.split("\n");
const srcLines = src.split("\n");
for (let i = 0; i < codeLines.length; i++) {
  if (codeLines[i].includes("!important") && !/!imp:(token|dark-util|bang|a11y)/.test(srcLines[i])) {
    untagged++;
    if (untagged <= 10) errors.push(`line ${i + 1}: untagged !important — ${srcLines[i].trim().slice(0, 70)}`);
  }
}
const tagged = imp - untagged;

console.log(`${file}`);
console.log(`  lines ${src.split("\n").length}   blocks ${rules}   :has() ${has}   [class*=] ${substr}`);
console.log(`  !important ${imp}   tagged ${tagged}   @risk markers ${risk}`);
if (warn.length) {
  console.log(`\n  warnings (${warn.length}):`);
  for (const w of warn.slice(0, 20)) console.log(`    - ${w}`);
}
if (errors.length) {
  console.log(`\n  ERRORS (${errors.length}):`);
  for (const e of errors) console.log(`    ! ${e}`);
  process.exit(1);
}
console.log("\n  structure OK");
