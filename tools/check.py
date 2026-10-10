"""Checks the built website. Run by tools/build.py after every build, or on its own:

    python tools/check.py

Errors stop the build: a link to a page or #anchor that doesn't exist, an
image without alt text, a meta description too long for search results, or
wording the site doesn't use (listed in BANNED below). Warnings are printed
but don't stop it: a heading in Title Case, or a page long enough that most
phone visitors won't reach the end.
"""
import html
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Wording the site doesn't use. Each pattern is matched against the visible
# text of every page, ignoring case.
BANNED = [
    (r"\brender(ed|ing|ings|s)?\b", "pictures are described by what they show, not how they were made"),
    (r"\bone phone\b|\btest phones?\b|\bwhich we measured\b", "no references to the phones used in testing"),
    (r"\bour (own )?tests\b|\bin one test\b|\bone test floor\b", "no references to who did the testing or to single tests"),
    (r"standard deviation", "say \"typical lap-to-lap variation\""),
    (r"\b\d+\s+(laps|sessions|walks)\b|\bthree walks\b", "no counts of laps, sessions or walks behind a figure"),
    (r"!", "no exclamation marks"),
    (r"prong spacing|spacing setting", "prong spacing isn't explained to visitors"),
]
# Capitalised words that may appear inside a sentence-case heading.
PROPER = set("""Rim Reader Bracket Calibration FRONT Google Play Android iPhone VIN PDF FAQ PETG PLA
Settings Send Feedback Not Closed Redo Rear Front Left Right Full Alignment Garage History Hands Off Hold Still
Start Measure Toe Camber Thrust I US A4 OK Help Use Terms Privacy Safety Is It""".split())
WORDS_PER_SCREEN = 120   # a rough phone screen of body text
WARN_SCREENS = 7


def pages(root):
    out = []
    for d, dirs, files in os.walk(root):
        dirs[:] = [x for x in dirs if x not in ("src", "tools", "assets", ".git", "node_modules")]
        for f in files:
            if f.endswith(".html"):
                out.append(os.path.relpath(os.path.join(d, f), root).replace(os.sep, "/"))
    return sorted(out)


def text_of(h):
    h = re.sub(r"<(script|style|svg|noscript)\b.*?</\1>", " ", h, flags=re.S)
    h = re.sub(r"<[^>]+>", " ", h)
    return html.unescape(re.sub(r"\s+", " ", h))


def run(root=ROOT):
    errors, warnings = [], []
    files = pages(root)
    ids = {}
    for p in files:
        with open(os.path.join(root, p), encoding="utf-8") as f:
            ids[p] = set(re.findall(r'\sid="([^"]+)"', f.read()))
    for p in files:
        with open(os.path.join(root, p), encoding="utf-8") as f:
            h = f.read()
        if 'http-equiv="refresh"' in h:
            continue
        here = os.path.dirname(p)
        for href in re.findall(r'(?:href|src)="([^"]+)"', h):
            if re.match(r"^(https?:|mailto:|tel:|data:|javascript:)", href):
                continue
            path, _, frag = href.partition("#")
            path = path.split("?")[0]
            if path == "" and frag:
                target = p
            else:
                target = os.path.normpath(path.lstrip("/") if path.startswith("/") else os.path.join(here, path))
                if os.path.isdir(os.path.join(root, target)):
                    target = os.path.normpath(os.path.join(target, "index.html"))
                target = target.replace(os.sep, "/")
            if not os.path.exists(os.path.join(root, target)):
                errors.append("%s: link to a missing file: %s" % (p, href))
            elif frag and target.endswith(".html") and frag not in ids.get(target, set()):
                errors.append("%s: link to a missing anchor: %s" % (p, href))
        for tag in re.findall(r"<img\b[^>]*>", h):
            if " alt=" not in tag:
                errors.append("%s: image without alt text: %s" % (p, tag[:80]))
        m = re.search(r'<meta name="description" content="([^"]*)"', h)
        if m and len(html.unescape(m.group(1))) > 160:
            errors.append("%s: description is %d characters; keep it under 160" % (p, len(html.unescape(m.group(1)))))
        main = h.split('<main id="main">')[-1].split("</main>")[0]
        body = text_of(main)
        title = re.search(r"<title>(.*?)</title>", h, re.S)
        for pat, why in BANNED:
            for src in (body, html.unescape(title.group(1)) if title else ""):
                mm = re.search(pat, src, re.I)
                if mm:
                    s = max(0, mm.start() - 40)
                    errors.append("%s: %s: \"...%s...\"" % (p, why, src[s:mm.end() + 40].strip()))
        for lvl, hd in re.findall(r"<h([1-3])[^>]*>(.*?)</h\1>", main, re.S):
            words = text_of(hd).split()
            caps = [w for w in words[1:] if w[:1].isupper() and w.strip(".,:;()?") not in PROPER]
            if len(caps) >= 2:
                warnings.append("%s: heading may be in Title Case: %s" % (p, " ".join(words)))
        closed = re.sub(r'<nav class="help-nav".*?</nav>|<details class="help-topics".*?</details>', " ", main, flags=re.S)
        closed = re.sub(r"<details\b[^>]*>\s*(<summary>.*?</summary>).*?</details>", r"\1", closed, flags=re.S)
        open_text = text_of(closed)
        screens = len(open_text.split()) / WORDS_PER_SCREEN
        if screens > WARN_SCREENS and not p.startswith(("terms", "privacy")):
            warnings.append("%s: about %d words before anything is opened; long for a phone" % (p, len(open_text.split())))
    for w in warnings:
        print("warning: " + w)
    for e in errors:
        print("ERROR: " + e)
    print("Checked %d pages: %d errors, %d warnings." % (len(files), len(errors), len(warnings)))
    return not errors


if __name__ == "__main__":
    sys.exit(0 if run() else 1)
