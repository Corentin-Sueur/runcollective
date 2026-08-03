// Verification harness for the Stockholm wall-clock -> instant conversion in assets/app.js.
// Run: TZ=<zone> node docs/tz-check.mjs

const ZONE = "Europe/Stockholm";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE, hour12: false,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit"
});

function zoneParts(date) {
  const out = {};
  for (const p of partsFormatter.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  out.hour = out.hour % 24;
  return out;
}

function zoneOffsetMs(date) {
  const p = zoneParts(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
}

function instantFromWallClock(year, month, day, hour, minute) {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const ts = naive - zoneOffsetMs(new Date(naive));
  return new Date(naive - zoneOffsetMs(new Date(ts)));
}

const RUNS = [
  { id: "tuesday", weekday: 2, hour: 18, minute: 15, durationMin: 90 },
  { id: "saturday", weekday: 6, hour: 10, minute: 15, durationMin: 120 }
];

function nextOccurrence(run, now) {
  const today = zoneParts(now);
  for (let offset = 0; offset <= 7; offset++) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    if (day.getUTCDay() !== run.weekday) continue;
    const start = instantFromWallClock(
      day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), run.hour, run.minute
    );
    if (start.getTime() + run.durationMin * 60000 > now.getTime()) return start;
  }
  return null;
}

function nextRun(now) {
  let best = null;
  for (const run of RUNS) {
    const start = nextOccurrence(run, now);
    if (start && (!best || start < best.start)) best = { run, start };
  }
  return best;
}

const show = (d) => new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE, weekday: "short", day: "2-digit", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: false
}).format(d);

let failures = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n        got      ${actual}\n        expected ${expected}`);
}

console.log(`process TZ = ${process.env.TZ || "(system)"}\n`);

// 1. Round trip: a known summer instant (CEST, +02:00).
check("summer wall clock 2026-08-04 18:15 -> UTC",
  instantFromWallClock(2026, 8, 4, 18, 15).toISOString(), "2026-08-04T16:15:00.000Z");

// 2. Round trip: a known winter instant (CET, +01:00).
check("winter wall clock 2026-12-01 18:15 -> UTC",
  instantFromWallClock(2026, 12, 1, 18, 15).toISOString(), "2026-12-01T17:15:00.000Z");

// 3. The Saturday immediately BEFORE the 2026 autumn switch (Sun 25 Oct) is still CEST.
check("2026-10-24 10:15 (last CEST Saturday) -> UTC",
  instantFromWallClock(2026, 10, 24, 10, 15).toISOString(), "2026-10-24T08:15:00.000Z");

// 4. The Saturday immediately AFTER the switch is CET — the hour must NOT drift.
check("2026-10-31 10:15 (first CET Saturday) -> UTC",
  instantFromWallClock(2026, 10, 31, 10, 15).toISOString(), "2026-10-31T09:15:00.000Z");

// 5. Spring switch (Sun 29 Mar 2026): Tuesday before is CET, Tuesday after is CEST.
check("2026-03-24 18:15 (last CET Tuesday) -> UTC",
  instantFromWallClock(2026, 3, 24, 18, 15).toISOString(), "2026-03-24T17:15:00.000Z");
check("2026-03-31 18:15 (first CEST Tuesday) -> UTC",
  instantFromWallClock(2026, 3, 31, 18, 15).toISOString(), "2026-03-31T16:15:00.000Z");

// 6. Selection: from a Sunday, the next run is Tuesday; from a Wednesday, it is Saturday.
check("from Sun 2026-08-02 12:00 UTC, next run",
  show(nextRun(new Date("2026-08-02T12:00:00Z")).start), "Tue, 04 Aug 2026, 18:15");
check("from Wed 2026-08-05 12:00 UTC, next run",
  show(nextRun(new Date("2026-08-05T12:00:00Z")).start), "Sat, 08 Aug 2026, 10:15");

// 7. A run stays "current" until its duration elapses, then rolls to the next one.
check("during Tuesday run (18:40 Stockholm), still shows Tuesday",
  show(nextRun(new Date("2026-08-04T16:40:00Z")).start), "Tue, 04 Aug 2026, 18:15");
check("after Tuesday run ends (19:50 Stockholm), rolls to Saturday",
  show(nextRun(new Date("2026-08-04T17:50:00Z")).start), "Sat, 08 Aug 2026, 10:15");

// 8. Crossing a month boundary, and crossing the autumn DST switch mid-week.
check("from Mon 2026-08-31, next run is Tue 1 Sep",
  show(nextRun(new Date("2026-08-31T09:00:00Z")).start), "Tue, 01 Sept 2026, 18:15");
check("from Wed 2026-10-28 (pre-switch week), next run is Sat 31 Oct in CET",
  show(nextRun(new Date("2026-10-28T09:00:00Z")).start), "Sat, 31 Oct 2026, 10:15");

// 9. Year boundary.
check("from Wed 2026-12-30, next run is Sat 2 Jan 2027",
  show(nextRun(new Date("2026-12-30T09:00:00Z")).start), "Sat, 02 Jan 2027, 10:15");

console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
process.exit(failures === 0 ? 0 : 1);
