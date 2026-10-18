# Time Tracker

A personal web app for recording how long I spend on things each day
(studying, coding, gaming, etc.). I'm the only user. Built for TCSS 490
Artifact 2 ("something you will use").

## Stack and structure

- Plain HTML, CSS and JavaScript. No frameworks, no build step, no npm packages.
- Files: `index.html`, `styles.css`, `app.js`. Keep it to these unless I agree to more.
- Hosted on GitHub Pages, so it must work by just opening `index.html`.
- Data is saved in the browser with `localStorage`. Nothing is ever sent anywhere.
  Wrap every `localStorage` read/write in try/catch so the app still works if storage is blocked.

## Data model

- One `localStorage` key, `timeTracker.v1`, holding JSON:
  `{ "entries": [ { "id", "task", "start", "end" } ], "running": { "task", "start" } | null }`
- `start` / `end` are ISO timestamps. A running timer stores only its start time,
  and elapsed time is always computed as now minus start (never by counting ticks),
  so a reload or a sleeping laptop doesn't lose time.
- Only one timer can run at a time.
- An entry that crosses midnight counts toward each day for the part that falls on it.
- Times are shown in my local time zone.

## Features (version 1)

1. Start/stop timer: type or pick a task name, Start, Stop. Stopping saves an entry.
2. Today: total time per task for today, plus today's entries (with delete).
3. History: pick a past day to see its totals, plus a 7-day summary.
4. Manual entry (task, date, start and end time) for time I forgot to track,
   and "Export CSV" to download all entries.

## Style

- Plain and simple: clean layout, readable on phone and laptop, light and dark mode
  following the device setting.
- Durations shown as `1h 05m` (and `mm:ss` on the live timer).
- Buttons and inputs must work with the keyboard and have visible focus.

## How to work with me

- Make one feature at a time. Before a big change, tell me the plan in plain words.
- Don't add features I didn't ask for. Suggest them instead.
- After each change, tell me exactly how to test it in the browser.
- After each change, add a short entry to `LOG.md`: what I asked for, what changed, any decisions.
- I make the git commits myself. Don't run `git commit` or `git push`.
