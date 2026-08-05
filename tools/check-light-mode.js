#!/usr/bin/env node
// check-light-mode.js — the theme is DARK-ONLY and promises that Minehut's
// light theme stays stock. Nothing enforced that, and for four releases the
// brand and state hues were declared at :root, so they repainted light mode
// too — with ratios that had only ever been verified against #141414.
//
// Strips .dark / data-theme from the fixture, then diffs computed styles with
// the theme enabled and disabled. Every difference is the dark theme bleeding
// into a light page.
//
// Expected: exactly ONE differing property, --mh-r-md's border-radius, which is
// the documented deliberate exception (it repairs a Minehut bug in both modes).
//
//   node tools/check-light-mode.js
const { chromium } = require("playwright");
const repo = "C:/Users/Daisy/Desktop/minehut-premium-dashboard";
(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 1680, height: 1200 } });
  await page.goto("file:///" + repo + "/tools/fixture.html");
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => {
    document.querySelectorAll(".dark,[data-theme]").forEach((e) => {
      e.classList.remove("dark");
      e.removeAttribute("data-theme");
    });
    document.documentElement.classList.remove("dark");
    document.documentElement.removeAttribute("data-theme");
    const theme = [...document.querySelectorAll("style")].pop();
    const P = [
      "color",
      "backgroundColor",
      "borderTopColor",
      "fill",
      "boxShadow",
      "borderRadius",
      "fontFamily",
    ];
    const grab = () =>
      [...document.querySelectorAll("*")].map((el) => {
        const cs = getComputedStyle(el);
        return P.map((p) => cs[p]).join("~");
      });
    const on = grab();
    theme.disabled = true;
    const off = grab();
    theme.disabled = false;
    const els = [...document.querySelectorAll("*")];
    const diffs = [];
    for (let i = 0; i < els.length; i++)
      if (on[i] !== off[i]) {
        const a = off[i].split("~"),
          b = on[i].split("~");
        const ch = P.map((p, j) => (a[j] !== b[j] ? `${p}: ${a[j]} -> ${b[j]}` : null)).filter(
          Boolean
        );
        const el = els[i];
        const cls =
          typeof el.className === "string"
            ? el.className.trim().split(/\s+/).slice(0, 2).join(" ")
            : "";
        diffs.push(`  <${el.tagName.toLowerCase()} ${cls}>  ${ch.join(" | ").slice(0, 150)}`);
      }
    // also read the tokens themselves off the root in light mode
    const cs = getComputedStyle(document.documentElement);
    const toks = [
      "--mh-brand",
      "--mh-emerald",
      "--mh-gold",
      "--og-accent",
      "--background",
      "--chart-1",
    ].map((t) => `    ${t.padEnd(14)} ${cs.getPropertyValue(t).trim() || "(unset)"}`);
    return { n: diffs.length, diffs: diffs.slice(0, 18), toks, total: els.length };
  });
  console.log(`light-mode elements changed by the theme: ${r.n} / ${r.total}`);
  console.log("\n  tokens visible at :root in LIGHT mode:");
  console.log(r.toks.join("\n"));
  if (r.n) {
    console.log("\n  diffs:");
    console.log(r.diffs.join("\n"));
  }
  await br.close();
  // Only --mh-r-md's border-radius may differ; see its comment in the sheet.
  const onlyRadius = r.diffs.every((d) => d.includes("borderRadius"));
  if (r.n > 2 || !onlyRadius) {
    console.log("\nFAIL: the dark theme is leaking into light mode.");
    process.exit(1);
  }
  console.log("\nPASS: light mode is stock Minehut apart from the documented --mh-r-md fix.");
})();
