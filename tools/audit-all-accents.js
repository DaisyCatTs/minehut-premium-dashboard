#!/usr/bin/env node
// audit-all-accents.js — the theme has to be correct in EVERY accent, not just
// the default. This renders the component fixture once per preset, runs the same
// contrast and unthemed-colour checks against each, and fails on any regression.
//
// It exists because a value that only passes for blue is a real defect that
// single-accent verification cannot see.
//
//   node tools/audit-all-accents.js

const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const repo = path.resolve(__dirname, "..");
const audit = fs.readFileSync(path.join(repo, "tools", "audit-page.js"), "utf8");

// read the presets straight from the stylesheet's @var block — one source of truth
const css = fs.readFileSync(path.join(repo, "minehut-premium-dashboard.user.css"), "utf8");
const meta = /@var\s+select\s+accentHsl\s+"[^"]*"\s*\{([\s\S]*?)\}/.exec(css);
if (!meta) {
  console.error("error: could not find the accentHsl @var block");
  process.exit(1);
}
const presets = [...meta[1].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)].map((m) => ({
  name: m[1].replace(/\*$/, "").split(":")[0],
  isDefault: m[1].endsWith("*"),
  value: m[2],
}));

(async () => {
  const browser = await chromium.launch();
  let failures = 0;

  console.log(`auditing ${presets.length} accents against the component fixture\n`);
  console.log("  accent     contrast fails   unthemed bg   unthemed fg   page errors");
  console.log("  " + "-".repeat(68));

  for (const p of presets) {
    // rebuild the fixture with this accent injected, exactly as Stylus would
    execFileSync("node", [path.join(repo, "tools", "build-fixture.js"), "--accent", p.name], {
      cwd: repo,
      stdio: "pipe",
    });

    const page = await browser.newPage({ viewport: { width: 1680, height: 1400 } });
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
    await page.goto("file:///" + path.join(repo, "tools", "fixture.html").replace(/\\/g, "/"));
    await page.waitForTimeout(250);

    const out = await page.evaluate(`(() => {
      const lines = [];
      const orig = console.log;
      console.log = (...a) => lines.push(a.join(" "));
      window.copy = () => {};
      ${audit}
      console.log = orig;
      return lines.join("\\n");
    })()`);

    const fails = +(/(\d+) failing element/.exec(out) || [0, 0])[1];
    const ubg = +(/UNTHEMED BACKGROUNDS === (\d+)/.exec(out) || [0, 0])[1];
    const ufg = +(/UNTHEMED TEXT COLOURS === (\d+)/.exec(out) || [0, 0])[1];

    // Known-intentional baseline. Every "unthemed" entry here is an ALPHA
    // COMPOSITE — `bg-primary/10` icon tiles, `bg-destructive/10`, and the
    // meter fill — which are themed but resolve to a blended hex the audit
    // cannot match against a token. The foreground pair is on-destructive ink
    // and the disabled tier. Raised from 2 to 4 when the wizard radio-cards
    // joined the fixture: they add two more bg-primary/10 tiles, and one of
    // them sits on the tinted checked-card surface so it composites to a
    // second distinct hex. Contrast failures remain the real gate at 0.
    const bad = fails > 0 || ubg > 4 || ufg > 2 || errs.length > 0;
    if (bad) failures++;

    console.log(
      `  ${(p.name + (p.isDefault ? " *" : "")).padEnd(11)}` +
        `${String(fails).padStart(8)}` +
        `${String(ubg).padStart(14)}` +
        `${String(ufg).padStart(14)}` +
        `${String(errs.length).padStart(14)}` +
        (bad ? "   <-- REGRESSION" : "")
    );

    if (bad && fails > 0) {
      const detail = out.split("CONTRAST FAILURES")[1] || "";
      detail
        .split("\n")
        .slice(1, 6)
        .filter((l) => l.trim())
        .forEach((l) => console.log("        " + l.trim()));
    }
    await page.close();
  }

  // leave the fixture on the default so nothing downstream is surprised
  const def = presets.find((p) => p.isDefault) || presets[0];
  execFileSync("node", [path.join(repo, "tools", "build-fixture.js"), "--accent", def.name], {
    cwd: repo,
    stdio: "pipe",
  });

  await browser.close();
  console.log();
  if (failures) {
    console.log(`FAIL: ${failures} accent(s) regressed.`);
    process.exit(1);
  }
  console.log(`PASS: all ${presets.length} accents render clean.`);
})();
