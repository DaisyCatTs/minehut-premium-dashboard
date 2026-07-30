# Minehut Premium Dashboard

A premium dark theme for [dashboard.minehut.com](https://dashboard.minehut.com).

OLED surfaces, elevation carried by lightness rather than shadow, a single
desaturated accent, glass confined to overlays, and every text colour measured
against WCAG instead of eyeballed.

*by Daisy · MIT*

---

## Install

**1. Get Stylus**

| Browser | Source |
|---|---|
| Chrome · Brave · Opera · Vivaldi | Chrome Web Store → **Stylus** |
| Edge | Edge Add-ons → **Stylus** |
| Firefox | Firefox Add-ons → **Stylus** |
| Safari | Stylus is unavailable — use **Cascadea** or **Userscripts** |

Install *Stylus*, not *Stylish*.

**2. Add the theme**

Click the raw `.user.css` link and Stylus will offer to install it:

```
https://github.com/DaisyCatTs/minehut-premium-dashboard/raw/refs/heads/main/minehut-premium-dashboard.user.css
```

Updates are then automatic — Stylus checks `@updateURL`.

**3. Set the site to Dark**

Bottom of the Minehut sidebar: sun / monitor / moon → pick the moon. The theme
styles dark mode only.

<details>
<summary>Manual install instead</summary>

Stylus icon → **Manage** → **Write new style** → paste the file → **Save**.
The theme carries its own `@match`, so leave "Applies to" alone. No
auto-updates and no settings panel this way.
</details>

<details>
<summary>Publishing your own copy</summary>

Any URL ending in `.user.css` triggers Stylus's install prompt, so a public
[Gist](https://gist.github.com) works as well as a repo. Name the file
`minehut-premium-dashboard.user.css`, then point `@updateURL` at its raw URL.
Bumping `@version` offers an update to everyone who installed it.
</details>

---

## Settings

Stylus icon → the theme's gear icon.

| Setting | Default | Notes |
|---|---|---|
| Accent colour | `#5A97E2` | Drives every blue — borders, rails, focus rings, buttons, console prompt |
| Page background | `#0A0A0C` | Below `#050505` flattens elevation; surfaces need room to step up |
| Motion speed | `150ms` | `0` disables transitions; past ~220ms feels sluggish |
| Card corner radius | `16px` | Buttons and inputs stay at 12px to keep the scale intact |

Picking a heavily saturated accent will fight the design: saturated colour on a
near-black ground reads as though it is emitting light. Around 70% saturation
stays calm.

---

## Design

**Elevation is lightness.** Shadows are nearly invisible on a dark ground, so
depth comes from a five-step surface ladder about 4–5 L\* apart. Hover raises a
surface instead of casting a shadow.

**Accent is earned.** Blue marks interaction, focus, navigation and selection.
Data, labels and domains stay neutral, so blue always means something.

**Colour carries state.** Emerald running, red pending deletion, amber warning,
teal version. Each status pairs colour with a dot *and* a text label, so it never
depends on colour alone.

**Glass is rare.** Sidebar and overlays only. `backdrop-filter` is the most
expensive filter available and repaints every scroll frame, so it never touches
cards or lists.

**Measured, not guessed.** Four text tiers at 17.0 / 11.6 / 7.1 / 5.2 : 1 against
the card surface. Focus ring 3.7–5.0 : 1 on every surface it can appear over.
Spacing wholly on the 8pt grid.

---

## Troubleshooting

**Nothing changed.** Check the Stylus badge shows a count. If it reads `0`, the
URL didn't match — confirm you're on `dashboard.minehut.com`, not
`app.minehut.com`.

**Page looks light and broken.** The site's own toggle is on Light or System.

**Some pages look plain.** Only **My Servers** and **Console** are visually
verified. Other routes inherit the colour tokens, so they won't look broken, but
their component details are untested.

**Blur looks wrong or scrolls badly.** Enable reduced transparency in your OS
accessibility settings; the theme detects it and switches to solid surfaces.

**Broke after a Minehut update.** Likely. The colour tokens are durable, but
rules matching Tailwind's generated class strings (e.g. `rounded-[10px]`) break
when those change. `THEME-SPEC.md` §II.4 lists the verified selectors.

**A control vanished or stopped responding.** Disable the theme to confirm the
cause, then open an issue with the element's HTML. `THEME-SPEC.md` documents 13
bugs of exactly this kind.

---

## Files

| File | Purpose |
|---|---|
| `minehut-premium-dashboard.user.css` | The theme |
| `THEME-SPEC.md` | Design system, measured palette, verified selector reference, 13 documented pitfalls — read before editing |

Not affiliated with Minehut.
