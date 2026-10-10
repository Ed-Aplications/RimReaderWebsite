# Rim Reader website

The public website for Rim Reader, hosted free on GitHub Pages from this repository's `main` branch.

- Address: https://rimreader.com (bought at Namecheap, 2026-10-09). The `CNAME` file holds the domain; GitHub Pages needs it.
- Before the domain is connected: https://ed-aplications.github.io/RimReaderWebsite/

**This repository is public.** Only website files belong here. The app, its code, data and notes stay in the private `Car-Alignment-App` repository.

The website and the app are one project in two repositories. When the app changes something this site shows or copies (see "Where things come from" below), the site is updated in the same piece of work. A fact found wrong here is fixed at its source in the app repository first.

## How the pages are made

The finished pages (`*.html` at the top and in `help/`) are **generated**. Don't edit them directly: edit the matching file in `src/pages/`, then run

```
python tools/build.py
```

and commit both. The build wraps each page in the shared header, menu and footer, so a change to the menu is made once, in `tools/build.py`. It also writes `sitemap.xml` and `robots.txt`. GitHub Pages serves the committed files as they are; nothing runs on the server.

Shortcuts a page can use (see the top of `tools/build.py`):

- `{{diagram:name}}` puts in a diagram from `src/diagrams/name.svg`. The diagrams use the site's colours, so they follow the light and dark themes.
- `{{lesson:Lesson Name}}` plays one of the app's animated lessons.
- `{{figure:path|alt text|caption}}` shows a picture with a caption, and is left out if the picture isn't there yet.

## Pages

| Page | What it is |
|---|---|
| `index.html` | Home |
| `how-it-works.html` | How the app measures, in plain words, with diagrams |
| `bracket.html` | The bracket: parts, sizes, the wedge finder, which phones fit, printing, care, make your own |
| `accuracy.html` | What has been measured, and what hasn't been tested yet |
| `compare.html` | Ways to check alignment, compared by type (no brand names) |
| `coming-soon.html` | What's coming: Google Play, iPhone, print files, factory specs and why they come later, shop plans |
| `faq.html` | Frequently asked questions, with a search box |
| `help/` | The help center: getting started, setup, calibration, measuring, results, adjusting, garage, reports, troubleshooting, all 16 lessons, alignment basics |
| `support.html` | How support works and how to contact us. Usable as the app stores' support URL |
| `privacy.html` | Privacy policy. Usable as the app stores' privacy-policy URL |
| `terms.html` | Terms of Use and Safety, version 6, word for word as the app shows it |
| `404.html` | Shown for an address that doesn't exist |

## Where things come from

- **Look:** `assets/css/rim-reader.css` is a copy of `brand/tokens/rim-reader.css` from the app repository; `assets/css/site.css` is the website layout. Dark by default; light when the visitor's system is light; the sun/moon button switches and is remembered in the visitor's own browser.
- **Logos and icon:** copies from `brand/logo` and `brand/icon` in the app repository.
- **Font:** Inter (SIL Open Font License, `assets/fonts/LICENSE.txt`), served from this site in web format.
- **Lessons:** `assets/js/lesson-engine.js` and `assets/js/lessons-data.js` are copied from the app repository's lesson gallery (`docs/design/tutorial/`), so the site plays the same lessons as the app. When the lessons change in the app, copy them again. `assets/js/lessons.js` is the player.
- **Sample reports:** `assets/img/report/` are the report design samples from `docs/design/alignment-report/` in the app repository, with made-up names and numbers, and are captioned that way. Replace them with real exports from the released app.
- **Bracket pictures:** `assets/img/render/`, made in Blender from the print files of bracket design 1.7.0. Re-make them when the bracket changes.
- **Terms page:** the text of `docs/legal/terms-of-use-v6.md` in the app repository. When the app's terms get a new version, this page must be updated to match.
- **Privacy page:** written from Section 9 of the terms and from what this site does. If the app's handling of information changes, both change together.
- **Facts:** every number and step on the site comes from the app repository's guides, requirements and test results as of app version 0.127 (October 2026). No competitor or vendor is named, and prices aren't published until launch.

## Before launch (from the app's `docs/legal/README.md`)

- A lawyer reviews the terms and the privacy policy.
- Contact details: info@rimreader.com.
- No sales on this site: GitHub Pages doesn't allow it. App sales go through the app stores; print-file sales would link to a store.
- Pictures of the app must be real screenshots of the released app (brand style guide). There are none on the site yet.
