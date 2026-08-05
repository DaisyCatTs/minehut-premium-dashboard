// recon.js — DOM reconnaissance for theme work on dashboard.minehut.com
//
// The CSS bundle tells us which class names EXIST. It cannot tell us how they are
// assembled: which element carries which state, what nests inside what, or how
// many <article> elements there are. This collects exactly the facts the
// stylesheet's section 99 lists as unresolved, and nothing else.
//
// Run on BOTH: /servers (My Servers) and a server's Console tab.
// Paste the whole output back — it is designed to be compact enough to share.

(() => {
  const out = [];
  const p = (...a) => out.push(a.join(" "));
  const cls = (el, n = 200) => (el ? (el.className?.baseVal ?? el.className ?? "").toString().slice(0, n) : "—");
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];

  p("=== ROUTE ===", location.pathname);
  p("html.className:", document.documentElement.className);
  p("body.className:", cls(document.body, 120));

  // 1. Is every <article> a server card? Gates the biggest remaining @risk F.
  const arts = qa("article");
  p("\n=== ARTICLES ===", arts.length, "total,", arts.filter((a) => a.closest("main")).length, "inside <main>");
  arts.slice(0, 3).forEach((a, i) => {
    p(`  [${i}] pos=${getComputedStyle(a).position} ${cls(a, 160)}`);
  });

  // 2. Status pill — which class carries the state, and is it hue-tinted?
  //    "HIBERNATING" renders grey today and I need to know why.
  p("\n=== STATUS PILLS ===");
  const pillTexts = ["HIBERNATING", "ONLINE", "OFFLINE", "STARTING", "SLEEPING"];
  const pills = qa("span,div").filter((e) => {
    const t = (e.textContent || "").trim().toUpperCase();
    return pillTexts.includes(t) && e.children.length <= 2 && t.length < 20;
  });
  (pills.length ? pills.slice(0, 4) : []).forEach((e) => {
    const cs = getComputedStyle(e);
    p(`  "${e.textContent.trim()}"`);
    p(`     class: ${cls(e, 300)}`);
    p(`     bg=${cs.backgroundColor} color=${cs.color} border=${cs.borderColor}`);
    const dot = e.querySelector("span,i");
    if (dot) p(`     dot: ${cls(dot, 120)} bg=${getComputedStyle(dot).backgroundColor}`);
    p(`     parentClass: ${cls(e.parentElement, 160)}`);
  });
  if (!pills.length) p("  (none matched — paste one pill's outerHTML manually)");

  // 3. The card's own top accent bar + whether the card is a positioning context
  p("\n=== CARD INTERNALS (first article) ===");
  const card = arts[0];
  if (card) {
    p("  card position:", getComputedStyle(card).position, " (needs 'relative' for a pill-anchored rail)");
    const bar = card.querySelector(".absolute.inset-x-0.top-0, [class*='inset-x-0'][class*='top-0']");
    p("  top bar:", bar ? cls(bar, 220) : "none");
    const icon = card.querySelector(".mh-sc-icon, img");
    p("  icon:", icon ? `<${icon.tagName.toLowerCase()}> ${cls(icon, 140)}` : "none");
    p("  --- outerHTML (first 2200 chars) ---");
    p(card.outerHTML.slice(0, 2200));
  } else {
    p("  no <article> on this route");
  }

  // 4. Grid container — governs the empty-space problem
  p("\n=== GRID ===");
  const grid = card?.parentElement;
  if (grid) {
    const g = getComputedStyle(grid);
    p("  class:", cls(grid, 220));
    p(`  display=${g.display} cols=${g.gridTemplateColumns} gap=${g.gap} alignContent=${g.alignContent}`);
  }

  // 5. Tabs — is it Minehut's real .mh-tabs, or something else?
  p("\n=== TABS ===");
  const tab = q("[role='tab'], .mh-tabs > *");
  p("  container:", tab ? cls(tab.parentElement, 260) : "none found");
  p("  active tab:", cls(q("[data-state='active'], .mh-tabs > .active, .mh-tabs > .\\!active"), 220));

  // 6. Confirm the Minehut bug the theme patches, plus token resolution
  p("\n=== TOKENS ===");
  const rs = getComputedStyle(document.documentElement);
  ["--mh-r-md", "--radius", "--card", "--background", "--primary", "--mh-brand", "--surface-grain"].forEach((t) =>
    p(`  ${t} = "${rs.getPropertyValue(t).trim()}"`)
  );
  const rmd = q("[class*='--mh-r-md']");
  p("  element using rounded-[var(--mh-r-md)]:", rmd ? getComputedStyle(rmd).borderRadius : "none on this route");

  // 7. Radix / shadcn generation — confirms which attribute hooks are real
  p("\n=== ATTRIBUTE HOOKS PRESENT ===");
  ["[data-slot]", "[data-state]", "[data-side]", "[data-highlighted]", "[data-active]", "[data-disabled]", "[role='menuitem']", "[role='option']", "[role='switch']", "[role='checkbox']"].forEach(
    (s) => {
      const n = qa(s).length;
      if (n) p(`  ${s} x${n}   e.g. ${cls(qa(s)[0], 90)}`);
    }
  );

  // 8. Anything still rendering an un-themed hue sweep
  p("\n=== GRADIENT ELEMENTS (should be brand blue only) ===");
  qa("[class*='bg-gradient']").slice(0, 5).forEach((e) => {
    p(`  ${cls(e, 200)}`);
    p(`     -> ${getComputedStyle(e).backgroundImage.slice(0, 160)}`);
  });

  const text = out.join("\n");
  console.log(text);
  copy?.(text); // DevTools helper: puts it on the clipboard
  return `collected ${text.length} chars — copied to clipboard if copy() was available`;
})();
