#!/usr/bin/env node
// check-hover.js — every interactive element must visibly react to hover, and
// nothing may become invisible when it does.
//
// Two failure modes, both shipped before this existed:
//
//   DEAD    the theme's resting rule ties with Minehut's :hover rule on
//           specificity, and a tie resolves on source order. A userstyle is
//           injected last, so the resting declaration wins and the hover does
//           nothing. `.mh-nav-item` lost its label brightening this way: the
//           theme's `& .mh-nav-item {color:…}` resolves to (0,2,0), exactly
//           matching Minehut's `.mh-nav-item:hover {color:…}`. The icon still
//           brightened because its rule carries an extra element, which made
//           the sidebar look half-responsive rather than plainly broken.
//
//   BLIND   hover paints text or an icon at under 1.5:1 against whatever is
//           actually composited behind it.
//
// Colours are resolved by painting them to a canvas and reading the pixel back,
// so oklab(), color-mix() and hsl() are all handled without parsing a colour
// space by hand — an earlier regex version reported four false positives
// because it only understood rgb().
//
//   node tools/check-hover.js

const { chromium } = require("playwright");
const path = require("path");
const repo = path.resolve(__dirname, "..").split(path.sep).join("/");

const SEL = [
  "button",
  "a[href]",
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  ".mh-nav-item",
  "summary",
].join(", ");

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 1600, height: 1600 } });
  await page.goto("file:///" + repo + "/tools/fixture.html");
  await page.waitForTimeout(250);

  const els = await page.$$(SEL);
  const dead = [];
  const blind = [];

  for (const el of els) {
    const snap = () =>
      el.evaluate((n) => {
        // Paint the colour to a 1x1 canvas and read the pixel back. This is how
        // oklab(), color-mix() and hsl() all become sRGB without parsing them.
        const resolve = (c) => {
          if (!c || c === "none") return null;
          const cv = document.createElement("canvas");
          cv.width = cv.height = 1;
          const x = cv.getContext("2d", { willReadFrequently: true });
          x.clearRect(0, 0, 1, 1);
          x.fillStyle = "#000";
          x.fillStyle = c;
          x.fillRect(0, 0, 1, 1);
          const d = x.getImageData(0, 0, 1, 1).data;
          return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
        };
        // composite the real backdrop rather than trusting the nearest ancestor
        const stack = [];
        for (let p = n; p; p = p.parentElement) {
          const c = resolve(getComputedStyle(p).backgroundColor);
          if (c && c.a > 0) stack.push(c);
          if (c && c.a > 0.98) break;
        }
        let back = { r: 9, g: 9, b: 9 };
        for (let i = stack.length - 1; i >= 0; i--) {
          const c = stack[i];
          back = {
            r: c.r * c.a + back.r * (1 - c.a),
            g: c.g * c.a + back.g * (1 - c.a),
            b: c.b * c.a + back.b * (1 - c.a),
          };
        }
        const cs = getComputedStyle(n);
        const svg = n.querySelector("svg");
        const rect = n.getBoundingClientRect();
        return {
          label: (n.textContent || "").trim().replace(/\s+/g, " ").slice(0, 26),
          cls: (typeof n.className === "string" ? n.className : "")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .join(" "),
          zero: rect.width < 1 || rect.height < 1,
          // An element covered by the fixture's dialog scrim or an open menu
          // never receives the pointer, so it would report a dead hover it does
          // not have. Ask the document what is actually on top at its centre.
          covered: (() => {
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return true;
            const top = document.elementFromPoint(cx, cy);
            return !(top && (top === n || n.contains(top) || top.contains(n)));
          })(),
          disabled:
            n.disabled === true ||
            n.getAttribute("aria-disabled") === "true" ||
            n.hasAttribute("data-disabled"),
          // An element already in a selected, active or highlighted state owns
          // its appearance; hover is not required to change it, and forcing a
          // change would make the selected state ambiguous. `data-highlighted`
          // is Radix's own keyboard/pointer highlight, so those items ARE in
          // their hover appearance already.
          settled:
            n.hasAttribute("data-highlighted") ||
            n.getAttribute("aria-checked") === "true" ||
            n.getAttribute("aria-selected") === "true" ||
            ["checked", "active", "open", "on"].includes(n.getAttribute("data-state")) ||
            n.getAttribute("data-active") === "true" ||
            // The ACTIVE TAB is marked by class, not by a state attribute:
            // Minehut ships either `.!active` or, in the bordered tab strip,
            // the active tab carries the raised surface classes while its
            // siblings are `border-transparent`. It legitimately does not
            // change on hover — it is already the selected surface. Matched on
            // className text rather than a selector so the `[` and `!` in those
            // class names need no escaping.
            (() => {
              const c = typeof n.className === "string" ? n.className : "";
              if (c.includes("!active")) return true;
              const p = n.parentElement;
              const pc = p && typeof p.className === "string" ? p.className : "";
              const inTabStrip = pc.includes("border-b") && pc.includes("shadow-[0_1px_0");
              return inTabStrip && c.includes("border-input") && c.includes("bg-card");
            })(),
          back,
          // the signature a hover is allowed to change
          sig: [
            cs.backgroundColor,
            cs.backgroundImage,
            cs.color,
            cs.borderTopColor,
            cs.borderBottomColor,
            cs.boxShadow,
            cs.opacity,
            cs.transform,
            cs.translate,
            cs.scale,
            cs.outlineColor,
            cs.filter,
            // hover:underline is the most common hover in the bundle; leaving
            // text-decoration out of the signature reported every prose link
            // and every server-name link as a dead hover.
            cs.textDecorationLine,
            cs.textDecorationColor,
            cs.textDecorationThickness,
            cs.textUnderlineOffset,
            svg ? getComputedStyle(svg).color : "",
          ].join("|"),
          text: resolve(cs.color),
          hasText: (n.textContent || "").trim().length > 0,
          icon: svg ? resolve(getComputedStyle(svg).color) : null,
        };
      });

    const before = await snap();
    if (before.zero || before.disabled || before.covered || before.settled) continue;
    // Signature of the nearest card ancestor, so a control that delegates its
    // feedback upward is not reported. The server-card icon links do exactly
    // this: hovering one lifts the whole <article> (surface steps up the
    // ladder, border picks up the accent, shadow raises), which is the intended
    // affordance — giving the inner link its own hover as well would double it.
    const ancestor = () =>
      el.evaluate((n) => {
        const a = n.closest("article, [role='listitem']") || n.parentElement;
        if (!a || a === n) return null;
        const cs = getComputedStyle(a);
        return [
          cs.backgroundColor,
          cs.borderTopColor,
          cs.boxShadow,
          cs.translate,
          cs.transform,
        ].join("|");
      });
    const ancBefore = await ancestor();
    await el.hover({ force: true }).catch(() => {});
    await page.waitForTimeout(60);
    const after = await snap();
    await page.mouse.move(3, 3);
    await page.waitForTimeout(20);

    const ancAfter = await ancestor();
    const tag = `<${after.cls || after.label}> "${after.label}"`;
    if (before.sig === after.sig && (ancBefore === null || ancBefore === ancAfter))
      dead.push(`  ${tag}`);

    const cr = (c, b) => {
      const f = (x) => {
        x /= 255;
        return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };
      const L = (q) => 0.2126 * f(q.r) + 0.7152 * f(q.g) + 0.0722 * f(q.b);
      const [h, l] = [L(c), L(b)].sort((p, q) => q - p);
      return (h + 0.05) / (l + 0.05);
    };
    for (const [what, c] of [
      ["text", after.hasText ? after.text : null],
      ["icon", after.icon],
    ]) {
      if (!c || c.a < 0.05) continue;
      const r = cr(c, after.back);
      if (r < 1.5) blind.push(`  ${what} ${r.toFixed(2)}:1  rgb(${c.r},${c.g},${c.b})  ${tag}`);
    }
  }

  console.log(`hovered ${els.length} interactive elements\n`);
  console.log(`=== HOVER DOES NOTHING (${dead.length}) ===`);
  console.log(dead.length ? [...new Set(dead)].join("\n") : "  none");
  console.log(`\n=== INVISIBLE ON HOVER (${blind.length}) ===`);
  console.log(blind.length ? [...new Set(blind)].join("\n") : "  none");

  await br.close();
  if (blind.length || dead.length) {
    console.log("\nFAIL: hover states are not all live and legible.");
    process.exit(1);
  }
  console.log("\nPASS: every interactive element reacts to hover and stays legible.");
})();
