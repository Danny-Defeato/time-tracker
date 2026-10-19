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

## 2026-10-18: The other ideas (themes, accent, goals, rename, reminder, overlap, shortcuts, last tab)

**Asked for:** add the remaining ideas (1, 2, 6, 7, 8, 9, 10, 11), then move on to Phase 5.

**How it stays simple:** almost everything lives in one **Settings** window, opened from the header (it replaces the old theme button), so the main screen didn't get busier. Each change applies straight away.

**Changed:** `index.html`, `styles.css`, `app.js`, `CLAUDE.md`.
- **Theme presets (1):** Auto, Light, Dark, plus **Warm paper** (soft off-white), **Midnight** (deep blue) and **High contrast** (black on white, strong borders, darker task colours). A small script in the page's `<head>` applies the choice before the page draws, so there's no flash.
- **Accent colour (2):** blue, green, purple, orange, pink or teal, each with a darker shade for light themes and a lighter one for dark themes.
- **Keyboard shortcuts (6):** `S` start/stop, `N` jump to the task box, `1` `2` `3` switch tabs.
  - Ignored while typing in a box, with a window open, or with Ctrl/Alt/⌘ held.
  - They can be turned off, because single-key shortcuts can get in the way of screen readers (an accessibility guideline asks for this).
- **Rename or merge (7):** pick a task and type a new name. Using a name that already exists merges the two. It also renames the running timer, the task box and any goal. Undo sits right in the window, because the usual Undo popup can't be reached while a window is open.
- **Daily goals (8):** for example "Studying: 1h a day". Today shows `0h 30m 00s / 1h`, then `✓ 1h 00m 00s / 1h` in the accent colour once met. Goals can be removed.
- **"Still working?" (9):** after 4 hours (or 2, 8, or never) a banner appears under the timer.
  - **Keep going** asks again after the next block (8h, then 12h).
  - **Stop now** saves the entry and suggests fixing the end with Edit.
  - Screen readers announce it once, not every second.
- **Overlap warning (10):** adding or editing time that overlaps another entry or the running timer warns once, naming what it overlaps. Pressing the button again keeps it. Changing the times checks again.
- **Last tab (11):** the page reopens on the tab you used last.

**Decisions**
- Goals and settings aren't part of backups; backups hold only time entries.
- The "Keep going" choice is forgotten on reload, so the question can come back after reloading. That errs on the side of catching a forgotten timer.

**Testing:** the full suite is now **150 checks** in headless Chrome, all passing. New checks cover:
- all five themes looking different
- a contrast check of every theme with every accent (text 7:1, muted and error text 4.5:1, button text 4.5:1, task colours 3:1)
- the accent being remembered and switching shade in dark themes
- goals (set, progress, met, removed, missing task)
- rename and merge (moves the goal, Undo, renames the running timer)
- the banner (shows, Keep going, Stop now, Never)
- overlaps (warns, warns again after a change, keeps on the second press, no warning when clear)
- shortcuts (S, S, 2, N, typing S in the box, turning them off)
- the last tab
- Settings fitting on a phone

Looking at the screenshots found one problem the checks missed: at phone width, the accent colour names overflowed the Settings window. It's fixed with two columns on narrow screens, and a check now confirms nothing sticks out at 320px, 375px and desktop width.

## 2026-10-18: Phase 5, getting ready to deploy

**Asked for:** move on to Phase 5 (deploy to GitHub Pages and the portfolio card).

**Done by Claude**
- **Pre-deploy check:** only relative links (`styles.css`, `app.js`), nothing loaded from other sites, and file names match exactly (GitHub Pages cares about capital letters).
- **Web-server smoke test:** served the folder on a local web server under `/time-tracker/`, like GitHub Pages, and checked in headless Chrome:
  - the page loads
  - start/stop works
  - Copy uses the real clipboard
  - the Excel and backup downloads work
  - settings are remembered
  - there are no console errors

  All 7 checks passed.
- **README.md** rewritten for the repository page: what the app does, the privacy note, how it's built, and links to this log and the plan.

**Left for me** (I push and commit myself, and the reflection has to be in my own words):
- push, turn on GitHub Pages, and test on my phone and laptop
- move my test data across with Backup if I want it
- fill in the portfolio card and write the reflection

**Note:** the times saved while opening `index.html` as a file live in a different browser storage area than the live site. The live site starts empty, and Download a backup / Restore from a backup moves the data over.

## 2026-10-18: Settings window, close button and folding sections

**Asked for:** a × close button in a header with the "Settings" title that stays visible while the window scrolls (aria-label "Close settings", visible focus); Esc and clicking outside also close it; each section (Look, Daily goals, Rename or merge, Reminder, Keyboard shortcuts) can be folded, with only Look open at first; keep Done at the bottom.

**Changed**
- `index.html`: the title and a new × button sit in a `settings-header`. Each section is now a `<details>` with its name in the `<summary>`, so folding works with the mouse, Enter and Space without extra code.
- `styles.css`: the header is sticky at the top of the window, with the surface colour behind it so content scrolls underneath. The × is a 44px button and uses the same yellow focus ring as other buttons. Section names show ▸ when folded and ▾ when open, and screen readers skip the arrows.
- `app.js`: the × closes the window. Clicking the dark area outside closes it too, but only if the press and the release both happen outside, so dragging a text selection out of a box doesn't close it by accident. Esc was already built into `<dialog>`. Each time Settings opens, only Look is unfolded.

**Decisions**
- Sections reset to "only Look open" every time the window opens, not just the first time, so it always opens the same way.
- I used the browser's built-in `<details>` rather than custom buttons: it's keyboard-friendly by default and needs less code.
- Checked in headless Chrome: opens with only Look unfolded, the header stays at the top after scrolling, × and outside clicks close it, clicks inside don't, the aria-label is right, and nothing sticks out sideways.

## 2026-10-18: Week chart

**Asked for:** a column chart of the last 7 days above "By day" in the Week tab: one column per day, its height showing the day's total, stacked coloured segments per task (each task's existing colour). Hovering or tapping a column shows the day's total and each task's time. A small legend. Plain HTML/CSS, no library. Use the shared midnight-split helper so the numbers match the lists. Screen readers get a text label for each column.

**Changed**
- `index.html`: a new "Each day by task" block in the Week tab with a one-line hint, the chart (a list of 7 columns) and the legend.
- `app.js`:
  - `renderWeekChart` builds the columns and legend when the page renders. `updateWeekChart` refreshes heights, segments, pop-ups and labels every second while a timer runs. Both use `weekData()`, which uses `dayTotals()` / `secondsOnDay()`, the same split as By day, By task and the week total. A midnight-crossing entry is split between its two columns.
  - Each column is a button. Its accessible name is a hidden sentence like "Today: 2h 55m 00s. Studying 1h 15m 00s, Coding 1h 40m 00s". The bars, the pop-up and the short day name are hidden from screen readers so nothing is read twice.
  - Tapping a column opens its pop-up, and tapping another column, tapping elsewhere or pressing Esc closes it. Esc also hides a hover or keyboard-focus pop-up.
  - A small helper (`placeChartTip`) centres the pop-up over its column but keeps it inside the chart, so it never sticks out on a phone.
  - The "Today"/date label logic is now one helper (`weekDayLabel`) shared with By day.
- `styles.css`: the chart, segments, pop-up and legend, all using the existing theme colours and task colours. Hover effects are only used on devices with a mouse, so a tap on a phone doesn't leave a pop-up stuck open.

**Decisions**
- Heights are relative to the busiest day, like the By day bars. In every column the task with the most time this week is at the bottom, so colours stack in the same order. The pop-up lists tasks biggest first, like the task rows.
- Under the columns, today shows its weekday in bold instead of "Today", because "Today" didn't fit at phone width. The pop-up and the screen-reader text still say "Today".
- The chart is hidden when nothing was tracked in the last 7 days (the existing "Nothing tracked" message shows instead).
- Checked in headless Chrome with test data (a midnight-crossing entry plus a running timer):
  - each column's task times add up to its total
  - each column matches By day, and the columns add up to the week total
  - tapping opens a pop-up, another tap switches to that column, a tap outside closes it
  - at 320px wide no pop-up goes off screen and the page doesn't scroll sideways

## 2026-10-18: No shared colours within the week

**Asked for:** the suggestion from the week chart: tasks in the last 7 days should never share a colour.

**Changed** (`app.js`)
- `hashColor(name)` is the old colour-from-the-name rule.
- New `assignTaskColors()` runs on each full render. It takes the tasks with time in the last 7 days, oldest first (by the first time each was used). Each one keeps its own colour if it's free, otherwise it takes the next free colour in the palette.
- `taskColor(name)` uses that assignment, and falls back to the name colour for tasks outside the week.

**Decisions**
- Oldest tasks go first, so long-used tasks keep their colour and a newer task is the one that moves.
- Trade-off: CLAUDE.md says a name always has the same colour. Now a task can change colour when the set of tasks in the last 7 days changes (for example, "Cooking" goes back to its own colour once "Coding" drops out of the week). Within any one view the colours are still consistent.
- With more than 8 tasks in a week, sharing can't be avoided, and the extra tasks use their name colour.

## 2026-10-18: Month calendar in History

**Asked for:** a month calendar above the date picker in History. One square per day, shaded by hours tracked (4 shades). Previous/next month buttons. Clicking a day opens it. Screen-reader labels like "October 14: 2h 10m". Use the shared midnight-split helper.

**Changed**
- `index.html`: the calendar block with ‹ › buttons, the month title, weekday letters, the day grid and a small key.
- `app.js`:
  - `renderCalendar()` rebuilds the squares only when the month (or today) changes, so focus stays put. `updateCalendar()` sets each square's shade and label from `dayTotals()`, the same helper as everything else. It also runs every second with the clock, so today's square follows a running timer.
  - Shades: none, under 1h, 1–3h, 3–5h, 5h+ (`calendarLevel`).
  - Clicking a square calls `showHistoryDay`. Picking a day in the date picker or from the Week tab moves the calendar to that day's month.
  - Future days are disabled, and › turns off on the current month.
- `styles.css`: the grid and the shades, mixed from the accent colour so they follow every theme and accent. Today is underlined, and the day shown below has a ring.

**Decisions**
- Labels round to the nearest minute ("2h 10m", "under 1m" for a few seconds). The day shown below adds ", shown below" to its label. The month title is announced when it changes.
- Weeks start on Sunday.
- I added a small key ("none · under 1h · 1–3h · 3–5h · 5h+"), because the shades mean nothing without one. It's hidden from screen readers since each square's label already says the time.
- Contrast: my first shades left day numbers at 3.0:1 in Light + Green. Shades 1–3 are now light tints with normal text and shade 4 is the full accent with button text. A check of all 5 themes × 6 accents gives at least 5.0:1.

## 2026-10-18: Notes on entries

**Asked for:** an optional short note (up to 120 characters) on any entry. An "Add note" / "Edit note" button opens a small text box, Enter saves and Esc cancels. Show the note under the entry in Today and History, include it in the Excel export and the copied text, and keep it in backups. Old entries must keep working.

**Changed**
- Data: entries can have an optional `"note"`. Entries without one are left exactly as they were. When saved data or a backup is cleaned on load, a note is trimmed, cut to 120 characters, and dropped if it's blank or not text.
- `app.js`:
  - Each entry row has a note line: the note in italics plus "Add note"/"Edit note". Pressing it swaps in a text box with Save / Cancel buttons (phones have no Esc key) and the hint "Enter saves, Esc cancels".
  - Saving an empty box removes the note. Focus returns to the note button afterwards.
  - What's typed is kept in `noteEdit`, so a re-render (the timer starting, another tab saving) doesn't wipe the box or move the cursor.
  - Copy this day: a task's notes from that day go at the end of its line, oldest first, without repeats: `Coding: 4h 00m 00s — fixed login; wrote tests`. This works in YouTrack format too: `work 2026-10-16 4h Coding — fixed login; wrote tests`.
  - Excel: a new "Note" column (E).
  - Backups: notes are saved as part of each entry, and Restore keeps them.
  - Editing an entry (or Undo) keeps its note.
- `styles.css`: the note line, box and hint.

**Decisions**
- The copied text has one line per task (not per entry), so notes are joined onto the task's line.
- Restore still treats an entry as "already here" by task + start + end. A backup copy of an entry that's already here doesn't overwrite its note.

## 2026-10-18: Pop-out timer

**Asked for:** a "Pop out" button next to the timer that opens a small always-on-top window (Document Picture-in-Picture, Chrome and Edge) with the task name, the live time and a Stop button that really stops the timer. Hide it where unsupported. Closing the small window just closes it.

**Changed**
- `index.html`: a "Pop out" button next to the Timer heading, hidden until the browser says it supports this.
- `app.js`:
  - `popOut()` opens the window, links `styles.css` into it, and copies the current theme and accent. It builds the task name, clock and a Stop button that calls the page's own `stopTimer()`, so stopping there saves an entry exactly like the main Stop.
  - `updatePip()` runs with every clock update, so both clocks match.
  - When no timer is running, the window shows "Not tracking" and Stop is greyed out.
  - Closing the window (`pagehide`) only forgets it, and the timer isn't touched. Pressing Pop out while it's open focuses the existing window.
- `styles.css`: the small window's layout.

**Decisions**
- Opening the window needs a real click (a browser rule), so it can't reopen by itself after a reload.
- Checked in headless Chrome with a stand-in window (headless can't show the real one): it shows the task and live time, its Stop stops and saves the timer, and closing it leaves the timer alone. The real window needs a manual check in Chrome or Edge.

**Tests for all four** (headless Chrome, test data on a scratch copy): 29 checks passed. They covered:
- distinct week colours
- calendar shades matching `dayTotals`, labels, clicking a day, month arrows, future days
- note load/trim/cap, Enter/Esc/empty, typing surviving a re-render, notes in copy/YouTrack/Excel/backup, Edit keeping notes
- Pop out show/stop/close
- calendar contrast in every theme × accent

**Found, not changed:** at 320px wide, entry rows were already squeezed before today (task names wrap a letter or two per line). It's still that way; I'd suggest a fix separately.

## 2026-10-18: CLAUDE.md update, phone layout fixes, no Done button, mobile bug sweep

**Asked for:** update CLAUDE.md; fix the squeezed entry rows at phone width; remove Settings' Done button (the × does the job); check how the app runs on mobile and fix bugs found.

**Changed**
- **CLAUDE.md:** describes today's features:
  - the optional `note` in the data model
  - the Week chart and History calendar (and that they use the shared split helper)
  - notes in copy, Excel and backups
  - Pop out
  - the Settings window (× in a sticky header, Esc/outside click, folding sections, no Done)
  - the new task-colour rule
  - a phone layout rule (≤ 26rem, must work at 320px, hover effects only on devices with a mouse)
- **Entry rows on phones** (`styles.css`): at 320px the task name only had 26px, because the dot, duration, Edit and × columns took the rest. Up to 26rem (416px) wide, the duration now goes on its own line under the time range.
- **Task rows on phones** (found in the sweep, worse than the entry rows): a long name with a goal ("✓ 1h 30m 00s / 1h30m") squeezed the name to 10px, one letter per line. On phones the time/goal now sits under the name, with ▶/■ beside both lines.
- **Done button removed** from Settings (markup and handler). The × now gets focus when the window opens, instead of the Theme box: Chrome shows a select's focus ring even after a tap, which looked odd on phones.
- **Bug: stale note box.** Deleting an entry while its note box was open, then pressing Undo, brought the box back without focus. A note box whose entry is gone is now dropped.
- **"Edit note" link** was indented by the general link padding. Fixed.
- **Calendar shades** spaced a little further apart (18% / 31% / 43% accent tints): in the dark theme, "none" vs "under 1h" and "1–3h" vs "3–5h" were hard to tell apart. They still pass 4.5:1 in every theme × accent (lowest 4.73).

**How I checked mobile:** a script drove headless Chrome through its DevTools protocol with real phone emulation: 320, 375 and 414px wide, touch input, no hover, 2× pixel density. On every tab and window (Today, note editing, History calendar and lists, Share, Week chart with taps, Settings scrolled open, Add time, Edit) it checked for:
- the page scrolling sideways
- anything off screen
- squeezed text
- tap targets under 24px
- JS errors

It also tried these by touch:
- tap outside Settings to close it, and Esc
- tap Add note, type with the on-screen keyboard, tap Save
- delete with a note box open, then Undo
- open and close chart pop-ups

After the fixes, every check passes at all three widths with no JS errors, and the 29 feature checks from earlier still pass.

**Not changed (judgement calls):**
- The blank gaps under "Use YouTrack format" and in Add time are space kept for messages, so nothing jumps when one appears.
- The goal shows as "/ 1h30m" (YouTrack style), as CLAUDE.md describes.
- Add time focuses the task box when it opens, so phones show the keyboard straight away. That's what you'd type next anyway.

## 2026-10-18: Launcher theme and smooth motion

**Asked for:** a "Launcher" theme matching my portfolio site's game-launcher look:
- navy #10141f with panels #1a2030 / #232b40, the Sora font (Google Fonts, system fallback), 14px corners
- an orange→purple→blue gradient (#ff7a59, #c64bff, #3f6bff) on the title, the Start button, the active tab underline and the week bars
- a soft purple glow on the timer card while it runs
- in the theme list and the default for new visitors, with the accent swatches swapped for gradients (Sunset, Ocean, Lime, Ember)

Plus smooth motion in every theme: sliding tab underline, panels fading in, animated bars, totals counting up, entries sliding in and out, buttons pressing down, dialogs and the undo toast popping in. All under 0.5s, all off with prefers-reduced-motion, looks only.

**Changed**
- `styles.css`:
  - New `:root[data-theme="launcher"]` colours, plus Ocean / Lime / Ember overrides via `data-gradient`.
  - A new `--raised` colour (inputs, small buttons, inactive tabs). It equals the page background in every other theme, so they look the same as before.
  - Launcher extras: Sora, 14px corners, gradient title / Start / tab underline / By day bars, and the glow (`.timer-card.is-running`). In Windows high-contrast mode the title falls back to normal text, since that mode removes backgrounds.
  - A Motion section with the animations. One `prefers-reduced-motion` rule turns every animation and transition off.
- `index.html`:
  - The head script picks Launcher for new visitors, applies the saved gradient, and adds the Sora `<link>` only when Launcher is the theme.
  - Launcher is first in the theme list, and there's a new "Accent gradient" group of 4 swatches.
  - Added the tab underline element and a `timer-card` class.
- `app.js`:
  - `timeTracker.gradient` setting. While Launcher is on, Settings shows the gradients instead of the accent colours.
  - `defaultTheme()`: Launcher if there are no saved times, otherwise Auto. The first choice is saved straight away, so it can't flip later.
  - `loadLauncherFont()`, also used for the pop-out window, which now copies the gradient too.
  - `placeTabIndicator()`.
  - `showTotal()` counts the 3 headline totals up in 0.4s and always ends on the exact `formatSeconds` value. Small live-timer steps, the first fill and a hidden page set it directly.
  - Entries new since the last render of the same day get `is-entering`.
  - Delete plays a 0.22s slide-out (`animateOut`), then deletes as before.
  - The timer card gets `is-running`.
- `README.md` privacy section, and CLAUDE.md (stack note, settings keys, Style section): updated for the font request, the theme list and the motion rules.

**Decisions**
- **Privacy:** Sora comes from Google Fonts, so the browser contacts Google. Your times are never sent, but "nothing is ever sent anywhere" was no longer true, so the README and CLAUDE.md now say so. The font is only requested while Launcher is the theme. With any other theme, the page loads nothing from other sites (checked).
- **"New visitors"** means no saved times. People who already use the app and never picked a theme stay on Auto instead of suddenly changing.
- **Gradients:** Sunset uses your exact colours. Ocean (#5eead4 → #38bdf8 → #818cf8), Lime (#d9f99d → #84cc16 → #22c55e) and Ember (#fde047 → #fb923c → #f87171) are light enough for dark button text. Each also has a solid accent for links, outlines and the calendar. Lime's first accent (#a3e635) left calendar numbers at 4.46:1, so it's #93d22c (5.03:1).
- **The glow** uses the gradient's middle colour: purple for Sunset as asked, and teal-blue, green or orange for the others.
- **Contrast** (checked for all 4 gradients):
  - text 11.9:1, muted 6.25:1
  - button text on the Start gradient where the word sits at least 4.74:1 (Sunset)
  - task colours 5.97:1, calendar at least 5.03:1
  - The gradient title is large text and meets 3:1 (Sunset's blue end is 4.14:1), not the 7:1 house rule. That's noted in CLAUDE.md as an exception.
- **The tab underline** shows in every theme, in the accent colour (the gradient in Launcher).
- **Only looks:** the slide-out delays the actual delete by 0.22s (Undo appears right after). With reduced motion it's instant. Totals always end on the real number.

**Tests:** a script drove headless Chrome through its DevTools protocol; all checks passed. It covered:
- the new-visitor default, and existing users keeping Auto
- the font request only in Launcher, and no other-site requests otherwise
- all 4 gradients applying and being saved
- contrast for all 4 gradients
- the underline sliding and landing under the tab, the panel fade, the total counting up and landing exactly
- entry slide-in, slide-out then delete, Undo, toast and dialog pop-in, button press rule, glow on and off
- longest animation 0.4s
- reduced motion: CSS motion off, totals and delete instant
- no JS errors

The mobile sweep (320/375/414px, touch) in Launcher and the 29 feature checks from before also pass.

## 2026-10-18: Pixel, the companion robot

**Asked for:** a small robot named Pixel in the corner of the timer card, HTML/CSS only, with three moods:
- asleep with a floating "z" when no timer runs
- bobbing and typing while a timer runs
- hopping happily for a few seconds when I meet a daily goal

Clicking him shows a random line in a speech bubble. Plus a "Show Pixel" switch in Settings. He must not cover any buttons on a phone, and his animations stop with prefers-reduced-motion. (I said I might paste my portfolio's Pixel CSS; I haven't yet, so this is Claude's own drawing in the same style.)

**Changed**
- `index.html`: the status line and Pixel now share a row at the bottom of the timer card (`timer-footer`). Pixel is a button made of spans (antenna, screen head with eyes and mouth, body, arms, a tiny keyboard, a "z"), with the speech bubble next to him. There's a "Show Pixel" switch (a checkbox with `role="switch"`) at the end of Settings → Look.
- `styles.css`, new Pixel section:
  - The drawing, and the three moods via `data-mood`: asleep (eyes shut, "z" drifting up), working (bob plus alternating typing arms, keyboard shown), happy (^ ^ eyes, smile, arms up, 6 hops ≈ 3s).
  - The speech bubble.
  - The switch styling.
  - In Launcher his eyes and antenna use the gradient colour.
  - In Windows high-contrast mode he keeps his own colours, since that mode strips backgrounds and would leave him half invisible.
- `app.js`:
  - `timeTracker.pixel` setting (on by default).
  - `updatePixel()` runs with each clock update and only touches the page when his mood changes. His label says the mood ("Pixel, working. Press for a message.").
  - `applyGoals` now notices a goal that has just become met and calls `pixelCelebrate()`. Goals already met when the page opens don't count, and neither does a rename.
  - `pixelSay()` picks a random line (not the same one twice in a row) that fits the moment:
    - running: "Still on Coding? Nice.", time so far, time left to the goal
    - asleep: "Today so far: …", a few sleepy lines
    - happy: "Goal met! Nice work."
  - The line shows for 4 seconds in a `role="status"` bubble, so screen readers read it.
- CLAUDE.md: the new setting key, Pixel as feature 7, and his long loops as the exception to the half-second motion rule.

**Decisions**
- **Placement:** Pixel is in the normal page flow, not floating, so he can't sit on a button at any size. The "Still working?" banner appears below his row.
- **The bubble** first sat above him, over the clock digits. It's now to his left, in his own row, and taps pass through it.
- **Loops:** his loops repeat for as long as the mood lasts, so they're longer than the 0.5s UI motion. Moving content that keeps going needs a way to hide it: that's the Show Pixel switch, and reduced motion stops them. With reduced motion the "z" still shows, standing still.
- The outline when hovering over him only shows on devices with a mouse, so a tap on a phone doesn't leave it stuck.

**Tests** (headless Chrome via its DevTools protocol, phone emulation at 320/375/414px with touch, plus desktop): 49 checks passed on two runs, with no JS errors. They covered:
- each mood and its animation, labels, and that tapping shows a line that disappears by itself
- Pixel and the bubble covering no button, input or select, with the bubble open and with the "Still working?" banner, plus no sideways scrolling
- the hop when a goal is met and the return to working after ~3s, asleep after Stop, and no hop for goals already met at load
- the switch being on by default, hiding him, saving, and staying off after reload
- reduced motion stopping every Pixel animation

I also looked at him in all 6 themes.

## 2026-10-18: Weekly Banner

**Asked for:** a "Weekly Banner" in the Week tab with four slides to step through: total time this week (and the change from last week), top task, longest single session, busiest day. Use the shared midnight-split helper so the numbers match the Week tab. Arrow keys move between slides.

**Changed**
- `index.html`: the banner sits under the Week total. It has four slides in a track, ‹ › buttons, four dot buttons, and a hidden live line for screen readers. It's marked up as a carousel: the region and each slide say "carousel" / "slide" and "2 of 4: Top task".
- `styles.css`: a card with a stripe along the top (the accent, or the gradient in Launcher). The slides move with a 0.35s slide, which reduced motion turns off. The dots are 32px tap targets.
- `app.js`:
  - `updateBanner()` runs with the Week numbers, so it stays live while a timer runs. Everything comes from `weekData()` / `dayTotals()` / `secondsOnDay()`:
    - **Total:** the same number as the Week total, plus "▲ 2h 30m 00s more than the 7 days before" (or less, the same, or "Nothing tracked the 7 days before"). The 7 days before come from `previousSevenDays()`.
    - **Top task:** the first By task row, with its share of the week.
    - **Longest single session:** the entry (or the running timer) with the most time inside the 7 days. An entry that started before the window only counts its part inside it.
    - **Busiest day:** matches By day (the most recent day if two tie).
  - `showSlide()` moves the track, marks the other slides `aria-hidden`, sets `aria-current` on the dot, and announces the slide.
  - Arrow Left/Right wrap around; Home/End go to the first/last. They work while focus is anywhere in the banner.

**Decisions**
- **"This week"** is the Week tab's Last 7 days, and "last week" is the 7 days before that, so slide 1 always equals the Week total.
- **No auto-advance:** slides only move when you ask.
- **Screen readers:** the slide text updates every second while a timer runs, so it isn't a live region (that would announce every tick). A separate hidden line announces a slide only when you change it.
- **Hidden when empty:** like the chart, the banner is hidden when nothing was tracked in the last 7 days.
- **Bug found and fixed while testing:** with only a just-started timer this week, the longest session is 0 seconds for the first half-second. The banner code then crashed, which stopped Start from finishing its screen update. It now shows "0h 00m 00s · Nothing yet." This case is part of the banner test now.

## 2026-10-18: Plan my day

**Asked for:** a "Plan my day" option in Today to set a planned amount for any task for today only (separate from daily goals, which repeat). Today's rows show the plan as a dashed outline behind the real bar, with "on track", "40m to go" or "25m over". Gaming-style tasks may go over, with over-plan time in red. Plans are saved per date in their own localStorage key and included in backups.

**Changed**
- `index.html`: a "Plan my day" button at the top of Today, and a "Plan my day" window: the same × header as Settings, a hint explaining plan vs goal, today's plans with Remove, Task + hours/minutes, "Add to today's plan".
- `styles.css`:
  - The bar row (`bar-line`: bar plus status text).
  - On rows with a plan: a taller bar, a dashed outline for the plan, the fill in front, and a red part for time over the plan.
  - Status colours: "on track" in the accent, "over" in red, "to go" muted.
- `app.js`:
  - `timeTracker.plans` = `{ "2026-10-18": { "Coding": 120 } }`, cleaned on load (real dates, non-blank names, 1 minute to 24 hours; corrupt data means no plans).
  - `todayRowOrder` adds planned tasks that have no time yet after today's tasks, as normal rows with ▶.
  - `applyPlans()` runs after the bars are filled in. Rows with a plan show progress against it:
    - the scale is the larger of plan and actual
    - "on track" within a minute of the plan
    - "1h 15m to go" (rounded up)
    - "15m over" (rounded down), in red
  - Backups now include `plans`. Restore adds plans only for a date + task with no plan here (never overwrites), counts them in the message ("Restored 0 entries and 2 plans"), and Undo removes them. Old backups without plans still work.
  - Renaming or merging a task moves its plans (a day that already plans the new name keeps that plan), and Undo puts them back.
  - Another tab changing the plans updates this one.
  - The Settings "click outside to close" code is now a shared helper (`closeOnBackdrop`) that the plan window uses too.

**Decisions**
- **Planned rows switch bar meaning:** a planned row's bar shows progress against the plan instead of its share of today. The dashed outline only makes sense on the same scale as the time, and the status text says what the bar means. Rows without a plan are unchanged.
- **Only Today rows:** History rows and the Week tab don't show plans.
- **"On track"** means within a minute of the plan. Under it shows time to go; past it shows time over.
- **Red for every task:** over-plan time is red for all tasks, and going over is never blocked.
- **Focus after delete:** the button is styled like the header buttons, not a `secondary-button`, so focus after deleting an entry still returns to "+ Add time".

**Tests** (headless Chrome via its DevTools protocol): 51 banner and plan checks passed on two runs, with no JS errors. They covered:
- every banner number against the Week tab, including an entry crossing into the window
- arrows, wrap, Home/End, dots, announcements, live updates, the slide animation, reduced motion, hidden when empty, the first-timer case
- plan refusals, the list, to go / over (red) / on track, a planned row with no time yet, rows without plans unchanged, per-date storage separate from goals, no plans in History, another date's plan not showing
- focus after delete, backup includes plans, restore adds/doesn't overwrite/skips bad dates/Undo, old backups, rename + Undo, corrupt storage
- red, outline and "on track" contrast in all 6 themes
- no layout problems at 320px and 375px (Today, the plan window, each banner slide)

The Pixel checks (49), the Launcher and motion checks (28), the mobile sweep and the 29 feature checks also pass.

## 2026-10-18: Wider layout and today's ring chart

**Asked for:** the app felt too linear. Expand it on wider screens and add a circle chart of today's tasks. Claude made a canvas of options (three layouts, four chart styles), and I picked **layout A (two columns)** with **chart 1 (share of today, total in the middle)**. Asked before building: keep the real task rows next to the chart (not a separate legend), and no extra "Today's plan" card.

**Changed**
- `index.html`: the timer card is wrapped in `layout-side` and the tabs and panels in `layout-main`, inside a `layout` grid. In Today, a `today-overview` row holds the ring chart (`<figure>` with an SVG whose `<title>` is its text version, and the total in the middle) and the existing empty message and task rows.
- `styles.css`:
  - **From 60rem (960px):** `main` widens from 32rem to 75rem. A two-column grid puts the timer column (20–25rem) on the left and the tabs on the right. When the window is at least 44rem tall, the timer column is sticky, so it stays in view while the right column scrolls. Entries become a grid of 17rem+ cards using the phone row layout, since a card is phone-narrow.
  - **The ring:** 200px (160px on phones), with a hairline gap between segments, and segments animate (0.35s, off with reduced motion). The rows sit beside it when there's room for both (22rem of rows), otherwise below it.
  - The wide-screen block sits after the entry styles so its card rules win.
- `app.js`: `updateTodayChart(totals)` runs with each clock update, using the same `dayTotals()` totals as the rows, in the same order (most time first) and colours. It updates the existing segments in place, so they grow smoothly (only re-ordering when the order changes). It keeps the centre total and the screen-reader text current, and hides the ring when nothing has been tracked today.
- CLAUDE.md: the wide layout and the ring.

**Decisions**
- **Ring placement:** the task rows stay as the ring's legend: their colour stripes match the segments, and they keep ▶/■, goal ticks and plan bars. The ring goes above the rows in narrower two-column widths (960–~1150px) and on phones, rather than squeezing the rows.
- **Phones keep the single column**, with a smaller ring above the rows.
- **Thinner ring:** the first version's centre total ("5h 30m 00s") touched the inside of the 160px phone ring in Sora. The ring is now slightly thinner (stroke 20) and the text slightly smaller. The test checks the text fits the hole at every width.
- **History and Week** just get the wider column for now; nothing else changed there.

**Tests** (headless Chrome via its DevTools protocol): the new layout test passed all 90 checks at 1280, 1000, 960, 959, 768, 375 and 320px in Launcher and Light, with no JS errors. It covered:
- two columns from 960px, one column below
- the ring beside or above the rows
- entries as cards
- the timer staying in view after scrolling 700px
- ring segments matching the rows (count, order, colours), filling exactly one circle, each starting where the last ends
- the centre total equal to today's total, the text version, live growth while a timer runs
- the ring hidden with nothing tracked, then appearing on the first timer
- reduced motion
- no layout problems on any tab at any width
- the centre text fitting the hole

All earlier suites still pass: phone sweep, Pixel 49, banner/plans 51, Launcher/motion 28, features 29.

## 2026-10-18: History and Week use the wide layout; clearer task colours

**Asked for:** the two follow-ups from the wide layout. History and Week should use the extra width too, and the blue and sky-blue task colours that looked alike in the ring should be fixed.

**Changed**
- `index.html`: in History, the calendar and date picker (`history-pick`) and the day's total and rows (`history-day`) are wrapped in a `side-by-side` row. In Week, the banner and the chart share one `side-by-side` row, and By day and By task share another.
- `styles.css`:
  - `.side-by-side` is a wrapping flex row where each part wants about 20rem. Parts sit next to each other when there's room (the wide right column) and stack otherwise (phones, and two-column widths under about 1150px).
  - The 8th task colour (`--task-7`) was a sky blue that looked like the blue (`--task-0`) in every theme:
    - dark themes (Dark, Midnight, Auto-dark, Launcher): slate #cbd5e1
    - light themes: stone #57534e
    - High contrast: #404040
- CLAUDE.md: the side-by-side sections.

**Decisions**
- **No breakpoints:** the side-by-side rule is based on available room, not the screen width, so it adapts to the column it's in.
- **Neutral 8th colour:** a neutral was the only choice unlike all seven hues already used. Checked: every pair of task colours is clearly different (colour distance ΔE ≥ 22 in every theme), and all still have at least 3:1 contrast against the surface.

**Tests:** the layout test (95 checks, new: side by side at 1280px, stacked at 375px, task colour distances and contrast in all 6 themes) and all earlier suites pass, with no JS errors.

## 2026-10-18: Settings revamp and a Tasks tab

**Asked for:** daily goals and rename/merge shouldn't be hidden in Settings; Share and Backup should be in Settings instead of History.

**Changed**
- `index.html`:
  - A fourth tab, **Tasks** (Today | History | Week | Tasks), with Daily goals and Rename or merge side by side (stacked on phones). It's the same forms with the same ids, moved out of Settings.
  - **Settings sections:** Look → Reminder → Keyboard shortcuts → **Share** → **Backup** → **Help** (Help is added in the tour entry below).
  - Share has its own "Day to copy" date picker.
  - Backup's Undo now sits next to its message.
- `app.js`:
  - `shareDay()` = the Share date picker, which starts as the History day each time Settings opens.
  - Opening Tasks fills the goal list and the rename options (keeping the selected task).
  - Shortcut **4** opens Tasks.
  - Restore no longer uses the Undo popup: an open window makes everything behind it unclickable, so the popup would be out of reach. Its Undo is a button inside Settings, cleared by the next restore.
  - Another tab changing goals refreshes the goal list.
- `styles.css`: the select and label styles also apply in the Tasks tab. Removed the unused History share/backup rules.
- CLAUDE.md updated.

**Decisions**
- **A Tasks tab** keeps goals and renaming one click away, without crowding Today.
- **The copy day picker** starts on the History day, so "pick a day in History, then copy it" still works as before.

## 2026-10-18: Pixel's personality (from the portfolio)

**Asked for:** Pixel should behave like the portfolio's Pixel: toss him around, click him, watch him get angry. Show the rage meter only once he's annoyed.

**Changed** (`index.html`, `styles.css`, `app.js`; ported from the portfolio's `main.js` and `styles.css`)
- **The drawing:** the portfolio's SVG, with happy, mad, dizzy, asleep and normal faces, one shown at a time via `data-mood`. Resting moods are still asleep (no timer) and working (bobbing, now with a typing keyboard).
- **Poking:**
  - When he's calm: chat lines that fit the moment (task, time so far, goal left).
  - When he's asleep: a poke wakes him ("Huh? I'm up!") and doesn't count against you.
- **Temper (0–100):** pokes +7, throws +14, hard landings +10; it drains 3 every half second after 3 quiet seconds.
  - Five stages: calm, annoyed, grumpy, angry, furious. Each has its own lines and face.
  - His shell warms to red (`data-anger`), and he puffs steam when furious.
  - A **rage meter** above his head shows from "annoyed". His label says the stage ("Pixel, working, annoyed").
- **Tossing:** drag him (the drag starts after 8px, so a click is still a poke).
  - Let go and he flies with gravity, bounces off the window edges, says "Ow!" and goes dizzy after a hard landing, then walks home.
  - While he's away he's above everything.
  - Letting go over a button doesn't press it.
  - With reduced motion he can't be tossed.
- **His eyes follow the mouse** (mouse and trackpad only).
- **Lines are typed out** letter by letter. Screen readers get the whole line at once from a hidden status.
- **Hiding him** from Settings mid-toss puts him straight back.

**Decisions**
- **No idle naps:** the portfolio's Pixel naps when you're idle, but here "asleep" already means "no timer running", so I didn't add a second sleep.
- **A real timing bug**, found by the test and fixed: after waking him, a timer meant for the excuse line raced his dizzy face (both 1.1s), so he fell straight back asleep. Each wake-up now has its own id.

## 2026-10-18: Pixel's game, Stop the Clock

**Asked for:** when Pixel's rage meter is full he forces you to play a game, a different one from the portfolio's bug squash.

**Changed**
- A `#clock-game` window: stop a stopwatch on exactly **5.00** seconds.
  - Within **0.10** on 2 of 3 tries wins; try 3 goes **dark** (the numbers vanish after 2 seconds). It ends early once 2 hits or 2 misses are in.
  - The time is taken from the button press itself (`event.timeStamp`) and judged to the hundredth shown, so 5.10 counts and 5.11 doesn't.
  - The ring fills toward 5 seconds (not with reduced motion), and the tries show "✓ 0.04 off" / "✗ 0.32 off".
  - An angry Pixel in the window gloats ("Ha! Missed by 3.99.") and smiles when you win.
- **Winning:** "Done" closes it, and his temper goes back to 0 ("Good game. We're cool.").
- **Losing:** "Try again".
- **Giving up:** "Give up" or Esc always closes it. He's left grumpy ("Fine. Be that way.") but the game is over.

**Decisions**
- **One big button** (Start / Stop, Space works), so it's fair on keyboard, mouse and touch, and still works with reduced motion.
- **Never trapping:** forcing you to play never means you can't get out.

## 2026-10-18: Pixel's tour

**Asked for:** a quick tutorial of what to do, presented by Pixel.

**Changed**
- A `#tour` window covering the screen. A spotlight (a huge shadow) dims everything except the part being explained, and Pixel's card (with his jetpack) sits beside it, below it or above it, whichever fits, always on screen.
- **Six steps:**
  1. start a timer
  2. Today (ring and rows)
  3. Plan my day
  4. entries / Add time
  5. History, Week and Tasks
  6. Settings, plus "poke me… just not too much"
- **Controls:** Back, Next (Done on the last step), Skip tour, and Esc. Focus starts on Next.
- **Shown once** to everyone (`timeTracker.tour` = "done" afterwards). Settings → **Help → Show the tour again** replays it.
- When it ends, Pixel says "Have fun! I'll be right here." and focus goes to the task box.

**Decisions**
- **It's a modal window**, so the page behind can't be used by accident while it's open.
- **Short phone screens:** when the card can't fit without covering the part being explained, the page scrolls that part near the top and the card goes underneath. The test found this at 320px on step 5.

## 2026-10-18: Glass look (Launcher) and the portfolio's gradients

**Asked for:** the portfolio's glassy look in Time Tracker (Launcher only), and the gradients matched to the portfolio exactly.

**Changed** (`styles.css`, plus a few lines in `app.js` for the mouse light)
- **Gradients:** Ocean, Lime and Ember now use the portfolio's exact stops (in the swatches too).
- **Glass, Launcher only:**
  - Panels and windows are see-through (62%) and frosted (blur 16px).
  - A soft glow sits behind the page, in the gradient's colours.
  - Panels have hairline light edges.
  - The selected tab matches its panel's glass.
  - On wide screens the header is frosted and stays at the top, with its tint running to the window's edges, and the timer column sits under it.
  - A soft light follows the mouse over task rows and entry cards.
- With `prefers-reduced-transparency` it's all solid again. Other themes never get glass.

**Decisions**
- **Lime's accent:** the portfolio's solid colour (#9be36a) left calendar numbers at 4.51:1, right at the limit. It's now #94d862 (4.81:1), almost the same green. The gradient itself is unchanged.
- **Contrast on glass:** checked for the worst case, a see-through panel over the brightest part of the glow. Text is at least 11.1:1, muted text 5.8:1 and links 5.9:1, in all four gradients.
- **Phones:** the header isn't sticky there, because it wraps to two rows.

**Tests for this batch** (headless Chrome via its DevTools protocol, all passing, no JS errors):
- settings and Tasks: 20 checks
- Pixel and the game: 30 checks, with real mouse drags and timing
- the tour: 31 checks at 1280/375/320px
- glass: 13 checks

The earlier suites still pass after updating them for the moved features: Pixel 49, banner/plans 51, Launcher 28, layout 95, phone sweep, features 29.

## 2026-10-18: Pixel moves to the corner; smoother grabbing

**Asked for:** grabbing Pixel felt janky and shifted the timer; put him in the corner like on the portfolio.

**What was wrong**
- **The timer moving:** while he was being dragged, a "put Pixel on top" rule switched the timer column from sticky to `position: relative`. When the page was scrolled, the timer column jumped.
- **The jank:** his position was measured from that column, so he jumped with it, and every pointer move re-measured it (a feedback loop).
- **The squish:** the general "buttons press down" effect also squished him while held.
- **The twitch:** his tilt jumped with every pointer event.

**Changed**
- `index.html`: Pixel's markup moved out of the timer card to just after `<main>`. The timer card's status line is back to a plain line.
- `styles.css`:
  - `.pixel-wrap` is `position: fixed` in the window's **bottom-left corner, 20px in**: the portfolio's spot (its `.guide` is `left: 20px; bottom: 20px`).
  - His bubble now opens to his right, and to his left when he's tossed near the right edge (`say-left`).
  - The `pixel-away` rules are removed, and so is the press effect on him.
  - `will-change: transform` while he moves.
  - The undo popup is above him (`z-index: 50` vs his 40).
- `app.js`:
  - His corner is measured once (and again after a resize) instead of on every move.
  - The drag tilt is eased (75/25), so he sways instead of twitching.
  - An `is-moving` class replaces the body class.
- CLAUDE.md: Pixel's placement.

**Decisions**
- **Bottom-left, not bottom-right:** I first tried bottom-right. On phones he then sat on the rows' ▶/■ buttons, which are on the right. The portfolio uses bottom-left anyway, and the left edge is mostly task names.
- **Trade-off:** a corner robot can be over content while you scroll (as on the portfolio). The page's existing bottom padding lets anything at the end of each tab scroll clear of him (checked on every tab at 1280/375/320).
- **320×640 phones:** on a phone that small, his corner overlaps part of the "Today" tab when the page first opens. A small scroll clears it. At 375px and on desktop nothing is under him at load.

**Tests:** a new corner test passed all 20 checks, with no JS errors. It covered:
- he's fixed 20px from the left and bottom and stays there while scrolling
- nothing is under him at the end of any tab
- the undo popup and windows go over him
- grabbing while scrolled moves nothing else on the page
- he stays exactly under the pointer (0px off)
- tilt changes are at most 4.7° per move
- no squish
- he walks back to his corner after a toss

Earlier tests updated for the corner (drag direction, eye-follow target, placement) and all pass: Pixel 49, Pixel/game 30, tour 31, glass 13, settings 20, layout 95, sweep, banner/plans 51, Launcher 28.
