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
