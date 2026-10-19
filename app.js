// Time Tracker: all data lives in localStorage under one key (see CLAUDE.md).

const STORAGE_KEY = "timeTracker.v1";
const NOTE_MAX = 120; // characters in an entry's optional note
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
const timerCard = document.querySelector(".timer-card"); // glows while running (Launcher)
const weekChartBlock = document.getElementById("week-chart-block");
const weekChart = document.getElementById("week-chart");
const weekLegend = document.getElementById("week-legend");

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
    const entry = { id, task: e.task.trim(), start: e.start, end: e.end };
    // The note is optional; older entries simply don't have one.
    const note = typeof e.note === "string" ? e.note.trim().slice(0, NOTE_MAX) : "";
    if (note) entry.note = note;
    entries.push(entry);
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

// ---------- Motion helpers (looks only) ----------

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Headline totals count up (or down) to a new value instead of jumping. The text always
// ends exactly at formatSeconds(seconds). Small steps (the live timer ticking), the first
// fill, a hidden page and reduced motion just set the text.
const countUps = new WeakMap();

function showTotal(el, seconds) {
  const from = Number(el.dataset.seconds);
  el.dataset.seconds = seconds;
  cancelAnimationFrame(countUps.get(el));
  if (!Number.isFinite(from) || Math.abs(seconds - from) <= 2 || document.hidden || reducedMotion()) {
    el.textContent = formatSeconds(seconds);
    return;
  }
  const started = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - started) / 400);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = formatSeconds(Math.round(from + (seconds - from) * eased));
    if (t < 1) countUps.set(el, requestAnimationFrame(step));
  };
  countUps.set(el, requestAnimationFrame(step));
}

// Plays the slide-out on a row, then runs `done` (which removes it for real).
// The timeout is a backstop in case the animation never runs (e.g. the row was rebuilt).
function animateOut(el, done) {
  if (reducedMotion()) return done();
  el.classList.add("is-leaving");
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    done();
  };
  el.addEventListener("animationend", finish, { once: true });
  setTimeout(finish, 300);
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

// A name's own colour, picked from its letters (--task-0 ... --task-7 in styles.css).
function hashColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % TASK_COLOR_COUNT;
}

// Colours for the tasks of the last 7 days, so no two of them share one (while
// there are 8 or fewer). Tasks are placed oldest first: each keeps its own colour
// if it's free, otherwise it takes the next free one. Other tasks use their own colour.
let assignedColors = new Map();

function assignTaskColors() {
  const firstUsed = new Map();
  const note = (task, start) => {
    const ms = Date.parse(start);
    if (!firstUsed.has(task) || ms < firstUsed.get(task)) firstUsed.set(task, ms);
  };
  for (const e of state.entries) note(e.task, e.start);
  if (state.running) note(state.running.task, state.running.start);

  const weekTasks = new Set();
  for (const day of lastSevenDays()) for (const task of dayTotals(day).keys()) weekTasks.add(task);
  const order = [...weekTasks].sort((a, b) => firstUsed.get(a) - firstUsed.get(b) || a.localeCompare(b));

  assignedColors = new Map();
  const taken = new Set();
  for (const task of order) {
    let color = hashColor(task);
    for (let i = 0; i < TASK_COLOR_COUNT && taken.has(color); i++) color = (color + 1) % TASK_COLOR_COUNT;
    taken.add(color);
    assignedColors.set(task, color);
  }
}

function taskColor(name) {
  const color = assignedColors.has(name) ? assignedColors.get(name) : hashColor(name);
  return "var(--task-" + color + ")";
}

// ---------- Settings ----------
// Each setting has its own key. If storage is blocked, changes still apply for this visit.

const ACCENT_KEY = "timeTracker.accent";
const TAB_KEY = "timeTracker.tab";
const GOALS_KEY = "timeTracker.goals";
const PLANS_KEY = "timeTracker.plans";
const REMIND_KEY = "timeTracker.remindHours";
const SHORTCUTS_KEY = "timeTracker.shortcuts";
const PIXEL_KEY = "timeTracker.pixel";
const GRADIENT_KEY = "timeTracker.gradient";

const THEMES = ["auto", "light", "dark", "warm", "midnight", "contrast", "launcher"];
const ACCENTS = ["blue", "green", "purple", "orange", "pink", "teal"];
const GRADIENTS = ["sunset", "ocean", "lime", "ember"]; // Launcher's accent
const REMIND_CHOICES = ["0", "2", "4", "8"];

function readSetting(key, fallback, isValid) {
  try {
    const value = localStorage.getItem(key);
    return value !== null && isValid(value) ? value : fallback;
  } catch (err) {
    return fallback;
  }
}

function writeSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    // Storage blocked: the setting still applies for this visit.
  }
}

// New visitors (no theme chosen and no saved times) start on Launcher. People who already
// use the app keep Auto. The head script in index.html makes the same choice.
function defaultTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === null ? "launcher" : "auto";
  } catch (err) {
    return "launcher";
  }
}

function loadSettings() {
  return {
    theme: readSetting(THEME_KEY, defaultTheme(), (v) => THEMES.includes(v)),
    accent: readSetting(ACCENT_KEY, "blue", (v) => ACCENTS.includes(v)),
    gradient: readSetting(GRADIENT_KEY, "sunset", (v) => GRADIENTS.includes(v)),
    remindHours: Number(readSetting(REMIND_KEY, "4", (v) => REMIND_CHOICES.includes(v))),
    shortcuts: readSetting(SHORTCUTS_KEY, "on", (v) => v === "on" || v === "off") === "on",
    pixel: readSetting(PIXEL_KEY, "on", (v) => v === "on" || v === "off") === "on",
  };
}

let settings = loadSettings();

// Theme, accent and gradient go on <html> as data-theme / data-accent / data-gradient
// (see styles.css).
function applyLook() {
  const root = document.documentElement;
  if (settings.theme === "auto") delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  if (settings.accent === "blue") delete root.dataset.accent;
  else root.dataset.accent = settings.accent;
  if (settings.gradient === "sunset") delete root.dataset.gradient;
  else root.dataset.gradient = settings.gradient;
  const launcher = settings.theme === "launcher";
  if (launcher) loadLauncherFont(document);
  // Launcher's accent is a gradient, so Settings shows those swatches instead.
  accentFieldset.hidden = launcher;
  gradientFieldset.hidden = !launcher;
  if (pipWindow) copyLook(pipWindow.document);
  placeTabIndicator();
}

// Sora, from Google Fonts. Only requested once Launcher is in use (the page falls back
// to system fonts until it arrives, or if it can't load).
const LAUNCHER_FONT_URL = "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap";

function loadLauncherFont(doc) {
  if (doc.getElementById("launcher-font")) return;
  const link = doc.createElement("link");
  link.id = "launcher-font";
  link.rel = "stylesheet";
  link.href = LAUNCHER_FONT_URL;
  doc.head.append(link);
}

// Daily goals: { "Studying": 120 } (minutes per day).
function loadGoals() {
  const goals = {};
  try {
    const data = JSON.parse(localStorage.getItem(GOALS_KEY) || "{}");
    for (const [task, minutes] of Object.entries(data && typeof data === "object" ? data : {})) {
      if (task.trim() && Number.isInteger(minutes) && minutes > 0 && minutes <= 24 * 60) goals[task.trim()] = minutes;
    }
  } catch (err) {
    // missing or corrupt: no goals
  }
  return goals;
}

function saveGoals() {
  writeSetting(GOALS_KEY, JSON.stringify(goals));
}

let goals = loadGoals();

// Plans: for one date only, { "2026-10-18": { "Coding": 120 } } (minutes). Separate from
// daily goals, which repeat every day. Used for saved data and for backups.
function cleanPlans(data) {
  const plans = {};
  for (const [date, day] of Object.entries(data && typeof data === "object" ? data : {})) {
    if (!dayFromKey(date) || !day || typeof day !== "object") continue;
    for (const [task, minutes] of Object.entries(day)) {
      if (!task.trim() || !Number.isInteger(minutes) || minutes <= 0 || minutes > 24 * 60) continue;
      (plans[date] = plans[date] || {})[task.trim()] = minutes;
    }
  }
  return plans;
}

function loadPlans() {
  try {
    return cleanPlans(JSON.parse(localStorage.getItem(PLANS_KEY) || "{}"));
  } catch (err) {
    return {}; // missing or corrupt: no plans
  }
}

function savePlans() {
  writeSetting(PLANS_KEY, JSON.stringify(plans));
}

let plans = loadPlans();

// Today's plan: { task: minutes }.
function todayPlan() {
  return plans[dateKey(Date.now())] || {};
}

// ---------- Tabs ----------

const tabs = [...document.querySelectorAll('[role="tab"]')];

// Shows one panel and remembers it for next time. Only the selected tab is in the
// Tab order; arrow keys move between tabs.
function selectTab(tab, { focus = false } = {}) {
  for (const t of tabs) {
    const selected = t === tab;
    t.setAttribute("aria-selected", String(selected));
    t.tabIndex = selected ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !selected;
  }
  writeSetting(TAB_KEY, tab.id);
  if (tab.id === "tab-tasks") {
    renderGoalList();
    renderRenameOptions(renameFrom.value);
  }
  placeTabIndicator();
  if (focus) tab.focus();
}

// Moves the underline under the selected tab. The first placement doesn't slide;
// after that it does (the is-ready class turns its transition on).
const tabIndicator = document.getElementById("tab-indicator");

function placeTabIndicator() {
  const tab = tabs.find((t) => t.getAttribute("aria-selected") === "true");
  if (!tab) return;
  tabIndicator.style.left = tab.offsetLeft + 8 + "px";
  tabIndicator.style.width = Math.max(0, tab.offsetWidth - 16) + "px";
  if (!tabIndicator.classList.contains("is-ready")) {
    requestAnimationFrame(() => tabIndicator.classList.add("is-ready"));
  }
}
window.addEventListener("resize", placeTabIndicator);

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
// Planned tasks with no time yet come right after, so their plan shows from the start.
function todayRowOrder(totals) {
  const today = [...totals.keys()].sort((a, b) => totals.get(b) - totals.get(a) || a.localeCompare(b));
  const planned = Object.keys(todayPlan()).filter((name) => !totals.has(name)).sort((a, b) => a.localeCompare(b));
  const others = taskSuggestions().filter((name) => !totals.has(name) && !planned.includes(name)).slice(0, RECENT_LIMIT);
  return { today, planned, others };
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
    if (button) {
      // Today's rows can show a plan (see applyPlans): an outline, time over it, a status.
      const outline = document.createElement("div");
      outline.className = "plan-outline";
      const over = document.createElement("div");
      over.className = "share-over";
      bar.prepend(outline);
      bar.append(over);
      const line = document.createElement("div");
      line.className = "bar-line";
      const status = document.createElement("span");
      status.className = "plan-status";
      line.append(bar, status);
      li.append(line);
    } else {
      li.append(bar);
    }
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
    ...order.planned.map((name) => makeTaskRow(name, { button: true })),
    ...order.others.map((name) => makeTaskRow(name, { button: true, dimmed: true }))
  );
  todayEmpty.hidden = order.today.length > 0;

  if (focusedTask !== null) {
    const button = [...taskRows.querySelectorAll(".row-button")].find((b) => b.dataset.task === focusedTask);
    if (button) button.focus();
  }
}

// The entry list for a day (Today's or History's). Returns how many entries it shows.
// The note being typed: which entry, in which list, and the text so far. Kept here
// so a re-render (the timer starting, another tab saving) doesn't wipe the box.
let noteEdit = null;

function openNote(entry, list) {
  noteEdit = { id: entry.id, listId: list.id, value: entry.note || "", focus: true };
  render();
}

function closeNote(entryId, list) {
  noteEdit = null;
  render();
  const button = list.querySelector('.note-button[data-entry-id="' + entryId + '"]');
  if (button) button.focus();
}

// Saves the box's text; an empty box removes the note.
function saveNote(entryId, list) {
  const entry = state.entries.find((e) => e.id === entryId);
  const text = noteEdit ? noteEdit.value.trim().slice(0, NOTE_MAX) : "";
  if (entry) {
    if (text) entry.note = text;
    else delete entry.note;
    saveState();
  }
  closeNote(entryId, list);
}

// The note line under an entry: the note (if any) and Add note / Edit note,
// or the text box while it's being edited.
function makeNoteLine(e, list, range) {
  const line = document.createElement("div");
  line.className = "entry-note-line";

  if (noteEdit && noteEdit.id === e.id && noteEdit.listId === list.id) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "note-input";
    input.maxLength = NOTE_MAX;
    input.value = noteEdit.value;
    input.setAttribute("aria-label", "Note for " + e.task + ", " + range);
    input.setAttribute("aria-describedby", list.id + "-note-help");
    input.addEventListener("input", () => { noteEdit.value = input.value; });
    input.addEventListener("keydown", (event) => {
      if (event.isComposing) return; // still picking characters in an input method
      if (event.key === "Enter") {
        event.preventDefault();
        saveNote(e.id, list);
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeNote(e.id, list);
      }
    });
    const help = document.createElement("span");
    help.id = list.id + "-note-help";
    help.className = "note-help";
    help.textContent = "Up to " + NOTE_MAX + " characters. Enter saves, Esc cancels.";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "link-button";
    save.textContent = "Save";
    save.addEventListener("click", () => saveNote(e.id, list));
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "link-button";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => closeNote(e.id, list));
    line.append(input, save, cancel, help);
    return line;
  }

  if (e.note) {
    const note = document.createElement("span");
    note.className = "entry-note";
    note.textContent = e.note;
    line.append(note);
  }
  const button = document.createElement("button");
  button.type = "button";
  button.className = "link-button note-button";
  button.dataset.entryId = e.id;
  button.textContent = e.note ? "Edit note" : "Add note";
  button.setAttribute("aria-label", (e.note ? "Edit note for " : "Add note to ") + e.task + ", " + range);
  button.addEventListener("click", () => openNote(e, list));
  line.append(button);
  return line;
}

// What each entry list showed last time ({ dayStart, ids }), so entries that are new
// on the same day can slide in. A different day, or the first fill, doesn't animate.
const shownEntries = new Map();

function renderEntries(list, day) {
  const entries = dayEntries(day);
  const before = shownEntries.get(list.id);
  const enteringIds = new Set(before && before.dayStart === day.start
    ? entries.filter((e) => !before.ids.has(e.id)).map((e) => e.id)
    : []);
  shownEntries.set(list.id, { dayStart: day.start, ids: new Set(entries.map((e) => e.id)) });
  // Rebuilding replaces the note box, so remember whether it had focus and where the caret was.
  const active = document.activeElement;
  const typing = active && active.classList.contains("note-input") && list.contains(active)
    ? { start: active.selectionStart, end: active.selectionEnd }
    : null;
  list.replaceChildren(
    ...entries.map((e) => {
      const startMs = Date.parse(e.start);
      const endMs = Date.parse(e.end);
      const range = formatTime(startMs, day) + " – " + formatTime(endMs, day);

      const li = document.createElement("li");
      li.className = "entry" + (enteringIds.has(e.id) ? " is-entering" : "");
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
      del.addEventListener("click", () => animateOut(li, () => deleteEntry(e.id)));

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "edit-button";
      edit.textContent = "Edit";
      edit.setAttribute("aria-label", "Edit " + e.task + ", " + range);
      edit.addEventListener("click", () => openEditDialog(e));

      li.append(dot, task, time, duration, edit, del, makeNoteLine(e, list, range));
      return li;
    })
  );
  const input = list.querySelector(".note-input");
  if (input && (typing || noteEdit.focus)) {
    input.focus();
    if (typing) input.setSelectionRange(typing.start, typing.end);
    noteEdit.focus = false;
  }
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
  // The calendar follows the day shown.
  const d = new Date(historyDay().start);
  calendarMonth = { year: d.getFullYear(), month: d.getMonth() };
  renderCalendar();
  renderHistory();
}

// ---------- History calendar ----------

const monthPrev = document.getElementById("month-prev");
const monthNext = document.getElementById("month-next");
const monthTitle = document.getElementById("month-title");
const calendarDays = document.getElementById("calendar-days");
let calendarMonth = null; // { year, month } shown, month 0-11
let renderedCalendarKey = "";

// 4 shades by hours tracked: under 1h, 1-3h, 3-5h, 5h or more (0 = nothing).
function calendarLevel(seconds) {
  if (seconds <= 0) return 0;
  if (seconds < 3600) return 1;
  if (seconds < 3 * 3600) return 2;
  if (seconds < 5 * 3600) return 3;
  return 4;
}

// "2h 10m" (nearest minute) for the squares' screen-reader labels.
function formatHoursMinutes(seconds) {
  if (seconds > 0 && seconds < 30) return "under 1m";
  const minutes = Math.round(seconds / 60);
  return Math.floor(minutes / 60) + "h " + pad2(minutes % 60) + "m";
}

// Squares are rebuilt only when the month (or today) changes, so focus stays put.
function renderCalendar() {
  const todayStart = dayRange(Date.now()).start;
  const { year, month } = calendarMonth;
  const key = year + "-" + month + "|" + todayStart;
  if (key !== renderedCalendarKey) {
    renderedCalendarKey = key;
    monthTitle.textContent = new Date(year, month, 1).toLocaleDateString([], { month: "long", year: "numeric" });
    const now = new Date();
    monthNext.disabled = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth());

    const blanks = new Date(year, month, 1).getDay(); // the grid starts on Sunday
    const dayCount = new Date(year, month + 1, 0).getDate();
    const squares = [];
    for (let i = 0; i < blanks; i++) squares.push(document.createElement("span"));
    for (let date = 1; date <= dayCount; date++) {
      const day = dayRange(new Date(year, month, date).getTime());
      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-day";
      button.dataset.dayStart = day.start;
      button.textContent = date;
      if (day.start === todayStart) button.setAttribute("aria-current", "date");
      if (day.start > todayStart) button.disabled = true; // History only goes up to today
      button.addEventListener("click", () => showHistoryDay(dateKey(day.start)));
      squares.push(button);
    }
    calendarDays.replaceChildren(...squares);
  }
  updateCalendar();
}

// Shades and labels, from the same per-day totals as everything else.
function updateCalendar() {
  for (const button of calendarDays.querySelectorAll(".calendar-day")) {
    const start = Number(button.dataset.dayStart);
    const day = dayRange(start);
    const name = new Date(start).toLocaleDateString([], { month: "long", day: "numeric" });
    const selected = dateKey(start) === historyKey;
    button.classList.toggle("is-selected", selected);
    if (button.disabled) {
      button.dataset.level = "0";
      button.setAttribute("aria-label", name);
      continue;
    }
    const seconds = sumSeconds(dayTotals(day));
    button.dataset.level = String(calendarLevel(seconds));
    button.setAttribute("aria-label", name + ": " + formatHoursMinutes(seconds) + (selected ? ", shown below" : ""));
  }
}

function changeMonth(step) {
  calendarMonth = { year: calendarMonth.year, month: calendarMonth.month + step };
  const d = new Date(calendarMonth.year, calendarMonth.month, 1);
  calendarMonth = { year: d.getFullYear(), month: d.getMonth() };
  renderCalendar();
  // The next arrow turns off on the current month, so keep focus on a working button.
  if (monthNext.disabled && document.activeElement === monthNext) monthPrev.focus();
}

// History rows have no buttons, so they can be rebuilt every second without
// disturbing focus. Entries (which have delete buttons) are only rebuilt by renderHistory.
function renderHistoryRows() {
  const totals = dayTotals(historyDay());
  historyRows.replaceChildren(...byMostTime(totals).map((name) => makeTaskRow(name)));
  updateRowNumbers(historyRows, totals);
  showTotal(historyTotalText, sumSeconds(totals));
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

// "Today", or the day's date in the given toLocaleDateString style.
function weekDayLabel(day, todayStart, options) {
  return day.start === todayStart ? "Today" : new Date(day.start).toLocaleDateString([], options);
}

// Stacking order in every column: most time this week at the bottom.
let weekChartOrder = [];

// Columns and the legend are rebuilt only here (not every second), so a focused
// or open column stays that way while a timer runs. Oldest day on the left.
function renderWeekChart(data) {
  const todayStart = dayRange(Date.now()).start;
  weekChartOrder = byMostTime(data.byTask);
  weekChart.replaceChildren(
    ...data.days.map(({ day }) => {
      const li = document.createElement("li");
      li.className = "chart-day";
      li.dataset.dayStart = day.start;
      li.dataset.name = weekDayLabel(day, todayStart, { weekday: "long", month: "long", day: "numeric" });

      // The button holds the bar (hidden from screen readers) and a text version of the column.
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chart-column";
      const bar = document.createElement("div");
      bar.className = "chart-bar";
      bar.setAttribute("aria-hidden", "true");
      const text = document.createElement("span");
      text.className = "visually-hidden";
      button.append(bar, text);
      button.addEventListener("click", () => {
        const open = !li.classList.contains("is-open");
        closeChartTips();
        li.classList.toggle("is-open", open);
      });

      // The pop-up repeats the button's text visually, so screen readers skip it.
      const tip = document.createElement("div");
      tip.className = "chart-tip";
      tip.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.className = "chart-label";
      label.setAttribute("aria-hidden", "true");
      // "Today" doesn't fit under a column on a phone, so today is its weekday in bold.
      label.textContent = new Date(day.start).toLocaleDateString([], { weekday: "short" });
      li.classList.toggle("is-today", day.start === todayStart);

      for (const type of ["pointerenter", "focusin", "click"]) li.addEventListener(type, () => placeChartTip(li));
      li.append(button, tip, label);
      return li;
    })
  );
  weekLegend.replaceChildren(
    ...weekChartOrder.map((name) => {
      const li = document.createElement("li");
      li.style.setProperty("--task-color", taskColor(name));
      li.textContent = name;
      return li;
    })
  );
}

// Centres a pop-up over its column, but keeps it inside the chart's width so it
// never sticks out of the screen on a phone.
function placeChartTip(li) {
  const tip = li.querySelector(".chart-tip");
  const chart = weekChart.getBoundingClientRect();
  const column = li.getBoundingClientRect();
  tip.style.maxWidth = Math.min(chart.width, 240) + "px";
  tip.style.display = "block"; // measurable even if it isn't showing yet
  const width = tip.offsetWidth;
  tip.style.display = "";
  const wanted = column.left + column.width / 2 - width / 2;
  const left = Math.max(chart.left, Math.min(wanted, chart.right - width));
  tip.style.left = left - column.left + "px";
}

function closeChartTips() {
  for (const li of weekChart.children) li.classList.remove("is-open");
}

// Column heights are relative to the busiest day; each segment is one task's share.
// The numbers come from weekData(), the same split as the lists below.
function updateWeekChart(data) {
  weekChartBlock.hidden = data.byTask.size === 0;
  const totalsByDay = new Map(data.days.map(({ day, totals }) => [String(day.start), totals]));
  const busiest = Math.max(0, ...data.days.map(({ totals }) => sumSeconds(totals)));
  const rank = (name) => (weekChartOrder.includes(name) ? weekChartOrder.indexOf(name) : weekChartOrder.length);

  for (const li of weekChart.children) {
    const totals = totalsByDay.get(li.dataset.dayStart) || new Map();
    const total = sumSeconds(totals);
    const tasks = [...totals.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

    const bar = li.querySelector(".chart-bar");
    bar.style.height = (busiest > 0 ? (total / busiest) * 100 : 0) + "%";
    bar.replaceChildren(
      ...tasks.map((name) => {
        const segment = document.createElement("div");
        segment.className = "chart-segment";
        segment.style.setProperty("--task-color", taskColor(name));
        segment.style.height = (total > 0 ? (totals.get(name) / total) * 100 : 0) + "%";
        return segment;
      })
    );

    li.querySelector(".visually-hidden").textContent = li.dataset.name + ": " + formatSeconds(total) +
      (tasks.length ? ". " + tasks.map((name) => name + " " + formatSeconds(totals.get(name))).join(", ") : ", nothing tracked");

    const title = document.createElement("p");
    title.className = "chart-tip-title";
    const totalEl = document.createElement("span");
    totalEl.textContent = formatSeconds(total);
    title.append(li.dataset.name + " · ", totalEl);
    const rows = document.createElement("ul");
    // Biggest first in the pop-up, like the task rows.
    for (const name of byMostTime(totals)) {
      const row = document.createElement("li");
      row.style.setProperty("--task-color", taskColor(name));
      const nameEl = document.createElement("span");
      nameEl.textContent = name;
      const timeEl = document.createElement("span");
      timeEl.className = "chart-tip-time";
      timeEl.textContent = formatSeconds(totals.get(name));
      row.append(nameEl, timeEl);
      rows.append(row);
    }
    li.querySelector(".chart-tip").replaceChildren(title, ...(tasks.length ? [rows] : []));
  }
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
      label.textContent = weekDayLabel(day, todayStart, { weekday: "short", month: "short", day: "numeric" });
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
  showTotal(weekTotalText, sumSeconds(data.byTask));
  weekTasks.replaceChildren(...byMostTime(data.byTask).map((name) => makeTaskRow(name)));
  updateRowNumbers(weekTasks, data.byTask);
  weekEmpty.hidden = data.byTask.size > 0;
  updateWeekChart(data);
  updateBanner(data);
}

// ---------- Weekly Banner ----------
// Four slides: total (and change from the 7 days before), top task, longest single
// session, busiest day. All from dayTotals() / secondsOnDay(), like the rest of the tab.

const weekBanner = document.getElementById("week-banner");
const bannerTrack = document.getElementById("banner-track");
const bannerSlides = [...bannerTrack.children];
const bannerDots = [...weekBanner.querySelectorAll(".banner-dot")];
const bannerPrev = document.getElementById("banner-prev");
const bannerNext = document.getElementById("banner-next");
const bannerAnnounce = document.getElementById("banner-announce");
const bannerText = (id) => document.getElementById(id);
let bannerIndex = 0;

// The 7 days before the last 7 (8 to 14 days ago), oldest first.
function previousSevenDays() {
  return lastSevenDays().map((day) => {
    const d = new Date(day.start);
    return dayRange(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7).getTime());
  });
}

// The single entry (or the running timer) with the most time inside these days.
function longestSession(days) {
  const sessions = state.entries.map((e) => ({ task: e.task, start: Date.parse(e.start), end: Date.parse(e.end), running: false }));
  if (state.running) sessions.push({ task: state.running.task, start: Date.parse(state.running.start), end: Date.now(), running: true });
  let best = null;
  for (const s of sessions) {
    let seconds = 0;
    for (const day of days) seconds += secondsOnDay(s.start, s.end, day);
    if (seconds > 0 && (!best || seconds > best.seconds)) best = { ...s, seconds };
  }
  return best;
}

function updateBanner(data) {
  weekBanner.hidden = data.byTask.size === 0;
  if (weekBanner.hidden) return;
  const days = data.days.map((d) => d.day);

  // 1. Total, and the change from the 7 days before.
  const total = sumSeconds(data.byTask);
  const before = previousSevenDays().reduce((sum, day) => sum + sumSeconds(dayTotals(day)), 0);
  bannerText("banner-total").textContent = formatSeconds(total);
  const sub = bannerText("banner-total-sub");
  const diff = total - before;
  if (before === 0) sub.textContent = "Nothing tracked the 7 days before.";
  else if (diff === 0) sub.textContent = "The same as the 7 days before.";
  else {
    const arrow = document.createElement("span");
    arrow.className = diff > 0 ? "banner-up" : "";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = diff > 0 ? "▲ " : "▼ ";
    sub.replaceChildren(arrow, formatSeconds(Math.abs(diff)) + (diff > 0 ? " more" : " less") + " than the 7 days before");
  }

  // 2. Top task.
  const top = byMostTime(data.byTask)[0];
  const topEl = bannerText("banner-top");
  topEl.textContent = top;
  topEl.style.setProperty("--task-color", taskColor(top));
  bannerText("banner-top-sub").textContent = formatSeconds(data.byTask.get(top)) + " · " +
    Math.round((data.byTask.get(top) / Math.max(1, total)) * 100) + "% of the week";

  // 3. Longest single session (its part inside the 7 days). There may be none yet: a
  // timer started this second has less than half a second, which rounds to 0.
  const longest = longestSession(days);
  bannerText("banner-longest").textContent = formatSeconds(longest ? longest.seconds : 0);
  bannerText("banner-longest-sub").textContent = !longest ? "Nothing yet." : longest.task + " · " +
    new Date(longest.start).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + ", " +
    formatTime(longest.start, dayRange(longest.start)) + (longest.running ? " (still running)" : "");

  // 4. Busiest day (the most recent one if two tie).
  let busiest = data.days[0];
  for (const d of data.days) if (sumSeconds(d.totals) >= sumSeconds(busiest.totals)) busiest = d;
  const todayStart = dayRange(Date.now()).start;
  bannerText("banner-busiest").textContent = weekDayLabel(busiest.day, todayStart, { weekday: "long", month: "long", day: "numeric" });
  bannerText("banner-busiest-sub").textContent = formatSeconds(sumSeconds(busiest.totals)) + " tracked";
}

// Shows slide `index` (wrapping around). `announce` reads it out for screen readers.
function showSlide(index, announce) {
  bannerIndex = (index + bannerSlides.length) % bannerSlides.length;
  bannerTrack.style.transform = "translateX(" + -bannerIndex * 100 + "%)";
  bannerSlides.forEach((slide, i) => slide.setAttribute("aria-hidden", String(i !== bannerIndex)));
  bannerDots.forEach((dot, i) => dot.setAttribute("aria-current", String(i === bannerIndex)));
  if (announce) {
    const slide = bannerSlides[bannerIndex];
    bannerAnnounce.textContent = slide.getAttribute("aria-label") + ". " +
      [...slide.querySelectorAll("p")].map((p) => p.textContent).filter(Boolean).slice(1).join(". ");
  }
}

bannerPrev.addEventListener("click", () => showSlide(bannerIndex - 1, true));
bannerNext.addEventListener("click", () => showSlide(bannerIndex + 1, true));
bannerDots.forEach((dot, i) => dot.addEventListener("click", () => showSlide(i, true)));
// Arrow keys (and Home / End) move between slides while focus is in the banner.
weekBanner.addEventListener("keydown", (event) => {
  const next = { ArrowLeft: bannerIndex - 1, ArrowRight: bannerIndex + 1, Home: 0, End: bannerSlides.length - 1 }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  showSlide(next, true);
});
showSlide(0, false);

// ---------- Render ----------

// Numbers that change every second: the clock, totals, row times and bars.
// Rows with buttons only get new text and widths here, so focus isn't disturbed.
function renderLive(totals) {
  clock.textContent = formatClock(elapsedMs());
  updatePip();
  // The running timer in the browser tab's title, so it's visible from other tabs.
  document.title = state.running
    ? formatClock(elapsedMs()) + " · " + state.running.task + " – Time Tracker"
    : "Time Tracker";
  showTotal(todayTotalText, sumSeconds(totals));
  updateRowNumbers(taskRows, totals);
  updateTodayChart(totals);
  applyGoals(totals);
  applyPlans(totals);
  updatePixel();
  updateLongTimer();
  if (historyKey === dateKey(Date.now())) renderHistoryRows();
  updateCalendar();
  updateWeekNumbers(weekData());
}

function render() {
  if (state.running) {
    runningTaskText.textContent = "Tracking: " + state.running.task;
    timerCard.classList.add("is-running");
    stopButton.disabled = false;
  } else {
    runningTaskText.textContent = "Type what you're working on, then press Start.";
    timerCard.classList.remove("is-running");
    stopButton.disabled = true;
  }
  const day = dayRange(Date.now());
  const totals = dayTotals(day);
  const order = todayRowOrder(totals);

  // A note box whose entry was deleted (here or in another tab) is dropped.
  if (noteEdit && !state.entries.some((e) => e.id === noteEdit.id)) noteEdit = null;
  assignTaskColors();
  renderSuggestions();
  renderTaskRows(order);
  entriesEmpty.hidden = renderEntries(entryList, day) > 0;
  renderCalendar();
  renderHistory();
  const week = weekData();
  renderWeekDays(week);
  renderWeekChart(week);
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
let overlapConfirmed = ""; // the times the person already chose to keep despite an overlap

// Closes a window when you click the dark area around it. Such a click lands on the
// <dialog> element but outside its box. Both the press and the release must be outside,
// so dragging a text selection out of a box doesn't close it.
function closeOnBackdrop(dialog) {
  let pressedOutside = false;
  const outside = (event) => {
    const box = dialog.getBoundingClientRect();
    return event.target === dialog &&
      (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom);
  };
  dialog.addEventListener("pointerdown", (event) => { pressedOutside = outside(event); });
  dialog.addEventListener("click", (event) => {
    if (pressedOutside && outside(event)) dialog.close();
    pressedOutside = false;
  });
}

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
  overlapConfirmed = "";
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

  // Warn once if the new times overlap other time; pressing the button again keeps them.
  if (!(original && !timesChanged)) {
    const clash = findOverlap(startMs, endMs, editingId);
    const choice = startMs + "|" + endMs;
    if (clash && overlapConfirmed !== choice) {
      overlapConfirmed = choice;
      const day = dayRange(startMs);
      return fail(addStart, "This overlaps " + clash.task + " (" + formatTime(clash.start, day) + " – " +
        formatTime(clash.end, day) + "). Press " + addSave.textContent + " again to keep it anyway.");
    }
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
const shareDateInput = document.getElementById("share-date");
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

// " — note one; note two": the notes on a task's entries that day, oldest first
// and without repeats, or "" when there are none.
function taskNotes(day, task) {
  const notes = dayEntries(day).reverse().filter((e) => e.task === task && e.note).map((e) => e.note);
  const unique = [...new Set(notes)];
  return unique.length ? " — " + unique.join("; ") : "";
}

// Plain:    "Saturday, October 17: 2h 00m 00s" then "Coding: 1h 00m 00s" lines.
// YouTrack: "work 2026-10-17 1h30m Coding" lines (tasks under 30 seconds are left out,
//           because YouTrack can't log 0 minutes).
// Either way, a task's notes go at the end of its line.
function dayText(day, youtrack) {
  const totals = dayTotals(day);
  const tasks = byMostTime(totals);
  if (youtrack) {
    return tasks
      .filter((task) => Math.round(totals.get(task) / 60) > 0)
      .map((task) => "work " + dateKey(day.start) + " " + formatHm(Math.round(totals.get(task) / 60)) + " " + task + taskNotes(day, task))
      .join("\n");
  }
  if (tasks.length === 0) return "";
  const title = new Date(day.start).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  return [title + ": " + formatSeconds(sumSeconds(totals)), ...tasks.map((task) => task + ": " + formatSeconds(totals.get(task)) + taskNotes(day, task))].join("\n");
}

function resetCopy() {
  showFormMessage(copyMessage, "");
  copyFallback.hidden = true;
}

// The day to copy (Settings → Share). It starts as the day shown in History.
function shareDay() {
  return dayFromKey(shareDateInput.value) || historyDay();
}

async function copyDay() {
  resetCopy();
  const text = dayText(shareDay(), youtrackCheck.checked);
  if (!text) {
    const nothingTracked = dayTotals(shareDay()).size === 0;
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

  const rows = [`<row r="1">${textCell("A1", "Task", 3)}${textCell("B1", "Start", 3)}${textCell("C1", "End", 3)}${textCell("D1", "Duration", 3)}${textCell("E1", "Note", 3)}</row>`];
  let totalDays = 0;
  entries.forEach((e, i) => {
    const r = i + 2;
    const startMs = Date.parse(e.start);
    const endMs = Date.parse(e.end);
    const lengthDays = Math.round((endMs - startMs) / 1000) / 86400;
    totalDays += lengthDays;
    rows.push(`<row r="${r}">${textCell("A" + r, e.task)}${numberCell("B" + r, excelDate(startMs), 1)}` +
      `${numberCell("C" + r, excelDate(endMs), 1)}${numberCell("D" + r, lengthDays, 2)}` +
      `${e.note ? textCell("E" + r, e.note) : ""}</row>`);
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
<worksheet xmlns="${main}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="3" width="22" customWidth="1"/><col min="4" max="4" width="12" customWidth="1"/><col min="5" max="5" width="50" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData></worksheet>` },
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
const backupUndo = document.getElementById("backup-undo");
let restoreUndo = null; // what the Undo next to the restore message does
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
  const backup = { app: "time-tracker", version: 1, saved: new Date().toISOString(), entries: state.entries, plans };
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
  backupUndo.hidden = true; // a new restore replaces the last one's Undo
  restoreUndo = null;
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

  // Plans in the backup are added the same way: only for a date and task that has no plan
  // here yet, so a plan you've changed since isn't overwritten. (Older backups have none.)
  const plansBefore = JSON.parse(JSON.stringify(plans));
  let addedPlans = 0;
  for (const [date, day] of Object.entries(cleanPlans(data.plans))) {
    for (const [task, minutes] of Object.entries(day)) {
      if (plans[date] && plans[date][task]) continue;
      (plans[date] = plans[date] || {})[task] = minutes;
      addedPlans++;
    }
  }

  if (added.length === 0 && addedPlans === 0) {
    showFormMessage(backupMessage, incoming.length
      ? "Everything in that backup is already here. Nothing changed."
      : "That backup has no entries in it.");
    return;
  }
  const before = state.entries.slice();
  state.entries.push(...added);
  saveState();
  savePlans();
  render();
  const what = added.length + (added.length === 1 ? " entry" : " entries") +
    (addedPlans ? " and " + addedPlans + (addedPlans === 1 ? " plan" : " plans") : "");
  showFormMessage(backupMessage, "Restored " + what + " from the backup" +
    (incoming.length > added.length ? " (" + (incoming.length - added.length) + " entries were already here)." : "."));
  // Undo sits next to the message, inside the Settings window.
  restoreUndo = () => {
    state.entries = before;
    plans = plansBefore;
    saveState();
    savePlans();
    render();
    showFormMessage(backupMessage, "Restore undone.");
  };
  backupUndo.hidden = false;
}

// ---------- Daily goals on Today's rows ----------

// Tasks whose goal was already met at the last check; null until the first check, so
// goals that are met when the page opens don't count as "just met".
let metGoals = null;

// After the row times are filled in: "1h 05m 09s / 2h", and a ✓ once the goal is met.
function applyGoals(totals) {
  const nowMet = new Set();
  for (const li of taskRows.children) {
    const goal = goals[li.dataset.task];
    const met = Boolean(goal) && (totals.get(li.dataset.task) || 0) >= goal * 60;
    li.classList.toggle("goal-met", met);
    if (met) nowMet.add(li.dataset.task);
    if (!goal) continue;
    const time = li.querySelector(".task-time");
    time.textContent = (met ? "✓ " : "") + time.textContent + " / " + formatHm(goal);
  }
  if (metGoals && [...nowMet].some((task) => !metGoals.has(task))) pixelCelebrate();
  metGoals = nowMet;
}

// ---------- Today by task (ring chart) ----------
// The ring beside Today's rows: the same totals (dayTotals), in the same order (most time
// first) and colours, so the rows' colour stripes are its legend. Segments are updated in
// place every second, so they grow smoothly instead of being redrawn.

const todayChart = document.getElementById("today-chart");
const todayChartSegments = document.getElementById("today-chart-segments");
const todayChartLabel = document.getElementById("today-chart-label");
const todayChartTotal = document.getElementById("today-chart-total");
const RING_LENGTH = 2 * Math.PI * 70; // the ring's radius is 70 (index.html)
const SVG_NS = "http://www.w3.org/2000/svg";

function updateTodayChart(totals) {
  const total = sumSeconds(totals);
  todayChart.hidden = total === 0;
  todayChartTotal.textContent = formatSeconds(total);
  const tasks = byMostTime(totals).filter((task) => totals.get(task) > 0);
  const unused = new Map([...todayChartSegments.children].map((seg) => [seg.dataset.task, seg]));
  const described = [];
  let start = 0;
  tasks.forEach((task, i) => {
    let seg = unused.get(task);
    unused.delete(task);
    if (!seg) {
      seg = document.createElementNS(SVG_NS, "circle");
      seg.setAttribute("class", "today-chart-segment");
      seg.setAttribute("cx", "100");
      seg.setAttribute("cy", "100");
      seg.setAttribute("r", "70");
      seg.dataset.task = task;
    }
    // Keep the segments in row order (moving one only when the order changes).
    if (todayChartSegments.children[i] !== seg) todayChartSegments.insertBefore(seg, todayChartSegments.children[i] || null);
    const length = (totals.get(task) / total) * RING_LENGTH;
    const gap = tasks.length > 1 && length > 6 ? 2 : 0; // a hairline between segments
    seg.style.stroke = taskColor(task);
    seg.style.strokeDasharray = length - gap + " " + RING_LENGTH;
    seg.style.strokeDashoffset = String(-start);
    start += length;
    described.push(task + " " + formatSeconds(totals.get(task)) + " (" + Math.round((totals.get(task) / total) * 100) + "%)");
  });
  for (const seg of unused.values()) seg.remove();
  todayChartLabel.textContent = "Today by task: " + (described.join(", ") || "nothing yet");
}

// ---------- Today's plan on the rows ----------

// "40m", "1h", "1h 05m".
function formatPlanTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return m + "m";
  return h + "h" + (m ? " " + pad2(m) + "m" : "");
}

// After the row bars are filled in (share of today): rows with a plan switch to progress
// against it. Within a minute of the plan is "on track"; under is "40m to go"; over is
// "25m over", in red (going over is allowed, e.g. for gaming).
function applyPlans(totals) {
  const plan = todayPlan();
  for (const li of taskRows.children) {
    const status = li.querySelector(".plan-status");
    if (!status) continue; // dimmed rows have no bar
    const minutes = plan[li.dataset.task];
    li.classList.toggle("has-plan", Boolean(minutes));
    status.className = "plan-status";
    if (!minutes) {
      status.textContent = "";
      continue;
    }
    const planned = minutes * 60;
    const done = totals.get(li.dataset.task) || 0;
    const scale = Math.max(planned, done);
    li.querySelector(".plan-outline").style.width = (planned / scale) * 100 + "%";
    li.querySelector(".share-fill").style.width = (Math.min(done, planned) / scale) * 100 + "%";
    const over = li.querySelector(".share-over");
    over.style.left = (planned / scale) * 100 + "%";
    over.style.width = (Math.max(0, done - planned) / scale) * 100 + "%";
    if (Math.abs(done - planned) < 60) {
      status.textContent = "on track";
      status.classList.add("is-on-track");
    } else if (done < planned) {
      status.textContent = formatPlanTime(Math.ceil((planned - done) / 60)) + " to go";
    } else {
      status.textContent = formatPlanTime(Math.floor((done - planned) / 60)) + " over";
      status.classList.add("is-over");
    }
  }
}

// ---------- "Still working?" check ----------

const longTimer = document.getElementById("long-timer");
const longTimerText = document.getElementById("long-timer-text");
const longKeep = document.getElementById("long-keep");
const longStop = document.getElementById("long-stop");
let longSnooze = { start: null, until: 0 }; // "Keep going" pushes the next question back

function updateLongTimer() {
  const limit = settings.remindHours * 3600000;
  const elapsed = elapsedMs();
  const snoozed = state.running && longSnooze.start === state.running.start ? longSnooze.until : 0;
  const show = Boolean(state.running) && limit > 0 && elapsed >= Math.max(limit, snoozed);
  if (show && longTimer.hidden) {
    // Text is set once when it appears (not every second), so screen readers announce it once.
    longTimerText.textContent = state.running.task + " has been running for " +
      formatHm(Math.floor(elapsed / 60000)) + ". Still working?";
    longTimer.hidden = false;
  } else if (!show && !longTimer.hidden) {
    longTimer.hidden = true;
  }
}

function keepGoing() {
  const limit = settings.remindHours * 3600000;
  // Ask again after the next block of the same length (4h → 8h → 12h).
  longSnooze = { start: state.running.start, until: (Math.floor(elapsedMs() / limit) + 1) * limit };
  longTimer.hidden = true;
  stopButton.focus();
}

function stopFromCheck() {
  longTimer.hidden = true;
  stopTimer();
  setStatus(statusText.textContent + " If you stopped working earlier, fix the time with Edit.");
  taskInput.focus();
}

// ---------- Overlap warning ----------

// The first other entry (or the running timer) that overlaps [startMs, endMs].
function findOverlap(startMs, endMs, ignoreId) {
  for (const e of state.entries) {
    if (e.id === ignoreId) continue;
    if (Date.parse(e.start) < endMs && Date.parse(e.end) > startMs) {
      return { task: e.task, start: Date.parse(e.start), end: Date.parse(e.end) };
    }
  }
  if (state.running && Date.parse(state.running.start) < endMs && Date.now() > startMs) {
    return { task: state.running.task + " (running now)", start: Date.parse(state.running.start), end: Date.now() };
  }
  return null;
}

// ---------- Settings window ----------

const settingsDialog = document.getElementById("settings-dialog");
const settingsButton = document.getElementById("settings-button");
const settingsX = document.getElementById("settings-x");
const settingsSections = [...settingsDialog.querySelectorAll(".settings-section")];
const settingsLook = document.getElementById("settings-look");
const themeSelect = document.getElementById("theme-select");
const accentRadios = [...document.querySelectorAll('input[name="accent"]')];
const gradientRadios = [...document.querySelectorAll('input[name="gradient"]')];
const accentFieldset = document.getElementById("accent-fieldset");
const gradientFieldset = document.getElementById("gradient-fieldset");
const remindSelect = document.getElementById("long-timer-select");
const shortcutsCheck = document.getElementById("shortcuts-check");
const pixelCheck = document.getElementById("pixel-check");
const goalList = document.getElementById("goal-list");
const goalTask = document.getElementById("goal-task");
const goalHours = document.getElementById("goal-hours");
const goalMinutes = document.getElementById("goal-minutes");
const goalSave = document.getElementById("goal-save");
const goalMessage = document.getElementById("goal-message");
const renameFrom = document.getElementById("rename-from");
const renameTo = document.getElementById("rename-to");
const renameSave = document.getElementById("rename-save");
const renameMessage = document.getElementById("rename-message");
const renameUndo = document.getElementById("rename-undo");
let renameUndoState = null;

function openSettings() {
  themeSelect.value = settings.theme;
  for (const radio of accentRadios) radio.checked = radio.value === settings.accent;
  for (const radio of gradientRadios) radio.checked = radio.value === settings.gradient;
  remindSelect.value = String(settings.remindHours);
  shortcutsCheck.checked = settings.shortcuts;
  pixelCheck.checked = settings.pixel;
  shareDateInput.max = dateKey(Date.now());
  shareDateInput.value = historyKey;
  resetCopy();
  // Every time the window opens, only Look is unfolded.
  for (const section of settingsSections) section.open = section === settingsLook;
  settingsDialog.showModal();
  // The × rather than the theme box: a focused select shows its ring even after a tap.
  settingsX.focus();
}

function renderGoalList() {
  const names = Object.keys(goals).sort((a, b) => a.localeCompare(b));
  goalList.replaceChildren(...names.map((task) => {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = task + ": " + formatHm(goals[task]) + " a day";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "link-button";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", "Remove goal for " + task);
    remove.addEventListener("click", () => {
      delete goals[task];
      saveGoals();
      renderGoalList();
      render();
      showFormMessage(goalMessage, "Removed the goal for " + task + ".");
      goalTask.focus();
    });
    li.append(text, remove);
    return li;
  }));
}

function setGoal() {
  const task = goalTask.value.trim();
  const hours = wholeNumber(goalHours);
  const minutes = wholeNumber(goalMinutes);
  const fail = (field, text) => {
    showFormMessage(goalMessage, text, true);
    field.focus();
  };
  if (!task) return fail(goalTask, "Type the task the goal is for.");
  if (hours === null || minutes === null || minutes > 59) return fail(goalHours, "Use whole numbers: hours, and minutes from 0 to 59.");
  const total = hours * 60 + minutes;
  if (total === 0 || total > 24 * 60) return fail(goalHours, "A daily goal has to be between 1 minute and 24 hours.");
  goals[task] = total;
  saveGoals();
  renderGoalList();
  render();
  goalTask.value = "";
  showFormMessage(goalMessage, "Goal set: " + task + ", " + formatHm(total) + " a day.");
}

// Every task name in use: saved entries, the running timer, and goals.
function allTaskNames() {
  const names = taskSuggestions();
  if (state.running && !names.includes(state.running.task)) names.unshift(state.running.task);
  return names;
}

function renderRenameOptions(selected) {
  const names = allTaskNames();
  renameFrom.replaceChildren(...names.map((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    return option;
  }));
  if (names.length === 0) {
    const option = document.createElement("option");
    option.textContent = "No tasks yet";
    renameFrom.append(option);
  }
  renameFrom.disabled = names.length === 0;
  renameSave.disabled = names.length === 0;
  if (selected && names.includes(selected)) renameFrom.value = selected;
}

function renameTask() {
  const from = renameFrom.value;
  const to = renameTo.value.trim();
  renameUndo.hidden = true;
  const fail = (text) => {
    showFormMessage(renameMessage, text, true);
    renameTo.focus();
  };
  if (!to) return fail("Type the new name.");
  if (to === from) return fail("That's already its name.");

  const merging = allTaskNames().includes(to);
  renameUndoState = { entries: state.entries.map((e) => ({ ...e })), running: state.running && { ...state.running }, goals: { ...goals },
    plans: JSON.parse(JSON.stringify(plans)) };
  metGoals = null; // a renamed task meeting its goal isn't a new goal met
  let count = 0;
  for (const e of state.entries) {
    if (e.task === from) {
      e.task = to;
      count++;
    }
  }
  if (state.running && state.running.task === from) state.running.task = to;
  if (goals[from]) {
    if (!goals[to]) goals[to] = goals[from];
    delete goals[from];
  }
  // Plans move too; when merging, a day that already plans the new name keeps that plan.
  for (const day of Object.values(plans)) {
    if (!day[from]) continue;
    if (!day[to]) day[to] = day[from];
    delete day[from];
  }
  if (taskInput.value.trim() === from) taskInput.value = to;
  saveState();
  saveGoals();
  savePlans();
  render();
  renderRenameOptions(to);
  renameTo.value = "";
  const entries = count + (count === 1 ? " entry" : " entries");
  showFormMessage(renameMessage, merging ? "Merged “" + from + "” into “" + to + "” (" + entries + ")."
    : "Renamed “" + from + "” to “" + to + "” (" + entries + ").");
  renameUndo.hidden = false;
}

function undoRename() {
  if (!renameUndoState) return;
  state.entries = renameUndoState.entries;
  state.running = renameUndoState.running;
  goals = renameUndoState.goals;
  plans = renameUndoState.plans;
  renameUndoState = null;
  saveState();
  saveGoals();
  savePlans();
  render();
  renderRenameOptions();
  renameUndo.hidden = true;
  showFormMessage(renameMessage, "Rename undone.");
  renameFrom.focus();
}

// ---------- Keyboard shortcuts ----------

function onShortcut(event) {
  if (!settings.shortcuts || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if (document.querySelector("dialog[open]")) return;
  const target = event.target;
  if (target.closest && target.closest("input, textarea, select, [contenteditable]")) return;
  const key = event.key.toLowerCase();
  if (key === "s") {
    event.preventDefault();
    if (state.running) stopTimer();
    else startTimer(taskInput.value);
  } else if (key === "n") {
    event.preventDefault();
    taskInput.focus();
    taskInput.select();
  } else if (["1", "2", "3", "4"].includes(key)) {
    event.preventDefault();
    selectTab(tabs[Number(key) - 1], { focus: true });
  }
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
shareDateInput.addEventListener("change", resetCopy);
exportButton.addEventListener("click", exportExcel);
backupButton.addEventListener("click", downloadBackup);

settingsButton.addEventListener("click", openSettings);
settingsX.addEventListener("click", () => settingsDialog.close());
// Esc closes it by itself (built into <dialog>); clicking outside closes it too.
closeOnBackdrop(settingsDialog);
settingsDialog.addEventListener("close", () => settingsButton.focus());
themeSelect.addEventListener("change", () => {
  settings.theme = themeSelect.value;
  writeSetting(THEME_KEY, settings.theme);
  applyLook();
});
for (const radio of accentRadios) {
  radio.addEventListener("change", () => {
    settings.accent = radio.value;
    writeSetting(ACCENT_KEY, settings.accent);
    applyLook();
  });
}
for (const radio of gradientRadios) {
  radio.addEventListener("change", () => {
    settings.gradient = radio.value;
    writeSetting(GRADIENT_KEY, settings.gradient);
    applyLook();
  });
}
remindSelect.addEventListener("change", () => {
  settings.remindHours = Number(remindSelect.value);
  writeSetting(REMIND_KEY, remindSelect.value);
  updateLongTimer();
});
shortcutsCheck.addEventListener("change", () => {
  settings.shortcuts = shortcutsCheck.checked;
  writeSetting(SHORTCUTS_KEY, settings.shortcuts ? "on" : "off");
});
pixelCheck.addEventListener("change", () => {
  settings.pixel = pixelCheck.checked;
  writeSetting(PIXEL_KEY, settings.pixel ? "on" : "off");
  if (!settings.pixel) resetPixelPosition();
  updatePixel();
});
goalSave.addEventListener("click", setGoal);
renameSave.addEventListener("click", renameTask);
renameUndo.addEventListener("click", undoRename);
longKeep.addEventListener("click", keepGoing);
longStop.addEventListener("click", stopFromCheck);
document.addEventListener("keydown", onShortcut);
// A tapped-open chart column closes on a tap elsewhere or Esc.
document.addEventListener("click", (event) => {
  if (!weekChart.contains(event.target)) closeChartTips();
});
// Esc also hides a hover or focus pop-up until the pointer or focus leaves that column.
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeChartTips();
  for (const li of weekChart.querySelectorAll(".chart-day:hover, .chart-day:focus-within")) {
    li.classList.add("is-dismissed");
  }
});
for (const type of ["pointerleave", "focusout"]) {
  weekChart.addEventListener(type, (event) => {
    const li = event.target.closest && event.target.closest(".chart-day");
    if (li) li.classList.remove("is-dismissed");
  }, true);
}
restoreButton.addEventListener("click", () => restoreInput.click());
backupUndo.addEventListener("click", () => {
  if (restoreUndo) restoreUndo();
  restoreUndo = null;
  backupUndo.hidden = true;
  restoreButton.focus();
});
restoreInput.addEventListener("change", () => restoreBackup(restoreInput.files[0]));

monthPrev.addEventListener("click", () => changeMonth(-1));
monthNext.addEventListener("click", () => changeMonth(1));
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
  if ([THEME_KEY, ACCENT_KEY, GRADIENT_KEY, REMIND_KEY, SHORTCUTS_KEY, PIXEL_KEY].includes(event.key)) {
    settings = loadSettings();
    applyLook();
    updatePixel();
    return;
  }
  if (event.key === PLANS_KEY) {
    plans = loadPlans();
    if (planDialog.open) renderPlanList();
    render();
    return;
  }
  if (event.key === GOALS_KEY) {
    goals = loadGoals();
    renderGoalList();
    render();
    return;
  }
  if (event.key === TAB_KEY) return;
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  const wasRunning = state.running && state.running.task;
  state = loadState();
  // Keep the task box in step with a timer started or stopped in the other tab,
  // unless the person is typing in it.
  const nowRunning = state.running && state.running.task;
  if (nowRunning !== wasRunning && document.activeElement !== taskInput) taskInput.value = nowRunning || "";
  render();
});

// ---------- Plan my day window ----------

const planButton = document.getElementById("plan-button");
const planDialog = document.getElementById("plan-dialog");
const planX = document.getElementById("plan-x");
const planEmpty = document.getElementById("plan-empty");
const planList = document.getElementById("plan-list");
const planTask = document.getElementById("plan-task");
const planHours = document.getElementById("plan-hours");
const planMinutes = document.getElementById("plan-minutes");
const planSave = document.getElementById("plan-save");
const planMessage = document.getElementById("plan-message");

function openPlan() {
  showFormMessage(planMessage, "");
  renderPlanList();
  planDialog.showModal();
  planTask.focus();
}

function renderPlanList() {
  const plan = todayPlan();
  const names = Object.keys(plan).sort((a, b) => a.localeCompare(b));
  planEmpty.hidden = names.length > 0;
  planList.replaceChildren(...names.map((task) => {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = task + ": " + formatPlanTime(plan[task]);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "link-button";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", "Remove " + task + " from today's plan");
    remove.addEventListener("click", () => {
      const key = dateKey(Date.now());
      if (plans[key]) delete plans[key][task];
      if (plans[key] && Object.keys(plans[key]).length === 0) delete plans[key];
      savePlans();
      renderPlanList();
      render();
      showFormMessage(planMessage, "Removed " + task + " from today's plan.");
      planTask.focus();
    });
    li.append(text, remove);
    return li;
  }));
}

// Adds a task to today's plan, or changes its planned time.
function setPlan() {
  const task = planTask.value.trim();
  const hours = wholeNumber(planHours);
  const minutes = wholeNumber(planMinutes);
  const fail = (field, text) => {
    showFormMessage(planMessage, text, true);
    field.focus();
  };
  if (!task) return fail(planTask, "Type the task you're planning.");
  if (hours === null || minutes === null || minutes > 59) return fail(planHours, "Use whole numbers: hours, and minutes from 0 to 59.");
  const total = hours * 60 + minutes;
  if (total === 0 || total > 24 * 60) return fail(planHours, "A plan has to be between 1 minute and 24 hours.");
  const key = dateKey(Date.now());
  plans[key] = { ...plans[key], [task]: total };
  savePlans();
  renderPlanList();
  render();
  planTask.value = "";
  showFormMessage(planMessage, "Planned for today: " + task + ", " + formatPlanTime(total) + ".");
  planTask.focus();
}

planButton.addEventListener("click", openPlan);
planX.addEventListener("click", () => planDialog.close());
planSave.addEventListener("click", setPlan);
planTask.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    setPlan();
  }
});
closeOnBackdrop(planDialog);
planDialog.addEventListener("close", () => planButton.focus());

// ---------- Pixel, the companion robot ----------
// The portfolio's Pixel, at home in the timer card. His resting mood follows the timer
// (asleep with no timer, working while one runs). Poke him for a line; poke or toss him
// too often and his temper rises (the rage meter shows from "annoyed"). When it runs out
// he makes you play Stop the Clock. Looks and fun only: he never changes any data.

const pixelWrap = document.getElementById("pixel-wrap");
const pixelHome = document.getElementById("pixel-home");
const pixelButton = document.getElementById("pixel");
const pixelBubble = document.getElementById("pixel-bubble");
const pixelSaid = document.getElementById("pixel-said");
const pixelMeterFill = document.getElementById("pixel-meter-fill");
const pixelEyes = pixelButton.querySelector(".pix-eyes");
const PIXEL_HAPPY_MS = 3000;
const MOOD_WORDS = { asleep: "asleep", working: "working", norm: "awake", happy: "happy", mad: "mad", dizzy: "dizzy" };
const TEMPER_WORDS = ["calm", "annoyed", "grumpy", "angry", "furious"];
const TEMPER_BELOW = [25, 45, 65, 85, 101]; // anger (0-100) under each number is that stage
const POKE = 7; // about 15 quick pokes from calm to snapping
const THROW = 14; // plus more for a hard landing: about 4-5 rough throws
const HARD_LANDING = 10;

// Lines take turns instead of repeating. The throw lines come in three levels
// (cheerful, grumpy, angry), picked by his temper.
const PIXEL_LINES = {
  annoyed: ["Okay, you can stop now.", "I'm trying to keep time here.", "Poke count: too many."],
  grumpy: ["Seriously?", "Do I poke YOU while you work?", "I will remember this."],
  angry: ["HEY.", "Hands. Off.", "My shell is turning red. Your fault."],
  furious: ["ONE. MORE. TIME.", "I'm warning you.", "Last chance."],
  snap: ["THAT'S IT!", "You're playing my game."],
  calmDown: ["...Okay. I'm calm.", "Deep breaths. Fine. We're good."],
  wake: ["Huh? I'm up! I'm up!", "Wha—? I was resting my eyes."],
  excuse: ["Press Start and I'll get to work.", "No timer, no work. That's the deal."],
  launched: ["Wheee!", "Hey! Put me—", "NOT AGAIN!"],
  landed: ["Again! Again!", "That was... fine.", "Was that necessary?"],
  grabbed: ["Ooh, where are we going?", "Put me down!", "LET GO OF ME."],
  afterDizzy: ["Okay, that was fun-ish.", "Please don't do that again.", "I'm keeping score, you know."],
};
const lineTurns = {};

let pixelOverride = null; // { mood, until } shown on top of his resting mood
let pixelOverrideTimer = null;
let pixelBubbleTimer = null;
let pixelTyping = null;
let pixelLastLine = "";
let pixelBusy = false; // being dragged, flying or walking home
let pixelGame = false; // snapping, or Stop the Clock is open
let pixelAnger = 0;
let pixelLastProvoked = 0;
let pixelWasAngry = false;
let pixelWakeId = 0; // which wake-up a delayed line belongs to

function pixelRestingMood() {
  return state.running ? "working" : "asleep";
}

function pixelMood() {
  return pixelOverride && Date.now() < pixelOverride.until ? pixelOverride.mood : pixelRestingMood();
}

// Shows `mood` for `ms`, then he goes back to his resting mood.
function setPixelMood(mood, ms) {
  pixelOverride = { mood, until: Date.now() + ms };
  clearTimeout(pixelOverrideTimer);
  pixelOverrideTimer = setTimeout(updatePixel, ms + 20);
  updatePixel();
}

function temperStage() {
  return TEMPER_BELOW.findIndex((below) => pixelAnger < below);
}

// Cheap enough to call every second; only touches the page when something changed.
function updatePixel() {
  pixelWrap.hidden = !settings.pixel;
  const mood = pixelMood();
  const stage = temperStage();
  if (pixelButton.dataset.mood !== mood) pixelButton.dataset.mood = mood;
  pixelButton.dataset.anger = String(stage);
  pixelHome.dataset.anger = String(stage);
  pixelHome.classList.toggle("is-annoyed", stage >= 1);
  pixelMeterFill.style.width = pixelAnger + "%";
  const label = "Pixel, " + MOOD_WORDS[mood] + (stage >= 1 ? ", " + TEMPER_WORDS[stage] : "") + ". Press for a message.";
  if (pixelButton.getAttribute("aria-label") !== label) pixelButton.setAttribute("aria-label", label);
}

// A daily goal was just met: a few happy hops.
function pixelCelebrate() {
  setPixelMood("happy", PIXEL_HAPPY_MS);
}

function nextLine(key) {
  const list = PIXEL_LINES[key];
  lineTurns[key] = ((lineTurns[key] === undefined ? -1 : lineTurns[key]) + 1) % list.length;
  return list[lineTurns[key]];
}

function tierLine(key) {
  const stage = temperStage();
  return PIXEL_LINES[key][stage <= 1 ? 0 : stage <= 2 ? 1 : 2];
}

// What he says when he's calm, depending on what's happening.
function pixelChatLines() {
  if (state.running) {
    const task = state.running.task;
    const lines = [
      "Still on " + task + "? Nice.",
      formatClock(elapsedMs()) + " of " + task + " so far.",
      "Typing as fast as I can.",
      "You've got this.",
      "Remember to blink. I do.",
    ];
    const goal = goals[task];
    const done = dayTotals(dayRange(Date.now())).get(task) || 0;
    if (goal && done < goal * 60) lines.push(formatHm(Math.ceil((goal * 60 - done) / 60)) + " to go for your " + task + " goal.");
    return lines;
  }
  return [
    "Today so far: " + formatSeconds(sumSeconds(dayTotals(dayRange(Date.now())))) + ".",
    "Five more minutes…",
    "Dreaming of tidy timesheets.",
  ];
}

// A line in his bubble, typed out letter by letter. Screen readers get the whole line at
// once from a hidden copy.
function pixelSay(line, ms) {
  clearTimeout(pixelBubbleTimer);
  clearInterval(pixelTyping);
  pixelSaid.textContent = line;
  pixelBubble.classList.add("is-showing");
  if (reducedMotion()) {
    pixelBubble.textContent = line;
  } else {
    let n = 0;
    pixelBubble.textContent = "";
    pixelTyping = setInterval(() => {
      n++;
      pixelBubble.textContent = line.slice(0, n);
      if (n >= line.length) clearInterval(pixelTyping);
    }, 20);
  }
  pixelBubbleTimer = setTimeout(() => {
    pixelBubble.classList.remove("is-showing");
    pixelBubbleTimer = setTimeout(() => { pixelBubble.textContent = ""; }, 250); // after the fade
  }, ms || 3200);
}

// Restarts a one-time animation (a hop or a shake).
function pixelFx(cls, ms) {
  pixelButton.classList.remove(cls);
  void pixelButton.offsetWidth;
  pixelButton.classList.add(cls);
  setTimeout(() => pixelButton.classList.remove(cls), ms);
}

function pixelSteam() {
  if (reducedMotion()) return;
  [8, 34].forEach((left, i) => {
    setTimeout(() => {
      const puff = document.createElement("span");
      puff.className = "pixel-steam";
      puff.setAttribute("aria-hidden", "true");
      puff.style.left = left + "px";
      pixelHome.append(puff);
      setTimeout(() => puff.remove(), 1000);
    }, i * 120);
  });
}

// ----- his temper -----

function provoke(points) {
  pixelAnger = Math.min(100, pixelAnger + points);
  pixelLastProvoked = Date.now();
  if (temperStage() >= 3) pixelWasAngry = true;
  updatePixel();
}

// Cooling off: after three quiet seconds the meter drains, and once he's calm again after
// being properly angry, he says so.
setInterval(() => {
  if (pixelBusy) pixelLastProvoked = Date.now();
  if (pixelAnger <= 0 || pixelGame || Date.now() - pixelLastProvoked < 3000) return;
  pixelAnger = Math.max(0, pixelAnger - 3);
  updatePixel();
  if (pixelWasAngry && pixelAnger < TEMPER_BELOW[0]) {
    pixelWasAngry = false;
    setPixelMood("happy", 2800);
    pixelSay(nextLine("calmDown"), 2800);
  }
}, 500);

// The meter is full: he snaps, then starts his game.
function pixelSnap() {
  pixelGame = true;
  setPixelMood("mad", 4000);
  pixelFx("is-shaking", 650);
  pixelSteam();
  pixelSay(PIXEL_LINES.snap[0], 1500);
  setTimeout(() => {
    pixelSay(PIXEL_LINES.snap[1], 1500);
    setTimeout(startClockGame, 1300);
  }, 1400);
}

function pokePixel() {
  if (pixelBusy || pixelGame) return;
  // Asleep: poking wakes him up (that doesn't count against you).
  if (pixelMood() === "asleep") {
    const wakeId = ++pixelWakeId;
    setPixelMood("dizzy", 1300);
    pixelFx("is-hopping", 500);
    pixelSay(nextLine("wake"), 1100);
    setTimeout(() => {
      if (wakeId !== pixelWakeId || pixelBusy || pixelGame) return; // something else happened since
      setPixelMood("norm", 5000);
      pixelSay(nextLine("excuse"), 2800);
    }, 1100);
    return;
  }
  provoke(POKE);
  if (pixelAnger >= 100) {
    pixelSnap();
    return;
  }
  const stage = temperStage();
  if (stage === 0) {
    const lines = pixelChatLines().filter((line) => line !== pixelLastLine);
    pixelLastLine = lines[Math.floor(Math.random() * lines.length)];
    setPixelMood("happy", 1500);
    pixelSay(pixelLastLine, 3200);
    return;
  }
  setPixelMood(stage >= 3 ? "mad" : "norm", 2600);
  pixelSay(nextLine(TEMPER_WORDS[stage]), 2600);
  pixelFx(stage >= 2 ? "is-shaking" : "is-hopping", stage >= 2 ? 650 : 500);
  if (stage >= 4) pixelSteam();
}

// ----- tossing him around -----
// #pixel-home moves by --tx / --ty from his spot and the drawing tilts by --tr. A drag
// starts after the pointer moves 8px, so a plain click is still a poke. Not with
// reduced motion.

let pixelDrag = null;
let pixelDragged = false;
let pixelFlight = null;
let pixelWalkTimer = null;
let pixelTrail = [];

function pixelOffset() {
  return {
    x: parseFloat(pixelHome.style.getPropertyValue("--tx")) || 0,
    y: parseFloat(pixelHome.style.getPropertyValue("--ty")) || 0,
  };
}

// His corner spot on screen. It's fixed, so it's measured once (and again after a resize)
// instead of on every pointer move.
let pixelSpotRect = null;

function pixelSpot() {
  if (!pixelSpotRect) pixelSpotRect = pixelWrap.getBoundingClientRect();
  return pixelSpotRect;
}

function setPixelOffset(x, y, rot) {
  pixelHome.style.setProperty("--tx", x + "px");
  pixelHome.style.setProperty("--ty", y + "px");
  pixelButton.style.setProperty("--tr", (rot || 0) + "deg");
  // Near the right edge his bubble opens to his left instead.
  const spot = pixelSpot();
  pixelHome.classList.toggle("say-left", spot.left + x + spot.width / 2 > document.documentElement.clientWidth - 260);
}

// How far he can go from his spot before hitting the window's edges.
function pixelLimits() {
  const r = pixelSpot();
  const w = document.documentElement.clientWidth;
  return { minX: -r.left, maxX: w - r.width - r.left, minY: -r.top, maxY: window.innerHeight - r.height - r.top - 4 };
}

function stopPixelThrow() {
  cancelAnimationFrame(pixelFlight);
  pixelFlight = null;
  clearTimeout(pixelWalkTimer);
  pixelDrag = null;
  pixelButton.classList.remove("is-dragging");
}

// Back to his spot (a short walk), then he's on the page as usual again.
function pixelWalkHome() {
  pixelBusy = true;
  pixelHome.classList.add("is-walking");
  setPixelOffset(0, 0, 0);
  pixelWalkTimer = setTimeout(() => {
    pixelHome.classList.remove("is-walking", "is-moving", "say-left");
    pixelBusy = false;
    updatePixel();
  }, 950);
}

function pixelFly(vx, vy) {
  let { x, y } = pixelOffset();
  let rot = 0;
  let spin = vx * 0.5;
  let last = performance.now();
  let hard = false;
  const GRAVITY = 1800;
  pixelHome.classList.add("is-moving");
  provoke(THROW);
  setPixelMood(temperStage() >= 3 ? "mad" : "happy", 60000);
  pixelSay(tierLine("launched"), 1500);

  function step(t) {
    const dt = Math.min(0.033, (t - last) / 1000);
    last = t;
    let hit = 0;
    const lim = pixelLimits(); // every frame, in case the window changes size mid-flight
    vy += GRAVITY * dt;
    x += vx * dt;
    y += vy * dt;
    rot += spin * dt;
    if (x < lim.minX) { x = lim.minX; hit = Math.abs(vx); vx = -vx * 0.62; spin = -spin * 0.6; }
    if (x > lim.maxX) { x = lim.maxX; hit = Math.abs(vx); vx = -vx * 0.62; spin = -spin * 0.6; }
    if (y < lim.minY) { y = lim.minY; hit = Math.max(hit, Math.abs(vy)); vy = -vy * 0.6; }
    if (y > lim.maxY) {
      y = lim.maxY;
      hit = Math.max(hit, Math.abs(vy));
      vy = -vy * 0.5;
      vx *= 0.82;
      spin *= 0.7;
      if (Math.abs(vy) < 60) vy = 0;
    }
    if (hit > 1100 && !hard) {
      hard = true;
      setPixelMood("dizzy", 60000);
      pixelSay("Ow!", 1200);
    }
    const resting = y >= lim.maxY - 0.5 && vy === 0;
    if (resting) {
      vx *= 0.9;
      rot *= 0.85;
      spin = 0;
    }
    setPixelOffset(x, y, rot);
    if (resting && Math.abs(vx) < 8 && Math.abs(rot) < 1) {
      setPixelOffset(x, y, 0);
      pixelFlight = null;
      pixelLand(hard);
      return;
    }
    pixelFlight = requestAnimationFrame(step);
  }
  pixelFlight = requestAnimationFrame(step);
}

function pixelLand(hard) {
  if (hard) provoke(HARD_LANDING);
  // Thrown one time too many: he snaps once he's back in his spot.
  if (pixelAnger >= 100) {
    pixelGame = true;
    setPixelMood("mad", 6000);
    pixelSay(PIXEL_LINES.snap[0], 1500);
    pixelWalkTimer = setTimeout(() => {
      pixelWalkHome();
      setTimeout(() => {
        pixelSay(PIXEL_LINES.snap[1], 1500);
        setTimeout(startClockGame, 1300);
      }, 1000);
    }, 1400);
    return;
  }
  const angry = temperStage() >= 3;
  if (hard) {
    setPixelMood("dizzy", 1800);
    pixelSay("The room is spinning…", 1800);
    pixelWalkTimer = setTimeout(() => {
      setPixelMood(angry ? "mad" : "norm", 2400);
      pixelSay(tierLine("afterDizzy"), 2400);
      pixelWalkTimer = setTimeout(pixelWalkHome, 1800);
    }, 1800);
  } else {
    setPixelMood(angry ? "mad" : temperStage() >= 1 ? "norm" : "happy", 2000);
    pixelSay(tierLine("landed"), 2000);
    pixelWalkTimer = setTimeout(pixelWalkHome, 2000);
  }
}

function onPixelDragMove(event) {
  if (!pixelDrag || event.pointerId !== pixelDrag.id) return;
  const dx = event.clientX - pixelDrag.x;
  const dy = event.clientY - pixelDrag.y;
  if (!pixelDrag.moving) {
    if (Math.hypot(dx, dy) < 8) return;
    pixelDrag.moving = true;
    pixelDragged = true;
    pixelBusy = true;
    cancelAnimationFrame(pixelFlight);
    clearTimeout(pixelWalkTimer);
    pixelHome.classList.remove("is-walking");
    pixelHome.classList.add("is-moving");
    pixelButton.setPointerCapture(event.pointerId);
    pixelButton.classList.add("is-dragging");
    setPixelMood(temperStage() >= 3 ? "mad" : "dizzy", 60000);
    pixelSay(tierLine("grabbed"), 2000);
  }
  const lim = pixelLimits();
  const x = Math.max(lim.minX, Math.min(lim.maxX, pixelDrag.startX + dx));
  const y = Math.max(lim.minY, Math.min(lim.maxY, pixelDrag.startY + dy));
  const tilt = Math.max(-25, Math.min(25, (event.movementX || 0) * 2));
  pixelDrag.tilt = pixelDrag.tilt * 0.75 + tilt * 0.25; // eased, so he sways instead of twitching
  setPixelOffset(x, y, pixelDrag.tilt);
  pixelTrail.push({ x: event.clientX, y: event.clientY, t: performance.now() });
  if (pixelTrail.length > 6) pixelTrail.shift();
}

function onPixelRelease(event) {
  if (!pixelDrag || (event && event.pointerId !== pixelDrag.id)) return;
  window.removeEventListener("pointermove", onPixelDragMove);
  window.removeEventListener("pointerup", onPixelRelease);
  window.removeEventListener("pointercancel", onPixelRelease);
  const wasMoving = pixelDrag.moving;
  pixelDrag = null;
  if (!wasMoving) return;
  pixelButton.classList.remove("is-dragging");
  // Letting go over a button shouldn't press it.
  const swallow = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => {
    window.removeEventListener("click", swallow, { capture: true });
    pixelDragged = false;
  }, 80);
  const a = pixelTrail[0];
  const b = pixelTrail[pixelTrail.length - 1];
  const dt = Math.max(16, b.t - a.t) / 1000;
  const cap = 2600;
  pixelFly(Math.max(-cap, Math.min(cap, (b.x - a.x) / dt)), Math.max(-cap, Math.min(cap, (b.y - a.y) / dt)));
}

pixelButton.addEventListener("pointerdown", (event) => {
  if (reducedMotion() || pixelGame || event.button > 0 || pixelHome.classList.contains("is-walking")) return;
  const { x, y } = pixelOffset();
  pixelDrag = { x: event.clientX, y: event.clientY, startX: x, startY: y, id: event.pointerId, moving: false, tilt: 0 };
  pixelDragged = false;
  pixelTrail = [{ x: event.clientX, y: event.clientY, t: performance.now() }];
  // Follow the pointer anywhere on the page: a quick flick can leave him behind.
  window.addEventListener("pointermove", onPixelDragMove);
  window.addEventListener("pointerup", onPixelRelease);
  window.addEventListener("pointercancel", onPixelRelease);
});

pixelButton.addEventListener("click", () => {
  if (pixelDragged) {
    pixelDragged = false; // the click that ends a drag isn't a poke
    return;
  }
  pokePixel();
});

// Keep him on screen if the window changes size while he's away from his spot.
window.addEventListener("resize", () => {
  pixelSpotRect = null;
  const { x, y } = pixelOffset();
  if (!pixelBusy && (x !== 0 || y !== 0)) pixelWalkHome();
});

// Hidden from Settings: back to his spot, no throw in progress.
function resetPixelPosition() {
  stopPixelThrow();
  pixelHome.classList.remove("is-walking", "is-moving", "say-left");
  setPixelOffset(0, 0, 0);
  pixelBusy = false;
}

// His eyes follow the mouse (mouse and trackpad only, with motion on).
if (window.matchMedia("(pointer: fine)").matches) {
  let pointer = null;
  let eyeFrame = null;
  window.addEventListener("pointermove", (event) => {
    pointer = event;
    if (eyeFrame || reducedMotion() || pixelWrap.hidden) return;
    eyeFrame = requestAnimationFrame(() => {
      eyeFrame = null;
      const r = pixelButton.getBoundingClientRect();
      const dx = pointer.clientX - (r.left + r.width / 2);
      const dy = pointer.clientY - (r.top + r.height / 2 - 3);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 140);
      pixelEyes.style.transform = "translate(" + ((dx / d) * 3.2 * k).toFixed(2) + "px," + ((dy / d) * 2.2 * k).toFixed(2) + "px)";
    });
  }, { passive: true });
}

// ---------- Pixel's game: Stop the Clock ----------
// Stop a stopwatch on exactly 5.00 seconds (to the hundredth shown). Within 0.10 on 2 of
// 3 tries and he calms right down. Try 3 goes dark: the numbers vanish after 2 seconds.
// Esc or Give up always closes it (he sulks a bit).

const clockGame = document.getElementById("clock-game");
const gameButton = document.getElementById("game-button");
const gameQuit = document.getElementById("game-quit");
const gameClock = document.getElementById("game-clock");
const gameTry = document.getElementById("game-try");
const gameTries = document.getElementById("game-tries");
const gameSay = document.getElementById("game-say");
const gameRingFill = document.getElementById("game-ring-fill");
const GAME_TARGET = 5;
const GAME_WINDOW = 0.1;
const GAME_TRIES = 3;
const GAME_DARK_AFTER = 2;
const GAME_RING = 2 * Math.PI * 86;
let clockRound = null; // { tries: [{ time, hit }], phase: "ready" | "running" | "done", startedAt, frame, won }

function renderGameTries() {
  gameTries.replaceChildren(...Array.from({ length: GAME_TRIES }, (_, i) => {
    const li = document.createElement("li");
    const result = clockRound.tries[i];
    const label = document.createTextNode("Try " + (i + 1) + (i === GAME_TRIES - 1 ? " · dark" : ""));
    const value = document.createElement("strong");
    value.textContent = result ? result.time.toFixed(2) : "–.––";
    li.append(label, value);
    if (result) {
      li.className = result.hit ? "is-hit" : "is-miss";
      const off = document.createElement("span");
      off.textContent = (result.hit ? "✓ " : "✗ ") + Math.abs(result.time - GAME_TARGET).toFixed(2) + " off";
      li.append(off);
    }
    return li;
  }));
}

function resetClockRound() {
  cancelAnimationFrame(clockRound && clockRound.frame);
  clockRound = { tries: [], phase: "ready", startedAt: 0, frame: null, won: false };
  clockGame.classList.remove("is-calm");
  gameClock.textContent = "0.00";
  gameRingFill.style.strokeDasharray = "0 " + GAME_RING;
  gameTry.textContent = "Try 1 of " + GAME_TRIES;
  gameButton.textContent = "Start";
  gameSay.textContent = "Tick tock. I'm watching.";
  renderGameTries();
}

function startClockGame() {
  pixelGame = true;
  resetClockRound();
  clockGame.showModal();
  gameButton.focus();
}

function gameTick() {
  const seconds = (performance.now() - clockRound.startedAt) / 1000;
  const dark = clockRound.tries.length === GAME_TRIES - 1 && seconds >= GAME_DARK_AFTER;
  gameClock.textContent = dark ? "?.??" : seconds.toFixed(2);
  if (!reducedMotion()) gameRingFill.style.strokeDasharray = Math.min(1, seconds / GAME_TARGET) * GAME_RING + " " + GAME_RING;
  clockRound.frame = requestAnimationFrame(gameTick);
}

function finishClockRound(won) {
  clockRound.phase = "done";
  clockRound.won = won;
  if (won) {
    clockGame.classList.add("is-calm");
    gameSay.textContent = "Okay, okay. Good timing. I'm calm now.";
    gameButton.textContent = "Done";
  } else {
    gameSay.textContent = "Ha! Two misses. Again!";
    gameButton.textContent = "Try again";
  }
}

gameButton.addEventListener("click", (event) => {
  // event.timeStamp is when the button was pressed, on the same clock as performance.now().
  if (clockRound.phase === "ready") {
    clockRound.phase = "running";
    clockRound.startedAt = event.timeStamp || performance.now();
    gameTry.textContent = "Try " + (clockRound.tries.length + 1) + " of " + GAME_TRIES;
    gameButton.textContent = "Stop";
    gameTick();
    return;
  }
  if (clockRound.phase === "running") {
    cancelAnimationFrame(clockRound.frame);
    const time = Math.round(((event.timeStamp || performance.now()) - clockRound.startedAt) / 10) / 100; // to the hundredth shown
    const hit = Math.abs(time - GAME_TARGET) <= GAME_WINDOW + 1e-9;
    clockRound.tries.push({ time, hit });
    gameClock.textContent = time.toFixed(2);
    gameRingFill.style.strokeDasharray = Math.min(1, time / GAME_TARGET) * GAME_RING + " " + GAME_RING;
    renderGameTries();
    const hits = clockRound.tries.filter((t) => t.hit).length;
    const misses = clockRound.tries.length - hits;
    if (hits >= 2) return finishClockRound(true);
    if (misses >= 2) return finishClockRound(false);
    clockRound.phase = "ready";
    gameButton.textContent = "Start try " + (clockRound.tries.length + 1);
    gameSay.textContent = hit ? "Lucky." : "Ha! Missed by " + Math.abs(time - GAME_TARGET).toFixed(2) + ".";
    return;
  }
  if (clockRound.won) clockGame.close();
  else resetClockRound();
});

gameQuit.addEventListener("click", () => clockGame.close());

// However it closes (Done, Give up, Esc): winning calms him right down; giving up leaves
// him grumpy but done with the game.
clockGame.addEventListener("close", () => {
  cancelAnimationFrame(clockRound.frame);
  pixelGame = false;
  pixelWasAngry = false;
  if (clockRound.won) {
    pixelAnger = 0;
    setPixelMood("happy", 3000);
    pixelSay("Good game. We're cool.", 3000);
  } else {
    pixelAnger = TEMPER_BELOW[1];
    setPixelMood("norm", 3000);
    pixelSay("Fine. Be that way.", 3000);
  }
  pixelLastProvoked = Date.now();
  updatePixel();
  if (!pixelWrap.hidden) pixelButton.focus();
});

// ---------- Pixel's tour ----------
// Six quick steps, shown once (timeTracker.tour = "done" afterwards) and again from
// Settings → Help. A spotlight dims everything but the part being explained; Pixel's card
// sits beside it. Esc or "Skip tour" ends it at any point.

const TOUR_KEY = "timeTracker.tour";
const tour = document.getElementById("tour");
const tourSpot = document.getElementById("tour-spot");
const tourCard = document.getElementById("tour-card");
const tourTitle = document.getElementById("tour-title");
const tourText = document.getElementById("tour-text");
const tourDots = document.getElementById("tour-dots");
const tourBack = document.getElementById("tour-back");
const tourNext = document.getElementById("tour-next");
const tourSkip = document.getElementById("tour-skip");
const TOUR_STEPS = [
  { target: "#timer-form", title: "Start a timer",
    text: "Hi, I'm Pixel! Type what you're working on here, then press Start. I'll keep the time, even if you close the tab." },
  { tab: "tab-today", target: ".today-overview", title: "Today",
    text: "Everything you did today. The ring shows how the day splits up, and each row has ▶ to pick a task back up." },
  { tab: "tab-today", target: "#plan-button", title: "Plan my day",
    text: "Got a plan? Set how long you want to spend on each task today, and the rows show how you're doing." },
  { tab: "tab-today", target: "#add-today-button", title: "Entries",
    text: "Forgot to start the timer? Add the time here. Every entry can be edited, deleted (with Undo) or given a short note." },
  { target: ".tabs", title: "History, Week and Tasks",
    text: "History has a calendar of past days, Week sums up the last 7 days, and Tasks is where you set daily goals and rename tasks." },
  { target: "#settings-button", title: "Settings",
    text: "Themes, sharing, backups and reminders live in Settings. And me? Poke me, toss me around… just not too much." },
];
let tourIndex = 0;

function startTour() {
  tourIndex = 0;
  if (!tour.open) tour.showModal();
  showTourStep();
  tourNext.focus();
}

function showTourStep() {
  const step = TOUR_STEPS[tourIndex];
  if (step.tab) selectTab(document.getElementById(step.tab));
  tourTitle.textContent = "Step " + (tourIndex + 1) + " of " + TOUR_STEPS.length + " · " + step.title;
  tourText.textContent = step.text;
  tourDots.replaceChildren(...TOUR_STEPS.map((_, i) => {
    const dot = document.createElement("i");
    if (i === tourIndex) dot.className = "is-current";
    return dot;
  }));
  tourBack.disabled = tourIndex === 0;
  tourNext.textContent = tourIndex === TOUR_STEPS.length - 1 ? "Done" : "Next";
  const target = document.querySelector(step.target);
  if (target) target.scrollIntoView({ block: "center" });
  placeTour(true);
}

// The spotlight goes around the step's target; the card goes beside it (right, left,
// below or above, whichever has room), always inside the window.
// `canScroll`: if the card can't fit beside, below or above without covering the target
// (short phone screens), scroll the target up near the top and put the card under it.
function placeTour(canScroll) {
  if (!tour.open) return;
  const target = document.querySelector(TOUR_STEPS[tourIndex].target);
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const pad = 8;
  const r = target ? target.getBoundingClientRect() : { left: vw / 2, top: vh / 2, right: vw / 2, bottom: vh / 2, width: 0, height: 0 };
  tourSpot.style.left = r.left - pad + "px";
  tourSpot.style.top = r.top - pad + "px";
  tourSpot.style.width = r.width + pad * 2 + "px";
  tourSpot.style.height = r.height + pad * 2 + "px";
  const card = tourCard.getBoundingClientRect();
  const gap = 18;
  let left;
  let top;
  if (vw - r.right - pad >= card.width + gap + 16) {
    left = r.right + pad + gap;
    top = r.top;
  } else if (r.left - pad >= card.width + gap + 16) {
    left = r.left - pad - gap - card.width;
    top = r.top;
  } else {
    left = r.left + r.width / 2 - card.width / 2;
    const below = vh - r.bottom - pad >= card.height + gap + 16;
    const above = r.top - pad >= card.height + gap + 16;
    if (!below && !above && canScroll === true && target) {
      window.scrollBy(0, r.top - pad - 16);
      placeTour(false);
      return;
    }
    top = below || !above ? r.bottom + pad + gap : r.top - pad - gap - card.height;
  }
  tourCard.style.left = Math.max(16, Math.min(left, vw - card.width - 16)) + "px";
  tourCard.style.top = Math.max(16, Math.min(top, vh - card.height - 16)) + "px";
}

function endTour() {
  if (tour.open) tour.close();
}

tourNext.addEventListener("click", () => {
  if (tourIndex === TOUR_STEPS.length - 1) {
    endTour();
    return;
  }
  tourIndex++;
  showTourStep();
});
tourBack.addEventListener("click", () => {
  tourIndex = Math.max(0, tourIndex - 1);
  showTourStep();
  if (tourBack.disabled) tourNext.focus();
});
tourSkip.addEventListener("click", endTour);
// However it ends (Done, Skip, Esc), it's done: it won't come back by itself.
tour.addEventListener("close", () => {
  writeSetting(TOUR_KEY, "done");
  window.scrollTo(0, 0);
  if (settings.pixel) {
    setPixelMood("happy", 2800);
    pixelSay("Have fun! I'll be right here.", 2800);
  }
  taskInput.focus();
});
window.addEventListener("resize", () => placeTour(false));
window.addEventListener("scroll", () => placeTour(false), { passive: true });
document.getElementById("tour-again").addEventListener("click", () => {
  settingsDialog.close();
  startTour();
});

// ---------- Glass light (Launcher) ----------
// The soft light over task rows and entry cards follows the mouse (styles.css draws it).
document.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "mouse" || document.documentElement.dataset.theme !== "launcher") return;
  const card = event.target.closest && event.target.closest(".task-row, .entry");
  if (!card) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty("--gx", event.clientX - r.left + "px");
  card.style.setProperty("--gy", event.clientY - r.top + "px");
}, { passive: true });

// ---------- Pop-out timer ----------
// A small always-on-top window (Document Picture-in-Picture, Chrome and Edge only).
// It runs this page's code, so its Stop button really stops the timer. Closing it
// only closes it.

const popOutButton = document.getElementById("pop-out-button");
let pipWindow = null;
let pipTask = null;
let pipClock = null;
let pipStop = null;

function copyLook(doc) {
  const from = document.documentElement.dataset;
  const to = doc.documentElement.dataset;
  for (const key of ["theme", "accent", "gradient"]) {
    if (from[key]) to[key] = from[key];
    else delete to[key];
  }
  if (from.theme === "launcher") loadLauncherFont(doc);
}

async function popOut() {
  if (pipWindow) {
    pipWindow.focus();
    return;
  }
  try {
    pipWindow = await documentPictureInPicture.requestWindow({ width: 300, height: 180 });
  } catch (err) {
    setStatus("Couldn't open the small window.");
    return;
  }
  const doc = pipWindow.document;
  doc.title = "Time Tracker";
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("styles.css", location.href).href; // the small window has no address of its own
  doc.head.append(link);
  copyLook(doc);
  doc.body.className = "pip-body";

  pipTask = doc.createElement("p");
  pipTask.className = "pip-task";
  pipClock = doc.createElement("p");
  pipClock.className = "clock pip-clock";
  pipClock.setAttribute("role", "timer");
  pipStop = doc.createElement("button");
  pipStop.type = "button";
  pipStop.className = "action-button pip-stop";
  pipStop.textContent = "Stop";
  pipStop.addEventListener("click", stopTimer);
  doc.body.append(pipTask, pipClock, pipStop);

  pipWindow.addEventListener("pagehide", () => {
    pipWindow = null;
  });
  updatePip();
}

// Called with every clock update (renderLive), so it shows the same time as the page.
function updatePip() {
  if (!pipWindow) return;
  pipTask.textContent = state.running ? state.running.task : "Not tracking";
  pipClock.textContent = formatClock(elapsedMs());
  pipStop.disabled = !state.running;
}

popOutButton.hidden = !("documentPictureInPicture" in window);
popOutButton.addEventListener("click", popOut);

// ---------- Start up ----------

// Save the theme picked for a first visit, so it doesn't change once times are saved.
if (readSetting(THEME_KEY, null, (v) => THEMES.includes(v)) === null) writeSetting(THEME_KEY, settings.theme);
applyLook();
const savedTab = readSetting(TAB_KEY, "tab-today", (v) => tabs.some((t) => t.id === v));
selectTab(tabs.find((t) => t.id === savedTab));
if (state.running) taskInput.value = state.running.task;
const startNow = new Date();
historyKey = dateKey(new Date(startNow.getFullYear(), startNow.getMonth(), startNow.getDate() - 1).getTime());
historyDateInput.value = historyKey;
const startDay = new Date(historyDay().start);
calendarMonth = { year: startDay.getFullYear(), month: startDay.getMonth() };
render();
// First visit (or never finished): Pixel's tour, once the page is drawn.
if (readSetting(TOUR_KEY, "", (v) => v === "done") !== "done") setTimeout(startTour, 400);
