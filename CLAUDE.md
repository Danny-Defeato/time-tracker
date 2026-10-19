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
- Data is saved in the browser with `localStorage`. Time data is never sent anywhere.
  The only outside request is the Launcher theme's font (Sora, Google Fonts), and only
  while Launcher is the theme; every other theme loads nothing from other sites.
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
  `{ "entries": [ { "id", "task", "start", "end", "note"? } ], "running": { "task", "start" } | null }`
- `note` is optional (up to 120 characters). Entries without one are valid and must keep
  working; a blank note is stored as no `note` at all.
- Settings each have their own small key, kept apart from the time data:
  `timeTracker.theme` (auto, light, dark, warm, midnight, contrast, launcher; new visitors
  with no saved times get launcher, existing users without a saved theme keep auto),
  `timeTracker.accent` (blue, green, purple, orange, pink, teal), `timeTracker.gradient`
  (sunset, ocean, lime, ember; Launcher's accent), `timeTracker.goals` (`{ "Task": minutes }`),
  `timeTracker.plans` (`{ "2026-10-18": { "Task": minutes } }`, plans for one date only),
  `timeTracker.remindHours` (0, 2, 4, 8), `timeTracker.shortcuts` (on/off), `timeTracker.pixel`
  (on/off, Show Pixel), `timeTracker.tour` ("done" once Pixel's tour has been finished or
  skipped), `timeTracker.tab` (last tab). Each is read with a safe fallback; if storage is blocked, changes last for the visit.
- `start` / `end` are ISO timestamps. A running timer stores only its start time,
  and elapsed time is always computed as now minus start (never by counting ticks),
  so a reload or a sleeping laptop doesn't lose time.
- Only one timer can run at a time. Starting a new timer while one is running
  stops and saves the running one first.
- An entry that crosses midnight counts toward each day for the part that falls on it.
  Do this split in one shared helper used by Today, History, the 7-day summary and
  the copy feature, so their numbers always agree. The Week chart and the History calendar
  use it too (`dayTotals()` → `secondsOnDay()`).
- Totals are built from whole seconds: each entry's part of a day is rounded to the
  nearest second, and every total is a sum of those. So rows add up to the day total
  and days add up to the week total exactly.
- Times are shown in my local time zone.

## Features (version 1)

1. Start/stop timer: type or pick a task name, Start, Stop. Stopping saves an entry.
   The task box suggests task names I've used before.
2. Today: a ring chart of today by task (same totals, order and colours as the rows, whose
   colour stripes are its legend; total in the middle; live while a timer runs; a text version
   for screen readers; hidden when nothing is tracked today) beside the rows when there's room,
   above them otherwise. Then one row per task done today (most time first) with its time, a thin bar showing
   its share of today's total, and a ▶/■ button to start or stop it. Below them, up to 5
   recent tasks from earlier days, dimmed, with ▶. Then today's entries, newest first,
   with delete. Deleting happens right away with an Undo button for about 6 seconds
   (no confirm question). Today's grand total is shown in the page header.
   Totals include the running timer live. Today switches to the new day at midnight by itself.
   Each entry has "Add note" / "Edit note": a small text box under the entry (Enter saves,
   Esc cancels, plus Save/Cancel buttons for phones; saving it empty removes the note).
   The note is shown under the entry in Today and History.
   "Plan my day" (a button at the top of Today) opens a small window to set a planned time
   for any task for today only (separate from daily goals, which repeat every day). Planned
   tasks get a Today row even before any time is tracked. A row with a plan shows progress
   against it instead of its share of today: a dashed outline is the plan, the fill is time
   so far, time past the plan is red, and next to the bar it says "on track" (within a minute
   of the plan), "40m to go" or "25m over" (red). Going over is allowed (e.g. gaming).
3. History: a month calendar on top (Sunday first), one square per day shaded by hours
   tracked: none, under 1h, 1–3h, 3–5h, 5h+ (tints of the accent colour, with a small key).
   ‹ › change the month (› stops at the current month), future days are disabled, and
   clicking a day opens it. Each square's label reads "October 14: 2h 10m". Below it, pick
   a day (default yesterday, up to today) to see its task rows and entries in the same
   layout as Today, but with no ▶ buttons; delete with Undo works there too.
   Week tab, "Last 7 days" (today and the 6 days before): first the Weekly Banner, four
   slides stepped through with ‹ ›, the dots, or the arrow keys / Home / End (no auto-advance):
   total this week and the change from the 7 days before that, top task, longest single
   session (the part of one entry, or the running timer, inside the 7 days), and busiest day.
   It uses the same shared split, so its numbers match the rest of the tab. Then a column chart, one column
   per day (height = day total relative to the busiest day) stacked by task in each task's
   colour, with a legend; hovering, focusing or tapping a column shows the day total and
   each task's time, and every column has a screen-reader text version. Then total per day
   with a bar relative to the busiest day (clicking a day opens it in History), total per
   task, and a week total.
4. Add time I forgot to track: an "+ Add time" button on Today and on History (for the
   day shown) opens a small dialog with just: what (task), started at (time), and how long
   (hours + minutes). No end time or midnight checkbox; if it runs past midnight the split
   happens automatically. Refuse empty fields, 0 length, over 24 hours, or ending after now.
   Adding shows "Added … · Undo".
   Settings → Share: "Copy this day as text", for the day in its own date picker (it starts
   as the day shown in History; a title line with the day total, then
   "Task: 1h 05m 09s" lines) with one option, a "Use YouTrack format" checkbox
   (`work 2026-10-17 1h30m Task` lines; tasks under 30 seconds left out). A task's notes
   from that day go at the end of its line, oldest first, no repeats
   (`Task: 1h 05m 09s — note one; note two`). If the clipboard is
   blocked, show the text selected for Ctrl+C. And "Download all entries for Excel": a real
   .xlsx file (built in app.js, no library) with columns Task | Start | End | Duration | Note,
   one row per entry with full date-times, a bold header and a Total row. No CSV: commas
   showed up in my Excel. Keep these features simple: no templates or format options.

5. Extras (kept after simplifying): the running timer shows in the browser tab title
   (`12:34 · Task – Time Tracker`). Every entry has an Edit button that opens the same
   dialog as Add time, filled in; changing only the name keeps the exact times. Settings →
   Backup: "Download a backup" (a .json file of all entries, notes included, plus `plans`)
   and "Restore from a backup", which only adds entries that aren't already here (same task,
   start and end) and plans for a date and task that has none here, never deletes or
   overwrites, and offers Undo next to its message (inside Settings, since the undo popup
   can't be reached behind an open window). Older backups without plans still restore.
   "Pop out" next to the Timer heading opens a small always-on-top window (Document
   Picture-in-Picture, Chrome and Edge only; the button is hidden elsewhere) with the task,
   the live time and a Stop that really stops and saves the timer. Closing it only closes it.
6. Settings window (header button). Its "Settings" title and a × close button (aria-label
   "Close settings") sit in a header that stays visible while the window scrolls; Esc and
   clicking outside also close it, and there is no Done button. Each section (Look,
   Reminder, Keyboard shortcuts, Share, Backup, Help) folds open and closed, and only Look is
   open each time the window opens. Each change applies at once: theme and accent colour (or
   gradient), Show Pixel; "Still working?" banner after 2/4/8 hours or never (Keep going asks
   again after the next block; Stop now saves and points to Edit); keyboard shortcuts
   S start/stop, N task box, 1/2/3/4 tabs, ignored while typing or with a window open, and
   can be turned off; Share and Backup (above); Help: "Show the tour again".
   The Tasks tab (not hidden in Settings): daily goals per task (Today shows
   `1h 05m 09s / 2h`, and `✓` when met), and rename or merge a task (renaming onto an
   existing name merges; renames the running timer, goals and plans too; Undo right there). Adding or editing time that overlaps other time warns once (press the
   button again to keep it). The page reopens on the last tab used.
7. Pixel, the portfolio's companion robot (its SVG drawing and faces), at home in the
   window's bottom-left corner, 20px in, like on the portfolio (fixed, so dragging or tossing
   him never moves anything on the page; windows and the undo popup go over him). Content can
   pass under him while scrolling, so the page keeps enough bottom space for anything to be
   scrolled clear of him; the left edge is mostly text, not buttons. Resting moods: asleep with a drifting "z" (no timer; a poke wakes him
   without counting against you), bobbing and typing (timer running), a few happy hops when a
   daily goal becomes met (not for goals already met when the page opens). Poking him shows a
   line typed into his bubble (screen readers get the whole line from a hidden status).
   His temper (0–100): pokes +7, throws +14, hard landings +10; drains after 3 quiet seconds.
   Five stages (calm, annoyed, grumpy, angry, furious) change his lines, face and shell colour;
   a small rage meter above his head shows from "annoyed". Drag him to toss him: gravity,
   bounces off the window edges, dizzy after hard landings, then he walks home (not with
   reduced motion). His eyes follow the mouse. When his temper runs out he snaps and makes
   you play Stop the Clock: stop a stopwatch on 5.00 seconds (to the hundredth shown), within
   0.10 on 2 of 3 tries; try 3 goes dark after 2 seconds. Winning calms him to 0; Give up or
   Esc always closes it (he's left grumpy). "Show Pixel" in Settings → Look. Looks and fun
   only: he never changes data.
8. Pixel's tour: six steps (start a timer, Today, Plan my day, entries, the other tabs,
   Settings), a spotlight on each part with his card beside it (Back, Next, Skip; Esc ends
   it). Shown once to everyone, then from Settings → Help.
- Saved data and backups are cleaned on load: names trimmed, blank names and entries
   that end before they start are skipped, and every entry gets its own id.

## Style

- Plain and simple: clean layout, readable on phone and laptop. Themes: Launcher (default
  for new visitors), Auto (follows the device), Light, Dark, Warm paper, Midnight, High
  contrast; plus an accent colour. Every theme × accent must keep text 7:1, muted/error
  text 4.5:1, button text 4.5:1 and task colours 3:1 against the surface. (Exception: the
  Launcher title's gradient text is large text and meets 3:1, not 7:1.)
- Launcher theme = the portfolio site's game-launcher look: navy background #10141f, panels
  #1a2030 and #232b40, Sora font with system fallback, 14px corners, and a gradient (the
  portfolio's: Sunset #ff7a59 → #c64bff → #3f6bff, Ocean #12b5a5 → #1f9bd1 → #3f6bff, Lime
  #8fd14f → #2fb37a → #0f8fa3, Ember #ff9f43 → #ff5f45 → #d6336c, chosen in Settings instead
  of the accent colour) on the app title, the Start button, the tab underline and the By day
  bars. The timer card glows softly while a timer runs. The portfolio's glass look: panels
  and windows are frosted, see-through glass over a soft glow, with hairline light edges, a
  frosted header that stays at the top on wide screens, and a soft light following the mouse
  over task rows and entry cards. Glass is Launcher only, and solid with
  `prefers-reduced-transparency`; text on glass must still pass the contrast rules over the
  brightest part of the glow.
- Motion, in every theme, looks only (never changes behaviour or numbers), each under
  0.5s, and all off with `prefers-reduced-motion`: the tab underline slides, panels fade
  in, bars animate to new widths, headline totals count up, new entries slide in and
  deleted ones slide out, buttons press down, dialogs and the undo toast pop in.
  Exception: Pixel's loops and tosses are longer (the "z" drifts over 2.4s, a throw lasts
  until he lands); they can be hidden with "Show Pixel" and stop with `prefers-reduced-motion`
  like everything else.
- Each task gets a colour from a fixed 8-colour palette, picked from its name. Exception:
  tasks with time in the last 7 days never share a colour (while there are 8 or fewer);
  oldest-used tasks keep their own colour and a newer clashing task takes the next free one.
  So a task's colour can change when the week's set of tasks changes. The colour is used for
  its row stripe, bar, entry dot, chart segment and legend. Palette colours must be readable
  in both themes.
- Durations shown as `1h 05m 09s` (and `mm:ss` on the live timer).
- Layout: header, then the Timer (always visible), then tabs: Today | History | Week | Tasks.
  The page opens on Today. Tabs work with arrow keys, Home and End.
- Wide screens (60rem / 960px and up): the page widens to 75rem and splits into two columns,
  the Timer card on the left (sticky, so it stays in view, when the window is at least 44rem
  tall) and the tabs on the right. Entries become a grid of small cards there. Narrower
  screens keep the single column. Inside the tabs, sections sit side by side whenever each
  can have about 20rem, and stack otherwise: History's calendar beside the day's rows; Week's
  banner beside its chart, and By day beside By task.
- Phones (26rem / 416px wide or less): task rows put the time under the name with ▶/■ beside
  both, and entries put the duration under the time range, so names never get squeezed.
  Must work at 320px wide with no sideways scrolling. Hover-only effects go inside
  `@media (hover: hover)` so taps don't leave things stuck open.
- Buttons and inputs must work with the keyboard and have visible focus.

## How to work with me

- Make one feature at a time. Before a big change, tell me the plan in plain words.
- Don't add features I didn't ask for. Suggest them instead.
- After each change, tell me exactly how to test it in the browser.
- After each change, add a short entry to `LOG.md`: what I asked for, what changed, any decisions.
- I make the git commits myself. Don't run `git commit` or `git push`.
