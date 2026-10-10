# Rim Reader website

The public website for Rim Reader, hosted free on GitHub Pages from this repository's `main` branch.

- Address: https://rimreader.com. The `CNAME` file holds the domain; GitHub Pages needs it.

**This repository is public.** Only website files belong here. The app, its code, data, research and notes, including the site's content rules, audits and page plans, stay in the private `Car-Alignment-App` repository under `docs/business/website/`.

The website and the app are one project in two repositories. When the app changes something this site shows or copies (see "Where things come from" below), the site is updated in the same piece of work. A fact found wrong here is fixed at its source in the app repository first.

## How the pages are made

The finished pages (`*.html` at the top and in `help/`) are **generated**. Don't edit them directly: edit the matching file in `src/pages/`, then run

```
python tools/build.py
```

and commit both. The build wraps each page in the shared header, menu and footer, so a change to the menu is made once, in `tools/build.py`. It also writes `sitemap.xml` and `robots.txt`, then runs `tools/check.py`, which stops on a broken link or anchor, an image without alt text, a description too long for search results, or wording the site doesn't use. GitHub Pages serves the committed files as they are; nothing runs on the server.

Shortcuts a page can use (see the top of `tools/build.py`):

- `{{fact:name}}` puts in a number or phrase from `src/facts.json`, so figures used on several pages are typed once.
- `{{more:Question|id}} ... {{/more}}` makes a section that opens when tapped. Pages give the short answer first and keep the detail in these. An address ending `#id` opens it.
- `{{diagram:name}}` puts in a diagram from `src/diagrams/name.svg`. The diagrams use the site's colours, so they follow the light and dark themes.
- `{{lesson:Lesson Name}}` shows one of the app's animated lessons as a still picture that plays when tapped. The lesson scripts load only then.
- `{{figure:path|alt text|caption}}` shows a picture with a caption, and is left out if the picture isn't there yet. A smaller copy named `name-800.webp` (or `-600`) is used on phones automatically.
- A table with `class="stack"` shows as one card per row on phones.

A page whose settings include `"redirect": "page.html#anchor"` only sends visitors on (used for `compare.html`, now part of the accuracy page).

## Pages

| Page | What it is |
|---|---|
| `index.html` | Home |
| `how-it-works.html` | What you'll do, then why it works, in questions that open |
| `bracket.html` | The bracket: the wedge finder, popular phones, getting one |
| `bracket-print.html` | Parts, sizes, the sixteen wedges, print settings, care, the camera version |
| `make-your-own.html` | The seven things a homemade bracket needs |
| `accuracy.html` | How closely readings repeat, other ways to check alignment compared, what makes a good reading |
| `compare.html` | Redirects to `accuracy.html#compare` |
| `coming-soon.html` | What's coming: Google Play, print files, iPhone, shop plans, factory specs |
| `faq.html` | Frequently asked questions, with a search box |
| `help/` | The help center: getting started, set up, measuring, results, history and reports, alignment basics, all 16 lessons, troubleshooting |
| `support.html` | How support works and how to contact us. Usable as the app stores' support URL |
| `privacy.html` | Privacy policy. Usable as the app stores' privacy-policy URL |
| `terms.html` | Terms of Use and Safety, version 6, word for word as the app shows it |
| `404.html` | Shown for an address that doesn't exist |

## Where things come from

- **Look:** `assets/css/rim-reader.css` is a copy of `brand/tokens/rim-reader.css` from the app repository; `assets/css/site.css` is the website layout. Dark by default; light when the visitor's system is light; the sun/moon button switches and is remembered in the visitor's own browser.
- **Logos and icon:** copies from `brand/logo` and `brand/icon` in the app repository.
- **Font:** Inter (SIL Open Font License, `assets/fonts/LICENSE.txt`), served from this site and cut down to Latin characters to keep pages light. To re-make the files from the full Inter release: `pyftsubset Inter-Regular.woff2 --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2070-209F,U+20AC,U+2122,U+2190-2199,U+2212,U+2215,U+2248,U+2260,U+2264,U+2265" --layout-features="kern,liga,calt,tnum,case" --flavor=woff2` (and the same for SemiBold, Bold and ExtraBold).
- **Lessons:** `assets/js/lesson-engine.js` and `assets/js/lessons-data.js` are copied from the app repository's lesson gallery (`docs/design/tutorial/`), so the site plays the same lessons as the app. `assets/js/lessons.js` is the player and `assets/js/lesson-loader.js` loads it on the first tap. The still pictures in `assets/img/lesson/` (one per lesson and theme) are drawn by the same engine. When the lessons change in the app, copy them again and re-make the stills.
- **Sample reports:** `assets/img/report/` are the report design samples from `docs/design/alignment-report/` in the app repository, with made-up names and numbers, and are captioned that way. Replace them with real exports from the released app.
- **Bracket pictures:** `assets/img/bracket/`, made from the print files of bracket design 1.7.0. Re-make them when the bracket changes.
- **Terms page:** the text of `docs/legal/terms-of-use-v6.md` in the app repository. When the app's terms get a new version, this page must be updated to match.
- **Privacy page:** written from Section 9 of the terms and from what this site does. If the app's handling of information changes, both change together.
- **Facts:** every number and step on the site comes from the app repository's guides, requirements and test results as of app version 0.128 (October 2026). Figures used on several pages live in `src/facts.json`.
