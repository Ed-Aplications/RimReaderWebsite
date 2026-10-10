"""Builds the Rim Reader website's pages from src/.

    python tools/build.py

Each file in src/pages/ is the middle of one page (what goes inside <main>).
Its first line is a comment holding the page's settings as JSON:

    <!--{"title": "...", "description": "...", "nav": "help"}-->

Settings: title, description (keep it under about 155 characters), nav (which
menu item is lit), help (true for a help-center page), js (extra scripts),
image (the picture shown when the page is shared), noindex, abs_root, and
redirect (the page only sends the visitor on to that address).

This script wraps each page in the shared head, header and footer and writes
the finished page to the same relative path at the top of the repository
(src/pages/help/camber.html -> help/camber.html). The finished pages are
committed, so GitHub Pages serves them as they are and nothing runs there.
It then runs tools/check.py, which stops on a broken link or a rule broken.

Shortcuts a page can use:
    {{root}}                     the path back to the top of the site ("" or "../")
    {{fact:name}}                a number or phrase from src/facts.json, so it is typed once
    {{diagram:name}}             the SVG in src/diagrams/name.svg, inline (it follows the theme)
    {{lesson:Lesson Name}}       one of the app's animated lessons: a still that plays when tapped
    {{figure:path|alt|caption}}  an image with a caption, left out if the file isn't there yet
    {{more:Question|id}} ... {{/more}}
                                 a section that opens when tapped; #id in an address opens it
Tables with class="stack" turn into one card per row on phones.
"""
import hashlib
import html
import json
import os
import re
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
SITE = "https://rimreader.com"
NAME = "Rim Reader"
SHARE_IMAGE = "assets/img/bracket/hero-wheel-og.jpg"
SHARE_ALT = "The Rim Reader bracket with a phone in it, on top of a car's front wheel"

NAV = [
    ("how", "how-it-works.html", "How it works"),
    ("bracket", "bracket.html", "The bracket"),
    ("accuracy", "accuracy.html", "Accuracy"),
    ("help", "help/index.html", "Help"),
    ("faq", "faq.html", "FAQ"),
]

FOOTER = [
    ("Rim Reader", [
        ("how-it-works.html", "How it works"),
        ("accuracy.html", "Accuracy and other methods"),
        ("coming-soon.html", "What&rsquo;s coming"),
        ("faq.html", "FAQ"),
    ]),
    ("The bracket", [
        ("bracket.html", "The bracket"),
        ("bracket.html#wedge", "Find your wedge"),
        ("bracket-print.html", "Print and care"),
        ("make-your-own.html", "Make your own"),
    ]),
    ("Help", [
        ("help/index.html", "Help center"),
        ("help/getting-started.html", "Getting started"),
        ("help/troubleshooting.html", "Troubleshooting"),
        ("help/lessons.html", "Animated lessons"),
        ("support.html", "Contact and support"),
    ]),
    ("Legal", [
        ("privacy.html", "Privacy policy"),
        ("terms.html", "Terms of use"),
    ]),
]

# The help center's contents, in reading order (its menu and next/previous links).
HELP = [
    ("Start here", [
        ("help/index.html", "Help center"),
        ("help/getting-started.html", "Getting started"),
    ]),
    ("Set up", [
        ("help/bracket-setup.html", "Wedge and phone"),
        ("help/calibration.html", "Bracket Calibration"),
        ("help/garage.html", "Vehicles and specs"),
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
        ("help/reports.html", "History, reports and sharing"),
    ]),
    ("Learn", [
        ("help/alignment-basics.html", "Alignment basics"),
        ("help/lessons.html", "All 16 lessons"),
    ]),
    ("Fix a problem", [
        ("help/troubleshooting.html", "Troubleshooting"),
    ]),
]

SUN = ('<svg viewBox="0 0 24 24" aria-hidden="true" class="only-dark"><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/>'
       '<path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>')
MOON = ('<svg viewBox="0 0 24 24" aria-hidden="true" class="only-light"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>')

LESSON_ENGINE = ["lesson-engine.js", "lessons-data.js", "lessons.js"]


def ver(path):
    """A short fingerprint of an asset's contents. Pages ask for
    site.css?v=<fingerprint>, so a visitor's browser fetches the new file the
    moment it changes instead of showing an old copy it kept."""
    with open(os.path.join(ROOT, path), "rb") as f:
        return hashlib.md5(f.read()).hexdigest()[:8]


def webp_size(path):
    """Width and height of a WebP file, read from its header (no image library needed)."""
    try:
        with open(path, "rb") as f:
            d = f.read(40)
    except OSError:
        return None
    if d[:4] != b"RIFF" or d[8:12] != b"WEBP":
        return None
    kind = d[12:16]
    if kind == b"VP8X":
        w = int.from_bytes(d[24:27], "little") + 1
        h = int.from_bytes(d[27:30], "little") + 1
        return w, h
    if kind == b"VP8 ":
        w, h = struct.unpack("<HH", d[26:30])
        return w & 0x3FFF, h & 0x3FFF
    if kind == b"VP8L":
        b = int.from_bytes(d[21:25], "little")
        return (b & 0x3FFF) + 1, ((b >> 14) & 0x3FFF) + 1
    return None


def img(path, alt, root, sizes="(max-width: 900px) 100vw, 900px", lazy=True, extra=""):
    """An <img> with its size and, when a smaller copy exists (name-800.webp
    or name-600.webp), a srcset so phones download the small one."""
    full = os.path.join(ROOT, path)
    wh = webp_size(full)
    dims = ' width="%d" height="%d"' % wh if wh else ""
    srcset = ""
    base, ext = os.path.splitext(path)
    for small in (800, 600):
        sp = "%s-%d%s" % (base, small, ext)
        if wh and os.path.exists(os.path.join(ROOT, sp)):
            srcset = ' srcset="%s%s %dw, %s%s %dw" sizes="%s"' % (root, sp, small, root, path, wh[0], sizes)
            break
    load = ' loading="lazy" decoding="async"' if lazy else ' fetchpriority="high"'
    return '<img src="%s%s"%s alt="%s"%s%s%s>' % (root, path, srcset, html.escape(alt, quote=True), dims, load, extra)


def page_url(rel):
    rel = rel.replace(os.sep, "/")
    if rel == "index.html":
        return SITE + "/"
    if rel.endswith("/index.html"):
        return SITE + "/" + rel[: -len("index.html")]
    return SITE + "/" + rel


def jsonld(obj):
    return '\n<script type="application/ld+json">%s</script>' % json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def head(meta, rel, root, extra_js, ld):
    title = meta["title"]
    full = title if title.startswith(NAME) else "%s | %s" % (title, NAME)
    desc = html.escape(meta["description"], quote=True)
    url = page_url(rel)
    image = SITE + "/" + meta.get("image", SHARE_IMAGE)
    noindex = '\n<meta name="robots" content="noindex">' if meta.get("noindex") else ""
    canonical = "" if meta.get("noindex") else '\n<link rel="canonical" href="%s">' % url
    js = "".join('\n<script src="%sassets/js/%s?v=%s" defer></script>' % (root, j, ver("assets/js/" + j)) for j in extra_js)
    return """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{full}</title>
<meta name="description" content="{desc}">{noindex}{canonical}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Rim Reader">
<meta property="og:title" content="{full_e}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{share_alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0F1C2E" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#F4F6F9" media="(prefers-color-scheme: light)">
<link rel="icon" type="image/png" sizes="192x192" href="{root}assets/icon/rim-reader-icon-192.png">
<link rel="icon" type="image/png" sizes="48x48" href="{root}assets/icon/rim-reader-icon-48.png">
<link rel="apple-touch-icon" href="{root}assets/icon/rim-reader-icon-192.png">
<link rel="preload" href="{root}assets/fonts/Inter-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{root}assets/fonts/Inter-ExtraBold.woff2" as="font" type="font/woff2" crossorigin>
<script>try{{var t=localStorage.getItem('rr-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}}catch(e){{}}</script>
<link rel="stylesheet" href="{root}assets/css/rim-reader.css?v={v_tok}">
<link rel="stylesheet" href="{root}assets/css/site.css?v={v_site}">
<script src="{root}assets/js/theme.js?v={v_theme}" defer></script>{js}{ld}
</head>
""".format(full=html.escape(full), full_e=html.escape(full, quote=True), desc=desc, noindex=noindex,
           canonical=canonical, url=url, image=image, share_alt=html.escape(SHARE_ALT, quote=True), root=root, js=js, ld=ld,
           v_tok=ver("assets/css/rim-reader.css"), v_site=ver("assets/css/site.css"), v_theme=ver("assets/js/theme.js"))


def logo(root, cls, width, height, alt, eager=True):
    """The logo for each theme. Only the one for the current theme is shown."""
    return ('<img class="only-dark" src="{r}assets/logo/rim-reader-logo-dark-notagline-transparent.svg" alt="{a}" width="{w}" height="{h}">'
            '<img class="only-light" src="{r}assets/logo/rim-reader-logo-light-notagline-transparent.svg" alt="{a}" width="{w}" height="{h}">').format(r=root, a=alt, w=width, h=height)


def header(meta, root):
    links = []
    for key, href, label in NAV:
        cur = ' aria-current="page"' if meta.get("nav") == key else ""
        links.append('<a href="%s%s"%s>%s</a>' % (root, href, cur, label))
    return """<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="{root}index.html" aria-label="Rim Reader home">{logo}</a>
    <nav class="nav" aria-label="Main">{links}</nav>
    <a class="rr-btn rr-btn-primary head-cta" href="{root}coming-soon.html">Coming soon</a>
    <button class="theme-toggle" type="button" aria-label="Switch theme">{sun}{moon}</button>
  </div>
</header>
""".format(root=root, links="".join(links), sun=SUN, moon=MOON, logo=logo(root, "", 180, 60, "Rim Reader"))


def footer(root):
    cols = []
    for title, items in FOOTER:
        lis = "".join('<li><a href="%s%s">%s</a></li>' % (root, h, l) for h, l in items)
        cols.append('<div><h2>%s</h2><ul>%s</ul></div>' % (title, lis))
    return """<footer class="site-footer">
  <div class="wrap">
    <div class="foot-top">
      <div class="foot-brand">
        {logo}
        <p>Wheel alignment at home, with your phone and a 3D-printed bracket.</p>
      </div>
      <nav class="foot-cols" aria-label="Footer">{cols}</nav>
    </div>
    <p>Rim Reader gives estimates, not a professional alignment. Have a qualified shop check your alignment before highway driving or carrying heavy loads.</p>
    <p>&copy; 2026 Middle TN Auto Repair LLC. Rim Reader is made by Middle TN Auto Repair LLC, Tennessee. Contact: <a href="mailto:info@rimreader.com">info@rimreader.com</a></p>
  </div>
</footer>
</body>
</html>
""".format(root=root, cols="".join(cols), logo=logo(root, "", 140, 47, ""))


def diagram(name):
    with open(os.path.join(SRC, "diagrams", name + ".svg"), encoding="utf-8") as f:
        s = f.read().strip()
    return re.sub(r"<\?xml[^>]*>\s*", "", s)


def figure(arg, root):
    path, alt, cap = (arg.split("|") + ["", ""])[:3]
    if not os.path.exists(os.path.join(ROOT, path)):
        return ""
    return '<figure class="fig">%s%s</figure>' % (img(path, alt, root), "<figcaption>%s</figcaption>" % cap if cap else "")


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def lesson(name, root):
    """A lesson starts as a still picture with a play button. The lesson
    scripts load only when someone taps it, so pages stay light."""
    n = html.escape(name, quote=True)
    s = slug(name)
    poster = ""
    for th, cls in (("dark", "only-dark"), ("light", "only-light")):
        p = "assets/img/lesson/%s-%s.webp" % (s, th)
        if os.path.exists(os.path.join(ROOT, p)):
            poster += '<img class="%s" src="%s%s" alt="" width="480" height="456" loading="lazy" decoding="async">' % (cls, root, p)
    return ('<figure class="lesson" data-lesson="%s"><div class="lesson-name">%s</div>'
            '<button class="lesson-poster" type="button" aria-label="Play the lesson: %s">%s<span class="play-badge" aria-hidden="true">'
            '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>Play</span></button>'
            '<figcaption class="lesson-line"></figcaption><div class="lesson-ctl"></div>'
            '<noscript><p class="rr-muted">This animated lesson needs JavaScript.</p></noscript></figure>') % (n, n, n, poster)


def more_block(m):
    title, _, ident = m.group(1).partition("|")
    ident = ident.strip() or slug(title)
    return '<details class="more" id="%s"><summary>%s</summary><div class="more-body">%s</div></details>' % (ident, title.strip(), m.group(2).strip())


def add_srcset(body, root):
    """Give a hand-written <img> of a .webp a srcset when a smaller copy exists."""
    def one(m):
        tag = m.group(0)
        if "srcset=" in tag:
            return tag
        src = re.search(r'src="([^"]+\.webp)"', tag)
        if not src:
            return tag
        path = src.group(1)[len(root):] if src.group(1).startswith(root) else src.group(1)
        full = os.path.join(ROOT, path)
        wh = webp_size(full)
        base, ext = os.path.splitext(path)
        for small in (800, 600):
            sp = "%s-%d%s" % (base, small, ext)
            if wh and os.path.exists(os.path.join(ROOT, sp)):
                return tag.replace(src.group(0), '%s srcset="%s%s %dw, %s%s %dw" sizes="(max-width: 600px) 100vw, 420px"' % (src.group(0), root, sp, small, root, path, wh[0]))
        return tag
    return re.sub(r"<img\b[^>]*>", one, body)


def stack_tables(body):
    """Give every cell of a <table class="stack"> its column heading as
    data-label, so on a phone each row shows as a card of label: value."""
    def one(t):
        tab = t.group(0)
        heads = [re.sub(r"<[^>]+>", "", h).strip() for h in re.findall(r"<th[^>]*>(.*?)</th>", tab.split("</thead>")[0], re.S)]
        def row(r):
            cells = iter(heads)
            return re.sub(r"<td(?![^>]*data-label)", lambda c: '<td data-label="%s"' % html.escape(next(cells, ""), quote=True), r.group(0))
        if "<tbody>" in tab:
            pre, rest = tab.split("<tbody>", 1)
            rest = re.sub(r"<tr[^>]*>.*?</tr>", row, rest, flags=re.S)
            tab = pre + "<tbody>" + rest
        return tab
    return re.sub(r'<table class="stack[^"]*">.*?</table>', one, body, flags=re.S)


def help_menu(rel, root, cls, label):
    groups = []
    for title, items in HELP:
        lis = "".join('<li><a href="%s%s"%s>%s</a></li>' % (root, h, ' aria-current="page"' if h == rel else "", l) for h, l in items)
        groups.append('<p class="help-group">%s</p><ul>%s</ul>' % (html.escape(title), lis))
    return '<nav class="%s" aria-label="%s">%s</nav>' % (cls, label, "".join(groups))


def help_wrap(body, rel, root, meta):
    rel = rel.replace(os.sep, "/")
    flat = [item for _, items in HELP for item in items]
    side = help_menu(rel, root, "help-nav", "Help topics")
    phone = '<details class="help-topics"><summary>Help topics</summary>%s</details>' % help_menu(rel, root, "help-nav-phone", "Help topics (phone)")
    crumbs = ('<nav class="crumbs" aria-label="Breadcrumb"><a href="%shelp/index.html">Help</a></nav>' % root) if rel != "help/index.html" else ""
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
    return ('<div class="wrap help-layout">\n<article class="help-main">\n%s%s%s\n%s\n</article>\n%s\n</div>' % (crumbs, phone, body.strip(), np, side))


def faq_ld(body):
    items = []
    for q, a in re.findall(r'<details[^>]*>\s*<summary>(.*?)</summary>\s*<div>(.*?)</div>\s*</details>', body, re.S):
        clean = lambda s: html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s))).strip()
        items.append({"@type": "Question", "name": clean(q), "acceptedAnswer": {"@type": "Answer", "text": clean(a)}})
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": items}


def structured(meta, rel, body):
    rel = rel.replace(os.sep, "/")
    if rel == "index.html":
        return jsonld({"@context": "https://schema.org", "@graph": [
            {"@type": "Organization", "name": "Rim Reader", "legalName": "Middle TN Auto Repair LLC", "url": SITE + "/",
             "logo": SITE + "/assets/icon/rim-reader-icon-512.png", "email": "info@rimreader.com"},
            {"@type": "WebSite", "name": "Rim Reader", "url": SITE + "/"}]})
    if rel == "faq.html":
        return jsonld(faq_ld(body))
    if meta.get("help") and rel != "help/index.html":
        return jsonld({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Help center", "item": SITE + "/help/"},
            {"@type": "ListItem", "position": 2, "name": meta["title"], "item": page_url(rel)}]})
    return ""


def redirect_page(meta, rel, root):
    target = meta["redirect"]
    return """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t} | Rim Reader</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="{site}/{target}">
<meta http-equiv="refresh" content="0; url={root}{target}">
</head>
<body>
<p>This page has moved: <a href="{root}{target}">{t}</a>.</p>
</body>
</html>
""".format(t=html.escape(meta["title"]), site=SITE, target=target.split("#")[0], root=root)


def clean_links(out):
    """Link to folders, not to index.html: help/ rather than help/index.html,
    so the address a visitor sees matches the one search engines are told."""
    def fix(m):
        pre, frag = m.group(1), m.group(2) or ""
        return 'href="%s%s"' % (pre or "./", frag)
    return re.sub(r'href="((?:\.\./)*(?:help/)?)index\.html(#[^"]*)?"', fix, out)


def build_one(src_path, facts):
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
    dest = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if meta.get("redirect"):
        with open(dest, "w", encoding="utf-8", newline="\n") as f:
            f.write(redirect_page(meta, rel, root))
        return rel, meta
    extra_js = list(meta.get("js", []))
    if "{{lesson:" in body:
        extra_js.append("lesson-loader.js")

    def fact(mm):
        if mm.group(1) not in facts:
            sys.exit("%s: no fact called %r in src/facts.json" % (rel, mm.group(1)))
        return facts[mm.group(1)]
    body = re.sub(r"\{\{fact:([\w-]+)\}\}", fact, body)
    body = re.sub(r"\{\{diagram:([\w-]+)\}\}", lambda mm: diagram(mm.group(1)), body)
    body = re.sub(r"\{\{lesson:([^}]+)\}\}", lambda mm: lesson(mm.group(1), root), body)
    body = re.sub(r"\{\{figure:([^}]+)\}\}", lambda mm: figure(mm.group(1), root), body)
    body = re.sub(r"\{\{more:([^}]+)\}\}(.*?)\{\{/more\}\}", more_block, body, flags=re.S)
    body = body.replace("{{root}}", root)
    body = stack_tables(body)
    body = add_srcset(body, root)
    # a diagram can scroll sideways on a phone, so it must be reachable by keyboard
    body = body.replace('<figure class="diagram"', '<figure class="diagram" tabindex="0"')
    ld = structured(meta, rel, body)
    if meta.get("help"):
        body = help_wrap(body, rel, root, meta)
    if "{{" in body:
        sys.exit("%s: unknown shortcut near %r" % (rel, body[body.index("{{"):body.index("{{") + 40]))
    if "lesson-loader.js" in extra_js:
        engine = " ".join("%sassets/js/%s?v=%s" % (root, j, ver("assets/js/" + j)) for j in LESSON_ENGINE)
        body = '<div hidden id="lesson-engine" data-src="%s"></div>\n' % engine + body
    out = head(meta, rel, root, extra_js, ld) + header(meta, root) + '<main id="main">\n' + body.rstrip() + "\n</main>\n" + footer(root)
    out = clean_links(out)
    with open(dest, "w", encoding="utf-8", newline="\n") as f:
        f.write(out)
    return rel, meta


def main():
    with open(os.path.join(SRC, "facts.json"), encoding="utf-8") as f:
        facts = {k: v for k, v in json.load(f).items() if not k.startswith("_")}
    pages = []
    for d, _, files in os.walk(os.path.join(SRC, "pages")):
        for fn in sorted(files):
            if fn.endswith(".html"):
                pages.append(build_one(os.path.join(d, fn), facts))
    # sitemap.xml for search engines (the 404 page, noindex pages and redirects left out)
    urls = sorted(page_url(rel) for rel, meta in pages if not meta.get("noindex") and not meta.get("redirect"))
    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8", newline="\n") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for u in urls:
            f.write("  <url><loc>%s</loc></url>\n" % u)
        f.write("</urlset>\n")
    with open(os.path.join(ROOT, "robots.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write("User-agent: *\nAllow: /\nDisallow: /src/\nDisallow: /tools/\nSitemap: %s/sitemap.xml\n" % SITE)
    print("Built %d pages." % len(pages))
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import check
    if not check.run(ROOT):
        sys.exit(1)


if __name__ == "__main__":
    main()
