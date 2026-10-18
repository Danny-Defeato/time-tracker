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
