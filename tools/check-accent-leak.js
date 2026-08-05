#!/usr/bin/env node
// check-accent-leak.js — finds anything that should follow the accent but does
// not. Renders the fixture under two maximally-different presets (blue and
// amber) and diffs every computed colour; whatever stayed blue under amber is
// either a hardcoded literal or a token that never got wired to --primary.
//
// This is how the console's ansi-4/12 were caught: they were literal hex, so
// every non-blue theme still had a console speaking blue.
//
// The two --mh-amethyst hits are EXPECTED — identity hues are deliberately
// independent of the accent, as are the five chart series.
//
//   node tools/check-accent-leak.js
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const repo = "C:/Users/Daisy/Desktop/minehut-premium-dashboard";

const PROPS = [
  "color",
  "backgroundColor",
  "borderTopColor",
  "borderLeftColor",
  "outlineColor",
  "boxShadow",
  "fill",
  "stroke",
  "textDecorationColor",
  "caretColor",
];

async function snap(browser, accent) {
  execFileSync("node", [repo + "/tools/build-fixture.js", "--accent", accent], {
    cwd: repo,
    stdio: "pipe",
  });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1400 } });
  await page.goto("file:///" + repo + "/tools/fixture.html");
  await page.waitForTimeout(200);
  const out = await page.evaluate((props) => {
    const map = {};
    const p2 = (el) => {
      const parts = [];
      for (let n = el; n && n.nodeType === 1 && parts.length < 4; n = n.parentElement)
        parts.unshift(
          n.tagName.toLowerCase() +
            (n.className && typeof n.className === "string"
              ? "." + n.className.trim().split(/\s+/).slice(0, 2).join(".")
              : "")
        );
      return parts.join(">");
    };
    let i = 0;
    for (const el of document.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      const key = i++ + "|" + p2(el);
      map[key] = props.map((p) => cs[p]).join(" ~ ");
      for (const pe of ["::before", "::after"]) {
        const c = getComputedStyle(el, pe);
        if (c.content !== "none") map[key + pe] = props.map((p) => c[p]).join(" ~ ");
      }
    }
    return map;
  }, PROPS);
  await page.close();
  return out;
}

const isBlue = (s) => {
  const re = /rgba?\((\d+),\s*(\d+),\s*(\d+)/g;
  let m;
  while ((m = re.exec(s))) {
    const r = +m[1],
      g = +m[2],
      b = +m[3];
    if (b > r + 28 && b > 90 && Math.abs(r - g) < 60) return `rgb(${r},${g},${b})`;
  }
  return null;
};

(async () => {
  const br = await chromium.launch();
  const blue = await snap(br, "blue");
  const amber = await snap(br, "amber");
  await br.close();
  const leaks = [];
  for (const k of Object.keys(blue)) {
    if (!(k in amber) || blue[k] !== amber[k]) continue;
    const hit = isBlue(amber[k]);
    if (hit) leaks.push({ k, hit, v: amber[k] });
  }
  console.log(`elements sampled: ${Object.keys(blue).length}`);
  console.log(
    `followed the accent: ${Object.keys(blue).filter((k) => k in amber && blue[k] !== amber[k]).length}`
  );
  console.log(`\n=== stayed blue under an amber accent (${leaks.length}) ===`);
  const seen = new Set();
  for (const l of leaks) {
    const sig = l.k.split("|")[1] + l.hit;
    if (seen.has(sig)) continue;
    seen.add(sig);
    console.log(`  ${l.hit.padEnd(20)} ${l.k.split("|")[1].slice(0, 88)}`);
  }
  if (!leaks.length) console.log("  none");
  // --mh-amethyst (#ad97fa) is an IDENTITY hue and independent of the accent by
  // design, as are the five chart series. Anything else that stays blue when the
  // accent is amber is a hardcoded literal that never got wired to --primary.
  const unexpected = leaks.filter((l) => l.hit !== "rgb(173,151,250)");
  if (unexpected.length) {
    console.log(`\nFAIL: ${unexpected.length} value(s) do not follow the accent.`);
    process.exit(1);
  }
  console.log("\nPASS: every accent-derived value follows the accent.");
})();
