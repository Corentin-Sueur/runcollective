# Run Collective Stockholm — website

Static site for [Run Collective Stockholm](https://www.instagram.com/runcollectivestockholm).
Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies.

## Running it

Open `index.html` in a browser. That is the whole workflow.

For the weather block you need to serve it over HTTP rather than `file://`:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Layout

```
index.html                  the entire site
assets/styles.css           all styling, light + dark themes
assets/app.js               countdown, pace picker, weather, theme toggle
assets/*.jpg, logo.png      photos, taken from the club's existing site
assets/*.ics                the two recurring calendar subscriptions
docs/                       design doc and the timezone test harness (not published)
.nojekyll                   stops GitHub Pages running the files through Jekyll
```

## What the JavaScript does

Everything degrades to a readable page if JS is off — times, venues and pace groups are
all in the HTML.

- **Next-run countdown.** Converts the Stockholm wall-clock schedule (Tue 18:15, Sat
  10:15) to an absolute instant, so it is correct for a visitor in any timezone and
  across both daylight-saving switches. A run stays showing as "current" until its
  duration elapses, then rolls to the next one.
- **Pace picker.** Maps a pace to a group: slower than 5:45/km → group 1, 5:15–5:44 →
  group 2, faster than 5:15 → group 3.
- **Weather.** Fetches the forecast for the next run's exact hour from
  [open-meteo](https://open-meteo.com) (free, no API key). If the request fails for any
  reason the whole section removes itself rather than showing an empty box.
- **Theme.** Follows the system preference, remembers an explicit choice.

### Timezone test

The scheduling logic has a test harness. Run it in a few timezones:

```bash
for z in Europe/Stockholm America/Los_Angeles Asia/Kolkata UTC; do
  printf "%-22s " "$z"; TZ="$z" node docs/tz-check.mjs | tail -1
done
```

13 assertions, covering both DST switches, month and year boundaries.

## Confirm with the club before this goes live

The times, venues, pace groups and all the section copy are taken verbatim from the
current runcollective.se. The FAQ and the "The run is half of it" section are new, and
some claims are reasonable inference rather than stated fact. Check these:

- [ ] No sign-up and no membership — is that right?
- [ ] Is group 1 genuinely a no-drop group?
- [ ] "Every session ends the same way — everyone back together around a table" and
      "stay for as long as you like" — is that how the socials actually run?
- [ ] Do the runs continue through winter, rain, and over the holidays?
- [ ] Is there a bag-drop caveat (indoors, valuables, staffed)?
- [ ] Is there a public contact email? There is none on the current site, so the contact
      section points at Instagram only.
- [ ] The `.ics` files recur weekly forever. If the club pauses (Christmas, summer), add
      `EXDATE;TZID=Europe/Stockholm:<YYYYMMDD>T181500` lines to the `VEVENT`.

## Performance

Images are sized to roughly 2× their displayed dimensions and re-encoded, which is where
almost all the page weight is. If you replace one, resize it too — a full-resolution
phone photo dropped into `assets/` will undo most of this.

| file | serves at | displayed |
|---|---|---|
| `hero.jpg` | 1024×768 | full-bleed |
| `crew-park.jpg` | 838×838 | ~419 px |
| `crew-water.jpg` | 628×838 | ~314 px |
| `social.jpg` | 1180×787 | ~half width |
| `logo.png` | 192×192 | 56 px + favicon |

**Still on the table:** converting to AVIF or WebP with a `<picture>` fallback saves a
further ~180 KB, most of it on `hero.jpg` (~77 KB), which is the one image a resize
can't help. macOS ImageIO refuses to encode either format inside the Claude sandbox, so
this needs a real terminal — `cwebp`/`avifenc` via Homebrew, or Squoosh.

Two audit findings are deliberately **not** fixed:

- *Efficient cache lifetimes.* GitHub Pages hardcodes `max-age=600` and exposes no
  setting. Only escapes are fronting it with a CDN or leaving Pages.
- *Render-blocking CSS* (~130 ms). Inlining the stylesheet would need a build step to
  keep the source split, which is not worth 130 ms.

## Photos

The five images come from the club's existing WordPress site and are its own published
material. `hero.jpg`, `crew-water.jpg` and `crew-park.jpg` are real club photos;
`social.jpg` is a stock image the club was already using — worth replacing with a real
one from a Tuesday.

## Deploying

GitHub Pages, `main` branch, root. Every path in the site is relative, so it works
unchanged whether it is served from a subpath (`/runcollective/`) or from the apex
domain — with three deliberate exceptions in `<head>`, which must be absolute because
they are read off-site: `og:image`, `og:url` and `rel="canonical"`. They currently point
at `corentin-sueur.github.io/runcollective/` and must be updated on a domain cutover, or
link previews break and Google indexes the wrong URL.

To move it to `runcollective.se` later: add a `CNAME` file containing `runcollective.se`,
then point the domain's DNS at GitHub Pages (four `A` records for the apex, or a `CNAME`
for `www`). Nothing in the site needs to change.
