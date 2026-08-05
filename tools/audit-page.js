// audit-page.js — runtime QA for the theme, on any route.
//
// recon.js answers "how is this page built". This answers "did the theme actually
// reach it". It works backwards from what is rendered rather than from what the
// stylesheet claims, so it finds gaps on routes nobody has looked at.
//
// Three checks:
//   1. UNTHEMED COLOURS — every computed colour on the page that is not one of
//      the theme's tokens. This is the mechanical version of "what did I miss".
//   2. CONTRAST — every visible text node against its effective background.
//   3. COMPONENT CENSUS — which component families are present on this route.
//
// Run on each route, in BOTH dark and light mode. Paste the output back.

(() => {
  const out = [];
  const p = (...a) => out.push(a.join(" "));
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const cls = (el, n = 110) =>
    el ? (el.className?.baseVal ?? el.className ?? "").toString().slice(0, n) : "—";

  // ── colour helpers ────────────────────────────────────────────────────────
  const parse = (c) => {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  const over = (fg, bg) =>
    fg.a >= 1
      ? fg
      : {
          r: fg.r * fg.a + bg.r * (1 - fg.a),
          g: fg.g * fg.a + bg.g * (1 - fg.a),
          b: fg.b * fg.a + bg.b * (1 - fg.a),
          a: 1,
        };
  const hex = ({ r, g, b }) =>
    "#" +
    [r, g, b]
      .map((v) => Math.round(v).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

  // Effective background: walk up until something is not transparent.
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.95) return c;
      n = n.parentElement;
    }
    return (
      parse(getComputedStyle(document.documentElement).backgroundColor) || {
        r: 0,
        g: 0,
        b: 0,
        a: 1,
      }
    );
  };

  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  p("=== ROUTE ===", location.pathname);
  p(
    "theme:",
    document.documentElement.className.includes("dark") ? "DARK" : "LIGHT",
    "| html.class:",
    document.documentElement.className
  );

  // ── 1. the theme's own palette, read from the live tokens ────────────────
  const rs = getComputedStyle(document.documentElement);
  const tokenNames = [
    "--background",
    "--card",
    "--muted",
    "--secondary",
    "--popover",
    "--accent",
    "--border",
    "--input",
    "--foreground",
    "--muted-foreground",
    "--secondary-foreground",
    "--primary",
    "--destructive",
    "--primary-foreground",
  ];
  const probe = document.createElement("div");
  document.body.appendChild(probe);
  const palette = new Set();
  const paletteMap = {};
  for (const t of tokenNames) {
    const v = rs.getPropertyValue(t).trim();
    if (!v) continue;
    probe.style.backgroundColor = `hsl(${v})`;
    const c = parse(getComputedStyle(probe).backgroundColor);
    if (c) {
      palette.add(hex(c));
      paletteMap[hex(c)] = t;
    }
  }
  for (const t of [
    "--mh-emerald",
    "--mh-redstone",
    "--mh-gold",
    "--mh-diamond",
    "--mh-amethyst",
    "--mh-copper",
    "--mh-lapis",
    "--mh-brand",
    "--mh-ink-4",
    "--console-bg",
    "--console-fg",
  ]) {
    const v = rs.getPropertyValue(t).trim();
    if (!v) continue;
    probe.style.backgroundColor = v;
    const c = parse(getComputedStyle(probe).backgroundColor);
    if (c) {
      palette.add(hex(c));
      paletteMap[hex(c)] = t;
    }
  }
  probe.remove();
  p("\npalette resolved:", palette.size, "distinct token colours");

  // ── 2. unthemed colours ──────────────────────────────────────────────────
  const all = qa("body *").filter(visible);
  const unthemedBg = new Map();
  const unthemedFg = new Map();
  const near = (h) => {
    // treat within ~6/255 per channel as "matches a token" (antialiasing, alpha)
    const c = parse(
      h.startsWith("#")
        ? `rgb(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)})`
        : h
    );
    for (const t of palette) {
      const q = parse(
        `rgb(${parseInt(t.slice(1, 3), 16)},${parseInt(t.slice(3, 5), 16)},${parseInt(t.slice(5, 7), 16)})`
      );
      if (Math.abs(c.r - q.r) <= 6 && Math.abs(c.g - q.g) <= 6 && Math.abs(c.b - q.b) <= 6)
        return paletteMap[t];
    }
    return null;
  };
  for (const el of all) {
    const s = getComputedStyle(el);
    const bg = parse(s.backgroundColor);
    if (bg && bg.a > 0.05) {
      const h = hex(over(bg, bgOf(el.parentElement || document.body)));
      if (!near(h)) {
        if (!unthemedBg.has(h)) unthemedBg.set(h, []);
        if (unthemedBg.get(h).length < 3)
          unthemedBg.get(h).push(`<${el.tagName.toLowerCase()}> ${cls(el)}`);
      }
    }
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText) {
      const fg = parse(s.color);
      if (fg) {
        const h = hex(over(fg, bgOf(el)));
        if (!near(h)) {
          if (!unthemedFg.has(h)) unthemedFg.set(h, []);
          if (unthemedFg.get(h).length < 3)
            unthemedFg.get(h).push(`"${el.textContent.trim().slice(0, 28)}" ${cls(el, 70)}`);
        }
      }
    }
  }
  p("\n=== UNTHEMED BACKGROUNDS ===", unthemedBg.size, "distinct");
  [...unthemedBg.entries()].slice(0, 18).forEach(([h, els]) => {
    p(`  ${h}`);
    els.forEach((e) => p(`      ${e}`));
  });

  p("\n=== UNTHEMED TEXT COLOURS ===", unthemedFg.size, "distinct");
  [...unthemedFg.entries()].slice(0, 18).forEach(([h, els]) => {
    p(`  ${h}`);
    els.forEach((e) => p(`      ${e}`));
  });

  // ── 3. contrast failures ─────────────────────────────────────────────────
  p("\n=== CONTRAST FAILURES (WCAG AA: 4.5 normal, 3.0 large/bold) ===");
  const fails = [];
  for (const el of all) {
    const hasText = [...el.childNodes].some(
      (n) => n.nodeType === 3 && n.textContent.trim().length > 1
    );
    if (!hasText) continue;
    const s = getComputedStyle(el);
    const fg = parse(s.color);
    if (!fg || fg.a < 0.05) continue;
    const bg = bgOf(el);
    const r = ratio(over(fg, bg), bg);
    const px = parseFloat(s.fontSize);
    const bold = +s.fontWeight >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (r < need)
      fails.push({
        r,
        need,
        px,
        t: el.textContent.trim().slice(0, 34),
        c: cls(el, 80),
        fg: hex(over(fg, bg)),
        bg: hex(bg),
      });
  }
  fails.sort((a, b) => a.r - b.r);
  p(`  ${fails.length} failing element(s)`);
  fails
    .slice(0, 20)
    .forEach((f) =>
      p(
        `  ${f.r.toFixed(2)}:1 (need ${f.need}) ${f.px}px  ${f.fg} on ${f.bg}\n      "${f.t}"  ${f.c}`
      )
    );

  // ── 4. component census ──────────────────────────────────────────────────
  p("\n=== COMPONENT CENSUS ===");
  const census = {
    article: "article",
    table: "table",
    "thead th": "thead th",
    select: "select",
    "input[type=file]": "input[type=file]",
    "input[type=range]": "input[type=range]",
    "input[type=checkbox]": "input[type=checkbox]",
    textarea: "textarea",
    progress: "progress",
    "[role=dialog]": "[role=dialog]",
    "[role=menu]": "[role=menu]",
    "[role=menuitem]": "[role=menuitem]",
    "[role=listbox]": "[role=listbox]",
    "[role=option]": "[role=option]",
    "[role=switch]": "[role=switch]",
    "[role=checkbox]": "[role=checkbox]",
    "[role=tab]": "[role=tab]",
    "[role=tooltip]": "[role=tooltip]",
    "[data-state]": "[data-state]",
    "[data-side]": "[data-side]",
    "[data-slot]": "[data-slot]",
    "[aria-invalid]": "[aria-invalid]",
    "[aria-expanded]": "[aria-expanded]",
    "[aria-current]": "[aria-current]",
    "[aria-selected]": "[aria-selected]",
    ".recharts-surface": ".recharts-surface",
    ".animate-pulse": ".animate-pulse",
    ".mh-tabs": ".mh-tabs",
    ".mh-meter-track": ".mh-meter-track",
    ".mh-sc-icon": ".mh-sc-icon",
    ".ds-label": ".ds-label",
    ".monaco-editor": ".monaco-editor",
    "[class*=overflow-x-auto]": "[class*='overflow-x-auto']",
  };
  Object.entries(census).forEach(([label, sel]) => {
    let n = 0;
    try {
      n = qa(sel).length;
    } catch {
      n = -1;
    }
    if (n > 0) p(`  ${label.padEnd(28)} x${n}`);
  });

  // ── 5. anything still showing a multi-hue gradient ───────────────────────
  const grads = qa("[class*='bg-gradient'],[class*='from-']").filter(visible);
  if (grads.length) {
    p("\n=== GRADIENTS ON PAGE ===", grads.length);
    grads
      .slice(0, 6)
      .forEach((e) =>
        p(`  ${cls(e, 150)}\n      -> ${getComputedStyle(e).backgroundImage.slice(0, 130)}`)
      );
  }

  const text = out.join("\n");
  console.log(text);
  try {
    copy(text);
  } catch {}
  return `audit complete — ${fails.length} contrast failures, ${unthemedBg.size} unthemed bg, ${unthemedFg.size} unthemed fg`;
})();
