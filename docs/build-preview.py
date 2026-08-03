#!/usr/bin/env python3
"""Bundle the site into a single self-contained file for the Claude artifact preview.

The artifact runs under a strict CSP that blocks every external request, so the CSS,
JS, photos and calendar files all have to be inlined. Output: docs/preview.html
(gitignored — the real site is index.html + assets/).
"""

import base64
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".ics": "text/calendar"}


def data_uri(name):
    path = ASSETS / name
    mime = MIME[path.suffix.lower()]
    return "data:" + mime + ";base64," + base64.b64encode(path.read_bytes()).decode()


html = (ROOT / "index.html").read_text(encoding="utf-8")

# Keep only what lives inside <body>; the artifact host supplies the skeleton.
title = re.search(r"<title>(.*?)</title>", html, re.S).group(1)
body = re.search(r"<body>(.*)</body>", html, re.S).group(1)

# Inline every ./assets/<file> reference as a data URI.
for match in sorted(set(re.findall(r"\./assets/([\w.-]+)", body))):
    if match in ("styles.css", "app.js"):
        continue
    body = body.replace("./assets/" + match, data_uri(match))

css = (ASSETS / "styles.css").read_text(encoding="utf-8")
js = (ASSETS / "app.js").read_text(encoding="utf-8")
body = body.replace('<script src="./assets/app.js"></script>', "")

# Preview-only. The artifact CSP blocks the open-meteo request, so the weather section
# would hide itself and its icons would never be seen. Fill the card with sample data
# and add a gallery of every icon so the visual can actually be reviewed.
ICONS = [
    ("clear", "Clear sky"), ("clear-night", "Clear night"),
    ("partly", "Partly cloudy"), ("partly-night", "Partly cloudy, night"),
    ("overcast", "Overcast"), ("fog", "Fog"),
    ("drizzle", "Drizzle"), ("rain", "Rain"),
    ("snow", "Snow"), ("thunder", "Thunderstorm"),
]

gallery = "".join(
    f'<li><svg class="weather-icon" viewBox="0 0 96 96" data-icon="{i}" aria-hidden="true">'
    f'</svg><span>{label}</span></li>'
    for i, label in ICONS
)

demo = """
<section class="band" id="icon-gallery">
  <div class="wrap">
    <p class="eyebrow">Preview only — not part of the site</p>
    <h2>Weather icons</h2>
    <p class="section-lede">One of these renders in the card above, chosen from the
      forecast code for the next run's exact hour. Day and night variants are picked
      using the forecast's own daylight flag, so a dark November Tuesday never shows a sun.</p>
    <ul class="icon-gallery">""" + gallery + """</ul>
  </div>
</section>
<style>
  .icon-gallery { list-style: none; padding: 0; margin: 2.5rem 0 0;
    display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: 2rem 1rem; }
  .icon-gallery li { display: flex; flex-direction: column; align-items: center; gap: .75rem; text-align: center; }
  .icon-gallery span { font-size: .72rem; text-transform: uppercase; letter-spacing: .12em; color: var(--fg-dim); }
</style>
<script>
  (function () {
    var when = document.getElementById("weather-when");
    if (!when) return;
    setTimeout(function () {
      var section = document.getElementById("weather");
      if (!section.hidden) return;
      when.textContent = "Sample forecast — the live one needs a real server";
      document.getElementById("weather-temp").textContent = "9\\u00b0C";
      document.getElementById("weather-desc").textContent = "Light rain";
      document.getElementById("weather-meta").textContent =
        "Feels like 6\\u00b0C \\u00b7 0.8 mm rain \\u00b7 21 km/h wind";
      window.RCS.renderIcon(document.getElementById("weather-icon"), "rain");
      section.hidden = false;
    }, 400);

    var slots = document.querySelectorAll("[data-icon]");
    for (var i = 0; i < slots.length; i++) {
      window.RCS.renderIcon(slots[i], slots[i].dataset.icon);
    }
  })();
</script>
"""

out = (
    "<title>" + title + "</title>\n"
    "<style>\n" + css + "\n</style>\n"
    + body.strip() + "\n"
    "<script>\n" + js + "\n</script>\n"
    + demo
)

target = ROOT / "docs" / "preview.html"
target.write_text(out, encoding="utf-8")
print("wrote", target, "-", f"{len(out.encode('utf-8')) / 1024:.0f} KB")
