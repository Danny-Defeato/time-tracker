# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
  If the stored JSON is missing or corrupt, start with empty data instead of crashing.

## Running and testing

- No build, lint or test tooling. Run by opening `index.html` in a browser.
- Testing is manual: each phase in `BUILD-PLAN.md` has a "Check it yourself"
  checklist, and a feature is done when its checklist passes.
- `BUILD-PLAN.md` is the roadmap: phases 1-4 are features 1-4 below, phase 5 is
  deploying to GitHub Pages. Build them in that order.

## Data model

- One `localStorage` key, `timeTracker.v1`, holding JSON:
  `{ "entries": [ { "id", "task", "start", "end" } ], "running": { "task", "start" } | null }`
- A second key, `timeTracker.theme`, holds only the theme choice: `"auto"`, `"light"` or `"dark"`.
  It's kept separate so the time data and CSV export stay clean.
- `start` / `end` are ISO timestamps. A running timer stores only its start time,
  and elapsed time is always computed as now minus start (never by counting ticks),
  so a reload or a sleeping laptop doesn't lose time.
- Only one timer can run at a time. Starting a new timer while one is running
  stops and saves the running one first.
- An entry that crosses midnight counts toward each day for the part that falls on it.
  Do this split in one shared helper used by Today, History, the 7-day summary and
  the CSV export, so their numbers always agree.
- Totals are built from whole minutes: each entry's part of a day is rounded to the
  nearest minute, and every total is a sum of those. So rows add up to the day total
  and days add up to the week total exactly. The live clock still shows seconds.
- Times are shown in my local time zone.

## Features (version 1)

1. Start/stop timer: type or pick a task name, Start, Stop. Stopping saves an entry.
   The task box suggests task names I've used before.
2. Today: one row per task done today (most time first) with its time, a thin bar showing
   its share of today's total, and a ▶/■ button to start or stop it. Below them, up to 5
   recent tasks from earlier days, dimmed, with ▶. Then today's entries, newest first,
   with delete. Deleting happens right away with an Undo button for about 6 seconds
   (no confirm question). Today's grand total is shown in the page header.
   Totals include the running timer live. Today switches to the new day at midnight by itself.
3. History: pick a day (default yesterday, up to today) to see its task rows and entries
   in the same layout as Today, but with no ▶ buttons; delete with Undo works there too.
   "Last 7 days" (today and the 6 days before): total per day with a bar relative to the
   busiest day (clicking a day opens it in History), total per task, and a week total.
4. Manual entry (task, date, start and end time) for time I forgot to track;
   reject an end time before the start. "Export CSV" downloads all entries with
   columns `task, date, start, end, minutes`, quoting fields that contain commas.
   "Copy summary" copies one line per task for a chosen day to the clipboard, using a
   format with `{date}`, `{task}`, `{duration}`, `{minutes}` placeholders. Presets:
   plain list (default), YouTrack `work` command (`work {date} 1h30m {task}`),
   spreadsheet (tab-separated), and custom. Nothing is sent anywhere; the user pastes it.

## Style

- Plain and simple: clean layout, readable on phone and laptop, light and dark mode
  following the device setting, unless the header's theme button (Auto / Light / Dark)
  overrides it.
- Each task gets a colour from a fixed 8-colour palette, picked from its name, so the
  same name always has the same colour. It's used for its row stripe, bar and entry dot.
  Palette colours must be readable in both themes.
- Durations shown as `1h 05m` (and `mm:ss` on the live timer).
- Buttons and inputs must work with the keyboard and have visible focus.

## How to work with me

- Make one feature at a time. Before a big change, tell me the plan in plain words.
- Don't add features I didn't ask for. Suggest them instead.
- After each change, tell me exactly how to test it in the browser.
- After each change, add a short entry to `LOG.md`: what I asked for, what changed, any decisions.
- I make the git commits myself. Don't run `git commit` or `git push`.
