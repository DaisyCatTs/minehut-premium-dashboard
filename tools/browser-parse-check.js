// Does the shipped stylesheet actually parse, and do its tokens resolve?
// This is the check that would have caught the broken-comment bug: it asks the
// browser, not a regex, whether the CSS survived.
const { chromium } = require("playwright");
const fs = require("fs");

const repo = "C:/Users/Daisy/Desktop/minehut-premium-dashboard";
const BS = String.fromCharCode(92);
const SQ = String.fromCharCode(39);

let css = fs.readFileSync(repo + "/minehut-premium-dashboard.user.css", "utf8"); // plain CSS now — no placeholder to substitute

// unwrap @-moz-document
const open = css.indexOf("@-moz-document");
const b = css.indexOf("{", open);
let d = 0,
  end = -1,
  inC = false,
  q = null;
for (let i = b; i < css.length; i++) {
  const c = css[i],
    n = css[i + 1];
  if (inC) {
    if (c === "*" && n === "/") {
      inC = false;
      i++;
    }
    continue;
  }
  if (q) {
    if (c === BS) {
      i++;
      continue;
    }
    if (c === q) q = null;
    continue;
  }
  if (c === "/" && n === "*") {
    inC = true;
    i++;
    continue;
  }
  if (c === '"' || c === SQ) {
    q = c;
    continue;
  }
  if (c === "{") d++;
  else if (c === "}") {
    d--;
    if (d === 0) {
      end = i;
      break;
    }
  }
}
const body = css.slice(b + 1, end);

(async () => {
  const br = await chromium.launch();
  const p = await br.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  // Reproduce exactly what Stylus does: @preprocessor default injects the chosen
  // @var value as a :root declaration ABOVE the sheet. It does not template the
  // file. Override to preview another accent:
  //   ACCENT="255 92% 76.3%" node tools/browser-parse-check.js
  const injected = ":root{--accentHsl:" + (process.env.ACCENT || "210 100% 69.8%") + "}";
  await p.setContent(
    '<style id="t">' +
      injected +
      body +
      "</style>" +
      '<div class="dark"><article class="rounded-[10px] bg-card">' +
      '<span class="bg-current"></span></article></div>'
  );
  const r = await p.evaluate(() => {
    const sheet = document.getElementById("t").sheet;
    // Tokens are declared on `.dark`, not on :root — read them where they live.
    const cs = getComputedStyle(document.querySelector(".dark"));
    const art = document.querySelector("article");
    const tok = (n) => cs.getPropertyValue(n).trim() || "(EMPTY)";
    // Resolve the accent all the way to a painted colour, which is the only
    // thing that proves the @var indirection survived substitution.
    const probe = document.createElement("div");
    probe.style.color = "hsl(var(--primary))";
    document.querySelector(".dark").appendChild(probe);
    const painted = getComputedStyle(probe).color;
    return {
      rules: sheet.cssRules.length,
      primary: tok("--primary"),
      card: tok("--card"),
      ogAccent: tok("--og-accent"),
      mhBrand: tok("--mh-brand"),
      accentPainted: painted,
      cardBg: getComputedStyle(art).backgroundColor,
      // did the keyframe retune actually land?
      pulse: [...sheet.cssRules]
        .filter((x) => x.type === CSSRule.KEYFRAMES_RULE && x.name === "pulse")
        .map((x) => x.cssText.replace(/\s+/g, " ").slice(0, 70)),
    };
  });
  console.log("  top-level rules  :", r.rules);
  console.log("  --primary        :", r.primary);
  console.log("  --card           :", r.card);
  console.log("  --og-accent      :", r.ogAccent);
  console.log("  --mh-brand       :", r.mhBrand);
  console.log("  accent painted   :", r.accentPainted, "(expect rgb(101,178,255) for blue)");
  console.log("  article bg       :", r.cardBg, "(expect rgb(20,20,20))");
  console.log("  @keyframes pulse :", r.pulse.length ? r.pulse[0] : "(none — retune missing)");
  if (errs.length) console.log("  PAGE ERRORS      :", errs.join(" | "));
  await br.close();
})();
