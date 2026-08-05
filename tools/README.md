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
| `check-palette.py` | Every colour claim in the stylesheet against its shipped value — resolves the authored triplets, recomputes each ratio, and fails on any comment that disagrees. Also enforces the AA floor on the material hues, 3:1 on the focus ring, and that exactly one accent is shipping. |

These three check the stylesheet against Minehut's CSS. They cannot tell you
whether a rule reaches anything on a real page — `recon.js` and `audit-page.js`
below do that, and both have caught bugs these three passed.

```sh
python tools/audit-selectors.py                 # audit every pattern in the theme
python tools/audit-selectors.py "bg-[#1c1c1c]"  # ad-hoc: what does this substring hit?
python tools/audit-selectors.py --tokens        # dump every class token in the bundle
python tools/audit-selectors.py --hash          # bundle hashes, for the @note line
python tools/check-exact-classes.py
node   tools/check-css.js minehut-premium-dashboard.user.css
```

## Palette

Two scripts, and the distinction matters:

- **`check-palette.py` verifies.** It parses the shipped CSS, resolves the
  authored triplets itself, recomputes every ratio, and diffs against the numbers
  written in the comments. Run it after any colour change.
- **`ladder.py` designs.** It computes a ladder from hardcoded values, which is
  useful when *choosing* one and verifies nothing — it never reads the stylesheet.

That distinction was learned the hard way: `ladder.py` was treated as the
verification story, so when the card colour was brightened, every contrast figure
in the file silently became wrong and nothing noticed for four releases.

```sh
python tools/check-palette.py     # gate — fails on drift
python tools/ladder.py            # exploration only
```

## Seeing it render, without a Minehut login

This is the one that closes the loop. Everything else verifies the stylesheet
against the *bundle*; this verifies it against a *rendering*.

```sh
node tools/build-fixture.js          # writes tools/fixture.html
```

It inlines Minehut's real shipped CSS, unwraps the theme's `@-moz-document` block
so it applies to a local file, and rebuilds the exact markup `recon.js` captured
from the live DOM — every class string in it was copied from the real page, not
invented. Open the result and toggle `class="dark"` on `<html>` to check light mode.

One divergence: next/font serves Geist, Unbounded and Silkscreen from Minehut's
origin, so letterforms fall back locally. Colour, spacing, elevation, borders and
state all render faithfully; type does not.

## Runtime QA on any page

`audit-page.js` works backwards from what actually rendered rather than from what
the stylesheet claims, which is how it finds gaps on routes nobody has looked at.
Paste it into the console on any route, in both themes. It reports:

- **Unthemed colours** — every computed colour on the page that is not one of the
  theme's tokens. The mechanical version of "what did I miss".
- **Contrast failures** — every visible text node against its real *composited*
  background, at the correct AA threshold for its size and weight.
- **Component census** — which component families exist on this route.

It caught two token bugs on its first run: the console blue had been left on a
superseded accent, and console bright-black was below AA.

## DevTools recon

`recon.js` collects the structural facts the CSS cannot supply — how the page is
assembled, rather than which class names exist. Run it on a route before writing
rules for that route. It settled the `main article` migration, proved the tab bar
has no `.mh-tabs`/`[role=tab]` anywhere on it, and confirmed the status pill is
deliberately outside the hue-tinted family.

`devtools-preconditions.js` is the older, narrower snippet for four specific
questions; `recon.js` supersedes it.

**Verify a hook in the DOM, not just in the stylesheet.** A whole section of this
theme once targeted `.mh-tabs`, which is compiled into Minehut's CSS but appears
zero times on the page it was written for.

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
