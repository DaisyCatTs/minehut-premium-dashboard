# tools/

Verification for a project with no build step. Run all three before shipping any
selector change; they are the substitute for a linter and a test suite.

Everything resolves paths from the repo root. **All three strip comments before
counting** — without that, documenting a removed selector ("`[class*="divider"]`
dropped — 0 hits") re-reports it forever as a live dead rule.

### Where the class names come from

Minehut's shipped CSS lives in `Original Css from their next static/` and is
**gitignored** — it is their copyrighted production output and does not belong in
an MIT repo. Neither audit needs the CSS itself, only the list of class *names*,
so that list is committed as **`bundle-tokens.txt`** (1096 entries) and both
scripts fall back to it automatically when the folder is absent. A fresh clone can
run the full gate with no downloads; results are identical either way.

| Script | Catches |
|---|---|
| `audit-selectors.py` | What each `[class*=]` **actually** matches. A pattern may ship only if the hit set equals the intended set recorded in its `@risk` comment. |
| `check-exact-classes.py` | Exact escaped selectors (`.bg-\[var\(--mh-brand\)\]`) that match nothing. A typo there fails silently — the rule just never applies. |
| `check-css.js` | Brace/paren/comment/string balance, declarations outside any block, unknown at-rules, and **untagged `!important`** (a policy violation per §01). |

```sh
python tools/audit-selectors.py                 # audit every pattern in the theme
python tools/audit-selectors.py "bg-[#1c1c1c]"  # ad-hoc: what does this substring hit?
python tools/audit-selectors.py --tokens        # dump every class token in the bundle
python tools/audit-selectors.py --hash          # bundle hashes, for the @note line
python tools/check-exact-classes.py
node   tools/check-css.js minehut-premium-dashboard.user.css
```

## Palette

`ladder.py` computes the §03 surface ladder: hex → shadcn HSL triplet (with a
round-trip check that the rounded triplet still lands on the intended colour),
measured relative luminance and CIE L\* per rung, and the full ink/accent contrast
matrix against every surface.

Use it whenever a colour changes — the stylesheet's contrast comments each name
the surface they were measured on, and they have to stay true.

```sh
python tools/ladder.py
```

## DevTools

`devtools-preconditions.js` is a paste-into-the-console snippet for the four
questions the CSS cannot answer: whether `.dark` sits on `<html>`, whether every
`<article>` is a server card, whether the card is the nearest positioned ancestor
of the status pill, and whether `--mh-r-md` really computed to `0px` before the
theme declared it. Run it on **My Servers** and on a server's **Console** tab.

The first two gate real decisions — see §99 in the stylesheet.

## Refreshing the bundle

When Minehut rebuilds:

```sh
# 1. drop the new _next/static/css/*.css into the (gitignored) reference folder
# 2. regenerate the committed class-name list
python tools/audit-selectors.py --write-tokens
# 3. update the @note bundle hash in section 01
python tools/audit-selectors.py --hash
# 4. re-audit — a new bundle invalidates every @risk F line
python tools/audit-selectors.py
python tools/check-exact-classes.py
```

`--write-tokens` refuses to run off the cached list, so it can never regenerate
itself from stale data.
