# Rim Reader website

The public website for Rim Reader, hosted free on GitHub Pages from this repository's `main` branch.

- Address: https://rimreader.com (bought at Namecheap, 2026-10-09). The `CNAME` file holds the domain; GitHub Pages needs it.
- Before the domain is connected: https://ed-aplications.github.io/RimReaderWebsite/

**This repository is public.** Only website files belong here. The app, its code, data and notes stay in the private `Car-Alignment-App` repository.

## Pages

| File | Page |
|---|---|
| `index.html` | Home: what Rim Reader is, how it works, what it measures, availability |
| `bracket.html` | The bracket: ours (print files coming) and the seven rules for making your own |
| `support.html` | Help, contact and safety. Usable as the app stores' support URL |
| `privacy.html` | Privacy policy. Usable as the app stores' privacy-policy URL |
| `terms.html` | Terms of Use and Safety, version 5, word for word as the app shows it |
| `404.html` | Shown for an address that doesn't exist |

Plain HTML and CSS, with nothing to build or install. Each page carries its own header and footer, so a change to the menu or footer is made in every page.

## Where things come from

- **Look:** `assets/css/rim-reader.css` is a copy of `brand/tokens/rim-reader.css` from the app repository; `assets/css/site.css` is the website layout. Dark by default; light when the visitor's system is light; the sun/moon button switches and is remembered in the visitor's own browser.
- **Logos and icon:** copies from `brand/logo` and `brand/icon` in the app repository.
- **Font:** Inter (SIL Open Font License, `assets/fonts/LICENSE.txt`), served from this site in web format.
- **Terms page:** the text of `docs/legal/terms-of-use-v5.md` in the app repository. When the app's terms get a new version, this page must be updated to match.
- **Privacy page:** written from Section 9 of the terms and from what this site does. If the app's handling of information changes, both change together.

## Before launch (from the app's `docs/legal/README.md`)

- A lawyer reviews the terms and the privacy policy.
- Contact details: currently info@rimreader.com.
- No sales on this site: GitHub Pages doesn't allow it. App sales go through the app stores; print-file sales would link to a store.
- Pictures of the app must be real screenshots of the released app (brand style guide).
