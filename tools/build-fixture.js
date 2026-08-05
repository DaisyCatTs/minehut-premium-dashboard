#!/usr/bin/env node
// build-fixture.js — render the theme locally, without a Minehut login.
//
// The theme has always been verified by static analysis plus screenshots the owner
// sends back. This closes that loop: it inlines Minehut's real shipped CSS, unwraps
// the theme's @-moz-document block so it applies to a local file, and rebuilds the
// exact markup `tools/recon.js` captured from the live DOM.
//
// The result is not a mock — every class string below was copied from the real page.
//
//   node tools/build-fixture.js && open tools/fixture.html
//
// Known divergence: next/font webfonts are served from Minehut's origin, so Geist,
// Unbounded and Silkscreen fall back locally. Colour, spacing, elevation, borders
// and state all render faithfully; letterforms do not.

const fs = require("fs");
const path = require("path");

const repo = path.resolve(__dirname, "..");
const bundleDir = path.join(repo, "Original Css from their next static");

if (!fs.existsSync(bundleDir)) {
  console.error("error: Minehut's CSS bundle is gitignored and not present locally.");
  console.error("       Fetch _next/static/css/*.css from dashboard.minehut.com into:");
  console.error("       " + bundleDir);
  process.exit(1);
}

const minehut = fs
  .readdirSync(bundleDir)
  .filter((f) => f.endsWith(".css"))
  .map((f) => fs.readFileSync(path.join(bundleDir, f), "utf8"))
  .join("\n");

// Unwrap `@-moz-document domain(...) { ... }` — a local file has no domain to match.
const themeSrc = fs.readFileSync(path.join(repo, "minehut-premium-dashboard.user.css"), "utf8");
const open = themeSrc.indexOf("@-moz-document");
const braceAt = themeSrc.indexOf("{", open);
let depth = 0, end = -1, inComment = false, quote = null;
for (let i = braceAt; i < themeSrc.length; i++) {
  const c = themeSrc[i], n = themeSrc[i + 1];
  if (inComment) { if (c === "*" && n === "/") { inComment = false; i++; } continue; }
  if (quote) { if (c === "\\") { i++; continue; } if (c === quote) quote = null; continue; }
  if (c === "/" && n === "*") { inComment = true; i++; continue; }
  if (c === '"' || c === "'") { quote = c; continue; }
  if (c === "{") depth++;
  else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
}
if (end < 0) { console.error("error: could not find the end of the @-moz-document block"); process.exit(1); }
const theme = themeSrc.slice(braceAt + 1, end);

// Markup below is transcribed from tools/recon.js output on the live dashboard.
const card = (name, domain, plan, lastOnline, state, stateClass, dotClass) => `
<div class="group relative h-full">
  <article class="relative flex h-full flex-col overflow-hidden rounded-[10px] border border-border bg-card transition-[border-color,box-shadow] duration-200">
    <div class="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[var(--mh-diamond)] to-[var(--mh-brand)] opacity-60"></div>
    <div class="grid grid-cols-[auto_1fr_auto] items-start gap-4 px-6 pb-4 pt-6">
      <a class="rounded-[10px]" href="#">
        <div class="relative size-12 shrink-0">
          <div class="grid size-full place-items-center overflow-hidden rounded-[10px] bg-[var(--mh-bg-3)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_8px_rgba(0,0,0,0.3)]">
            <span style="font-size:26px;line-height:1">${name === "Bleed" ? "\u{1F7E5}" : "\u{1F5FF}"}</span>
          </div>
          <span class="absolute -bottom-1 -right-1 size-3.5 rounded-full border-[2.5px] border-card ${dotClass} opacity-70"></span>
        </div>
      </a>
      <div class="min-w-0">
        <h3 class="m-0 text-[16px] font-semibold leading-tight tracking-[-0.01em] text-muted-foreground">
          <a class="align-middle hover:underline" href="#">${name}</a>
        </h3>
        <button class="mt-1 inline-flex items-center gap-1.5 font-mono text-[12px] text-muted-foreground transition-colors hover:text-foreground">
          <span>${domain}</span>
        </button>
      </div>
      <span class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-[3px] font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${stateClass}">
        <span class="size-1.5 rounded-full bg-current"></span>${state}
      </span>
    </div>
    <div class="grid grid-cols-2 gap-4 px-6 pb-4">
      <div><div class="text-[20px] font-semibold text-foreground">${plan}</div><div class="ds-label">Plan</div></div>
      <div><div class="text-[20px] font-semibold text-foreground">${lastOnline}</div><div class="ds-label">Last online</div></div>
    </div>
    <div class="mt-auto grid grid-cols-2 gap-2 px-6 pb-6">
      <button class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--mh-brand)] px-3.5 text-[13px] font-medium">Activate</button>
      <button class="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-card px-3.5 text-[13px] font-medium text-foreground">Manage</button>
    </div>
  </article>
</div>`;

const tabBar = `
<div class="mt-6 flex flex-wrap gap-2 border-b border-border pb-2 shadow-[0_1px_0_hsl(var(--foreground)/0.08),0_2px_0_hsl(var(--foreground)/0.2)]">
  <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-medium tracking-[-0.005em] transition-all duration-[120ms] ease-mh-out border h-9 px-3.5 py-2 border-input bg-card text-foreground">Console</button>
  ${["File Manager", "Settings", "Stats", "Backups", "Sub users", "Upgrade"]
    .map((t) => `<a href="#" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-medium tracking-[-0.005em] transition-all duration-[120ms] ease-mh-out border h-9 px-3.5 py-2 border-transparent text-muted-foreground">${t}</a>`)
    .join("\n  ")}
</div>`;

const pill = (label, hue) =>
  hue === "muted"
    ? `<span class="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground"><span class="size-[7px] rounded-full bg-current"></span>${label}</span>`
    : `<span class="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs border-[color-mix(in_oklab,var(--mh-${hue})_30%,transparent)] bg-[color-mix(in_oklab,var(--mh-${hue})_15%,transparent)] text-[var(--mh-${hue})]" style="border-width:1px"><span class="size-[7px] rounded-full bg-current"></span>${label}</span>`;

const html = `<!doctype html>
<html lang="en" class="dark">
<head>
<meta charset="utf-8">
<title>Minehut Premium Dashboard — local fixture</title>
<style>/* ── Minehut's shipped CSS ── */
${minehut}
</style>
<style>/* ── theme, @-moz-document unwrapped ── */
${theme}
</style>
</head>
<body class="font-sans antialiased">
  <main class="p-8">
    <h1 class="font-display">My Servers</h1>

    <div class="mt-6 flex flex-wrap items-center gap-2">
      ${pill("Hibernating", "muted")}
      ${pill("Online", "emerald")}
      ${pill("Warning", "gold")}
      ${pill("Stopped", "redstone")}
      ${pill("Paper 1.21.11", "diamond")}
      ${pill("Plugin", "amethyst")}
      ${pill("Copper", "copper")}
    </div>

    <div class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      ${card("Bleed", "bleed.minehut.gg", "Starter", "Today", "Hibernating", "bg-muted text-muted-foreground", "bg-muted-foreground")}
      ${card("ExoticMines", "exoticmines.minehut.gg", "Starter", "1147 days ago", "Online", "bg-[color-mix(in_oklab,var(--mh-emerald)_16%,transparent)] text-[var(--mh-emerald)]", "bg-[var(--mh-emerald)]")}
      ${card("TransNetwork", "transnetwork.minehut.gg", "Starter", "—", "Hibernating", "bg-muted text-muted-foreground", "bg-muted-foreground")}
    </div>

    ${tabBar}

    <div class="mt-6 rounded-[10px] border border-border bg-card p-6">
      <h2>Typography scale</h2>
      <h3>Card title at 16px</h3>
      <p class="text-muted-foreground">Body copy at 14px with 1.55 leading. The four ink tiers should be clearly distinguishable from one another at a glance, not merely different by measurement.</p>
      <p class="ds-label">Micro label</p>
      <p class="font-mono text-[12px] text-muted-foreground">2,249 rules &middot; 11 packs &middot; 0/10 players</p>
      <div class="mt-4 flex gap-2">
        <button class="inline-flex h-9 items-center rounded-md bg-[var(--mh-brand)] px-3.5 text-[13px] font-medium">Primary</button>
        <button class="inline-flex h-9 items-center rounded-md border border-input bg-card px-3.5 text-[13px] font-medium text-foreground">Secondary</button>
        <button class="inline-flex h-9 items-center rounded-md bg-destructive/10 px-3.5 text-[13px] font-medium">Danger</button>
        <button class="inline-flex h-9 items-center rounded-md border border-input bg-card px-3.5 text-[13px] font-medium" disabled>Disabled</button>
      </div>
      <div class="mt-4 max-w-md">
        <div class="mh-meter-track"><div class="mh-meter-fill" style="width:63%"></div></div>
      </div>
      <div class="mt-4 flex gap-2">
        <input class="h-9 rounded-md border border-input bg-muted px-3 text-[13px]" placeholder="Search servers by name…">
        <select class="h-9 rounded-md border border-input bg-muted px-3 text-[13px]"><option>All statuses</option></select>
      </div>
    </div>

    <div class="mt-6 rounded-[10px] border border-border bg-[var(--console-bg)] p-4 font-mono text-[12px]">
      <div style="color:var(--console-fg)">[00:28:02] Starting background profiler…</div>
      <div><span style="color:var(--console-ansi-4)">[DaisyFilter]</span> <span style="color:var(--console-fg)">Rule snapshot ready: </span><span style="color:var(--console-ansi-2)">2249</span><span style="color:var(--console-fg)"> enabled rules</span></div>
      <div style="color:var(--console-ansi-3)">[00:28:02] You are 4 release(s) behind the latest stable release</div>
      <div style="color:var(--console-ansi-1)">[00:28:02] Error: something went wrong</div>
      <div style="color:var(--console-ansi-8)">[00:28:02] muted / comment text</div>
    </div>
  </main>
</body>
</html>`;

const out = path.join(repo, "tools", "fixture.html");
fs.writeFileSync(out, html, "utf8");
console.log(`wrote ${out}  (${(html.length / 1024).toFixed(0)} KB)`);
console.log("toggle light mode by removing class=\"dark\" from <html>");
