#!/usr/bin/env python3
"""
audit-selectors.py — the pre-ship gate for minehut-premium-dashboard.user.css

Every `[class*="..."]` in the theme is a substring match against a class attribute.
Substring matching over-matches silently: `p-6` also matches `gap-6`, `h-` also matches
every `--mh-*` arbitrary utility. This script tells you exactly which of Minehut's real
class names each pattern hits, so a rule can only ship when the hit set equals the
intended set recorded in its `@risk` comment.

Usage
  python audit-selectors.py                 audit every [class*=]/[class^=]/[class~=] in the theme
  python audit-selectors.py "bg-[#1c1c1c]"  ad-hoc: what does this substring hit?
  python audit-selectors.py --tokens        dump every class token in the bundle
  python audit-selectors.py --hash          print the bundle sha256 (goes in @note)

Paths are resolved relative to the repo root, which is found by walking up from this
file or from the CWD looking for `minehut-premium-dashboard.user.css`.
"""

import hashlib
import re
import sys
from pathlib import Path

BUNDLE_GLOB = "Original Css from their next static/*.css"
THEME_NAME = "minehut-premium-dashboard.user.css"


def find_repo() -> Path:
    for base in (Path(__file__).resolve().parent, Path.cwd()):
        for cand in (base, *base.parents):
            if (cand / THEME_NAME).is_file():
                return cand
    sys.exit(f"error: could not find {THEME_NAME} in any parent of {Path.cwd()}")


def unescape(s: str) -> str:
    """Resolve CSS escapes: \\2c -> ',', \\[ -> '[', etc."""
    out, i = [], 0
    while i < len(s):
        if s[i] == "\\" and i + 1 < len(s):
            m = re.match(r"[0-9a-fA-F]{1,6}[ \t\n]?", s[i + 1 :])
            if m:
                out.append(chr(int(m.group().strip() or "0", 16)))
                i += 1 + len(m.group())
            else:
                out.append(s[i + 1])
                i += 2
        else:
            out.append(s[i])
            i += 1
    return "".join(out)


# A class selector: '.' then idents/escapes. Tailwind escapes [ ] ( ) % / ! # : , . etc.
CLASS_RE = re.compile(r"\.((?:\\[0-9a-fA-F]{1,6}[ \t]?|\\.|[-_a-zA-Z0-9])+)")
# Theme patterns: [class*="..."], [class^="..."], [class~="..."], [class$="..."]
PATTERN_RE = re.compile(r"\[class([*^~$])=\"([^\"]*)\"\]")


def bundle_tokens(repo: Path) -> tuple[set[str], list[Path]]:
    files = sorted(repo.glob(BUNDLE_GLOB))
    if not files:
        sys.exit(f"error: no bundle CSS found at {repo / BUNDLE_GLOB}")
    tokens: set[str] = set()
    for f in files:
        css = f.read_text(encoding="utf-8", errors="replace")
        for raw in CLASS_RE.findall(css):
            tok = unescape(raw)
            # CSS idents cannot start with a digit; this drops `375rem` from `.375rem`
            if tok and not tok[0].isdigit():
                tokens.add(tok)
    return tokens, files


def report(pattern: str, op: str, tokens: set[str], limit: int = 14) -> int:
    needle = unescape(pattern)
    # A space-anchored guard like [class*=" h-"] targets a boundary in the live class
    # ATTRIBUTE ("a b c"), but bundle tokens are single classes with no spaces — so it
    # can never match here. Zero hits is correct, not a dead selector.
    if " " in needle:
        print(f'[class{op}="{pattern}"]')
        print(f"    needle: {needle!r}   n/a — space-anchored, matches the class")
        print("    attribute at runtime, not a single bundle token. Verify in the DOM.\n")
        return -1
    if op == "*":
        hits = sorted(t for t in tokens if needle in t)
    elif op == "^":
        hits = sorted(t for t in tokens if t.startswith(needle))
    elif op == "$":
        hits = sorted(t for t in tokens if t.endswith(needle))
    else:  # ~= whole-token match
        hits = sorted(t for t in tokens if t == needle)
    shown = hits[:limit]
    more = f" (+{len(hits) - limit} more)" if len(hits) > limit else ""
    flag = "  <-- ZERO" if not hits else ""
    print(f'[class{op}="{pattern}"]')
    print(f"    needle: {needle!r}   hits: {len(hits)}{flag}")
    if shown:
        print(f"    {shown}{more}")
    print()
    return len(hits)


def main() -> None:
    repo = find_repo()
    tokens, files = bundle_tokens(repo)
    args = sys.argv[1:]

    if args and args[0] == "--hash":
        for f in files:
            h = hashlib.sha256(f.read_bytes()).hexdigest()[:16]
            print(f"{h}  {f.name}")
        return

    if args and args[0] == "--tokens":
        for t in sorted(tokens):
            print(t)
        return

    print(f"bundle: {', '.join(f.name for f in files)}")
    print(f"distinct class tokens: {len(tokens)}\n")

    if args:
        for needle in args:
            report(needle, "*", tokens)
        return

    theme = (repo / THEME_NAME).read_text(encoding="utf-8")
    # Strip comments first. Explaining a removed selector in prose ("[class*=\"divider\"]
    # dropped — 0 hits") would otherwise re-report it forever as a live dead selector.
    theme = re.sub(r"/\*[\s\S]*?\*/", "", theme)
    pats = sorted(set(PATTERN_RE.findall(theme)), key=lambda p: (p[0], p[1]))
    if not pats:
        print("no [class*=] patterns in the theme.")
        return

    zero = 0
    for op, pat in pats:
        if report(pat, op, tokens) == 0:
            zero += 1
    print(f"{len(pats)} patterns audited, {zero} matching nothing.")


if __name__ == "__main__":
    main()
