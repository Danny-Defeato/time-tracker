// Time Tracker: all data lives in localStorage under one key (see CLAUDE.md).

const STORAGE_KEY = "timeTracker.v1";
const THEME_KEY = "timeTracker.theme";

let state = loadState();

const form = document.getElementById("timer-form");
const taskInput = document.getElementById("task-input");
const suggestionList = document.getElementById("task-suggestions");
const stopButton = document.getElementById("stop-button");
const runningTaskText = document.getElementById("running-task");
const clock = document.getElementById("clock");
const statusText = document.getElementById("status");
const todayTotalText = document.getElementById("today-total");
const themeButton = document.getElementById("theme-button");
const todayEmpty = document.getElementById("today-empty");
const taskRows = document.getElementById("task-rows");
const entriesEmpty = document.getElementById("entries-empty");
const entryList = document.getElementById("entry-list");
const undoToast = document.getElementById("undo-toast");
const undoText = document.getElementById("undo-text");
const undoButton = document.getElementById("undo-button");
const historyDateInput = document.getElementById("history-date");
const historyTotalText = document.getElementById("history-total");
const historyEmpty = document.getElementById("history-empty");
const historyRows = document.getElementById("history-rows");
const historyEntriesBlock = document.getElementById("history-entries-block");
const historyEntries = document.getElementById("history-entries");
const weekTotalText = document.getElementById("week-total");
const weekDays = document.getElementById("week-days");
const weekEmpty = document.getElementById("week-empty");
const weekTasks = document.getElementById("week-tasks");

// ---------- Storage ----------

function emptyState() {
  return { entries: [], running: null };
}

function isValidTime(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    showStorageWarning();
    return emptyState();
  }
  if (!raw) return emptyState();

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return emptyState();
  }
  return cleanState(data);
}

// Turns parsed data (from storage or a backup file) into a safe state.
function cleanState(data) {
  if (!data || typeof data !== "object") return emptyState();

  // Keep only entries that make sense (data may have been edited by hand): a non-blank
  // name, real times, and an end after the start. Every entry needs its own id, or
  // deleting one could remove another.
  const seenIds = new Set();
  const entries = [];
  for (const e of Array.isArray(data.entries) ? data.entries : []) {
    if (!e || typeof e.task !== "string" || !e.task.trim()) continue;
    if (!isValidTime(e.start) || !isValidTime(e.end) || Date.parse(e.end) <= Date.parse(e.start)) continue;
    let id = typeof e.id === "string" && e.id ? e.id : newId();
    while (seenIds.has(id)) id = newId();
    seenIds.add(id);
    entries.push({ id, task: e.task.trim(), start: e.start, end: e.end });
  }

  const r = data.running;
  const running = r && typeof r.task === "string" && r.task.trim() && isValidTime(r.start)
    ? { task: r.task.trim(), start: r.start }
    : null;

  return { entries, running };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    showStorageWarning();
  }
}

function showStorageWarning() {
  // Can run before the page elements are looked up (from the first loadState call).
  const el = document.getElementById("storage-warning");
  if (el) el.hidden = false;
}

// ---------- Timer ----------

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function startTimer(taskText) {
  const task = taskText.trim();
  if (!task) {
    setStatus("Type a task name first.");
    taskInput.focus();
    return;
  }
  if (state.running && state.running.task === task) {
    setStatus("Already tracking " + task);
    return;
  }
  // Switching tasks saves the running one first and keeps its "Saved: ..." message.
  if (state.running) {
    stopTimer();
  } else {
    setStatus("");
  }

  state.running = { task, start: new Date().toISOString() };
  saveState();
  taskInput.value = task;
  render();
}

function stopTimer() {
  if (!state.running) return;
  const { task, start } = state.running;
  const end = new Date().toISOString();
  state.running = null;
  if (Date.parse(end) <= Date.parse(start)) {
    // The start is in the future (the computer's clock was changed), so there's no time to save.
    saveState();
    setStatus("Nothing saved for " + task + ": its start time was later than now. Was the clock changed?");
    render();
    return;
  }
  state.entries.push({ id: newId(), task, start, end });
  saveState();
  setStatus("Saved: " + task + ", " + formatDuration(Date.parse(end) - Date.parse(start)));
  render();
}

// Always computed from the start time, never by counting ticks.
function elapsedMs() {
  if (!state.running) return 0;
  return Math.max(0, Date.now() - Date.parse(state.running.start));
}

// ---------- Days ----------

// Local midnight at the start of the day containing `ms`, and the next one.
// Built from the calendar date (not +24h) so daylight-saving days come out right.
function dayRange(ms) {
  const d = new Date(ms);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  return { start, end };
}

// The part of [startMs, endMs] that falls on the given day. Every view that
// totals time per day uses this, so an entry crossing midnight is split the same way.
function msOnDay(startMs, endMs, day) {
  return Math.max(0, Math.min(endMs, day.end) - Math.max(startMs, day.start));
}

// An entry's part of a day in whole seconds (nearest). Every total is a sum of
// these, so rows add up to day totals and days add up to the week total exactly.
function secondsOnDay(startMs, endMs, day) {
  return Math.round(msOnDay(startMs, endMs, day) / 1000);
}

// Seconds per task on a day, including the running timer up to now. A task is
// included if it has any time on the day, even if that rounds to 0 seconds.
function dayTotals(day) {
  const totals = new Map();
  const add = (task, seconds) => totals.set(task, (totals.get(task) || 0) + seconds);
  for (const e of state.entries) {
    const startMs = Date.parse(e.start);
    const endMs = Date.parse(e.end);
    if (msOnDay(startMs, endMs, day) > 0) add(e.task, secondsOnDay(startMs, endMs, day));
  }
  if (state.running) {
    // Included from the moment it starts, so its row appears straight away.
    const startMs = Date.parse(state.running.start);
    const now = Date.now();
    if (startMs < day.end && now >= day.start) add(state.running.task, secondsOnDay(startMs, now, day));
  }
  return totals;
}

function sumSeconds(totals) {
  let sum = 0;
  for (const seconds of totals.values()) sum += seconds;
  return sum;
}

// The 7 days ending today, oldest first.
function lastSevenDays() {
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    days.push(dayRange(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i).getTime()));
  }
  return days;
}

// "2026-10-18" for the local day containing `ms` (the format date inputs use).
function dateKey(ms) {
  const d = new Date(ms);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

// The day for a "2026-10-18" key, or null if it isn't a real date.
function dayFromKey(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || "");
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(d.getTime()) ? null : dayRange(d.getTime());
}

// Saved entries that have any time on the day, newest first.
function dayEntries(day) {
  return state.entries
    .filter((e) => msOnDay(Date.parse(e.start), Date.parse(e.end), day) > 0)
    .sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
}

// ---------- Formatting ----------

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Live timer: "mm:ss", or "h:mm:ss" once past 60 minutes.
function formatClock(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return hours + ":" + pad2(minutes) + ":" + pad2(seconds);
  return pad2(minutes) + ":" + pad2(seconds);
}

// Durations: "1h 05m 09s".
function formatSeconds(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours + "h " + pad2(minutes) + "m " + pad2(totalSeconds % 60) + "s";
}

// Rounded to the nearest second, like the totals.
function formatDuration(ms) {
  return formatSeconds(Math.round(Math.max(0, ms) / 1000));
}

// "9:05 AM", with the date in front when it isn't on `day` ("Oct 17, 11:30 PM").
function formatTime(ms, day) {
  const time = new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (ms >= day.start && ms <= day.end) return time;
  return new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" }) + ", " + time;
}

// ---------- Task colours ----------

const TASK_COLOR_COUNT = 8;

// The same name always gets the same colour (--task-0 ... --task-7 in styles.css).
function taskColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return "var(--task-" + (hash % TASK_COLOR_COUNT) + ")";
}

// ---------- Theme ----------

const THEMES = ["auto", "light", "dark"];

function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return THEMES.includes(saved) ? saved : "auto";
  } catch (err) {
    return "auto";
  }
}

function applyTheme(theme) {
  if (theme === "auto") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
  const label = theme[0].toUpperCase() + theme.slice(1);
  themeButton.textContent = "Theme: " + label;
}

function cycleTheme() {
  const next = THEMES[(THEMES.indexOf(currentTheme) + 1) % THEMES.length];
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (err) {
    // Storage blocked: the theme still changes for this visit.
  }
  currentTheme = next;
  applyTheme(next);
}

let currentTheme = loadTheme();

// ---------- Tabs ----------

const tabs = [...document.querySelectorAll('[role="tab"]')];

// Shows one panel. Only the selected tab is in the Tab order; arrow keys move between tabs.
function selectTab(tab, { focus = false } = {}) {
  for (const t of tabs) {
    const selected = t === tab;
    t.setAttribute("aria-selected", String(selected));
    t.tabIndex = selected ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !selected;
  }
  if (focus) tab.focus();
}

for (const tab of tabs) {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (event) => {
    const i = tabs.indexOf(tab);
    const next = {
      ArrowRight: tabs[(i + 1) % tabs.length],
      ArrowLeft: tabs[(i - 1 + tabs.length) % tabs.length],
      Home: tabs[0],
      End: tabs[tabs.length - 1],
    }[event.key];
    if (next) {
      event.preventDefault();
      selectTab(next, { focus: true });
    }
  });
}

// ---------- Undo popup ----------

const UNDO_MS = 6000;
let undoAction = null; // what the Undo button does right now
let undoTimeout = null;
let undoReturnFocus = null; // where focus goes when the popup closes

// Shows "message · Undo" for a few seconds. Used after deleting and after adding time.
// `returnFocus` is where focus should go afterwards (near what the person was doing).
function showUndo(message, undo, returnFocus) {
  undoAction = undo;
  undoReturnFocus = returnFocus || null;
  undoText.textContent = message;
  undoToast.hidden = false;
  undoButton.focus();
  clearTimeout(undoTimeout);
  undoTimeout = setTimeout(hideUndoIfIdle, UNDO_MS);
}

// Don't pull the popup away while someone is about to press Undo.
function hideUndoIfIdle() {
  if (undoToast.contains(document.activeElement) || undoToast.matches(":hover")) {
    undoTimeout = setTimeout(hideUndoIfIdle, 1000);
    return;
  }
  hideUndo();
}

function hideUndo() {
  clearTimeout(undoTimeout);
  const hadFocus = undoToast.contains(document.activeElement);
  undoToast.hidden = true;
  undoAction = null;
  // Go back near where the person was, not to the task box at the top
  // (on a phone that would scroll away and open the keyboard).
  if (hadFocus) {
    const target = undoReturnFocus && document.contains(undoReturnFocus) && !undoReturnFocus.closest("[hidden]")
      ? undoReturnFocus
      : tabs.find((t) => t.getAttribute("aria-selected") === "true");
    if (target) target.focus();
  }
}

function runUndo() {
  const undo = undoAction;
  hideUndo();
  if (undo) undo();
}

function deleteEntry(id) {
  const index = state.entries.findIndex((e) => e.id === id);
  if (index === -1) return;
  // The deleted entry's button disappears, so afterwards focus goes to the
  // "+ Add time" button in the same tab.
  const panel = document.activeElement && document.activeElement.closest('[role="tabpanel"]');
  const returnFocus = panel && panel.querySelector(".secondary-button");
  const [entry] = state.entries.splice(index, 1);
  saveState();
  render();
  showUndo("Deleted " + entry.task + ", " + formatDuration(Date.parse(entry.end) - Date.parse(entry.start)), () => {
    state.entries.splice(Math.min(index, state.entries.length), 0, entry);
    saveState();
    render();
    setStatus("Restored " + entry.task);
  }, returnFocus);
}

// ---------- Rendering ----------

function setStatus(message) {
  statusText.textContent = message;
}

// Unique task names, most recently used first.
function taskSuggestions() {
  const sorted = state.entries
    .slice()
    .sort((a, b) => Date.parse(b.end) - Date.parse(a.end));
  const names = [];
  for (const entry of sorted) {
    if (!names.includes(entry.task)) names.push(entry.task);
  }
  return names;
}

function renderSuggestions() {
  suggestionList.replaceChildren(
    ...taskSuggestions().map((name) => {
      const option = document.createElement("option");
      option.value = name;
      return option;
    })
  );
}

// Tasks from earlier days shown under today's rows, so they're one click away.
const RECENT_LIMIT = 5;

// Today's tasks (most time first), then recent tasks not done today.
function todayRowOrder(totals) {
  const today = [...totals.keys()].sort((a, b) => totals.get(b) - totals.get(a) || a.localeCompare(b));
  const others = taskSuggestions().filter((name) => !totals.has(name)).slice(0, RECENT_LIMIT);
  return { today, others };
}

let renderedOrder = "";
let renderedDayStart = 0;

// One task row. Options: `button` adds ▶/■, `dimmed` greys it out (no bar),
// otherwise it gets a bar showing its share of the list's total.
function makeTaskRow(name, { button = false, dimmed = false } = {}) {
  const running = button && state.running && state.running.task === name;
  const li = document.createElement("li");
  li.className = "task-row" + (dimmed ? " task-row-other" : "") + (running ? " task-row-running" : "");
  li.style.setProperty("--task-color", taskColor(name));
  li.dataset.task = name;

  const nameEl = document.createElement("span");
  nameEl.className = "task-name";
  nameEl.textContent = name;

  const timeEl = document.createElement("span");
  timeEl.className = "task-time";
  li.append(nameEl, timeEl);

  if (button) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "row-button";
    btn.dataset.task = name;
    btn.textContent = running ? "■" : "▶";
    btn.setAttribute("aria-label", (running ? "Stop " : "Start ") + name);
    btn.addEventListener("click", () => {
      if (state.running && state.running.task === name) {
        stopTimer();
      } else {
        startTimer(name);
      }
    });
    li.append(btn);
  }

  if (!dimmed) {
    const bar = document.createElement("div");
    bar.className = "share-bar";
    const fill = document.createElement("div");
    fill.className = "share-fill";
    bar.append(fill);
    li.append(bar);
  }
  return li;
}

// Fills in row times and share bars from a Map of task -> seconds.
function updateRowNumbers(list, totals) {
  const total = sumSeconds(totals);
  for (const li of list.children) {
    const seconds = totals.get(li.dataset.task) || 0;
    li.querySelector(".task-time").textContent = formatSeconds(seconds);
    const fill = li.querySelector(".share-fill");
    if (fill) fill.style.width = (total > 0 ? (seconds / total) * 100 : 0) + "%";
  }
}

// Task names, most seconds first (ties alphabetical).
function byMostTime(totals) {
  return [...totals.keys()].sort((a, b) => totals.get(b) - totals.get(a) || a.localeCompare(b));
}

function renderTaskRows(order) {
  // Rebuilding replaces the buttons, so put keyboard focus back where it was.
  const focusedTask = document.activeElement && document.activeElement.classList.contains("row-button")
    ? document.activeElement.dataset.task
    : null;

  taskRows.replaceChildren(
    ...order.today.map((name) => makeTaskRow(name, { button: true })),
    ...order.others.map((name) => makeTaskRow(name, { button: true, dimmed: true }))
  );
  todayEmpty.hidden = order.today.length > 0;

  if (focusedTask !== null) {
    const button = [...taskRows.querySelectorAll(".row-button")].find((b) => b.dataset.task === focusedTask);
    if (button) button.focus();
  }
}

// The entry list for a day (Today's or History's). Returns how many entries it shows.
function renderEntries(list, day) {
  const entries = dayEntries(day);
  list.replaceChildren(
    ...entries.map((e) => {
      const startMs = Date.parse(e.start);
      const endMs = Date.parse(e.end);
      const range = formatTime(startMs, day) + " – " + formatTime(endMs, day);

      const li = document.createElement("li");
      li.className = "entry";
      li.style.setProperty("--task-color", taskColor(e.task));

      const dot = document.createElement("span");
      dot.className = "dot";
      dot.setAttribute("aria-hidden", "true");

      const task = document.createElement("span");
      task.className = "entry-task";
      task.textContent = e.task;

      const time = document.createElement("span");
      time.className = "entry-range";
      time.textContent = range;

      const duration = document.createElement("span");
      duration.className = "entry-duration";
      duration.textContent = formatSeconds(secondsOnDay(startMs, endMs, day));

      const del = document.createElement("button");
      del.type = "button";
      del.className = "delete-button";
      del.textContent = "×";
      del.setAttribute("aria-label", "Delete " + e.task + ", " + range);
      del.addEventListener("click", () => deleteEntry(e.id));

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "edit-button";
      edit.textContent = "Edit";
      edit.setAttribute("aria-label", "Edit " + e.task + ", " + range);
      edit.addEventListener("click", () => openEditDialog(e));

      li.append(dot, task, time, duration, edit, del);
      return li;
    })
  );
  return entries.length;
}

// ---------- History ----------

// The day picked in History, as "2026-10-18". Starts on yesterday.
let historyKey = "";

function historyDay() {
  return dayFromKey(historyKey) || dayRange(Date.now());
}

function showHistoryDay(key) {
  historyKey = key;
  resetCopy();
  historyDateInput.value = key;
  renderHistory();
}

// History rows have no buttons, so they can be rebuilt every second without
// disturbing focus. Entries (which have delete buttons) are only rebuilt by renderHistory.
function renderHistoryRows() {
  const totals = dayTotals(historyDay());
  historyRows.replaceChildren(...byMostTime(totals).map((name) => makeTaskRow(name)));
  updateRowNumbers(historyRows, totals);
  historyTotalText.textContent = formatSeconds(sumSeconds(totals));
  return totals.size;
}

function renderHistory() {
  historyDateInput.max = dateKey(Date.now());
  const taskCount = renderHistoryRows();
  const entryCount = renderEntries(historyEntries, historyDay());
  historyEmpty.hidden = taskCount > 0;
  historyEntriesBlock.hidden = entryCount === 0;
}

// ---------- Last 7 days ----------

function weekData() {
  const days = lastSevenDays().map((day) => ({ day, totals: dayTotals(day) }));
  const byTask = new Map();
  for (const { totals } of days) {
    for (const [task, seconds] of totals) byTask.set(task, (byTask.get(task) || 0) + seconds);
  }
  return { days, byTask };
}

// Day buttons are rebuilt only here (not every second), so focus isn't lost.
function renderWeekDays(data) {
  const todayStart = dayRange(Date.now()).start;
  weekDays.replaceChildren(
    ...data.days.slice().reverse().map(({ day }) => {
      const li = document.createElement("li");
      li.dataset.dayStart = day.start;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "week-day";
      const label = document.createElement("span");
      label.className = "week-day-label";
      label.textContent = day.start === todayStart
        ? "Today"
        : new Date(day.start).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
      const time = document.createElement("span");
      time.className = "week-day-time";
      button.append(label, time);
      button.addEventListener("click", () => {
        showHistoryDay(dateKey(day.start));
        selectTab(document.getElementById("tab-history"));
        historyDateInput.focus();
      });

      const bar = document.createElement("div");
      bar.className = "share-bar";
      const fill = document.createElement("div");
      fill.className = "share-fill week-fill";
      bar.append(fill);

      li.append(button, bar);
      return li;
    })
  );
}

// Numbers that change while a timer runs. Day bars are relative to the busiest day.
function updateWeekNumbers(data) {
  const daySeconds = new Map(data.days.map(({ day, totals }) => [String(day.start), sumSeconds(totals)]));
  const busiest = Math.max(0, ...daySeconds.values());
  for (const li of weekDays.children) {
    const seconds = daySeconds.get(li.dataset.dayStart) || 0;
    li.querySelector(".week-day-time").textContent = formatSeconds(seconds);
    li.querySelector(".share-fill").style.width = (busiest > 0 ? (seconds / busiest) * 100 : 0) + "%";
  }
  weekTotalText.textContent = formatSeconds(sumSeconds(data.byTask));
  weekTasks.replaceChildren(...byMostTime(data.byTask).map((name) => makeTaskRow(name)));
  updateRowNumbers(weekTasks, data.byTask);
  weekEmpty.hidden = data.byTask.size > 0;
}

// ---------- Render ----------

// Numbers that change every second: the clock, totals, row times and bars.
// Rows with buttons only get new text and widths here, so focus isn't disturbed.
function renderLive(totals) {
  clock.textContent = formatClock(elapsedMs());
  // The running timer in the browser tab's title, so it's visible from other tabs.
  document.title = state.running
    ? formatClock(elapsedMs()) + " · " + state.running.task + " – Time Tracker"
    : "Time Tracker";
  todayTotalText.textContent = formatSeconds(sumSeconds(totals));
  updateRowNumbers(taskRows, totals);
  if (historyKey === dateKey(Date.now())) renderHistoryRows();
  updateWeekNumbers(weekData());
}

function render() {
  if (state.running) {
    runningTaskText.textContent = "Tracking: " + state.running.task;
    stopButton.disabled = false;
  } else {
    runningTaskText.textContent = "Type what you're working on, then press Start.";
    stopButton.disabled = true;
  }
  const day = dayRange(Date.now());
  const totals = dayTotals(day);
  const order = todayRowOrder(totals);

  renderSuggestions();
  renderTaskRows(order);
  entriesEmpty.hidden = renderEntries(entryList, day) > 0;
  renderHistory();
  renderWeekDays(weekData());
  renderLive(totals);

  renderedOrder = JSON.stringify(order);
  renderedDayStart = day.start;
  scheduleTick();
}

let tickTimeout = null;

// Runs just after each whole second of the running timer (so the clock never lags),
// or once a minute when idle. A full render only happens if the day changed or
// the running task overtook another in the row order.
function tick() {
  const day = dayRange(Date.now());
  const totals = dayTotals(day);
  if (day.start !== renderedDayStart || JSON.stringify(todayRowOrder(totals)) !== renderedOrder) {
    render();
    return;
  }
  renderLive(totals);
  scheduleTick();
}

function scheduleTick() {
  clearTimeout(tickTimeout);
  const delay = state.running ? 1000 - (elapsedMs() % 1000) + 20 : 60000;
  tickTimeout = setTimeout(tick, delay);
}

// ---------- Add time ----------

const addDialog = document.getElementById("add-dialog");
const addForm = document.getElementById("add-form");
const addTitle = document.getElementById("add-title");
const addTask = document.getElementById("add-task");
const addStart = document.getElementById("add-start");
const addHours = document.getElementById("add-hours");
const addMinutes = document.getElementById("add-minutes");
const addMessage = document.getElementById("add-message");
const addCancel = document.getElementById("add-cancel");
const addTodayButton = document.getElementById("add-today-button");
const addHistoryButton = document.getElementById("add-history-button");

const addSave = document.getElementById("add-save");

const MAX_ENTRY_MS = 24 * 60 * 60 * 1000;
let addDay = null; // the day the dialog adds time to (for an edit: the entry's start day)
let addOpener = null; // where focus goes back to when the dialog closes
let editingId = null; // the entry being edited, or null when adding
let timesChanged = false; // in edit mode: did the person touch the start or length?

function showFormMessage(el, text, isError) {
  el.textContent = text;
  el.classList.toggle("error", Boolean(isError));
}

// "Saturday, October 17", or "today".
function dayName(day) {
  if (day.start === dayRange(Date.now()).start) return "today";
  return new Date(day.start).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function openDialog(title, saveLabel, values) {
  addOpener = document.activeElement;
  addTitle.textContent = title;
  addSave.textContent = saveLabel;
  addTask.value = values.task;
  addStart.value = values.start;
  addHours.value = String(values.hours);
  addMinutes.value = String(values.minutes);
  timesChanged = false;
  showFormMessage(addMessage, "");
  for (const input of [addTask, addStart, addHours, addMinutes]) input.removeAttribute("aria-invalid");
  addDialog.showModal();
  addTask.focus();
}

function openAddDialog(day) {
  addDay = day;
  editingId = null;
  openDialog("Add time to " + dayName(day), "Add", { task: "", start: "", hours: 0, minutes: 0 });
}

function openEditDialog(entry) {
  const startMs = Date.parse(entry.start);
  const lengthMinutes = Math.round((Date.parse(entry.end) - startMs) / 60000);
  const d = new Date(startMs);
  addDay = dayRange(startMs);
  editingId = entry.id;
  openDialog("Edit " + entry.task, "Save", {
    task: entry.task,
    start: pad2(d.getHours()) + ":" + pad2(d.getMinutes()),
    hours: Math.floor(lengthMinutes / 60),
    minutes: lengthMinutes % 60,
  });
}

// A whole number from a number box ("" counts as 0), or null if it isn't one.
function wholeNumber(input) {
  const text = input.value.trim();
  if (text === "") return 0;
  return /^\d+$/.test(text) ? Number(text) : null;
}

// Handles both adding and editing (editingId set).
function saveAddedTime() {
  const fail = (field, text) => {
    showFormMessage(addMessage, text, true);
    for (const input of [addTask, addStart, addHours, addMinutes]) input.setAttribute("aria-invalid", String(input === field));
    field.focus();
  };
  const original = editingId && state.entries.find((e) => e.id === editingId);
  if (editingId && !original) {
    addDialog.close();
    setStatus("That entry was deleted in another tab, so there was nothing to save.");
    return;
  }

  const task = addTask.value.trim();
  if (!task) return fail(addTask, "Type what you worked on.");

  let startMs;
  let endMs;
  if (original && !timesChanged) {
    // Only the name changed: keep the exact times (including seconds).
    startMs = Date.parse(original.start);
    endMs = Date.parse(original.end);
  } else {
    const match = /^(\d{2}):(\d{2})/.exec(addStart.value);
    if (!match) return fail(addStart, "Enter the time you started.");
    const d = new Date(addDay.start);
    startMs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(match[1]), Number(match[2])).getTime();

    const hours = wholeNumber(addHours);
    const minutes = wholeNumber(addMinutes);
    if (hours === null) return fail(addHours, "Hours must be a whole number.");
    if (minutes === null || minutes > 59) return fail(addMinutes, "Minutes must be a whole number from 0 to 59.");
    const lengthMs = (hours * 60 + minutes) * 60000;
    if (lengthMs === 0) return fail(addMinutes, "Enter how long you worked.");
    if (lengthMs > MAX_ENTRY_MS) return fail(addHours, "That's longer than 24 hours.");

    endMs = startMs + lengthMs;
    if (endMs > Date.now()) return fail(addStart, "That would end later than now. Check the start time and length.");
  }

  const start = new Date(startMs).toISOString();
  const end = new Date(endMs).toISOString();
  // Undo goes back to the "+ Add time" button in the same tab (an edited entry's
  // own button is rebuilt, so it can't keep focus).
  const panel = addOpener && addOpener.closest('[role="tabpanel"]');
  const returnFocus = panel ? panel.querySelector(".secondary-button") : addOpener;

  if (original) {
    const before = { ...original };
    Object.assign(original, { task, start, end });
    saveState();
    addDialog.close();
    render();
    showUndo("Saved changes to " + task, () => {
      const current = state.entries.find((e) => e.id === before.id);
      if (current) Object.assign(current, before);
      saveState();
      render();
    }, returnFocus);
    return;
  }

  const entry = { id: newId(), task, start, end };
  state.entries.push(entry);
  saveState();
  addDialog.close();
  render();
  showUndo("Added " + task + ", " + formatDuration(endMs - startMs), () => {
    state.entries = state.entries.filter((e) => e.id !== entry.id);
    saveState();
    render();
  }, returnFocus);
}

// ---------- Copy this day ----------

const copyButton = document.getElementById("copy-button");
const youtrackCheck = document.getElementById("youtrack-check");
const copyMessage = document.getElementById("copy-message");
const copyFallback = document.getElementById("copy-fallback");

// "1h30m", "45m", "2h": the duration style YouTrack's docs use.
function formatHm(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return m + "m";
  return h + "h" + (m ? m + "m" : "");
}

// Plain:    "Saturday, October 17: 2h 00m 00s" then "Coding: 1h 00m 00s" lines.
// YouTrack: "work 2026-10-17 1h30m Coding" lines (tasks under 30 seconds are left out,
//           because YouTrack can't log 0 minutes).
function dayText(day, youtrack) {
  const totals = dayTotals(day);
  const tasks = byMostTime(totals);
  if (youtrack) {
    return tasks
      .filter((task) => Math.round(totals.get(task) / 60) > 0)
      .map((task) => "work " + dateKey(day.start) + " " + formatHm(Math.round(totals.get(task) / 60)) + " " + task)
      .join("\n");
  }
  if (tasks.length === 0) return "";
  const title = new Date(day.start).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  return [title + ": " + formatSeconds(sumSeconds(totals)), ...tasks.map((task) => task + ": " + formatSeconds(totals.get(task)))].join("\n");
}

function resetCopy() {
  showFormMessage(copyMessage, "");
  copyFallback.hidden = true;
}

async function copyDay() {
  resetCopy();
  const text = dayText(historyDay(), youtrackCheck.checked);
  if (!text) {
    const nothingTracked = dayTotals(historyDay()).size === 0;
    showFormMessage(copyMessage, nothingTracked
      ? "Nothing to copy for this day."
      : "Nothing to copy: every task is under 30 seconds, and YouTrack needs at least 1 minute.", true);
    return;
  }
  const lineCount = text.split("\n").length;
  const done = () => showFormMessage(copyMessage, "Copied " + lineCount + (lineCount === 1 ? " line." : " lines.") + " Paste it wherever you need it.");
  try {
    await navigator.clipboard.writeText(text);
    done();
  } catch (err) {
    // Some browsers block the clipboard on pages opened as a file. Try the older
    // copy command on a visible box; if that fails too, leave the text selected.
    copyFallback.value = text;
    copyFallback.hidden = false;
    copyFallback.focus();
    copyFallback.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (err2) {
      copied = false;
    }
    if (copied) {
      copyFallback.hidden = true;
      copyButton.focus();
      done();
    } else {
      showFormMessage(copyMessage, "Your browser blocked copying. The text below is selected: press Ctrl+C (or ⌘C).", true);
    }
  }
}

// ---------- Excel download ----------

const exportButton = document.getElementById("export-button");
const exportMessage = document.getElementById("export-message");
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// An .xlsx file is a zip of a few XML files. This writes an uncompressed zip.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipBlob(files, type) {
  const encoder = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.text);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // local file header
    local.setUint16(4, 20, true);         // version needed
    local.setUint16(12, 0x21, true);      // date: 1980-01-01
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(local, name, data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true); // central directory header
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(14, 0x21, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(entry, name);

    offset += 30 + name.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); // end of central directory
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type });
}

function xmlText(text) {
  return String(text)
    .replace(/[^\t\n\r -퟿-�]/g, "") // characters XML can't hold
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Excel stores a date-time as days since 1899-12-30, in local time.
function excelDate(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()) / 86400000 + 25569;
}

// Columns: Task | Start | End | Duration, one row per entry, oldest first, then a Total row.
// Cell styles (see styles.xml below): 1 = date-time, 2 = duration, 3 = bold, 4 = bold duration.
function buildWorkbook(entries) {
  const textCell = (ref, text, style) =>
    `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${xmlText(text)}</t></is></c>`;
  const numberCell = (ref, value, style) => `<c r="${ref}" s="${style}"><v>${value}</v></c>`;

  const rows = [`<row r="1">${textCell("A1", "Task", 3)}${textCell("B1", "Start", 3)}${textCell("C1", "End", 3)}${textCell("D1", "Duration", 3)}</row>`];
  let totalDays = 0;
  entries.forEach((e, i) => {
    const r = i + 2;
    const startMs = Date.parse(e.start);
    const endMs = Date.parse(e.end);
    const lengthDays = Math.round((endMs - startMs) / 1000) / 86400;
    totalDays += lengthDays;
    rows.push(`<row r="${r}">${textCell("A" + r, e.task)}${numberCell("B" + r, excelDate(startMs), 1)}` +
      `${numberCell("C" + r, excelDate(endMs), 1)}${numberCell("D" + r, lengthDays, 2)}</row>`);
  });
  const t = entries.length + 2;
  rows.push(`<row r="${t}">${textCell("A" + t, "Total", 3)}` +
    `<c r="D${t}" s="4"><f>SUM(D2:D${t - 1})</f><v>${totalDays}</v></c></row>`);

  const main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  return [
    { name: "[Content_Types].xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: "_rels/.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${main}" xmlns:r="${rel}"><sheets><sheet name="Time entries" sheetId="1" r:id="rId1"/></sheets><calcPr fullCalcOnLoad="1"/></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${main}"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd h:mm AM/PM"/><numFmt numFmtId="165" formatCode="[h]:mm:ss"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    { name: "xl/worksheets/sheet1.xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${main}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="3" width="22" customWidth="1"/><col min="4" max="4" width="12" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData></worksheet>` },
  ];
}

function exportExcel() {
  const entries = state.entries.slice().sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  if (entries.length === 0) {
    showFormMessage(exportMessage, "Nothing to download yet.", true);
    return;
  }
  downloadFile(zipBlob(buildWorkbook(entries), XLSX_TYPE), "time-tracker-" + dateKey(Date.now()) + ".xlsx");
  showFormMessage(exportMessage, "Downloaded " + entries.length + (entries.length === 1 ? " entry." : " entries.") +
    (state.running ? " The running timer is added once you stop it." : ""));
}

// ---------- Backup and restore ----------

const backupButton = document.getElementById("backup-button");
const restoreButton = document.getElementById("restore-button");
const restoreInput = document.getElementById("restore-input");
const backupMessage = document.getElementById("backup-message");
const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

function downloadFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// A backup is the saved entries as JSON. The running timer isn't included.
function downloadBackup() {
  if (state.entries.length === 0) {
    showFormMessage(backupMessage, "Nothing to back up yet.", true);
    return;
  }
  const backup = { app: "time-tracker", version: 1, saved: new Date().toISOString(), entries: state.entries };
  downloadFile(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
    "time-tracker-backup-" + dateKey(Date.now()) + ".json");
  showFormMessage(backupMessage, "Downloaded a backup of " + state.entries.length +
    (state.entries.length === 1 ? " entry." : " entries.") +
    (state.running ? " The running timer is included once you stop it." : ""));
}

// Restoring adds the backup's entries that aren't here yet. It never deletes
// anything, so restoring an old backup can't wipe out newer times.
async function restoreBackup(file) {
  restoreInput.value = ""; // so picking the same file again still works
  if (!file) return;
  if (file.size > MAX_BACKUP_BYTES) {
    showFormMessage(backupMessage, "That file is too big to be a Time Tracker backup.", true);
    return;
  }
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (err) {
    data = null;
  }
  if (!data || data.app !== "time-tracker" || !Array.isArray(data.entries)) {
    showFormMessage(backupMessage, "That file isn't a Time Tracker backup. Pick a file named like time-tracker-backup-….json.", true);
    return;
  }

  // An entry counts as "already here" when its task and times match one here
  // (ids alone could clash). Restored entries get fresh ids.
  const incoming = cleanState({ entries: data.entries }).entries;
  const same = new Set(state.entries.map((e) => e.task + "|" + Date.parse(e.start) + "|" + Date.parse(e.end)));
  const added = [];
  for (const e of incoming) {
    const key = e.task + "|" + Date.parse(e.start) + "|" + Date.parse(e.end);
    if (same.has(key)) continue;
    same.add(key);
    added.push({ ...e, id: newId() });
  }

  if (added.length === 0) {
    showFormMessage(backupMessage, incoming.length
      ? "Everything in that backup is already here. Nothing changed."
      : "That backup has no entries in it.");
    return;
  }
  const before = state.entries.slice();
  state.entries.push(...added);
  saveState();
  render();
  showFormMessage(backupMessage, "Restored " + added.length + (added.length === 1 ? " entry" : " entries") +
    " from the backup" + (incoming.length > added.length ? " (" + (incoming.length - added.length) + " were already here)." : "."));
  showUndo("Restored " + added.length + (added.length === 1 ? " entry" : " entries"), () => {
    state.entries = before;
    saveState();
    render();
    showFormMessage(backupMessage, "Restore undone.");
  }, restoreButton);
}

// ---------- Events ----------

form.addEventListener("submit", (event) => {
  event.preventDefault();
  startTimer(taskInput.value);
});

stopButton.addEventListener("click", () => {
  stopTimer();
  taskInput.focus();
});

themeButton.addEventListener("click", cycleTheme);
undoButton.addEventListener("click", runUndo);

addTodayButton.addEventListener("click", () => openAddDialog(dayRange(Date.now())));
addHistoryButton.addEventListener("click", () => openAddDialog(historyDay()));
addCancel.addEventListener("click", () => addDialog.close());
for (const input of [addStart, addHours, addMinutes]) {
  input.addEventListener("input", () => { timesChanged = true; });
}
addDialog.addEventListener("close", () => {
  if (addOpener && document.contains(addOpener) && undoToast.hidden) addOpener.focus();
});
addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveAddedTime();
});

copyButton.addEventListener("click", copyDay);
youtrackCheck.addEventListener("change", resetCopy);
exportButton.addEventListener("click", exportExcel);
backupButton.addEventListener("click", downloadBackup);
restoreButton.addEventListener("click", () => restoreInput.click());
restoreInput.addEventListener("change", () => restoreBackup(restoreInput.files[0]));

historyDateInput.addEventListener("change", () => {
  const key = historyDateInput.value;
  const today = dateKey(Date.now());
  if (!dayFromKey(key)) {
    historyDateInput.value = historyKey; // cleared or not a date: keep the last good day
  } else {
    showHistoryDay(key > today ? today : key);
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) tick();
});

// Another tab changed the data: reload it so the tabs don't overwrite each other.
window.addEventListener("storage", (event) => {
  if (event.key === THEME_KEY) {
    currentTheme = loadTheme();
    applyTheme(currentTheme);
    return;
  }
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  const wasRunning = state.running && state.running.task;
  state = loadState();
  // Keep the task box in step with a timer started or stopped in the other tab,
  // unless the person is typing in it.
  const nowRunning = state.running && state.running.task;
  if (nowRunning !== wasRunning && document.activeElement !== taskInput) taskInput.value = nowRunning || "";
  render();
});

// ---------- Start up ----------

applyTheme(currentTheme);
if (state.running) taskInput.value = state.running.task;
const startNow = new Date();
historyKey = dateKey(new Date(startNow.getFullYear(), startNow.getMonth(), startNow.getDate() - 1).getTime());
historyDateInput.value = historyKey;
render();
