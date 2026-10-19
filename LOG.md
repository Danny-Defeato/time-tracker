# Log: plans and changes

What I set out to build, what I asked the agent for, what I decided, and what I dropped.

## 2026-10-18: Plan

**Goal:** a time tracker I'll actually use: record how long I spend on tasks each day.

**Decisions**
- Web page (HTML/CSS/JS) on GitHub Pages, so I can use it on my phone and laptop and link it from my portfolio.
- Data stays in my browser (`localStorage`); nothing is uploaded.
- Plain, simple look (no game theme this time) so the time goes into features.
- Version 1 features: start/stop timer, today's totals, past days and a weekly view, manual entries, CSV export.
- Built in phases with Claude Code, one feature per phase, testing and committing after each (see `BUILD-PLAN.md`).

**Dropped for now:** accounts/sync between devices, charts, categories/tags, reminders.

## 2026-10-18: Update CLAUDE.md from /init

**Asked for:** ran `/init`; accepted all six suggested improvements to `CLAUDE.md`.

**Changed (`CLAUDE.md` only, no app code yet)**
- Added the standard header.
- Added "Running and testing": no build or test tools, open `index.html`, test with the checklists in `BUILD-PLAN.md`, which is the roadmap.
- Copied details from `BUILD-PLAN.md` into the features list: task suggestions, confirm before delete, reject end before start, CSV columns and comma quoting.
- Design rules: one shared helper splits entries across midnight for every view and the CSV; missing or corrupt saved data starts empty instead of crashing.

**Decisions**
- Starting a second timer stops and saves the first one automatically.
- Today's totals include the running timer live.

## 2026-10-18: Feature 1, timer

**Asked for:** start/stop timer with a task box that suggests past tasks, a live `mm:ss` clock (hours past 60 minutes), Stop saves an entry, starting a new timer saves the running one, and a running timer survives a reload. Planned in plan mode first.

**Changed:** created `index.html`, `styles.css`, `app.js`.
- Data saved to `timeTracker.v1`. Elapsed time is always now minus the start time, so reloads and closed tabs don't lose time.
- Missing or corrupt saved data starts empty. If storage is blocked, a warning shows and the app keeps working without saving.
- Light and dark mode follow the device setting. Visible keyboard focus. Layout fits a phone.

**Decisions**
- Enter in the task box starts the timer.
- Starting the task that's already running shows "Already tracking <task>" and keeps going, with no save and no restart. Changed from my first plan, which saved and restarted. "Same task" means an exact match after trimming spaces.
- After Stop, a status line says "Saved: <task>, <duration>". It's the only sign of a save until feature 2 adds the Today list.
- Two open tabs stay in sync through the browser's `storage` event.
- The storage warning has its own box above the timer instead of using the status line, so a "Saved" message can't hide it.

## 2026-10-18: Fix test 7, add recent-task buttons

**Problem:** test 7 failed. Clearing the task box and clicking into it showed no suggestions.

**Cause:** the saved tasks were in the suggestion list. The problem is that the browser decides when to open that list (an HTML `<datalist>`), and browsers don't agree. Firefox only opens it once you type or press the Down arrow. Chrome usually needs a second click or the Down arrow. Phones often show suggestions only above the keyboard, or not at all. The page can't make the list open on click.

**Asked for:** keep the suggestions, and add one-click buttons for my most recent tasks (up to 5) under the task box, working on phones too.

**Changed:** `index.html`, `app.js`, `styles.css`.
- A "Recent:" row of buttons under the task box shows the 5 most recently used tasks, newest first, using the same list as the suggestions. Clicking one starts that task straight away.
- The row is hidden until there's at least one saved entry.
- The buttons wrap onto more lines on narrow screens. They're at least 44px tall so they're easy to tap. Long names wrap instead of overflowing.

**Decisions**
- A recent button behaves exactly like typing the name and pressing Start: it saves a different running task first, and shows "Already tracking <task>" if that task is already running.
- The running task stays in the row; it isn't hidden or highlighted.

## 2026-10-18: Browser tests and clock lag fix

**Asked for:** have Claude run the tests itself, then fix the clock lag it found.

**Testing:** Claude ran the whole Phase 1 checklist plus the recent buttons in headless Chrome, using a script with a throwaway profile kept outside the repo. It used real clicks and key presses and real waiting, including a tab closed for 62 seconds. Everything passed. The first run had 3 failures, all caused by mistakes in the test script, not the app. One thing it couldn't check: whether the browser's suggestion dropdown actually opens, because the browser draws it outside the page.

**Problem found:** the live clock could show up to 1 second less than the real time. It redrew once a second, but those redraws weren't lined up with the moment Start was pressed.

**Changed:** `app.js`. After each redraw, the clock now schedules the next one for just after the next whole second since the start (20 ms after). It only runs while a timer is going, and it lines back up when you return to the tab. The saved times and durations were always correct; only the display lagged.

## 2026-10-18: Feature 2, Today (with ideas from two other trackers)

**Asked for:** draw inspiration from two trackers I found (taskspage.com and wattdo.org) without copying them. Claude read both sites and looked at their app screenshots, then suggested 6 ideas. I picked all 6 and approved the plan before anything was built.

**Where the ideas came from**
- Wattdo (a time tracker): each task is a row with its time and its own ▶ button, and the header shows the total.
- TasksPage (a to-do list, no timers): a thin bar on every task row, colour stripes, and undo instead of "are you sure?".

**Changed:** `index.html`, `styles.css`, `app.js`, `CLAUDE.md`.
- **Header:** today's grand total, counting live, and a theme button that cycles Auto → Light → Dark.
- **Today rows:** one per task done today, most time first, showing the time, a bar for its share of today, and ▶/■. Up to 5 tasks from earlier days are shown dimmed with ▶. These rows replace the Recent buttons from feature 1.
- **Entries list:** newest first, with time range, duration and a colour dot. Delete happens right away, with Undo for about 6 seconds.
- **Task colours:** 8 colours picked from the task name, with separate shades for light and dark mode.
- **Midnight split:** a shared helper (`msOnDay`) splits entries across midnight. History will reuse it.
- **Midnight rollover:** Today switches to the new day by itself.

**Decisions**
- The theme is saved in its own key, `timeTracker.theme`. A small script in the page's `<head>` applies it before the page draws, so there's no flash of the wrong theme.
- Each second, only the numbers and bar widths are updated, so keyboard focus isn't lost. Rows are rebuilt when the data changes, or when the running task overtakes another in the order. After a rebuild, focus goes back to the same task's button.
- The Undo popup stays up while it has keyboard focus or the mouse is over it. After Undo, the entry goes back in the same place.
- An entry crossing midnight shows the date on the side that isn't today (for example "Oct 17, 11:30 PM – 12:30 AM"), and its duration counts only today's part.
- `BUILD-PLAN.md`'s Phase 2 checklist still says delete "asks first". That's now replaced by Undo. I left that file as it was.

**Testing:** Claude ran 46 checks in headless Chrome. They covered feature 1 again, totals, order, bars, ▶/■ (including by keyboard), delete and Undo, the midnight split, the midnight rollover (using a fake clock set to 23:59:57), the theme button, phone width, corrupt data and blocked storage. All passed. The first run had one failure, caused by a mistake in the test itself (it created test data while the fake clock was still on).

## 2026-10-18: Feature 3, History and last 7 days (plus YouTrack planning)

**Asked for:** start Phase 3, and work out how export could help with YouTrack, which another class uses for tracking work. I went with Claude's suggestions. I also asked for the YouTrack helper to be generic, so it's useful for other things too.

**YouTrack research and decision (for Phase 4)**
- YouTrack logs time per issue as a "work item": a date, a duration and an optional comment. You add one with the Add spent time form, or with the `work` command (`work 2026-10-18 1h30m description`). The docs don't show a way to import time from a file.
- Plan: start task names with the issue ID (for example `CS490-12 Login page`). Phase 4 adds a generic **Copy summary** button: one line per task for a chosen day, using a format with `{date}`, `{task}`, `{duration}` and `{minutes}` placeholders. It has presets for a plain list, YouTrack `work` commands and spreadsheets, plus a custom option. Added to `CLAUDE.md` feature 4.
- **Rejected:** sending time to YouTrack automatically through its API. It would mean storing a login token in the browser and sending data to a server, which breaks the "nothing is sent anywhere" rule. It also may not work from GitHub Pages at all.

**Changed:** `index.html`, `styles.css`, `app.js`, `CLAUDE.md`.
- **History:** a date picker (starts on yesterday, can't go past today) showing that day's task rows, share bars, total and entries. Same layout as Today but with no ▶ buttons. Delete with Undo works. An empty day says "Nothing tracked on this day."
- **Last 7 days:** today plus the 6 days before.
  - Each day shows its total and a bar relative to the busiest day. Clicking a day opens it in History.
  - Each task shows its week total, most first.
  - The week total is shown at the top.
- Today's numbers in History and the week update live while a timer runs, and match the Today section.

**Fix found while planning:** totals could disagree by a minute, because each number was rounded down separately. For example, two 30-second entries showed 0m each but 1m in total. Now each entry's part of a day is rounded to the nearest minute, and every total adds those up. Rows add up to the day total and days add up to the week total exactly. The live clock still shows seconds. Added to `CLAUDE.md`.

**Decisions**
- "Last 7 days" is a rolling window ending today, not Monday to Sunday (as in `BUILD-PLAN.md`).
- A future date typed into History is pulled back to today. Clearing the date keeps the last day shown.
- Rows without buttons (History and the week) are rebuilt every second. Rows with buttons only get their numbers updated, so keyboard focus is never lost.

**Testing:** Claude ran 64 checks in headless Chrome covering features 1–3, all passing. The new checks covered the History default and limits, the midnight split on both days, empty days, week totals adding up, clicking a day, delete and Undo from History, whole-minute rounding, live updates, and the phone layout. The first run had 5 failures, all from the test clicking things outside the visible part of the now-taller page. Fixed by scrolling to each element before clicking, as a real user would.

## 2026-10-18: Tabs and seconds

**Asked for:** make the page collapsible or tabbed (Claude's suggestion, because the page was getting long on a phone), and show seconds, since minutes felt too rough for tracking.

**About seconds:** Claude pointed out that tracking was never inaccurate. Every start and stop is saved to the millisecond, and only the totals were rounded for display. Seconds are still useful for short tasks and for checking that numbers add up, so they're now shown everywhere.

**Changed:** `index.html`, `styles.css`, `app.js`, `CLAUDE.md`.
- **Seconds:** durations are now `1h 05m 09s`. Totals are built from whole seconds (each entry's part of a day rounded to the nearest second), so rows, days and the week still add up exactly. While a timer runs, the totals tick every second.
- **Tabs:** the Timer stays at the top, with **Today | History | Last 7 days** tabs below it. The page opens on Today. Clicking a day in Last 7 days switches to History on that day.
- **Keyboard:** only the selected tab is in the Tab order. The arrow keys, Home and End move between tabs, following the standard pattern for accessible tabs. The panel headings are kept for screen readers but hidden visually, since the tab names already say the same thing.

**Decisions**
- Tabs rather than collapsible sections: they're shorter on a phone and only one view shows at a time.
- The page always opens on Today; the last tab used isn't remembered. That could be added later if wanted.
- Entry time ranges still show hours and minutes (for example "9:05 AM – 9:45 AM"), and only durations show seconds. That keeps the list readable.
- For Phase 4: YouTrack takes whole minutes, so the Copy summary's YouTrack preset will round to minutes. The CSV can include a seconds column.

**Testing:** Claude ran 70 checks in headless Chrome, all passing. New checks covered the tabs (click, arrow keys, Home and End, only one panel shown), live seconds in every total, totals adding up with odd-second entries (40s + 40s + 20s = 1m 40s everywhere), 44px tap targets on tabs, and the Today tab fitting on a phone. Earlier checks were updated for the seconds format. One first-run failure came from the test measuring a button inside a hidden tab; the app was fine.

## 2026-10-18: Feature 4, Add time, Export CSV and Copy summary

**Asked for:** build Phase 4 as planned. I also approved ideas 1–11 for afterward (not 12 or 13), to be built one at a time after this is committed.

**Changed:** `index.html`, `styles.css`, `app.js`, `CLAUDE.md`.
- **New tab, Add & export.** The "Last 7 days" tab label is now "Week" so four tabs fit on a phone; the heading inside still says Last 7 days.
- **Add time:** task (with suggestions), date (up to today), start, end, and an "Ends the next day" checkbox.
  - **Rejected, with a clear message next to the field:**
    - a missing field
    - an end before the start (the message points to the checkbox)
    - more than 24 hours
    - time in the future
  - The new entry shows up in every view straight away.
- **Export CSV:** columns `task, date, start, end, minutes, seconds`. An entry crossing midnight becomes two rows (the first ends at `24:00:00`), so each date adds up to what the app shows.
  - **Excel-safe:** a BOM so Excel reads accented letters, quotes around names with commas or quotes, and a `'` in front of names starting with `= + - @` so Excel can't run them as formulas.
  - Downloads as `time-tracker-YYYY-MM-DD.csv`. The running timer isn't included until it's stopped.
- **Copy summary:** a day picker, a format picker (Plain list / YouTrack / Spreadsheet / Custom), an editable line format, a live preview, and a Copy button.
  - **Blanks you can use:** `{date} {task} {duration} {minutes} {hm} {tab}`.
  - **YouTrack preset:** `work {date} {hm} {task}`. It leaves out tasks under 30 seconds, because YouTrack rejects 0 minutes.
  - If the browser blocks the clipboard, the preview text is selected for Ctrl+C.

**Decisions**
- Manual entries may overlap existing ones (an overlap warning is idea 10, coming later).
- Summary lines are sorted by most time first. The preview refreshes when data changes, and pressing Copy recalculates first, so a running timer is counted up to that moment.

**Testing:** Claude ran 96 checks in headless Chrome, all passing. They covered every validation message, the midnight entry from the form (30 min on each day), the CSV contents (quoting, formula guard, decimal minutes, midnight split, each date adding up to the app), the real downloaded file (BOM, Windows line endings), every summary preset, Copy (normal and blocked), and the phone layout in both themes. One first-run failure was the test reading the file in a way that hides the BOM; the saved file itself was correct.

## 2026-10-18: Simplified Phase 4 (my feedback: too confusing)

**What I said:** the dates in the CSV were messed up, the site was hard to understand, the "line format" made no sense, and adding entries felt faulty. Simplify a lot, and don't use commas in the export, since they looked ugly in Excel.

**What went wrong (Claude's explanation):** everything passed its tests but was too complicated for a person to use.
- The CSV split dates and times into separate columns.
- It cut midnight entries into two rows ending at `24:00:00`, which Excel shows oddly.
- The commas probably appeared because Excel didn't split the columns, which depends on Windows' region settings.
- Copy summary needed you to learn `{placeholders}`.
- Adding time needed a date, a start, an end and a midnight checkbox, in a separate tab.

**Changed:** `index.html`, `styles.css`, `app.js`, `CLAUDE.md`.
- **Back to three tabs:** Today | History | Week. The Add & export tab is gone.
- **Add time:** a "+ Add time" button at the bottom of Today and History, for the day on screen, opens a small dialog with just three things:
  - what you worked on
  - when you started
  - how long (hours and minutes)

  No end time and no midnight checkbox; going past midnight is handled on its own. Plain messages explain any problem. Adding shows "Added … · Undo", the same popup as delete.
- **Copy this day as text** (in History, under Share): a title line with the day's total, then one line per task. The only option is a "Use YouTrack format" checkbox, which gives `work 2026-10-17 1h30m Task` lines. The line format and presets are gone.
- **Download all entries for Excel** replaces the CSV. It's a real `.xlsx` file built in `app.js` (no library), so there are no commas.
  - Columns: Task | Start | End | Duration. Each start and end is a full date and time that Excel recognises.
  - Wide columns, a bold frozen header row, and a Total row at the bottom.
  - Claude checked it by opening the downloaded file in Excel and reading the cells back.
- **Clearer text:** the timer asks "What are you working on?", and when idle it says "Type what you're working on, then press Start."

**Decisions**
- The 11 ideas I approved earlier are paused, because they'd add features while we're simplifying. Claude suggests keeping only the tab-title timer, backup and restore, and edit an entry for later.
- `BUILD-PLAN.md`'s Phase 4 checklist still talks about CSV and end times. It's left as it was; this entry records the change.

**Testing:** 96 checks in headless Chrome, all passing: the dialog (every message, Cancel, Escape, Enter, focus going back), adding to History, Undo of an add, the midnight case, Copy (plain, YouTrack, blocked clipboard, empty day), and the Excel file (unzipped and inspected: header, rows, Total formula, safe text, correct dates and durations). Then Excel itself opened the file and showed:

    Task               | Start              | End                 | Duration
    Reading, chapter 3 | 2026-10-17 9:00 AM | 2026-10-17 10:30 AM | 1:30:30
    Night              | 2026-10-17 11:30 PM| 2026-10-18 12:30 AM | 1:00:00
    Total              |                    |                     | 3:20:30

## 2026-10-18: Bug sweep

**Asked for:** a sweep for bugs across the whole site: what it shows, what it produces (copy text, Excel), and how it takes input.

**How:** Claude read all the code, wrote a reproduction for each suspected bug, and only fixed the ones that actually happened. Then it ran a random-data check and the full test suite.

**Bugs found and fixed** (7 of the 8 suspected bugs were real):
1. **Deleting the wrong entry.** Entries without an id (for example after editing data by hand) shared a blank id, so deleting one removed another. Now every entry gets its own id when the data loads.
2. **Bad saved data showed up.** Blank task names appeared as empty rows, and entries ending before they start went into the Excel file with negative durations. These are now ignored when loading, and names are trimmed.
3. **Undo jumped to the top of the page.** After Undo, focus went to the task box at the top, which on a phone scrolls away and opens the keyboard. Focus now goes back near where you were (the "+ Add time" button in the same tab).
4. **Misleading copy message.** Copying in YouTrack format on a day where every task is under 30 seconds said "Nothing to copy for this day." It now explains that YouTrack needs at least 1 minute.
5. **Task box out of step with another tab.** Starting or stopping a timer in another tab didn't update this tab's task box. It does now, unless you're typing in it.
6. **Backwards entries.** If the computer's clock was changed so a timer's start was in the future, Stop saved an entry that ends before it starts. Now nothing is saved, and a message explains why.
7. **Errors not read out.** Error messages in the Add time dialog weren't linked to their fields, so screen readers didn't read them. They're linked now.

Also fixed: the header showed "0h 00m" for a moment on load, without the seconds.

**Not a bug:** a daylight-saving day (Nov 1 2026, 25 hours long) is counted correctly.

**Checks**
- **Random data:** 300 random entries over 10 days (odd seconds, many crossing midnight), tested in two time zones. Every History day total matches an independent calculation, task rows and entries add up to the day total, the week adds up, the header matches, copied text adds up, and the Excel file has 300 rows whose durations and Total match the data.
- **Full suite:** 96 checks, all passing.

**Noticed, not changed:** deleting an entry that crosses midnight from one day's list deletes the whole entry, so both days' parts go. Its time range shows both dates, so this is visible.

## 2026-10-18: Idea 3, timer in the tab title

**Asked for:** continue with the ideas kept after simplifying (tab-title timer, backup and restore, edit an entry).

**Changed:** `app.js`. While a timer runs, the browser tab's title shows it, for example `12:34 · Studying – Time Tracker`. When stopped, it goes back to `Time Tracker`. It's still right after a reload.

**Known limit:** browsers slow down pages in background tabs. After about 5 minutes hidden, Chrome only lets a page update about once a minute, so the title can be up to a minute behind in a background tab. The recorded time isn't affected.

**Testing:** 4 new checks in headless Chrome (idle title, ticking title, after a reload, after Stop), all passing.

## 2026-10-18: Idea 4, backup and restore

**Why:** the times are saved only in this browser. Clearing browser data or switching laptops would lose them.

**Changed:** `index.html`, `styles.css`, `app.js`. A **Backup** area at the bottom of History, with a one-line explanation:
- **Download a backup** saves `time-tracker-backup-YYYY-MM-DD.json` with all saved entries.
- **Restore from a backup** opens a file picker. It **adds** the backup's entries that aren't already here and never deletes anything, so restoring an old backup can't wipe out newer times. It reports what happened ("Restored 3 entries", "Everything in that backup is already here") and offers Undo.
- A file that isn't a backup is refused with a clear message. Broken entries inside a backup (blank names, impossible times) are skipped, using the same checks as the saved data.

**Decisions**
- "Already here" means the same task, start and end, not the same id. Testing showed ids alone can clash and wrongly skip an entry. Restored entries get fresh ids.
- The running timer isn't part of a backup. The message says so if one is running.
- The Excel download now shares the same download code.

**Testing:** 8 new checks in headless Chrome, all passing: nothing to back up, a real downloaded file, restoring into an empty browser, restoring twice, restoring next to existing data, Undo, a non-backup file, and a backup with broken entries. The first run found the id-clash problem above, which is now fixed.

## 2026-10-18: Idea 5, edit an entry

**Changed:** `app.js`, `styles.css`, `CLAUDE.md`. Every entry, in Today and History, has an **Edit** button. It opens the same small window as Add time, titled "Edit Coding" and filled in with the entry's name, start and length.
- **Name only:** if just the name changes, the original times are kept exactly, seconds included. A short entry that shows as 0 minutes can still be renamed.
- **Times:** changing the start or length uses the same checks as adding (not blank, not 0 length, not over 24 hours, not later than now).
- **After saving:** "Saved changes to … · Undo" appears. Cancel or Escape changes nothing, and focus goes back to the Edit button.

**Decisions**
- An edited entry stays on its original day; only the time of day can change. To move time to another day, delete it and add it on that day.
- If the entry was deleted in another tab while the window was open, saving explains that instead of failing silently.

**Testing:** 10 new checks in headless Chrome, all passing: filled-in window, rename keeping seconds, Undo, changing the length, Cancel, blank name, future time, renaming a 20-second entry, editing from History, and the phone layout. The full suite is now **118 checks**, all passing. The tab-order check was updated because Edit buttons are now in the Tab order.
