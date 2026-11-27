// Habit Tracker app logic

const STORAGE_KEY = 'habitTracker.habits';
const THEME_KEY = 'habitTracker.theme';
const THEMES = ['light', 'dark', 'party'];
const DEFAULT_THEME = 'light';
const DAYS_SHOWN = 7;

const state = {
  habits: loadHabits(),
};

// ---------- Theme (light / dark / party) ----------

function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return THEMES.includes(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage unavailable: the mode still applies for this session.
  }
}

// Apply the saved mode right away, before the page finishes loading.
applyTheme(loadTheme());

// ---------- Storage ----------

function loadHabits() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved.map(normalizeHabit) : [];
  } catch {
    return [];
  }
}

// Fills in fields that older saved habits may not have.
function normalizeHabit(habit) {
  return {
    id: habit.id,
    name: habit.name,
    description: habit.description || '',
    createdAt: habit.createdAt,
    completions: Array.isArray(habit.completions) ? habit.completions : [],
  };
}

function saveHabits() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.habits));
  } catch {
    // Storage unavailable (e.g. private mode): the app keeps working for this session.
  }
}

// ---------- Dates ----------

// "YYYY-MM-DD" in the user's local time zone (toISOString would use UTC).
function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// The last DAYS_SHOWN days, oldest first, ending with today.
function lastDays() {
  const days = [];
  for (let i = DAYS_SHOWN - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push(date);
  }
  return days;
}

// ---------- Actions ----------

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Returns an error message, or an empty string if the name is valid.
function validateHabitName(name) {
  if (!name) return 'Please enter a habit name.';
  const exists = state.habits.some(
    (habit) => habit.name.toLowerCase() === name.toLowerCase()
  );
  if (exists) return 'You already have a habit with that name.';
  return '';
}

function addHabit(name, description) {
  state.habits.push({
    id: createId(),
    name,
    description,
    createdAt: new Date().toISOString(),
    completions: [],
  });
  saveHabits();
  render();
}

function setDoneToday(id, done) {
  const habit = state.habits.find((h) => h.id === id);
  if (!habit) return;
  const today = toDateKey(new Date());
  habit.completions = habit.completions.filter((day) => day !== today);
  if (done) habit.completions.push(today);
  saveHabits();
  render();
}

function removeHabit(id) {
  state.habits = state.habits.filter((h) => h.id !== id);
  saveHabits();
  render();
}

// ---------- Rendering ----------

// Small helper: create an element with a class and optional text.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // textContent avoids injecting HTML
  return node;
}

function renderWeek(habit, todayKey) {
  const week = el('ol', 'week');
  week.setAttribute('aria-label', `Last ${DAYS_SHOWN} days`);

  for (const date of lastDays()) {
    const key = toDateKey(date);
    const done = habit.completions.includes(key);
    const weekday = date.toLocaleDateString(undefined, { weekday: 'short' });

    const day = el('li', 'week__day');
    if (done) day.classList.add('week__day--done');
    if (key === todayKey) day.classList.add('week__day--today');
    day.setAttribute(
      'aria-label',
      `${date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}: ${done ? 'done' : 'not done'}`
    );

    day.append(el('span', 'week__weekday', weekday), el('span', 'week__date', String(date.getDate())));
    week.append(day);
  }
  return week;
}

function renderHabit(habit, todayKey) {
  const item = el('li', 'habit');
  item.dataset.id = habit.id;

  const header = el('div', 'habit__header');
  const text = el('div');
  text.append(el('h3', 'habit__name', habit.name));
  if (habit.description) text.append(el('p', 'habit__description', habit.description));

  const remove = el('button', 'habit__remove', 'Remove');
  remove.type = 'button';
  remove.dataset.action = 'remove';
  remove.setAttribute('aria-label', `Remove habit "${habit.name}"`);
  header.append(text, remove);

  const todayLabel = el('label', 'habit__today');
  const checkbox = el('input');
  checkbox.type = 'checkbox';
  checkbox.dataset.action = 'toggle-today';
  checkbox.checked = habit.completions.includes(todayKey);
  todayLabel.append(checkbox, document.createTextNode('Done today'));

  item.append(header, todayLabel, renderWeek(habit, todayKey));
  return item;
}

function render() {
  const list = document.getElementById('habit-list');
  const emptyState = document.getElementById('empty-state');
  const todayKey = toDateKey(new Date());

  list.replaceChildren(...state.habits.map((habit) => renderHabit(habit, todayKey)));
  emptyState.hidden = state.habits.length > 0;
}

// ---------- Events ----------

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('add-habit-form');
  const nameInput = document.getElementById('habit-name');
  const descriptionInput = document.getElementById('habit-description');
  const error = document.getElementById('form-error');
  const list = document.getElementById('habit-list');
  const themeSelect = document.getElementById('theme-select');

  themeSelect.value = loadTheme();
  themeSelect.addEventListener('change', () => {
    const theme = THEMES.includes(themeSelect.value) ? themeSelect.value : DEFAULT_THEME;
    applyTheme(theme);
    saveTheme(theme);
  });

  function showError(message) {
    error.textContent = message;
    if (message) {
      nameInput.setAttribute('aria-invalid', 'true');
    } else {
      nameInput.removeAttribute('aria-invalid');
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const message = validateHabitName(name);

    if (message) {
      showError(message);
      nameInput.focus();
      return;
    }

    addHabit(name, descriptionInput.value.trim());
    showError('');
    form.reset();
    nameInput.focus();
  });

  // Clear the error as soon as the user starts fixing it.
  nameInput.addEventListener('input', () => showError(''));

  // One listener for all habits (event delegation), since the list is re-rendered.
  list.addEventListener('change', (event) => {
    if (event.target.dataset.action !== 'toggle-today') return;
    const id = event.target.closest('.habit').dataset.id;
    setDoneToday(id, event.target.checked);
    // Keep keyboard focus on the same checkbox after re-render.
    list.querySelector(`[data-id="${id}"] [data-action="toggle-today"]`)?.focus();
  });

  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="remove"]');
    if (!button) return;
    const habit = state.habits.find((h) => h.id === button.closest('.habit').dataset.id);
    if (habit && confirm(`Remove "${habit.name}"? This deletes its history too.`)) {
      removeHabit(habit.id);
    }
  });

  render();
});
