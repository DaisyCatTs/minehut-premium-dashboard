#!/usr/bin/env python3
"""ladder.py — DESIGN a palette. It does not verify one.

This computes hex -> shadcn HSL triplet, measured relative luminance and CIE L*,
and a full contrast matrix, from values hardcoded below. That makes it useful when
choosing a ladder, and useless for checking the shipped one: it never reads the
stylesheet, so it cannot notice when the CSS drifts away from it. It did not
notice when a card-colour change silently invalidated every contrast figure in
the file.

**Use `tools/check-palette.py` to verify.** That one parses the shipped CSS,
recomputes every ratio, and fails on any comment that disagrees with reality.

Edit the values under "the v2 palette" below to explore a change, then move the
result into section 03 of the stylesheet and re-run check-palette.py.
"""Compute the v2 palette: hex -> shadcn HSL triplet, measured luminance, contrast matrix.

shadcn consumes `hsl(var(--card))`, which needs a BARE component triplet (H S% L%).
No CSS feature derives a triplet from a colour, so the triplets must be authored --
which is why they are the source of truth and --mh-* is derived from them.

HSL L% is not perceptually uniform, so the ladder is stepped by measured relative
luminance (Y) and CIE L*, not by nominal L%. Every contrast number printed here goes
into the stylesheet as a comment naming its reference surface.
"""

def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def rgb_hex(r, g, b):
    return "#%02X%02X%02X" % (round(r), round(g), round(b))


def hsl_triplet(h):
    r, g, b = (c / 255 for c in hex_rgb(h))
    mx, mn = max(r, g, b), min(r, g, b)
    d = mx - mn
    L = (mx + mn) / 2
    if d == 0:
        H = S = 0.0
    else:
        S = d / (1 - abs(2 * L - 1))
        if mx == r:
            H = 60 * (((g - b) / d) % 6)
        elif mx == g:
            H = 60 * ((b - r) / d + 2)
        else:
            H = 60 * ((r - g) / d + 4)
    return H, S * 100, L * 100


def triplet_hex(H, S, L):
    """Round-trip check: does the rounded triplet still land on the intended colour?"""
    S, L = S / 100, L / 100
    C = (1 - abs(2 * L - 1)) * S
    X = C * (1 - abs((H / 60) % 2 - 1))
    m = L - C / 2
    r, g, b = [
        (C, X, 0), (X, C, 0), (0, C, X), (0, X, C), (X, 0, C), (C, 0, X)
    ][int(H // 60) % 6]
    return rgb_hex((r + m) * 255, (g + m) * 255, (b + m) * 255)


def lum(h):
    def f(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = hex_rgb(h)
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def lstar(h):
    y = lum(h)
    return 116 * (y ** (1 / 3)) - 16 if y > 0.008856 else 903.3 * y


# ── the v2 palette ────────────────────────────────────────────────────────────
SURFACES = [
    ("--background", "#0A0A09", "page"),
    ("--card",       "#121110", "cards, primary containers"),
    ("--muted",      "#1A1917", "inputs, hover, secondary fills"),
    ("--popover",    "#212020", "menus, dialogs, raised"),
    ("--accent",     "#2A2926", "top rung: hover on raised"),
]
INKS = [
    ("--foreground",           "#F5F4F2", "titles"),
    ("--secondary-foreground", "#C9C6C1", "body"),
    ("--muted-foreground",     "#94918B", "metadata"),
    ("--mh-ink-4",             "#736F69", "micro labels"),
]
ACCENTS = [
    ("--primary / --ring", "#5B93E8", "accent-strong"),
    ("--destructive",      "#D9736F", "danger"),
    ("--mh-emerald",       "#4CC08A", "running"),
    ("--mh-gold",          "#D9A94F", "warning"),
    ("--mh-diamond",       "#6FC4C0", "version/info"),
    ("--mh-amethyst",      "#9B93D6", "plugin"),
    ("--mh-copper",        "#C98A66", "misc"),
    ("--mh-lapis",         "#4A6FB5", "misc"),
    ("--mh-redstone",      "#D9736F", "danger hue"),
]
BORDERS = [("--border", "#2E2C29"), ("--input", "#3A3733")]

print("=== SURFACES (triplet, round-trip, measured) ===")
prev = None
for name, hx, use in SURFACES:
    H, S, L = hsl_triplet(hx)
    t = f"{H:.0f} {S:.0f}% {L:.1f}%"
    rt = triplet_hex(*[float(x.rstrip('%')) for x in t.split()])
    step = f"  dL* {lstar(hx) - lstar(prev):+.1f}" if prev else ""
    print(f"{name:<12} {hx}  ->  {t:<16} rt:{rt} {'OK' if rt.lower()==hx.lower() else 'DRIFT'}"
          f"  Y {lum(hx):.4f}  L* {lstar(hx):5.1f}{step}   {use}")
    prev = hx

print("\n=== BORDERS ===")
for name, hx in BORDERS:
    H, S, L = hsl_triplet(hx)
    print(f"{name:<12} {hx}  ->  {H:.0f} {S:.0f}% {L:.1f}%   vs card {contrast(hx, '#121110'):.2f}:1")

print("\n=== INK CONTRAST MATRIX (: 1) ===")
hdr = "".join(f"{n.replace('--',''):>13}" for n, _, _ in SURFACES)
print(f"{'ink':<24}{hdr}")
for iname, ihex, use in INKS:
    row = "".join(f"{contrast(ihex, shex):>13.2f}" for _, shex, _ in SURFACES)
    print(f"{iname:<15}{ihex} {row}   ({use})")

print("\n=== ACCENT / STATUS on card #121110 and page #0A0A09 ===")
for name, hx, use in ACCENTS:
    H, S, L = hsl_triplet(hx)
    print(f"{name:<22}{hx}  {H:.0f} {S:.0f}% {L:.1f}%   card {contrast(hx,'#121110'):5.2f}:1"
          f"   page {contrast(hx,'#0A0A09'):5.2f}:1   ({use})")

print("\n=== FOCUS RING (WCAG 2.4.11 needs >=3:1 on every surface it appears over) ===")
for _, shex, use in SURFACES:
    c = contrast("#5B93E8", shex)
    print(f"  #5B93E8 on {shex} ({use:<28}) {c:5.2f}:1  {'PASS' if c >= 3 else 'FAIL'}")

print("\n=== DISABLED TEXT (target >=4.5:1 on the disabled surface --muted) ===")
for hx in ("#8A8781", "#94918B", "#A19D96"):
    print(f"  {hx} on #1A1917  {contrast(hx, '#1A1917'):.2f}:1")
