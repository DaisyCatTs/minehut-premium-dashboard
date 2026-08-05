#!/usr/bin/env python3
"""Second half of the pre-ship gate.

audit-selectors.py covers `[class*=]` substring matches. This covers the other
fragile form: EXACT escaped class selectors like `.bg-\\[var\\(--mh-brand\\)\\]`.
A typo in one of those fails silently -- the rule simply never matches anything.

Every escaped class the theme selects on must exist verbatim in Minehut's bundle,
with two documented exceptions (library-injected DOM classes).
"""

import glob
import re
import sys
from pathlib import Path

BS = chr(92)
CLASS_RE = re.compile(r"\.((?:\\[0-9a-fA-F]{1,6}[ \t]?|\\.|[-_a-zA-Z0-9])+)")

# Classes injected by libraries at runtime; they never appear in the CSS bundle.
DOM_ONLY = {"lucide"}


def unescape(s: str) -> str:
    out, i = [], 0
    while i < len(s):
        if s[i] == BS and i + 1 < len(s):
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


def blank_comments(css: str) -> str:
    return re.sub(r"/\*[\s\S]*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)), css)


repo = Path(__file__).resolve().parent
for cand in (repo, *repo.parents):
    if (cand / "minehut-premium-dashboard.user.css").is_file():
        repo = cand
        break
else:
    repo = Path.cwd()

# The bundle is gitignored (Minehut's copyrighted CSS); tools/bundle-tokens.txt is
# the extracted class-name list, which is all this check needs. Regenerate with
# `python tools/audit-selectors.py --write-tokens`.
tokens = set()
files = sorted(glob.glob(str(repo / "Original Css from their next static" / "*.css")))
if files:
    for f in files:
        css = open(f, encoding="utf-8", errors="replace").read()
        for raw in CLASS_RE.findall(css):
            t = unescape(raw)
            if t and not t[0].isdigit():
                tokens.add(t)
    source = f"{len(files)} bundle file(s)"
else:
    cached = repo / "tools" / "bundle-tokens.txt"
    if not cached.is_file():
        sys.exit(
            "error: no bundle CSS and no tools/bundle-tokens.txt\n"
            "       Fetch the bundle from dashboard.minehut.com's _next/static/,\n"
            "       or restore the token list from git."
        )
    tokens = {l.strip() for l in cached.read_text(encoding="utf-8").splitlines() if l.strip()}
    source = "tools/bundle-tokens.txt"

theme = blank_comments((repo / "minehut-premium-dashboard.user.css").read_text(encoding="utf-8"))
used = {unescape(r) for r in CLASS_RE.findall(theme) if BS in r}

print(f"bundle tokens: {len(tokens)}  (from {source})")
print(f"escaped class selectors used by the theme: {len(used)}\n")

missing = []
for c in sorted(used):
    if c in tokens:
        print(f"  OK    {c}")
    elif c in DOM_ONLY:
        print(f"  DOM   {c}   (library-injected, expected absent from CSS)")
    else:
        print(f"  MISS  {c}")
        missing.append(c)

print()
if missing:
    print(f"FAIL: {len(missing)} selector(s) match nothing in the bundle:")
    for c in missing:
        print(f"  - {c}")
    sys.exit(1)
print("PASS: every escaped class selector exists in the bundle.")
