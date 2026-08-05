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
let themeSrc = fs.readFileSync(path.join(repo, "minehut-premium-dashboard.user.css"), "utf8");

// The stylesheet is a Stylus template (@preprocessor default). Substitute each
// /*[[name]]*/ placeholder with its DEFAULT option — the one marked with * — so
// the fixture renders exactly what a fresh install gets. Override on the command
// line to preview another theme:  node tools/build-fixture.js --accent Purple
const wanted =
  (process.argv.find((a) => a.startsWith("--accent=")) || "").split("=")[1] ||
  process.argv[process.argv.indexOf("--accent") + 1] ||
  "";
for (const m of themeSrc.matchAll(/@var\s+select\s+(\w+)\s+"[^"]*"\s*\{([^}]*)\}/g)) {
  const opts = [...m[2].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)].map((o) => [o[1], o[2]]);
  const picked =
    opts.find(([k]) => k.replace(/\*$/, "").toLowerCase() === wanted.toLowerCase()) ||
    opts.find(([k]) => k.endsWith("*")) ||
    opts[0];
  if (picked) {
    themeSrc = themeSrc.split(`/*[[${m[1]}]]*/`).join(picked[1]);
    console.log(`  ${m[1]} = ${picked[0].replace(/\*$/, "")} (${picked[1]})`);
  }
}
const open = themeSrc.indexOf("@-moz-document");
const braceAt = themeSrc.indexOf("{", open);
let depth = 0,
  end = -1,
  inComment = false,
  quote = null;
for (let i = braceAt; i < themeSrc.length; i++) {
  const c = themeSrc[i],
    n = themeSrc[i + 1];
  if (inComment) {
    if (c === "*" && n === "/") {
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
    continue;
  }
  if (c === "/" && n === "*") {
    inComment = true;
    i++;
    continue;
  }
  if (c === '"' || c === "'") {
    quote = c;
    continue;
  }
  if (c === "{") depth++;
  else if (c === "}") {
    depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }
}
if (end < 0) {
  console.error("error: could not find the end of the @-moz-document block");
  process.exit(1);
}
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
    .map(
      (t) =>
        `<a href="#" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-medium tracking-[-0.005em] transition-all duration-[120ms] ease-mh-out border h-9 px-3.5 py-2 border-transparent text-muted-foreground">${t}</a>`
    )
    .join("\n  ")}
</div>`;

const pill = (label, hue) =>
  hue === "muted"
    ? `<span class="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground"><span class="size-[7px] rounded-full bg-current"></span>${label}</span>`
    : `<span class="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs border-[color-mix(in_oklab,var(--mh-${hue})_30%,transparent)] bg-[color-mix(in_oklab,var(--mh-${hue})_15%,transparent)] text-[var(--mh-${hue})]" style="border-width:1px"><span class="size-[7px] rounded-full bg-current"></span>${label}</span>`;

// ── Components that exist in Minehut's bundle but live on routes nobody has
//    opened. Every class string below is a real token from the shipped CSS
//    (verified via `audit-selectors.py --tokens`), assembled into the shapes
//    shadcn/Radix produce. This is not a mock of Minehut's markup — it is a
//    harness that forces each component family to RENDER so audit-page.js can
//    check it, instead of it being styled blind forever.
const components = `
<h2 class="mt-10">Components — routes not yet opened</h2>

<div class="mt-4 rounded-[10px] border border-border bg-card p-6">
  <p class="ds-label">Data grid (File Manager / Backups / Sub users)</p>
  <div class="mt-3 overflow-x-auto">
    <table class="min-w-[760px] table-fixed">
      <thead><tr class="sticky top-0">
        <th class="px-4 py-2 text-left ds-label">Name</th>
        <th class="px-4 py-2 text-left ds-label">Size</th>
        <th class="px-4 py-2 text-left ds-label">Modified</th>
      </tr></thead>
      <tbody class="divide-y divide-border">
        <tr><td class="px-4 py-2">server.properties</td><td class="px-4 py-2 font-mono">1,024</td><td class="px-4 py-2 font-mono">00:28:02</td></tr>
        <tr><td class="px-4 py-2">plugins/</td><td class="px-4 py-2 font-mono">10,240</td><td class="px-4 py-2 font-mono">01:07:44</td></tr>
      </tbody>
    </table>
  </div>
</div>

<div class="mt-4 rounded-[10px] border border-border bg-card p-6">
  <p class="ds-label">Form controls (Settings)</p>
  <div class="mt-3 flex flex-wrap items-center gap-4">
    <label class="flex items-center gap-2 text-[13px]"><input type="checkbox" checked> Enabled</label>
    <label class="flex items-center gap-2 text-[13px]"><input type="radio" checked> Option</label>
    <input type="range" min="0" max="100" value="63">
    <input type="file" class="file:bg-transparent file:border-0 file:text-sm file:font-medium text-[13px]">
    <textarea class="rounded-md border border-input bg-muted px-3 py-2 text-[13px]" rows="2">MOTD line</textarea>
  </div>
  <div class="mt-4 flex flex-wrap gap-2">
    <span role="checkbox" data-state="checked" class="inline-block size-4 rounded border border-input"></span>
    <span role="switch" data-state="checked" class="inline-block h-5 w-9 rounded-full border border-input"></span>
    <span role="switch" class="inline-block h-5 w-9 rounded-full border border-input"></span>
  </div>
</div>

<div class="mt-4 rounded-[10px] border border-border bg-card p-6">
  <p class="ds-label">Overlays (dialog, menu, tooltip, toast)</p>
  <div class="mt-3 flex flex-wrap items-start gap-4">
    <div role="dialog" class="w-[min(92vw,460px)] rounded-lg border border-border bg-popover p-5">
      <h2 class="text-[17px]">Delete server?</h2>
      <p class="mt-1 text-muted-foreground max-w-[46ch]">This cannot be undone. Your world and plugins are removed permanently.</p>
      <div class="mt-4 flex justify-end gap-2">
        <button class="inline-flex h-9 items-center rounded-md border border-input bg-card px-3.5 text-[13px]">Cancel</button>
        <button class="inline-flex h-9 items-center rounded-md bg-destructive px-3.5 text-[13px]">Delete</button>
      </div>
    </div>
    <div role="menu" class="min-w-[8rem] rounded-md border border-border bg-popover p-1">
      <div role="menuitem" class="px-2 py-1.5 text-[13px]">Restart</div>
      <div role="menuitem" data-highlighted class="px-2 py-1.5 text-[13px]">Duplicate</div>
      <div role="separator" class="my-1 h-px"></div>
      <div role="menuitem" data-disabled class="px-2 py-1.5 text-[13px]">Archive</div>
    </div>
    <div role="tooltip" data-side="top" class="rounded-md border border-border bg-popover px-2 py-1">Copy domain</div>
    <div class="fixed bottom-4 right-4 z-50" style="position:static">
      <div class="max-w-[360px] rounded-md border border-border bg-popover p-3 text-[13px]">Server stopped.</div>
    </div>
  </div>
</div>

<div class="mt-4 rounded-[10px] border border-border bg-card p-6">
  <p class="ds-label">Banners &amp; stock palette (warnings across the app)</p>
  <div class="mt-3 space-y-2">
    <div class="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-[13px] text-amber-500">Console is only available while the server is online.</div>
    <div class="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-500">Backup completed.</div>
    <div class="rounded-md border border-destructive/40 bg-red-500/20 px-3 py-2 text-[13px] text-red-400">Failed to start.</div>
    <p class="text-[13px] max-w-[60ch]">Read the <a href="#">documentation</a> for details, or see <a href="#" class="underline">the wiki</a>.</p>
    <ul class="list-disc pl-4 text-[13px] text-muted-foreground"><li>One</li><li>Two</li></ul>
  </div>
</div>

<div class="mt-4 rounded-[10px] border border-border bg-card p-6">
  <p class="ds-label">Loading &amp; charts (Stats)</p>
  <div class="mt-3 flex flex-wrap items-center gap-4">
    <div class="animate-pulse bg-muted h-4 w-40 rounded"></div>
    <div class="animate-pulse bg-muted h-4 w-24 rounded"></div>
    <div class="animate-spin size-4 rounded-full border-2 border-input"></div>
    <div class="rounded-[var(--mh-r-md)] bg-muted size-10"></div>
  </div>
  <div class="mt-4 aspect-[16/9] max-w-md">
    <svg class="recharts-surface" width="100%" height="160">
      <g class="recharts-cartesian-grid"><line x1="0" y1="40" x2="400" y2="40"></line><line x1="0" y1="90" x2="400" y2="90"></line></g>
      <g class="recharts-cartesian-axis"><line x1="0" y1="140" x2="400" y2="140"></line>
        <g class="recharts-cartesian-axis-tick"><text x="10" y="155">00:00</text></g>
        <g class="recharts-cartesian-axis-tick"><text x="190" y="155">12:00</text></g></g>
      <path class="recharts-curve" d="M0,120 L100,60 L200,90 L300,40 L400,70" fill="none" stroke="#22c55e" stroke-width="2"></path>
      <circle class="recharts-dot" cx="300" cy="40" r="3" fill="#22c55e"></circle>
    </svg>
  </div>
</div>
`;

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
      ${card("ExoticMines", "exoticmines.minehut.gg", "Starter", "1147 days ago", "Online", "bg-[color-mix(in_oklab,var(--mh-emerald)_16%,transparent)] rounded-full text-[var(--mh-emerald)]", "bg-[var(--mh-emerald)]")}
      ${card("TransNetwork", "transnetwork.minehut.gg", "Starter", "—", "Pending deletion", "bg-[color-mix(in_oklab,var(--mh-redstone)_16%,transparent)] rounded-full text-[var(--mh-redstone)]", "bg-[var(--mh-redstone)]")}
    </div>

    ${tabBar}

    ${components}

    <div class="mt-6 rounded-[10px] border border-border bg-card p-6">
      <h2>Typography scale</h2>
      <h3>Card title at 16px</h3>
      <p class="text-muted-foreground">Body copy at 14px with 1.55 leading. The four ink tiers should be clearly distinguishable from one another at a glance, not merely different by measurement.</p>
      <p class="ds-label">Micro label</p>
      <p class="font-mono text-[12px] text-muted-foreground">2,249 rules &middot; 11 packs &middot; 0/10 players</p>
      <div class="mt-4 flex gap-2">
        <button class="inline-flex h-9 items-center rounded-md bg-[var(--mh-brand)] px-3.5 text-[13px] font-medium">Primary</button>
        <button class="inline-flex h-9 items-center rounded-md border border-input bg-card px-3.5 text-[13px] font-medium text-foreground">Secondary</button>
        <button class="inline-flex h-9 items-center rounded-md bg-destructive px-3.5 text-[13px] font-medium">Stop server</button>
        <button class="inline-flex h-9 items-center rounded-md bg-destructive/10 px-3.5 text-[13px] font-medium">Danger ghost</button>
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
console.log('toggle light mode by removing class="dark" from <html>');
