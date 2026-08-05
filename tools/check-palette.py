#!/usr/bin/env python3
"""check-palette.py — verify the stylesheet's colour claims against its own values.

`ladder.py` computes a palette from hardcoded inputs, which is useful for DESIGNING
one but verifies nothing: it cannot notice when the CSS drifts away from it. That is
exactly how a whole set of contrast figures survived a ladder change -- every ratio
in the file had been measured against a card colour that no longer shipped.

This reads the shipped CSS, resolves the authored triplets itself, recomputes every
ratio, and diffs against the numbers written in the comments. It fails the build on
drift, so a colour change that does not update its own documentation cannot ship.

    python tools/check-palette.py
"""

import re
import sys
from pathlib import Path

THEME = "minehut-premium-dashboard.user.css"
TOL = 0.15  # a claimed ratio may differ from measured by at most this


def repo_root() -> Path:
    here = Path(__file__).resolve().parent
    for cand in (here, *here.parents):
        if (cand / THEME).is_file():
            return cand
    sys.exit(f"error: could not find {THEME}")


def triplet_to_rgb(h: float, s: float, ll: float):
    s, ll = s / 100, ll / 100
    c = (1 - abs(2 * ll - 1)) * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = ll - c / 2
    r, g, b = [(c, x, 0), (x, c, 0), (0, c, x), (0, x, c), (x, 0, c), (c, 0, x)][int(h // 60) % 6]
    return tuple(round((v + m) * 255) for v in (r, g, b))


def hex_to_rgb(s: str):
    s = s.lstrip("#")
    return tuple(int(s[i : i + 2], 16) for i in (0, 2, 4))


def rgb_hex(rgb) -> str:
    return "#" + "".join(f"{v:02X}" for v in rgb)


def lum(rgb) -> float:
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b) -> float:
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def lstar(rgb) -> float:
    y = lum(rgb)
    return 116 * (y ** (1 / 3)) - 16 if y > 0.008856 else 903.3 * y


repo = repo_root()
css = (repo / THEME).read_text(encoding="utf-8")

# The stylesheet is a Stylus template: @preprocessor default means it carries
# /*[[name]]*/ placeholders that Stylus substitutes at save time. Resolve each
# one to its DEFAULT (the option marked with *) so the gate can verify the raw
# file exactly as it would ship out of the box.
_vars = {}
for m in re.finditer(r"@var\s+select\s+(\w+)\s+\"[^\"]*\"\s*\{([^}]*)\}", css):
    name, body = m.group(1), m.group(2)
    opts = re.findall(r"\"([^\"]+)\"\s*:\s*\"([^\"]+)\"", body)
    default = next((v for k, v in opts if k.endswith("*")), opts[0][1] if opts else None)
    if default:
        _vars[name] = default
for name, val in _vars.items():
    css = css.replace(f"/*[[{name}]]*/", val)
if _vars:
    print("resolved @var defaults: " + ", ".join(f"{k}={v}" for k, v in _vars.items()))


# --ring / --chart-1 alias --primary rather than restating it; resolve the
# indirection so every downstream check still sees a real triplet.
_prim = re.search(r"--primary:\s*([\d.]+\s+[\d.]+%\s+[\d.]+%)", css)
if _prim:
    css = re.sub(r"(--(?:ring|chart-1):\s*)var\(--primary\)", r"\g<1>" + _prim.group(1), css)

# ── resolve every authored triplet and raw colour token from the CSS itself ──
triplets, colours = {}, {}
for m in re.finditer(r"(--[a-z0-9-]+):\s*(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*(?:/\s*[\d.]+\s*)?!important", css):
    triplets[m.group(1)] = triplet_to_rgb(float(m.group(2)), float(m.group(3)), float(m.group(4)))
for m in re.finditer(r"(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*!important", css):
    colours[m.group(1)] = hex_to_rgb(m.group(2))

need = ["--background", "--card", "--muted", "--popover", "--accent", "--foreground", "--muted-foreground", "--primary"]
missing = [t for t in need if t not in triplets]
if missing:
    sys.exit(f"error: could not resolve {missing} from the stylesheet")

card = triplets["--card"]
fails, warns = [], []

print(f"resolved {len(triplets)} triplets + {len(colours)} raw colour tokens from {THEME}\n")

print("=== SURFACE LADDER (measured from the shipped values) ===")
prev = None
for t in ["--background", "--card", "--muted", "--popover", "--accent"]:
    rgb = triplets[t]
    step = f"  dL* {lstar(rgb) - lstar(prev):+.1f}" if prev else ""
    print(f"  {t:<20}{rgb_hex(rgb)}  L* {lstar(rgb):5.1f}{step}")
    prev = rgb

# ── every "N.NN:1 on --card" claim in a comment must match reality ───────────
print("\n=== CLAIMED vs MEASURED ===")
for m in re.finditer(r"(--[a-z0-9-]+):[^;]*;\s*/\*\s*(#[0-9a-fA-F]{6})?\s*([\d.]+):1 on --card", css):
    tok, claimed_hex, claimed = m.group(1), m.group(2), float(m.group(3))
    rgb = triplets.get(tok) or colours.get(tok)
    if rgb is None:
        continue
    actual = contrast(rgb, card)
    ok = abs(actual - claimed) <= TOL
    hex_ok = claimed_hex is None or claimed_hex.upper() == rgb_hex(rgb)
    flag = "" if ok and hex_ok else "   <-- DRIFT"
    if not ok or not hex_ok:
        fails.append(f"{tok}: comment says {claimed_hex or ''} {claimed}:1, actual {rgb_hex(rgb)} {actual:.2f}:1")
    print(f"  {tok:<22}{rgb_hex(rgb)}  claimed {claimed:5.2f}  actual {actual:5.2f}{flag}")

# ── the material hues must clear AA on the card they are documented against ──
print("\n=== MATERIAL HUES on --card ===")
for tok in ["--mh-emerald", "--mh-gold", "--mh-diamond", "--mh-amethyst", "--mh-copper", "--mh-redstone", "--mh-lapis"]:
    if tok not in colours:
        continue
    c = contrast(colours[tok], card)
    flag = "" if c >= 4.5 else "   <-- BELOW AA"
    if c < 4.5:
        fails.append(f"{tok} is {c:.2f}:1 on --card, below the 4.5 floor")
    elif c < 4.7:
        warns.append(f"{tok} is {c:.2f}:1 — only just above the floor")
    print(f"  {tok:<20}{rgb_hex(colours[tok])}  {c:5.2f}:1{flag}")

# ── the focus ring must clear 3:1 on every surface it can appear over ────────
print("\n=== FOCUS RING (WCAG 2.4.11, needs 3:1) ===")
for t in ["--background", "--card", "--muted", "--popover", "--accent"]:
    c = contrast(triplets["--primary"], triplets[t])
    flag = "" if c >= 3 else "   <-- FAIL"
    if c < 3:
        fails.append(f"ring is {c:.2f}:1 on {t}")
    print(f"  on {t:<18}{c:5.2f}:1{flag}")

# ── one accent, not two ─────────────────────────────────────────────────────
knob = re.search(r"--og-accent:\s*(#[0-9a-fA-F]{6})", css)
if knob and "--primary" in triplets:
    k, p = hex_to_rgb(knob.group(1)), triplets["--primary"]
    if k != p:
        fails.append(f"--og-accent {rgb_hex(k)} != --primary {rgb_hex(p)} — two accents are shipping")
    print(f"\n=== ONE ACCENT ===\n  --og-accent {rgb_hex(k)}  --primary {rgb_hex(p)}  {'OK' if k == p else '<-- MISMATCH'}")

if warns:
    print("\nwarnings:")
    for w in warns:
        print(f"  - {w}")
if fails:
    print(f"\nFAIL ({len(fails)}):")
    for f in fails:
        print(f"  ! {f}")
    sys.exit(1)
print("\nPASS: every colour claim in the stylesheet matches its shipped value.")
