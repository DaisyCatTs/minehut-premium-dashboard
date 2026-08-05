// Phase 0 preconditions — paste into DevTools console on dashboard.minehut.com,
// once on **My Servers** and once on a server's **Console** tab.
// Four answers gate design decisions I cannot settle from the CSS alone.

(() => {
  const out = {};

  // 1. Is the dark class on <html> or <body>?
  //    The gate `:is(.dark *)` needs .dark as an ANCESTOR. Tailwind's default puts it
  //    on <html>. If it's on <body>, no html-targeting rule can be gated.
  out["1_darkHost"] = {
    html: document.documentElement.className,
    body: document.body.className.slice(0, 120),
  };

  // 2. Is every <article> a server card?
  //    Decides whether 17 fragile `article[class*="rounded-\[10px\]"]` selectors
  //    collapse into one durable `main article`.
  const arts = [...document.querySelectorAll("article")];
  out["2_articles"] = {
    count: arts.length,
    inMain: arts.filter((a) => a.closest("main")).length,
    hasRounded10: arts.filter((a) => a.className.includes("rounded-[10px]")).length,
    sample: arts.slice(0, 4).map((a) => a.className.slice(0, 90)),
  };

  // 3. Is the card the nearest positioned ancestor of the status pill?
  //    Required for the :has()-free state rail (attach pseudo to the pill instead).
  const card = arts[0];
  const pill = card && card.querySelector('[class*="bg-[color-mix"]');
  out["3_railViable"] = card
    ? {
        cardPosition: getComputedStyle(card).position,
        pillFound: !!pill,
        pillPosition: pill ? getComputedStyle(pill).position : null,
        pillClass: pill ? pill.className.slice(0, 90) : null,
      }
    : "no <article> on this route";

  // 4. Confirm Minehut's --mh-r-md bug (declared nowhere, consumed by a utility).
  const rmd = document.querySelector('[class*="rounded-[var(--mh-r-md)]"]');
  out["4_mhRmdBug"] = rmd
    ? { borderRadius: getComputedStyle(rmd).borderRadius, expected: "0px if bug confirmed" }
    : "no element uses rounded-[var(--mh-r-md)] on this route";

  // 5. Bonus: are the fonts actually the ones Minehut ships?
  //    If body resolves to Segoe UI, the Inter stack is the cause.
  out["5_fonts"] = {
    body: getComputedStyle(document.body).fontFamily,
    display: (() => {
      const d = document.querySelector(".font-display");
      return d
        ? getComputedStyle(d).fontFamily + " @ " + getComputedStyle(d).fontSize
        : "none found";
    })(),
  };

  console.log(JSON.stringify(out, null, 2));
  return out;
})();
