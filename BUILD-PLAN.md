# Build plan

Each phase: paste the prompt into Claude Code, read what it changed, run the
checklist yourself in the browser, then commit. If a phase breaks something
that worked, `git restore <file>` (or `git checkout .`) takes you back to the
last commit.

Rough timing for tonight: setup 20 min, each phase 45-60 min, deploy and
portfolio card 30 min.

---

## Phase 0: Set up the repository

1. On GitHub, create a new **public** repository named `time-tracker`
   (public so GitHub Pages can host it). Add a README when it asks.
2. Clone it and go into it:
   `git clone https://github.com/YOUR-USERNAME/time-tracker.git` then `cd time-tracker`
3. Copy `CLAUDE.md`, `LOG.md` and this `BUILD-PLAN.md` into the folder.
4. Commit: `git add .` then `git commit -m "Add project plan, CLAUDE.md and log"` then `git push`
5. Check `git status` says "nothing to commit, working tree clean".
6. Start Claude Code **inside the folder**: `claude`
7. Stay in Manual permission mode for this first session (Shift+Tab cycles modes)
   and read each command before you approve it.
8. Run `/init`. Since CLAUDE.md already exists, it will suggest improvements.
   Accept the ones you agree with, then commit:
   `git commit -am "Update CLAUDE.md from /init"`

---

## Phase 1: The timer

Use plan mode first (Shift+Tab until it says plan, or start the prompt with `/plan`),
read the plan, then let it build.

**Prompt:**
> Read CLAUDE.md. Build feature 1, the start/stop timer: a text box for the task
> name (with suggestions from tasks I've used before), a Start button, a live
> timer showing mm:ss (and hours once past 60 minutes), and a Stop button that
> saves the entry. Only one timer at a time. A running timer must survive a page
> reload. Create index.html, styles.css and app.js. Then tell me how to test it
> and add an entry to LOG.md.

**Check it yourself** (open `index.html` in your browser):
- [ ] Start with an empty task name: it should refuse or ask for a name.
- [ ] Start "Studying", wait 10 seconds, Stop: an entry is saved.
- [ ] Start a timer, reload the page: still running, and the time didn't reset.
- [ ] Start a timer, close the tab for a minute, reopen: the minute counted.
- [ ] Try to start a second timer: you can't (or it stops the first one, your choice).
- [ ] The task box suggests "Studying" next time.
- [ ] Works on your phone's screen width (browser dev tools, phone view).

**Commit:** `git add .` then `git commit -m "Add start/stop timer"`

---

## Phase 2: Today's totals

**Prompt:**
> Read CLAUDE.md. Build feature 2: a "Today" section that shows total time per
> task for today (largest first) and a grand total, plus a list of today's
> entries with start time, end time, duration and a delete button (ask before
> deleting). It should update right away when I stop a timer. Tell me how to
> test it and add an entry to LOG.md.

**Check it yourself:**
- [ ] Record two short "Studying" entries and one "Coding": Studying shows the sum of both.
- [ ] The grand total equals the sum of the tasks.
- [ ] While a timer runs, decide: does today's total include it live? (Either is fine, but know which.)
- [ ] Delete an entry: it asks first, then the totals go down.
- [ ] Reload: everything is still there.

**Commit:** `git commit -am "Add today's totals and entry list"`

---

## Phase 3: History and the week

**Prompt:**
> Read CLAUDE.md. Build feature 3: a History section where I pick a past date
> and see that day's totals and entries (same layout as Today), plus a "Last
> 7 days" summary showing the total for each day and for each task across the
> week. Entries that cross midnight count toward each day for their part.
> Tell me how to test it and add an entry to LOG.md.

**Check it yourself:**
- [ ] Today's numbers match between the Today section and the 7-day summary.
- [ ] Picking a day with nothing shows a friendly "nothing tracked" message, not an error.
- [ ] (After phase 4) Add a manual entry from 11:30 PM to 12:30 AM: 30 minutes on each day.
- [ ] The 7-day summary's days add up to the week total.

**Commit:** `git commit -am "Add history and 7-day summary"`

---

## Phase 4: Manual entries and CSV export

**Prompt:**
> Read CLAUDE.md. Build feature 4: an "Add time" form (task, date, start time,
> end time) for time I forgot to track, which rejects an end time before the
> start, and an "Export CSV" button that downloads all entries with columns
> task, date, start, end, minutes. Tell me how to test it and add an entry to LOG.md.

**Check it yourself:**
- [ ] Add 9:00-10:30 for "Reading" yesterday: it appears in History for yesterday as 1h 30m.
- [ ] End before start: it's rejected with a clear message.
- [ ] Export CSV and open it in Excel or Google Sheets: columns and minutes look right.
- [ ] A task name with a comma (like "Reading, chapter 3") doesn't break the CSV.
- [ ] Go back and run the midnight test from phase 3.

**Commit:** `git commit -am "Add manual entries and CSV export"`

---

## Phase 5: Deploy and fill in the portfolio card

1. Push: `git push`
2. On GitHub: Settings → Pages → Deploy from branch → `main`, folder `/ (root)` → Save.
   After a minute it's live at `https://YOUR-USERNAME.github.io/time-tracker/`.
3. Open that link on your phone and laptop and do a quick start/stop test on each.
4. Ask Claude Code to bring `LOG.md` up to date, read it over, and commit.
5. Portfolio card for Artifact 2 (in your portfolio's `content.js`):
   - `title`: your app's name
   - `status`: `"done"`
   - `link`: the GitHub Pages link (or the repository link)
   - `reflection`: a few sentences **in your own words** on how it went and what you learned
     (for example: what the agent got wrong and how you caught it, what you'd change).
6. Push the portfolio and submit your portfolio link on Canvas (same link as Artifact 1).

**Out of time?** The artifact is complete if it runs, the repository has a log, and the
card is on your portfolio. Phases 3 and 4 can be cut; write in LOG.md that you dropped them
and why. That counts as a decision.
