"""Builds the Rim Reader website's pages from src/.

    python tools/build.py

Each file in src/pages/ is the middle of one page (what goes inside <main>).
Its first line is a comment holding the page's settings as JSON:

    <!--{"title": "...", "description": "...", "nav": "help"}-->

This script wraps it in the shared head, header and footer and writes the
finished page to the same relative path at the top of the repository
(src/pages/help/camber.html -> help/camber.html). The finished pages are
committed, so GitHub Pages serves them as they are and nothing runs there.

Shortcuts a page can use:
    {{root}}                     the path back to the top of the site ("" or "../")
    {{diagram:name}}             the SVG in src/diagrams/name.svg, inline (it follows the theme)
    {{lesson:Lesson Name}}       one of the app's animated lessons, played in place
    {{figure:path|alt|caption}}  an image with a caption, left out if the file isn't there yet
"""
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
SITE = "https://rimreader.com"
NAME = "Rim Reader"

NAV = [
    ("home", "index.html", "Home"),
    ("how", "how-it-works.html", "How it works"),
    ("bracket", "bracket.html", "The bracket"),
    ("help", "help/index.html", "Help"),
    ("faq", "faq.html", "FAQ"),
]

FOOTER = [
    ("Rim Reader", [
        ("how-it-works.html", "How it works"),
        ("bracket.html", "The bracket"),
        ("accuracy.html", "Accuracy and limits"),
        ("compare.html", "Ways to check alignment"),
        ("coming-soon.html", "What&rsquo;s coming"),
    ]),
    ("Help", [
        ("help/index.html", "Help center"),
        ("help/getting-started.html", "Getting started"),
        ("help/lessons.html", "Animated lessons"),
        ("help/troubleshooting.html", "Troubleshooting"),
        ("faq.html", "FAQ"),
        ("support.html", "Contact and support"),
    ]),
    ("Legal", [
        ("privacy.html", "Privacy policy"),
        ("terms.html", "Terms of use"),
    ]),
]

# The help center's contents, in reading order (used for its side menu and next/previous links).
HELP = [
    ("Start here", [
        ("help/index.html", "Help center"),
        ("help/getting-started.html", "Getting started"),
        ("help/alignment-basics.html", "Alignment basics"),
    ]),
    ("Set up", [
        ("help/bracket-setup.html", "Wedge and phone"),
        ("help/calibration.html", "Bracket Calibration"),
    ]),
    ("Measure", [
        ("help/before-you-measure.html", "Before you measure"),
        ("help/measure-toe.html", "Measure toe"),
        ("help/thrust-angle.html", "Add thrust angle"),
        ("help/camber.html", "Add camber"),
    ]),
    ("Results", [
        ("help/results.html", "Read the result"),
        ("help/adjust-toe.html", "Adjust toe safely"),
        ("help/garage.html", "Vehicles, specs and history"),
        ("help/reports.html", "Reports and sharing"),
    ]),
    ("When something's wrong", [
        ("help/troubleshooting.html", "Troubleshooting"),
        ("help/lessons.html", "All 16 lessons"),
        ("support.html", "Contact and support"),
    ]),
]

SUN = ('<svg viewBox="0 0 24 24" aria-hidden="true" class="only-dark"><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/>'
       '<path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>')
MOON = ('<svg viewBox="0 0 24 24" aria-hidden="true" class="only-light"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>')


def page_url(rel):
    rel = rel.replace(os.sep, "/")
    if rel == "index.html":
        return SITE + "/"
    if rel.endswith("/index.html"):
        return SITE + "/" + rel[: -len("index.html")]
    return SITE + "/" + rel


def head(meta, rel, root, extra_js):
    title = meta["title"]
    full = title if title.startswith(NAME) else "%s | %s" % (title, NAME)
    desc = html.escape(meta["description"], quote=True)
    url = page_url(rel)
    image = SITE + "/" + meta.get("image", "assets/icon/rim-reader-icon-512.png")
    noindex = '\n<meta name="robots" content="noindex">' if meta.get("noindex") else ""
    canonical = "" if meta.get("noindex") else '\n<link rel="canonical" href="%s">' % url
    js = "".join('\n<script src="%sassets/js/%s" defer></script>' % (root, j) for j in extra_js)
    return """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{full}</title>
<meta name="description" content="{desc}">{noindex}{canonical}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Rim Reader">
<meta property="og:title" content="{title_e}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image}">
<meta name="theme-color" content="#0F1C2E">
<link rel="icon" type="image/png" sizes="192x192" href="{root}assets/icon/rim-reader-icon-192.png">
<link rel="icon" type="image/png" sizes="48x48" href="{root}assets/icon/rim-reader-icon-48.png">
<link rel="apple-touch-icon" href="{root}assets/icon/rim-reader-icon-192.png">
<link rel="preload" href="{root}assets/fonts/Inter-Regular.woff2" as="font" type="font/woff2" crossorigin>
<script>try{{var t=localStorage.getItem('rr-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}}catch(e){{}}</script>
<link rel="stylesheet" href="{root}assets/css/rim-reader.css">
<link rel="stylesheet" href="{root}assets/css/site.css">
<script src="{root}assets/js/theme.js" defer></script>{js}
</head>
""".format(full=html.escape(full), title_e=html.escape(title, quote=True), desc=desc, noindex=noindex,
           canonical=canonical, url=url, image=image, root=root, js=js)


def header(meta, root):
    links = []
    for key, href, label in NAV:
        cur = ' aria-current="page"' if meta.get("nav") == key else ""
        links.append('<a href="%s%s"%s>%s</a>' % (root, href, cur, label))
    return """<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="{root}index.html" aria-label="Rim Reader home">
      <img class="only-dark" src="{root}assets/logo/rim-reader-logo-dark-notagline-transparent.svg" alt="Rim Reader" width="180" height="60">
      <img class="only-light" src="{root}assets/logo/rim-reader-logo-light-notagline-transparent.svg" alt="Rim Reader" width="180" height="60">
    </a>
    <nav class="nav" aria-label="Main">
      {links}
      <a class="rr-btn rr-btn-primary" href="{root}coming-soon.html#app">Get the app</a>
    </nav>
    <button class="theme-toggle" type="button" aria-label="Switch theme">{sun}{moon}</button>
  </div>
</header>
""".format(root=root, links="".join(links), sun=SUN, moon=MOON)


def footer(root):
    cols = []
    for title, items in FOOTER:
        lis = "".join('<li><a href="%s%s">%s</a></li>' % (root, h, l) for h, l in items)
        cols.append('<div><h2>%s</h2><ul>%s</ul></div>' % (title, lis))
    return """<footer class="site-footer">
  <div class="wrap">
    <div class="foot-top">
      <div class="foot-brand">
        <img class="only-dark" src="{root}assets/logo/rim-reader-logo-dark-notagline-transparent.svg" alt="" width="140" height="47">
        <img class="only-light" src="{root}assets/logo/rim-reader-logo-light-notagline-transparent.svg" alt="" width="140" height="47">
        <p>Rack-free alignment from your phone and a 3D-printed bracket.</p>
      </div>
      <nav class="foot-cols" aria-label="Footer">{cols}</nav>
    </div>
    <p>Rim Reader gives estimates, not a professional alignment. Have a qualified shop check your alignment before highway driving or carrying heavy loads.</p>
    <p>&copy; 2026 Middle TN Auto Repair LLC. Rim Reader is made by Middle TN Auto Repair LLC, Tennessee. Contact: <a href="mailto:info@rimreader.com">info@rimreader.com</a></p>
  </div>
</footer>
</body>
</html>
""".format(root=root, cols="".join(cols))


def diagram(name):
    with open(os.path.join(SRC, "diagrams", name + ".svg"), encoding="utf-8") as f:
        s = f.read().strip()
    return re.sub(r"<\?xml[^>]*>\s*", "", s)


def figure(arg, root):
    path, alt, cap = (arg.split("|") + ["", ""])[:3]
    if not os.path.exists(os.path.join(ROOT, path)):
        return ""
    img = '<img src="%s%s" alt="%s" loading="lazy">' % (root, path, html.escape(alt, quote=True))
    return '<figure class="fig">%s%s</figure>' % (img, "<figcaption>%s</figcaption>" % cap if cap else "")


def lesson(name):
    n = html.escape(name, quote=True)
    return ('<figure class="lesson" data-lesson="%s"><div class="lesson-name">%s</div>'
            '<canvas width="720" height="684" role="img" aria-label="Animated lesson: %s"></canvas>'
            '<figcaption class="lesson-line" aria-live="polite"></figcaption>'
            '<div class="lesson-ctl"></div>'
            '<noscript><p class="rr-muted">This animated lesson needs JavaScript.</p></noscript></figure>') % (n, n, n)


def help_wrap(body, rel, root, meta):
    rel = rel.replace(os.sep, "/")
    flat = [item for _, items in HELP for item in items]
    groups = []
    for title, items in HELP:
        lis = "".join('<li><a href="%s%s"%s>%s</a></li>' % (root, h, ' aria-current="page"' if h == rel else "", l) for h, l in items)
        groups.append("<h2>%s</h2><ul>%s</ul>" % (html.escape(title), lis))
    nav = '<nav class="help-nav" aria-label="Help topics">%s</nav>' % "".join(groups)
    crumbs = '<p class="crumbs"><a href="%shelp/index.html">Help</a></p>' % root if rel != "help/index.html" else ""
    np = ""
    idx = [i for i, (h, _) in enumerate(flat) if h == rel]
    if idx:
        i = idx[0]
        prev = flat[i - 1] if i > 0 else None
        nxt = flat[i + 1] if i + 1 < len(flat) else None
        parts = []
        if prev:
            parts.append('<a class="prev" href="%s%s"><small>Previous</small>%s</a>' % (root, prev[0], prev[1]))
        if nxt:
            parts.append('<a class="next" href="%s%s"><small>Next</small>%s</a>' % (root, nxt[0], nxt[1]))
        np = '<nav class="next-prev" aria-label="Previous and next topic">%s</nav>' % "".join(parts)
    return ('<div class="wrap help-layout">\n%s\n<article class="help-main">\n%s%s\n%s\n</article>\n</div>' % (nav, crumbs, body.strip(), np))


def build_one(src_path):
    rel = os.path.relpath(src_path, os.path.join(SRC, "pages"))
    with open(src_path, encoding="utf-8") as f:
        text = f.read()
    m = re.match(r"\s*<!--(\{.*?\})-->\s*\n", text, re.S)
    if not m:
        sys.exit("%s: the first line must be <!--{...settings...}-->" % rel)
    meta = json.loads(m.group(1))
    body = text[m.end():]
    depth = rel.replace(os.sep, "/").count("/")
    root = "/" if meta.get("abs_root") else "../" * depth
    extra_js = list(meta.get("js", []))
    if "{{lesson:" in body:
        extra_js += ["lesson-engine.js", "lessons-data.js", "lessons.js"]
    body = re.sub(r"\{\{diagram:([\w-]+)\}\}", lambda mm: diagram(mm.group(1)), body)
    body = re.sub(r"\{\{lesson:([^}]+)\}\}", lambda mm: lesson(mm.group(1)), body)
    body = re.sub(r"\{\{figure:([^}]+)\}\}", lambda mm: figure(mm.group(1), root), body)
    body = body.replace("{{root}}", root)
    if meta.get("help"):
        body = help_wrap(body, rel, root, meta)
    if "{{" in body:
        sys.exit("%s: unknown shortcut near %r" % (rel, body[body.index("{{"):body.index("{{") + 40]))
    out = head(meta, rel, root, extra_js) + header(meta, root) + '<main id="main">\n' + body.rstrip() + "\n</main>\n" + footer(root)
    dest = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "w", encoding="utf-8", newline="\n") as f:
        f.write(out)
    return rel, meta


def main():
    pages = []
    for d, _, files in os.walk(os.path.join(SRC, "pages")):
        for fn in sorted(files):
            if fn.endswith(".html"):
                pages.append(build_one(os.path.join(d, fn)))
    # sitemap.xml for search engines (the 404 page and noindex pages left out)
    urls = sorted(page_url(rel) for rel, meta in pages if not meta.get("noindex"))
    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8", newline="\n") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for u in urls:
            f.write("  <url><loc>%s</loc></url>\n" % u)
        f.write("</urlset>\n")
    with open(os.path.join(ROOT, "robots.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write("User-agent: *\nAllow: /\nDisallow: /src/\nDisallow: /tools/\nSitemap: %s/sitemap.xml\n" % SITE)
    print("Built %d pages." % len(pages))


if __name__ == "__main__":
    main()
