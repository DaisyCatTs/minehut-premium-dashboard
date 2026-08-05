# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file **UserCSS theme** (Stylus) that restyles `dashboard.minehut.com`. There is no
package manager, build step, test runner, or linter — the deliverable _is_
`minehut-premium-dashboard.user.css`, shipped verbatim from the repo's raw URL.

| Path                                   | Role                                                                                                                                                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minehut-premium-dashboard.user.css`   | The entire theme (~2840 lines, one `@-moz-document` block)                                                                                                                                                       |
| `Original Css from their next static/` | Minehut's own shipped Next.js CSS bundles — the reference for real class names and token values. **Gitignored** (their copyrighted output, not ours to redistribute). Keep a local copy when doing selector work |
| `tools/`                               | The verification gate that stands in for the absent build step, plus `bundle-tokens.txt` — the extracted class-name list the audits fall back to when the bundle isn't present                                   |
| `Theme guide.md`                       | The design brief the theme is written against (restraint, elevation-by-lightness, no "AI UI")                                                                                                                    |
| `docs/screenshots/`                    | README images                                                                                                                                                                                                    |

## Release / distribution

Users install from `@updateURL` (raw `main`). **Bumping `@version` in the UserStyle header is
what pushes an update to every installed user** — treat it as the release action, and only bump
when the user asks to ship.

## Architecture: authored vs derived tokens

**One rule decides the whole design:** shadcn consumes `hsl(var(--card))`, which needs a _bare
component triplet_ (`H S% L%`), not a colour. No CSS feature can produce a bare triplet from a
colour — not `color-mix()`, not relative colour syntax. So the shadcn layer cannot be derived, and
is therefore the **source of truth**.

- **Authored** (§03, §04a) — shadcn triplets: `--background --card --muted --secondary --popover
--accent --border --input --foreground --muted-foreground --primary --ring --destructive`, plus
  `--surface-grain`, `--chart-*` and the 18 `--console-*` slots. The only place numbers live.
- **Derived** (§04) — Minehut's `--mh-*` aliased straight off the triplets:
  `--mh-bg: hsl(var(--background))`, `--mh-line: hsl(var(--border))`, and so on. Drift is
  structurally impossible because there is nothing to keep in sync.
- **Theme-private** (§05) — only what Minehut has no equivalent for: `--og-lift*` (inner
  highlights), `--og-glass*`, and the `--og-r-*` radii.

v1.5.0 authored two parallel ladders and they drifted: `--card` sat 3.2pp lighter than its `--og-s1`
twin, `--popover` 5.8pp lighter than `--og-s3`. That whole class of bug is gone.

Two traps worth knowing: `--mh-bg-1` and `--mh-bg-2` have **zero** `var()` consumers in Minehut's
bundle (overriding them does nothing); `--surface-grain`'s value carries an inline `/ alpha` that
feeds a `repeating-conic-gradient` on `body` — drop the slash and you paint an opaque checkerboard
over the page.

**Prefer claiming a token over adding a selector.** A token override reaches every consumer, costs
no specificity, and cannot over-match. Claiming `--border` alone retires most border rules, because
Minehut ships `*{border-color:hsl(var(--border))}`.

## The dark gate

Everything from §10 to §71 lives inside **one** nested block:

```css
.dark, [data-theme="dark"] { & .bg-card { … } }
```

`&` resolves to `:is(.dark, [data-theme="dark"])` = (0,1,0), so a gated `.bg-card` is (0,2,0) and
beats Minehut's `.bg-card` and `.mh-nav-item` (both (0,1,0)) **without `!important`**. That is why
the file carries 157 `!important` instead of 339. It also means light mode is genuinely untouched —
before 2.0.0 the palette was `:root` and ~200 rules were ungated, so Minehut's light theme rendered
dark cards on light tokens.

Two hazards this creates:

- **`& html` never matches.** It resolves to `:is(.dark) html`, and `.dark` sits _on_ `<html>`.
  Root-element styling is handled separately in §08 with `html.dark, html[data-theme="dark"]`.
- **Bare declarations must not follow a nested rule** inside the gate — Chrome 112–129 predates
  `CSSNestedDeclarations` and drops them silently. This is why `--console-*` lives in §04a rather
  than beside the console rules.

Always write `&` explicitly; relaxed nesting is newer and fails silently on older builds.

## The `!important` policy

Permitted in exactly four cases, each carrying a same-line tag. **An untagged `!important` is a
bug**, and the validator fails the file for it.

| Tag              | When                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `!imp:token`     | Overriding a custom property Minehut also declares — Next.js appends route CSS chunks on client navigation, so source order isn't safe for tokens. |
| `!imp:dark-util` | Beating a `dark:` variant. Those compile to `.dark\:x:is(.dark *)` = (0,2,0), which _ties_ our gated (0,2,0), and ties resolve on source order.    |
| `!imp:bang`      | Beating a utility that ships `!important` itself — only `.mh-tabs > button.\!active`.                                                              |
| `!imp:a11y`      | §80/§90 must beat the whole file by construction.                                                                                                  |

## Selector conventions

Prefer hooks in this order — the marker on each rule records which tier it is, so
`grep '@risk F'` is the breakage inventory:

- **`@risk D`** — Minehut's eleven hand-written classes (`.mh-nav-item`, `.mh-meter-track`,
  `.mh-meter-fill`, `.mh-sc-icon`, `.mh-nav-count`, `.mh-tabs`, `.mh-tab-in`, `.ds-label`,
  `.font-display`, `.mh-gs-lockup`, `.mh-cloud-cluster-*`), elements, ARIA roles, `data-*`
  attributes, and library DOM classes (`svg.lucide`, `.recharts-*`). Survives a rebuild.
- **`@risk S`** — stock Tailwind names (`.bg-card`, `.border-input`, `.bg-black\/80`).
- **`@risk F`** — arbitrary generated values (`rounded-[10px]`, `bg-[#1c1c1c]`, the Monokai
  literals). 13 remain, listed in §99 with the audit string that verifies each.

Note this is shadcn **pre-`data-slot`** — there is no `data-slot`, `data-radix-*`,
`data-orientation` or `data-highlighted` in the bundle. Radix is confirmed via
`--radix-select-trigger-*` / `--radix-dropdown-menu-trigger-width` and `[data-side=*]`.

**Never ship a new `[class*=]` without running the audit.** Substring matching over-matches
silently, and every instance of it in v1.5.0 was wrong: `p-6` also matched `gap-6`; `p-4` matched
`gap-4`; `backdrop` matched `.backdrop-blur`; `popover` matched `.text-popover-foreground`;
`bg-[#` matched `hover:bg-[#3D2210]` and killed that hover permanently; `destructive` matched
`hover:text-destructive`, giving ghost buttons a permanent red skin; and `h-` matched **200 of
1096** class tokens because every `--mh-*` utility contains `mh-`, which left the WCAG target-size
rule dead on most buttons.

## File layout

One `@-moz-document domain("dashboard.minehut.com")` wrapper. Sections carry numbered banners
(`/* §32  TABS */`), so `Ctrl-F "§32"` is a single hit; the contents list is in §01. Order encodes
a rule: **each section may only override sections above it.**

```
§01 CONTRACT   §02 KNOBS      §03 LADDER (authored)  §04 DERIVED   §04a CONSOLE
§05 HUES       §06 GEOMETRY   §07 MOTION             §08 GLOBAL (ungated)
──── gate ──── §10–§71 components ──── gate ────
§80 A11Y (ungated)   §90 DEGRADATION   §99 RISK REGISTER
```

§07 sits before every component because **no component may write a duration literal** — that is
what makes the `--og-speed` knob honest. §61 (literal-colour quarantine) is deliberately late
because it must override §11. §80/§90 are last so they beat everything.

The tail holds three _separate_ degradation blocks — `@supports not (backdrop-filter)`,
`prefers-reduced-transparency`, `prefers-reduced-motion`. Reduced transparency and reduced motion
are distinct user needs; keep them separate. Any new blur or moved property must be registered
there, and note that killing `transition-duration` alone leaves a transform applied _instantly_ —
`translate`, `scale` and `transform` are each neutralised explicitly.

## Motion

Minehut runs **six** timing regimes at once. Claiming `--mh-dur-*` and `--mh-ease-*` covers two;
the other four are stock Tailwind timing utilities whose values are baked into the class name, so
§07 restyles them by name. `.ease-mh-out` and `.ease-mh-spring` in particular hardcode their
cubic-beziers rather than reading the variable — after any bundle refresh, re-grep for
`cubic-bezier` and claim every literal, or motion silently re-fragments.

Never put a `transition` **shorthand** on `input` — Minehut ships
`input:-webkit-autofill { transition: background-color 9999s }` to freeze Chrome's autofill
repaint, and a shorthand with `!important` destroys it. Use the longhands only.

## Design constraints (from `Theme guide.md`, enforced in the CSS)

- **Depth comes from lightness, not shadow.** Hover raises a surface up the ladder; it doesn't add
  a glow. Small `translateY(-2px)` at most.
- **`backdrop-filter` is restricted to the sidebar and overlays** — it repaints every scroll frame,
  so it never touches cards or lists.
- **One desaturated accent.** Blue means interaction/focus/selection only; data and labels stay
  neutral. Status colour always pairs with a dot _and_ a label.
- Contrast is measured, not eyeballed, and **every ratio names its reference surface**. On `--card`:
  18.42 / 11.94 / 7.75 / 5.06 : 1 for the four ink tiers, evenly spaced at 1.54x; focus ring
  5.17–7.58 : 1 across all five surfaces. `tools/check-palette.py` recomputes every claim from the
  shipped CSS and **fails on any comment that disagrees** — don't hand-write a ratio.
- **The palette is pure neutral (zero chroma).** Minehut puts every token at hue 35–45, which leaves
  no neutral reference and makes small uppercase labels read brown. Chroma was trimmed twice before
  removing it entirely. Don't reintroduce warmth to the greys.
- **The stylesheet is PLAIN VALID CSS — it is not a template.** This paragraph used to say the
  opposite and that misconception cost two broken releases. `@preprocessor default` performs **no
  placeholder substitution at all**; it only injects `:root { --accentHsl: <chosen value> }` above
  the sheet. So there is no `[[…]]` token anywhere, and there must never be one — writing
  `/*[[accent]]*/` inside a comment in 4.1.0 terminated the enclosing comment and turned the rest of
  the file into live CSS while every gate still reported OK. Only `@preprocessor uso` substitutes.
  The twelve presets are read via `var(--accentHsl, 210 100% 69.8%)`, so the fallback keeps the file
  correct even if Stylus injects nothing. `build-fixture.js --accent Purple` previews another theme
  by injecting the same declaration a browser would.
- **`--og-accent` is derived, never authored** — `hsl(var(--primary))`. There is exactly one place an
  accent is chosen. It used to be a hand-written hex kept equal to the triplet by a script, and they
  had already drifted apart once, shipping two accents at the same time.
- **A substring match is dangerous in ancestor position** in a way it isn't as a target.
  `[class*="mh-brand"] span.bg-current` matched any forebear carrying the string — including
  `hover:bg-[color-mix(…var(--mh-brand)…)]` — and recoloured every dot beneath it.
- **Never run prettier on the stylesheet** — it's in `.prettierignore`. Escaped classes contain
  `c ` hex escapes where the trailing space is load-bearing; prettier wraps there and silently
  converts a class selector into a descendant combinator.
- **Spend the accent rarely.** v1.5.0 used one blue 38 times at one saturation with 16 glow
  declarations up to `0 0 28px`. v2 tiers it (strong / base / soft) and uses it ~12 times.
- Radius scale 8 / 10 / 12 / 14 / 16 / pill, keyed to element size — not one value everywhere.
- Typography: **consume** `var(--font-geist-sans)` / `--font-geist-mono` / `--font-display`, never
  redeclare them (they live on hashed `.__variable_*` classes, and redeclaring defeats next/font's
  `size-adjust` fallback metrics). v1.5.0 requested Inter, which the page never loads, so the whole
  UI fell through to Segoe UI. Unbounded is display-only, on `h1`.

## Verifying a change

There is no build or test runner. Eight gates stand in, split into two groups, and **both groups
must pass** before shipping:

```sh
npm run check          # static — the stylesheet against Minehut's class list
npm run check:visual   # visual — the theme rendered in a real browser
```

The split is the important part. The static gates cannot tell whether a rule _reaches_ anything,
and every notable bug in this file's history got past them: the accent picker that never
substituted, the pink wizard card, the dead nav hover, the accent bar painted at 1.27:1. Each
visual gate exists because a release shipped without it and broke something.

### Static — `npm run check`

| Check                    | What it catches                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `audit-selectors.py`     | What each `[class*=]` **actually** matches in Minehut's bundle. A pattern ships only if the hit set equals the intended set recorded in its `@risk` comment. |
| `check-exact-classes.py` | Exact escaped selectors (`.bg-\[var\(--mh-brand\)\]`) that match nothing — a typo there fails silently.                                                      |
| `check-css.js`           | Brace/paren/comment balance, declarations outside any block, unknown at-rules, and untagged `!important`.                                                    |

| `check-palette.py` | Every colour claim against its shipped value — resolves the triplets, recomputes each ratio, fails on any comment that disagrees. Never hand-write a ratio. |

### Visual — `npm run check:visual` (needs `playwright`)

| Check                  | What it catches                                                                                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-light-mode.js`  | The dark theme leaking into light mode. Exactly one property may differ: `--mh-r-md`'s radius, documented in §06 as the one deliberate exception.                    |
| `check-accent-leak.js` | Values that do not follow the accent — renders blue vs amber and reports whatever stayed blue. `--mh-amethyst` is allowlisted; identity hues are accent-independent. |
| `check-hover.js`       | Hovers that do nothing, and hovers that make something illegible.                                                                                                    |
| `audit-all-accents.js` | Renders once per accent and runs the contrast checks against each. Reads the presets from the `@var` block, so there is one source of truth.                         |

**A dead-hover exemption is a claim about intent, not a way to silence the gate.** `check-hover.js`
skips elements that are covered, disabled, settled, or delegating feedback upward — but never one
that ships its own `hover:` utility. Widening an exemption to make it pass produced a false negative
once already, and the bug reached the user.

The static gates strip comments before counting — otherwise documenting a removed selector re-reports
it forever. The bundle itself is gitignored, so the audits read `tools/bundle-tokens.txt` when it's
absent; results are identical. After refreshing the bundle, regenerate it with
`python tools/audit-selectors.py --write-tokens`, update the `@note bundle` hash in §01, and
re-audit — a new bundle invalidates every `@risk F` line.

Then load in Stylus and hard-reload `dashboard.minehut.com`. Only **My Servers** and **Console** are
visually verified — say so rather than claiming coverage. **File Manager, Backups and Stats have
never been rendered by either party.** Check **both** themes: the theme gates to dark, so light mode
must look like stock Minehut.

**Green gates are not the same as verified.** Three consecutive releases passed every gate and still
shipped a defect the owner spotted by eye within minutes. When that happens, fix the bug _and_ the
gate that missed it — a fix without a new gate is half the work.

Four things the scripts cannot settle, which need one DevTools paste:
`document.documentElement.className` (is `.dark` on `<html>`?); whether every `<article>` is a
server card (settles the file's largest remaining `@risk F`); whether the card is the nearest
positioned ancestor of the status pill (would allow state-coloured rails back without `:has()`);
and that `.rounded-[var(--mh-r-md)]` really did compute to `0px` before we declared it.

Before touching a component rule, check the real class names in
`Original Css from their next static/` instead of guessing.
