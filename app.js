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

// An entry's part of a day in whole minutes (nearest). Every total is a sum of
// these, so rows add up to day totals and days add up to the week total exactly.
function minutesOnDay(startMs, endMs, day) {
  return Math.round(msOnDay(startMs, endMs, day) / 60000);
}

// Minutes per task on a day, including the running timer up to now. A task is
// included if it has any time on the day, even if that rounds to 0 minutes.
function dayTotals(day) {
  const totals = new Map();
  const add = (task, minutes) => totals.set(task, (totals.get(task) || 0) + minutes);
  for (const e of state.entries) {
    const startMs = Date.parse(e.start);
    const endMs = Date.parse(e.end);
    if (msOnDay(startMs, endMs, day) > 0) add(e.task, minutesOnDay(startMs, endMs, day));
  }
  if (state.running) {
    // Included from the moment it starts, so its row appears straight away.
    const startMs = Date.parse(state.running.start);
    const now = Date.now();
    if (startMs < day.end && now >= day.start) add(state.running.task, minutesOnDay(startMs, now, day));
  }
  return totals;
}

function sumMinutes(totals) {
  let sum = 0;
  for (const minutes of totals.values()) sum += minutes;
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

// Durations: "1h 05m".
function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  return hours + "h " + pad2(totalMinutes % 60) + "m";
}

// Rounded to the nearest minute, like the totals.
function formatDuration(ms) {
  return formatMinutes(Math.round(Math.max(0, ms) / 60000));
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

// Fills in row times and share bars from a Map of task -> minutes.
function updateRowNumbers(list, totals) {
  const total = sumMinutes(totals);
  for (const li of list.children) {
    const minutes = totals.get(li.dataset.task) || 0;
    li.querySelector(".task-time").textContent = formatMinutes(minutes);
    const fill = li.querySelector(".share-fill");
    if (fill) fill.style.width = (total > 0 ? (minutes / total) * 100 : 0) + "%";
  }
}

// Task names, most minutes first (ties alphabetical).
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
      duration.textContent = formatMinutes(minutesOnDay(startMs, endMs, day));

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
  historyDateInput.value = key;
  renderHistory();
}

// History rows have no buttons, so they can be rebuilt every second without
// disturbing focus. Entries (which have delete buttons) are only rebuilt by renderHistory.
function renderHistoryRows() {
  const totals = dayTotals(historyDay());
  historyRows.replaceChildren(...byMostTime(totals).map((name) => makeTaskRow(name)));
  updateRowNumbers(historyRows, totals);
  historyTotalText.textContent = formatMinutes(sumMinutes(totals));
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
    for (const [task, minutes] of totals) byTask.set(task, (byTask.get(task) || 0) + minutes);
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
        historyDateInput.focus();
        historyDateInput.scrollIntoView({ block: "center" });
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
  const dayMinutes = new Map(data.days.map(({ day, totals }) => [String(day.start), sumMinutes(totals)]));
  const busiest = Math.max(0, ...dayMinutes.values());
  for (const li of weekDays.children) {
    const minutes = dayMinutes.get(li.dataset.dayStart) || 0;
    li.querySelector(".week-day-time").textContent = formatMinutes(minutes);
    li.querySelector(".share-fill").style.width = (busiest > 0 ? (minutes / busiest) * 100 : 0) + "%";
  }
  weekTotalText.textContent = formatMinutes(sumMinutes(data.byTask));
  weekTasks.replaceChildren(...byMostTime(data.byTask).map((name) => makeTaskRow(name)));
  updateRowNumbers(weekTasks, data.byTask);
  weekEmpty.hidden = data.byTask.size > 0;
}

// ---------- Render ----------

// Numbers that change every second: the clock, totals, row times and bars.
// Rows with buttons only get new text and widths here, so focus isn't disturbed.
function renderLive(totals) {
  clock.textContent = formatClock(elapsedMs());
  todayTotalText.textContent = formatMinutes(sumMinutes(totals));
  updateRowNumbers(taskRows, totals);
  if (historyKey === dateKey(Date.now())) renderHistoryRows();
  updateWeekNumbers(weekData());
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
  state = loadState();
  render();
});

// ---------- Start up ----------

applyTheme(currentTheme);
if (state.running) taskInput.value = state.running.task;
const startNow = new Date();
historyKey = dateKey(new Date(startNow.getFullYear(), startNow.getMonth(), startNow.getDate() - 1).getTime());
historyDateInput.value = historyKey;
render();
