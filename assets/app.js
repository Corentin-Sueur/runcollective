(function () {
  "use strict";

  var ZONE = "Europe/Stockholm";

  var RUNS = [
    { id: "tuesday", weekday: 2, hour: 18, minute: 15, label: "Tuesday", venue: "Bacchi Syre", area: "Gamla Stan", durationMin: 90 },
    { id: "saturday", weekday: 6, hour: 10, minute: 15, label: "Saturday", venue: "Biscuit Konditoriet", area: "Södermalm", durationMin: 120 }
  ];

  /* ---------- theme ---------- */

  var root = document.documentElement;

  function markButtons(name) {
    var buttons = document.querySelectorAll("[data-theme-set]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-pressed", String(buttons[i].dataset.themeSet === name));
    }
  }

  function applyTheme(name) {
    root.setAttribute("data-theme", name);
    markButtons(name);
    try { localStorage.setItem("rcs-theme", name); } catch (e) { /* private mode */ }
  }

  var stored = null;
  try { stored = localStorage.getItem("rcs-theme"); } catch (e) { /* private mode */ }

  if (stored === "light" || stored === "dark") {
    applyTheme(stored);
  } else {
    var prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    markButtons(prefersLight ? "light" : "dark");
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-theme-set]");
    if (button) applyTheme(button.dataset.themeSet);
  });

  /* ---------- Stockholm wall clock <-> absolute instant ---------- */

  var partsFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });

  function zoneParts(date) {
    var parts = partsFormatter.formatToParts(date);
    var out = {};
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type !== "literal") out[parts[i].type] = Number(parts[i].value);
    }
    out.hour = out.hour % 24;
    return out;
  }

  function zoneOffsetMs(date) {
    var p = zoneParts(date);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
  }

  function instantFromWallClock(year, month, day, hour, minute) {
    var naive = Date.UTC(year, month - 1, day, hour, minute, 0);
    var ts = naive - zoneOffsetMs(new Date(naive));
    return new Date(naive - zoneOffsetMs(new Date(ts)));
  }

  function nextOccurrence(run, now) {
    var today = zoneParts(now);
    for (var offset = 0; offset <= 7; offset++) {
      var day = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
      if (day.getUTCDay() !== run.weekday) continue;
      var start = instantFromWallClock(
        day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), run.hour, run.minute
      );
      if (start.getTime() + run.durationMin * 60000 > now.getTime()) return start;
    }
    return null;
  }

  function nextRun(now) {
    var best = null;
    for (var i = 0; i < RUNS.length; i++) {
      var start = nextOccurrence(RUNS[i], now);
      if (start && (!best || start < best.start)) best = { run: RUNS[i], start: start };
    }
    return best;
  }

  /* ---------- next run banner ---------- */

  var banner = document.getElementById("nextrun");
  var elDay = document.getElementById("nextrun-day");
  var elTime = document.getElementById("nextrun-time");
  var elWhere = document.getElementById("nextrun-where");
  var elCount = document.getElementById("nextrun-count");

  var dateFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE, weekday: "long", day: "numeric", month: "long"
  });

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function countdownText(ms) {
    var total = Math.floor(ms / 1000);
    var days = Math.floor(total / 86400);
    var hours = Math.floor((total % 86400) / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var seconds = total % 60;
    if (days > 0) return "Starts in " + days + "d " + pad(hours) + "h " + pad(minutes) + "m";
    return "Starts in " + pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
  }

  var current = null;

  function tick() {
    var now = new Date();
    if (!current || now.getTime() > current.start.getTime() + current.run.durationMin * 60000) {
      current = nextRun(now);
      if (!current) { banner.hidden = true; return; }
      var p = zoneParts(current.start);
      elDay.textContent = dateFormatter.format(current.start);
      elTime.textContent = pad(p.hour) + ":" + pad(p.minute);
      elWhere.textContent = current.run.venue + " · " + current.run.area;
      banner.hidden = false;
      loadWeather(current);
    }
    var remaining = current.start.getTime() - now.getTime();
    if (remaining <= 0) {
      banner.classList.add("is-live");
      elCount.textContent = "Happening right now — come find us";
    } else {
      banner.classList.remove("is-live");
      elCount.textContent = countdownText(remaining);
    }
  }

  tick();
  setInterval(tick, 1000);

  /* ---------- pace picker ---------- */

  var slider = document.getElementById("pace");
  var paceOut = document.getElementById("pace-out");
  var verdict = document.getElementById("pace-verdict");

  var GROUP_COPY = {
    1: "Tuesday 5–6 km, Saturday 8–9 km. This is the social group — conversation the whole way, nobody left behind.",
    2: "Tuesday 8 km, Saturday 12–15 km. The middle group, and the one most people settle into.",
    3: "Tuesday 8–10 km, Saturday 12–15 km. The quick end of the club."
  };

  function formatPace(seconds) {
    return Math.floor(seconds / 60) + ":" + pad(seconds % 60);
  }

  function groupFor(seconds) {
    if (seconds < 315) return 3;
    if (seconds < 345) return 2;
    return 1;
  }

  function updatePicker() {
    var seconds = Number(slider.value);
    var group = groupFor(seconds);
    paceOut.textContent = formatPace(seconds) + " /km";

    var note = "";
    if (seconds >= 405) note = " Slower than the listed pace is fine — say hello before the start and group 1 will keep you company.";
    else if (seconds <= 260) note = " You will be at the sharp end of group 3.";

    verdict.textContent = "";
    var strong = document.createElement("strong");
    strong.textContent = "Group " + group + ". ";
    verdict.appendChild(strong);
    verdict.appendChild(document.createTextNode(GROUP_COPY[group] + note));

    var rows = document.querySelectorAll(".groups tbody tr");
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.toggle("is-match", Number(rows[i].dataset.group) === group);
    }
  }

  slider.addEventListener("input", updatePicker);
  updatePicker();

  /* ---------- weather ---------- */

  var WEATHER_CODES = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Freezing fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    56: "Freezing drizzle", 57: "Freezing drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain",
    66: "Freezing rain", 67: "Freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Light showers", 81: "Showers", 82: "Heavy showers",
    85: "Snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail"
  };

  /* Icons are built as real DOM nodes rather than an <svg><use> sprite: <use> renders
     into a shadow tree, where only inherited properties reach the shapes, so the
     per-part styling and the animations below would silently not apply. */

  var SVG_NS = "http://www.w3.org/2000/svg";

  function svgEl(name, attrs) {
    var node = document.createElementNS(SVG_NS, name);
    for (var key in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, key)) node.setAttribute(key, attrs[key]);
    }
    return node;
  }

  function svgGroup(className, children, transform) {
    var g = svgEl("g", transform ? { "class": className, transform: transform } : { "class": className });
    for (var i = 0; i < children.length; i++) g.appendChild(children[i]);
    return g;
  }

  function cloud(transform, className) {
    return svgGroup(className || "wi-cloud", [
      svgEl("circle", { cx: 33, cy: 60, r: 15 }),
      svgEl("circle", { cx: 50, cy: 49, r: 19 }),
      svgEl("circle", { cx: 67, cy: 60, r: 15 }),
      svgEl("rect", { x: 33, y: 57, width: 34, height: 18, rx: 9 })
    ], transform);
  }

  var RAYS = [
    [48, 10, 48, 18], [48, 62, 48, 70], [18, 40, 26, 40], [70, 40, 78, 40],
    [27, 19, 33, 25], [63, 55, 69, 61], [69, 19, 63, 25], [33, 55, 27, 61]
  ];

  function sun(transform) {
    var rays = [];
    for (var i = 0; i < RAYS.length; i++) {
      rays.push(svgEl("line", { x1: RAYS[i][0], y1: RAYS[i][1], x2: RAYS[i][2], y2: RAYS[i][3] }));
    }
    return svgGroup("wi-sun", [
      svgEl("circle", { cx: 48, cy: 40, r: 14 }),
      svgGroup("wi-rays", rays)
    ], transform);
  }

  function moon(transform) {
    return svgGroup("wi-moon", [
      svgEl("path", { d: "M60 16a30 30 0 1 0 22 46 34 34 0 0 1-22-46z" })
    ], transform);
  }

  function streaks(className, coords) {
    var lines = [];
    for (var i = 0; i < coords.length; i++) {
      var line = svgEl("line", { x1: coords[i][0], y1: coords[i][1], x2: coords[i][2], y2: coords[i][3] });
      line.style.setProperty("--d", (i * 0.22) + "s");
      lines.push(line);
    }
    return svgGroup(className, lines);
  }

  function flakes() {
    var groups = [];
    for (var i = 0; i < 3; i++) {
      var flake = svgGroup("wi-flake", [
        svgEl("line", { x1: -6, y1: 0, x2: 6, y2: 0 }),
        svgEl("line", { x1: -3, y1: -5, x2: 3, y2: 5 }),
        svgEl("line", { x1: 3, y1: -5, x2: -3, y2: 5 })
      ]);
      flake.style.setProperty("--d", (i * 0.35) + "s");
      // The animation sets `transform`, so positioning lives on an outer group it
      // cannot overwrite.
      groups.push(svgGroup("wi-flake-slot", [flake], "translate(" + (35 + i * 15) + " 80)"));
    }
    return svgGroup("wi-flakes", groups);
  }

  var ICON_PARTS = {
    "clear": function () { return [sun("translate(0 6)")]; },
    "clear-night": function () { return [moon("translate(2 6)")]; },
    "partly": function () {
      return [sun("translate(4 -2) scale(0.72) translate(-4 2)"), cloud("translate(4 14) scale(0.88)")];
    },
    "partly-night": function () {
      return [moon("translate(14 2) scale(0.6) translate(-14 -2)"), cloud("translate(4 14) scale(0.88)")];
    },
    "overcast": function () {
      return [cloud("translate(24 6) scale(0.62)", "wi-cloud wi-cloud-back"), cloud("translate(-4 12) scale(0.96)")];
    },
    "fog": function () {
      return [cloud("translate(0 -10)"), streaks("wi-fog-lines", [[22, 78, 74, 78], [30, 89, 66, 89]])];
    },
    "drizzle": function () {
      return [cloud("translate(0 -10)"), streaks("wi-drops", [[36, 74, 33, 82], [50, 74, 47, 82], [64, 74, 61, 82]])];
    },
    "rain": function () {
      return [cloud("translate(0 -12)"), streaks("wi-drops", [[37, 70, 31, 87], [50, 70, 44, 87], [63, 70, 57, 87]])];
    },
    "snow": function () { return [cloud("translate(0 -12)"), flakes()]; },
    "thunder": function () {
      return [cloud("translate(0 -12)"), svgGroup("wi-bolt", [
        svgEl("path", { d: "M53 64 37 90h11l-3 16 17-25H51l5-17z" })
      ])];
    }
  };

  function renderIcon(host, name) {
    var build = ICON_PARTS[name] || ICON_PARTS.overcast;
    var parts = build();
    while (host.firstChild) host.removeChild(host.firstChild);
    for (var i = 0; i < parts.length; i++) host.appendChild(parts[i]);
  }

  window.RCS = { renderIcon: renderIcon, iconNames: Object.keys(ICON_PARTS) };

  var WEATHER_ICONS = {
    0: "clear", 1: "clear", 2: "partly", 3: "overcast",
    45: "fog", 48: "fog",
    51: "drizzle", 53: "drizzle", 55: "drizzle", 56: "drizzle", 57: "drizzle",
    61: "rain", 63: "rain", 65: "rain", 66: "rain", 67: "rain",
    71: "snow", 73: "snow", 75: "snow", 77: "snow", 85: "snow", 86: "snow",
    80: "rain", 81: "rain", 82: "rain",
    95: "thunder", 96: "thunder", 99: "thunder"
  };

  function iconName(code, isDay) {
    var name = WEATHER_ICONS[code] || "overcast";
    if (!isDay && (name === "clear" || name === "partly")) name += "-night";
    return name;
  }

  var weatherSection = document.getElementById("weather");
  var weatherIcon = document.getElementById("weather-icon");
  var weatherLoadedFor = null;

  /* The forecast is below the fold, so it waits until the page has finished loading
     rather than competing with the critical path. Deliberately not an
     IntersectionObserver: the section carries `hidden` until data arrives, a hidden
     element generates no box, and the observer would never fire. */

  function whenIdle(run) {
    var start = function () {
      if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 2000 });
      else setTimeout(run, 200);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
  }

  function loadWeather(target) {
    var key = target.start.getTime();
    if (weatherLoadedFor === key) return;
    weatherLoadedFor = key;
    whenIdle(function () { fetchWeather(target); });
  }

  function fetchWeather(target) {

    var p = zoneParts(target.start);
    var stamp = p.year + "-" + pad(p.month) + "-" + pad(p.day) + "T" + pad(p.hour) + ":00";

    var url = "https://api.open-meteo.com/v1/forecast?latitude=59.3293&longitude=18.0686" +
      "&hourly=temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code,is_day" +
      "&timezone=Europe%2FStockholm&forecast_days=9";

    fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error("weather unavailable");
        return response.json();
      })
      .then(function (data) {
        var index = data.hourly.time.indexOf(stamp);
        if (index === -1) throw new Error("hour not in forecast range");

        var temp = Math.round(data.hourly.temperature_2m[index]);
        var feels = Math.round(data.hourly.apparent_temperature[index]);
        var rain = data.hourly.precipitation[index];
        var wind = Math.round(data.hourly.wind_speed_10m[index]);
        var code = data.hourly.weather_code[index];

        document.getElementById("weather-when").textContent =
          dateFormatter.format(target.start) + " · " + pad(p.hour) + ":" + pad(p.minute);
        document.getElementById("weather-temp").textContent = temp + "°C";
        document.getElementById("weather-desc").textContent = WEATHER_CODES[code] || "Stockholm weather";
        document.getElementById("weather-meta").textContent =
          "Feels like " + feels + "°C · " + rain.toFixed(1) + " mm rain · " + wind + " km/h wind";

        renderIcon(weatherIcon, iconName(code, data.hourly.is_day[index] === 1));

        weatherSection.hidden = false;
      })
      .catch(function () {
        weatherSection.hidden = true;
        weatherLoadedFor = null;
      });
  }
})();
