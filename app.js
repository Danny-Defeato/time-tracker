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
  if (!data || typeof data !== "object") return emptyState();

  const entries = Array.isArray(data.entries)
    ? data.entries.filter((e) =>
        e && typeof e.task === "string" && isValidTime(e.start) && isValidTime(e.end))
    : [];

  const r = data.running;
  const running = r && typeof r.task === "string" && isValidTime(r.start)
    ? { task: r.task, start: r.start }
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
  state.entries.push({ id: newId(), task, start, end });
  state.running = null;
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

// Time per task on a day, including the running timer up to now.
function dayTotals(day) {
  const totals = new Map();
  const add = (task, ms) => totals.set(task, (totals.get(task) || 0) + ms);
  for (const e of state.entries) {
    const ms = msOnDay(Date.parse(e.start), Date.parse(e.end), day);
    if (ms > 0) add(e.task, ms);
  }
  if (state.running) {
    add(state.running.task, msOnDay(Date.parse(state.running.start), Date.now(), day));
  }
  return totals;
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

// Durations: "1h 05m".
function formatDuration(ms) {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  return hours + "h " + pad2(totalMinutes % 60) + "m";
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

// ---------- Delete and undo ----------

const UNDO_MS = 6000;
let lastDeleted = null; // { entry, index }
let undoTimeout = null;

function deleteEntry(id) {
  const index = state.entries.findIndex((e) => e.id === id);
  if (index === -1) return;
  const [entry] = state.entries.splice(index, 1);
  saveState();
  render();

  lastDeleted = { entry, index };
  undoText.textContent = "Deleted " + entry.task + ", " +
    formatDuration(Date.parse(entry.end) - Date.parse(entry.start));
  undoToast.hidden = false;
  undoButton.focus();
  clearTimeout(undoTimeout);
  undoTimeout = setTimeout(hideUndoIfIdle, UNDO_MS);
}

// Don't pull the toast away while someone is about to press Undo.
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
  lastDeleted = null;
  if (hadFocus) taskInput.focus();
}

function undoDelete() {
  if (!lastDeleted) return;
  const { entry, index } = lastDeleted;
  state.entries.splice(Math.min(index, state.entries.length), 0, entry);
  saveState();
  hideUndo();
  render();
  setStatus("Restored " + entry.task);
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

function makeTaskRow(name, isToday) {
  const running = state.running && state.running.task === name;
  const li = document.createElement("li");
  li.className = "task-row" + (isToday ? "" : " task-row-other") + (running ? " task-row-running" : "");
  li.style.setProperty("--task-color", taskColor(name));
  li.dataset.task = name;

  const nameEl = document.createElement("span");
  nameEl.className = "task-name";
  nameEl.textContent = name;

  const timeEl = document.createElement("span");
  timeEl.className = "task-time";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "row-button";
  button.dataset.task = name;
  button.textContent = running ? "■" : "▶";
  button.setAttribute("aria-label", (running ? "Stop " : "Start ") + name);
  button.addEventListener("click", () => {
    if (state.running && state.running.task === name) {
      stopTimer();
    } else {
      startTimer(name);
    }
  });

  li.append(nameEl, timeEl, button);

  if (isToday) {
    const bar = document.createElement("div");
    bar.className = "share-bar";
    const fill = document.createElement("div");
    fill.className = "share-fill";
    bar.append(fill);
    li.append(bar);
  }
  return li;
}

function renderTaskRows(totals, order) {
  // Rebuilding replaces the buttons, so put keyboard focus back where it was.
  const focusedTask = document.activeElement && document.activeElement.classList.contains("row-button")
    ? document.activeElement.dataset.task
    : null;

  taskRows.replaceChildren(
    ...order.today.map((name) => makeTaskRow(name, true)),
    ...order.others.map((name) => makeTaskRow(name, false))
  );
  todayEmpty.hidden = order.today.length > 0;

  if (focusedTask !== null) {
    const button = [...taskRows.querySelectorAll(".row-button")].find((b) => b.dataset.task === focusedTask);
    if (button) button.focus();
  }
}

function renderEntries(day) {
  const entries = dayEntries(day);
  entriesEmpty.hidden = entries.length > 0;
  entryList.replaceChildren(
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
      duration.textContent = formatDuration(msOnDay(startMs, endMs, day));

      const del = document.createElement("button");
      del.type = "button";
      del.className = "delete-button";
      del.textContent = "×";
      del.setAttribute("aria-label", "Delete " + e.task + ", " + range);
      del.addEventListener("click", () => deleteEntry(e.id));

      li.append(dot, task, time, duration, del);
      return li;
    })
  );
}

// Numbers that change every second: the clock, the header total, row times and bars.
// Only text and widths change here, so focus and screen readers aren't disturbed.
function renderLive(totals) {
  clock.textContent = formatClock(elapsedMs());
  let grandTotal = 0;
  for (const ms of totals.values()) grandTotal += ms;
  todayTotalText.textContent = formatDuration(grandTotal);

  for (const li of taskRows.children) {
    const ms = totals.get(li.dataset.task) || 0;
    li.querySelector(".task-time").textContent = formatDuration(ms);
    const fill = li.querySelector(".share-fill");
    if (fill) fill.style.width = (grandTotal > 0 ? (ms / grandTotal) * 100 : 0) + "%";
  }
}

function render() {
  if (state.running) {
    runningTaskText.textContent = "Tracking: " + state.running.task;
    stopButton.disabled = false;
  } else {
    runningTaskText.textContent = "No timer running";
    stopButton.disabled = true;
  }
  const day = dayRange(Date.now());
  const totals = dayTotals(day);
  const order = todayRowOrder(totals);

  renderSuggestions();
  renderTaskRows(totals, order);
  renderEntries(day);
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
undoButton.addEventListener("click", undoDelete);

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
  state = loadState();
  render();
});

// ---------- Start up ----------

applyTheme(currentTheme);
if (state.running) taskInput.value = state.running.task;
render();
