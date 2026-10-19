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
- Settings each have their own small key, kept apart from the time data:
  `timeTracker.theme` (auto, light, dark, warm, midnight, contrast), `timeTracker.accent`
  (blue, green, purple, orange, pink, teal), `timeTracker.goals` (`{ "Task": minutes }`),
  `timeTracker.remindHours` (0, 2, 4, 8), `timeTracker.shortcuts` (on/off), `timeTracker.tab`
  (last tab). Each is read with a safe fallback; if storage is blocked, changes last for the visit.
- `start` / `end` are ISO timestamps. A running timer stores only its start time,
  and elapsed time is always computed as now minus start (never by counting ticks),
  so a reload or a sleeping laptop doesn't lose time.
- Only one timer can run at a time. Starting a new timer while one is running
  stops and saves the running one first.
- An entry that crosses midnight counts toward each day for the part that falls on it.
  Do this split in one shared helper used by Today, History, the 7-day summary and
  the copy feature, so their numbers always agree.
- Totals are built from whole seconds: each entry's part of a day is rounded to the
  nearest second, and every total is a sum of those. So rows add up to the day total
  and days add up to the week total exactly.
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
4. Add time I forgot to track: an "+ Add time" button on Today and on History (for the
   day shown) opens a small dialog with just: what (task), started at (time), and how long
   (hours + minutes). No end time or midnight checkbox; if it runs past midnight the split
   happens automatically. Refuse empty fields, 0 length, over 24 hours, or ending after now.
   Adding shows "Added … · Undo".
   History has a Share area: "Copy this day as text" (a title line with the day total, then
   "Task: 1h 05m 09s" lines) with one option, a "Use YouTrack format" checkbox
   (`work 2026-10-17 1h30m Task` lines; tasks under 30 seconds left out). If the clipboard is
   blocked, show the text selected for Ctrl+C. And "Download all entries for Excel": a real
   .xlsx file (built in app.js, no library) with columns Task | Start | End | Duration, one
   row per entry with full date-times, a bold header and a Total row. No CSV: commas
   showed up in my Excel. Keep these features simple: no templates or format options.

5. Extras (kept after simplifying): the running timer shows in the browser tab title
   (`12:34 · Task – Time Tracker`). Every entry has an Edit button that opens the same
   dialog as Add time, filled in; changing only the name keeps the exact times. History has
   a Backup area: "Download a backup" (a .json file of all entries) and "Restore from a
   backup", which only adds entries that aren't already here (same task, start and end),
   never deletes, and offers Undo.
6. Settings window (header button), each change applies at once: theme and accent colour;
   daily goals per task (Today shows `1h 05m 09s / 2h`, and `✓` when met); rename or merge a
   task (renaming onto an existing name merges; renames the running timer and goals too; Undo
   inside the window); "Still working?" banner after 2/4/8 hours or never (Keep going asks
   again after the next block; Stop now saves and points to Edit); keyboard shortcuts
   S start/stop, N task box, 1/2/3 tabs, ignored while typing or with a window open, and
   can be turned off. Adding or editing time that overlaps other time warns once (press the
   button again to keep it). The page reopens on the last tab used.
- Saved data and backups are cleaned on load: names trimmed, blank names and entries
   that end before they start are skipped, and every entry gets its own id.

## Style

- Plain and simple: clean layout, readable on phone and laptop. Theme follows the device
  (Auto) unless Settings picks Light, Dark, Warm paper, Midnight or High contrast; plus an
  accent colour. Every theme × accent must keep text 7:1, muted/error text 4.5:1, button
  text 4.5:1 and task colours 3:1 against the surface.
- Each task gets a colour from a fixed 8-colour palette, picked from its name, so the
  same name always has the same colour. It's used for its row stripe, bar and entry dot.
  Palette colours must be readable in both themes.
- Durations shown as `1h 05m 09s` (and `mm:ss` on the live timer).
- Layout: header, then the Timer (always visible), then tabs: Today | History | Week.
  The page opens on Today. Tabs work with arrow keys, Home and End.
- Buttons and inputs must work with the keyboard and have visible focus.

## How to work with me

- Make one feature at a time. Before a big change, tell me the plan in plain words.
- Don't add features I didn't ask for. Suggest them instead.
- After each change, tell me exactly how to test it in the browser.
- After each change, add a short entry to `LOG.md`: what I asked for, what changed, any decisions.
- I make the git commits myself. Don't run `git commit` or `git push`.
