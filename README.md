# Time Tracker

A simple web app for recording how long I spend on things each day: studying, coding,
gaming, anything. Built for TCSS 490, Artifact 2 ("something you will use").

**Use it:** https://danny-defeato.github.io/time-tracker/

## What it does

- **Timer:** type what you're working on and press Start. The time keeps counting through
  reloads and a sleeping laptop, and shows in the browser tab's title.
- **Today:** time per task, a bar for each task's share of the day, and a list of entries
  you can edit or delete (with Undo).
- **History and Week:** any past day, plus the last 7 days by day and by task.
- **Add time you forgot to track:** just what, when you started, and how long.
- **Share:** copy a day as text (with an optional YouTrack format) or download everything
  as an Excel file.
- **Backup:** download a backup file and restore it on another device.
- **Settings:** themes (including Warm paper, Midnight and High contrast), an accent
  colour, daily goals, renaming or merging tasks, a "Still working?" reminder and keyboard
  shortcuts.

## Privacy

Everything is saved in your own browser (`localStorage`). Your times are never sent anywhere.
That also means each browser keeps its own data: use **History → Backup** to move it.

The one outside request: the **Launcher** theme (the default for new visitors) loads its
font, Sora, from Google Fonts, so Google sees that font request. Pick any other theme in
Settings and nothing is loaded from other sites.

## How it's built

Plain HTML, CSS and JavaScript, with no frameworks, libraries or build step: `index.html`,
`styles.css` and `app.js`. Even the Excel file is put together in `app.js`.

It was built with Claude Code, one feature at a time. [`LOG.md`](LOG.md) records what I
asked for, what changed, the decisions I made and what I dropped. [`BUILD-PLAN.md`](BUILD-PLAN.md)
is the original plan, and [`CLAUDE.md`](CLAUDE.md) holds the instructions the agent followed.
