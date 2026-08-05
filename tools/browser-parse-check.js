// Does the shipped stylesheet actually parse, and do its tokens resolve?
// This is the check that would have caught the broken-comment bug: it asks the
// browser, not a regex, whether the CSS survived.
const { chromium } = require("playwright");
const fs = require("fs");

const repo = "C:/Users/Daisy/Desktop/minehut-premium-dashboard";
const BS = String.fromCharCode(92);
const SQ = String.fromCharCode(39);

let css = fs
  .readFileSync(repo + "/minehut-premium-dashboard.user.css", "utf8")
  .replace(/\/\*\[\[accent\]\]\*\//g, "211 100% 65.1%");

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
  await p.setContent(
    '<style id="t">' +
      body +
      "</style>" +
      '<div class="dark"><article class="rounded-[10px] bg-card">' +
      '<span class="bg-current"></span></article></div>'
  );
  const r = await p.evaluate(() => {
    const sheet = document.getElementById("t").sheet;
    const cs = getComputedStyle(document.documentElement);
    const art = document.querySelector("article");
    const tok = (n) => cs.getPropertyValue(n).trim() || "(EMPTY)";
    return {
      rules: sheet.cssRules.length,
      primary: tok("--primary"),
      card: tok("--card"),
      ogAccent: tok("--og-accent"),
      mhBrand: tok("--mh-brand"),
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
  console.log("  article bg       :", r.cardBg, "(expect rgb(20,20,20))");
  console.log("  @keyframes pulse :", r.pulse.length ? r.pulse[0] : "(none — retune missing)");
  if (errs.length) console.log("  PAGE ERRORS      :", errs.join(" | "));
  await br.close();
})();
