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
TOKENS_NAME = "bundle-tokens.txt"


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
    """Class tokens from Minehut's bundle, or from the checked-in token list.

    The bundle itself is gitignored -- it is Minehut's copyrighted production CSS
    and does not belong in an MIT repo. `tools/bundle-tokens.txt` is the extracted
    list of class NAMES, which is all either audit actually needs, and carries no
    meaningful copyright claim. Regenerate it with --write-tokens whenever the
    bundle is refreshed.
    """
    files = sorted(repo.glob(BUNDLE_GLOB))
    if files:
        tokens: set[str] = set()
        for f in files:
            css = f.read_text(encoding="utf-8", errors="replace")
            for raw in CLASS_RE.findall(css):
                tok = unescape(raw)
                # CSS idents cannot start with a digit; drops `375rem` from `.375rem`
                if tok and not tok[0].isdigit():
                    tokens.add(tok)
        return tokens, files

    cached = repo / "tools" / TOKENS_NAME
    if cached.is_file():
        toks = {l.strip() for l in cached.read_text(encoding="utf-8").splitlines() if l.strip()}
        return toks, [cached]

    sys.exit(
        f"error: no bundle CSS at {repo / BUNDLE_GLOB}\n"
        f"       and no cached token list at {cached}\n"
        "       Fetch the bundle from dashboard.minehut.com's _next/static/, or\n"
        "       restore tools/bundle-tokens.txt from git."
    )


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

    if args and args[0] == "--write-tokens":
        out = repo / "tools" / TOKENS_NAME
        if not sorted(repo.glob(BUNDLE_GLOB)):
            sys.exit("error: refusing to regenerate from the cached list; fetch the bundle first.")
        out.write_text("\n".join(sorted(tokens)) + "\n", encoding="utf-8")
        print(f"wrote {len(tokens)} class tokens -> {out.relative_to(repo)}")
        return

    print(f"bundle: {', '.join(f.name for f in files)}")
    print(f"distinct class tokens: {len(tokens)}\n")

    if args:
        for needle in args:
            report(needle, "*", tokens)
        return

    theme = (repo / THEME_NAME).read_text(encoding="utf-8")
    # Strip comments first, preserving line numbers. Explaining a removed selector in
    # prose ("[class*=\"divider\"] dropped — 0 hits") would otherwise re-report it
    # forever as a live dead selector.
    theme = re.sub(r"/\*[\s\S]*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)), theme)

    # Report EVERY occurrence with its line, and never deduplicate.
    #
    # This script used to collapse identical needles with sorted(set(...)). That hid
    # real bugs twice: one CORRECT anchored use of a needle and one INCORRECT bare use
    # of the same needle collapsed into a single clean-looking line, so the good usage
    # laundered the bad one. The dot bug and an unanchored forced-colors rule both
    # survived that way. A needle is only as safe as its worst occurrence.
    occurrences = []
    for lineno, line in enumerate(theme.split("\n"), 1):
        for op, pat in PATTERN_RE.findall(line):
            anchored = pat.startswith(" ") or op in "^~$"
            compound = bool(re.search(r"\]\s*\[class|\]\s*[.:#\w]", line[line.index(pat) :] if pat in line else ""))
            occurrences.append((op, pat, lineno, anchored))
    pats = sorted({(o, p) for o, p, _, _ in occurrences}, key=lambda p: (p[0], p[1]))

    # Flag any needle used BOTH anchored and bare — that pattern means someone fixed
    # one site and missed another, which is exactly how this class of bug propagates.
    bare_needles = {p.lstrip() for o, p, _, a in occurrences if not a}
    mixed = sorted(n for n in bare_needles if any(p.lstrip() == n and a for o, p, _, a in occurrences))
    if mixed:
        print("!! NEEDLE USED BOTH ANCHORED AND BARE — the bare one is probably a bug:")
        for n in mixed:
            for o, p, ln, a in occurrences:
                if p.lstrip() == n:
                    print(f"     line {ln:5}  {'anchored' if a else 'BARE    '}  [class{o}=\"{p}\"]")
        print()
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
