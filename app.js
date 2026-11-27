// Habit Tracker app logic

const STORAGE_KEY = 'habitTracker.habits';
const THEME_KEY = 'habitTracker.theme';
const THEMES = ['light', 'dark', 'party'];
const DEFAULT_THEME = 'light';
const DAYS_SHOWN = 7;

const state = {
  habits: loadHabits(),
  // The habit being edited, with the user's unsaved changes: { id, name, description, error }
  edit: null,
  // Whether the "new habit" form was opened via the "Add a new habit" button.
  // With no habits yet, the form is always shown.
  addFormOpen: false,
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

// ---------- Intro panel (collapsible) ----------

const INTRO_KEY = 'habitTracker.introCollapsed';

function loadIntroCollapsed() {
  try {
    return localStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
}

function saveIntroCollapsed(collapsed) {
  try {
    localStorage.setItem(INTRO_KEY, collapsed ? '1' : '0');
  } catch {
    // Storage unavailable: the choice applies for this session only.
  }
}

// The class drives the animation in CSS. `inert` keeps the hidden panel out of
// keyboard focus and screen readers.
function applyIntroCollapsed(collapsed) {
  document.body.classList.toggle('intro-collapsed', collapsed);
  const intro = document.getElementById('intro');
  if (intro) intro.inert = collapsed;
  for (const button of document.querySelectorAll('[data-intro-toggle]')) {
    button.setAttribute('aria-expanded', String(!collapsed));
  }
}

// Apply the saved state on load without animating: `is-loading` switches transitions off
// until the page has been drawn once. (This script sits at the end of <body>, so the elements exist.)
document.body.classList.add('is-loading');
applyIntroCollapsed(loadIntroCollapsed());
requestAnimationFrame(() => {
  requestAnimationFrame(() => document.body.classList.remove('is-loading'));
});

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
// ignoreId: the habit being edited, so it doesn't count as its own duplicate.
function validateHabitName(name, ignoreId = null) {
  if (!name) return 'Please enter a habit name.';
  const exists = state.habits.some(
    (habit) => habit.id !== ignoreId && habit.name.toLowerCase() === name.toLowerCase()
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
  if (state.edit?.id === id) state.edit = null;
  saveHabits();
  render();
}

function startEdit(id) {
  const habit = state.habits.find((h) => h.id === id);
  if (!habit) return;
  // Only one habit is edited at a time; opening another discards the first one's changes.
  state.edit = { id, name: habit.name, description: habit.description, error: '' };
  render();
}

function cancelEdit() {
  state.edit = null;
  render();
}

// Returns true if saved, false if the name was invalid (the error is shown in the form).
function saveEdit() {
  const habit = state.habits.find((h) => h.id === state.edit?.id);
  if (!habit) return false;

  const name = state.edit.name.trim();
  const error = validateHabitName(name, habit.id);
  if (error) {
    state.edit.error = error;
    render();
    return false;
  }

  habit.name = name;
  habit.description = state.edit.description.trim();
  state.edit = null;
  saveHabits();
  render();
  return true;
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

function actionButton(className, label, action, ariaLabel) {
  const button = el('button', className, label);
  button.type = 'button';
  button.dataset.action = action;
  button.setAttribute('aria-label', ariaLabel);
  return button;
}

// Name, description, and the Edit / Remove buttons.
function renderHabitHeader(habit) {
  const header = el('div', 'habit__header');
  const text = el('div');
  text.append(el('h3', 'habit__name', habit.name));
  if (habit.description) text.append(el('p', 'habit__description', habit.description));

  const actions = el('div', 'habit__actions');
  actions.append(
    actionButton('habit__action habit__action--edit', 'Edit', 'edit', `Edit habit "${habit.name}"`),
    actionButton('habit__action habit__action--remove', 'Remove', 'remove', `Remove habit "${habit.name}"`)
  );
  header.append(text, actions);
  return header;
}

function editField(habitId, field, labelText, value, maxLength, hint) {
  const wrapper = el('div', 'field');
  const id = `edit-${field}-${habitId}`;
  const label = el('label', '', labelText);
  label.htmlFor = id;
  if (hint) label.append(' ', el('span', 'optional', hint));

  const input = el('input');
  input.id = id;
  input.type = 'text';
  input.value = value;
  input.maxLength = maxLength;
  input.autocomplete = 'off';
  input.dataset.field = field;
  wrapper.append(label, input);
  return { wrapper, input };
}

// Inline form that replaces the header while a habit is being edited.
function renderEditForm(habit) {
  const form = el('form', 'habit__edit');
  form.noValidate = true;
  form.dataset.action = 'save-edit';
  form.setAttribute('aria-label', `Edit habit "${habit.name}"`);

  const name = editField(habit.id, 'name', 'Name', state.edit.name, 60);
  const description = editField(habit.id, 'description', 'Description', state.edit.description, 140, '(optional)');
  if (state.edit.error) name.input.setAttribute('aria-invalid', 'true');

  const error = el('p', 'form-error', state.edit.error);
  error.setAttribute('role', 'alert');

  const buttons = el('div', 'habit__edit-buttons');
  const save = el('button', 'button-primary', 'Save');
  save.type = 'submit';
  const cancel = el('button', 'button-secondary', 'Cancel');
  cancel.type = 'button';
  cancel.dataset.action = 'cancel-edit';
  buttons.append(save, cancel);

  form.append(name.wrapper, description.wrapper, error, buttons);
  return form;
}

function renderHabit(habit, todayKey) {
  const item = el('li', 'habit');
  item.dataset.id = habit.id;

  const isEditing = state.edit?.id === habit.id;
  const header = isEditing ? renderEditForm(habit) : renderHabitHeader(habit);

  const todayLabel = el('label', 'habit__today');
  const checkbox = el('input');
  checkbox.type = 'checkbox';
  checkbox.dataset.action = 'toggle-today';
  checkbox.checked = habit.completions.includes(todayKey);
  todayLabel.append(checkbox, document.createTextNode('Done today'));

  item.append(header, todayLabel, renderWeek(habit, todayKey));
  return item;
}

// "2 / 5 habits done today", plus a progress bar. Hidden when there are no habits.
function renderTodaySummary(todayKey) {
  const summary = document.getElementById('today-summary');
  const total = state.habits.length;
  const done = state.habits.filter((habit) => habit.completions.includes(todayKey)).length;

  summary.hidden = total === 0;
  if (total === 0) return;

  const allDone = done === total;
  summary.classList.toggle('today-summary--complete', allDone);
  document.getElementById('today-count').textContent = `${done} / ${total}`;
  document.getElementById('today-label').textContent = allDone
    ? 'All habits done today 🎉'
    : `habit${total === 1 ? '' : 's'} done today`;

  const bar = document.getElementById('today-progress');
  bar.setAttribute('aria-valuemax', String(total));
  bar.setAttribute('aria-valuenow', String(done));
  document.getElementById('today-progress-fill').style.width = `${(done / total) * 100}%`;
}

// With no habits the form is always visible. Otherwise it's hidden behind the
// "Add a new habit" button until that button is clicked.
function renderAddForm() {
  const hasHabits = state.habits.length > 0;
  const formVisible = !hasHabits || state.addFormOpen;
  const openButton = document.getElementById('open-add-form');

  document.getElementById('add-habit-form').hidden = !formVisible;
  openButton.hidden = formVisible;
  openButton.setAttribute('aria-expanded', String(formVisible));
  document.getElementById('cancel-add').hidden = !hasHabits;
}

function render() {
  const list = document.getElementById('habit-list');
  const emptyState = document.getElementById('empty-state');
  const todayKey = toDateKey(new Date());

  // e.g. "Friday, 27 November" in the browser's language (same as the 7-day grid)
  document.getElementById('today-date').textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  renderAddForm();

  list.replaceChildren(...state.habits.map((habit) => renderHabit(habit, todayKey)));
  emptyState.hidden = state.habits.length > 0;
  renderTodaySummary(todayKey);
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

  // Intro: the header button toggles it; the × inside the panel hides it.
  const introToggle = document.getElementById('intro-toggle');
  for (const button of document.querySelectorAll('[data-intro-toggle]')) {
    button.addEventListener('click', () => {
      const collapse = !document.body.classList.contains('intro-collapsed');
      applyIntroCollapsed(collapse);
      saveIntroCollapsed(collapse);

      if (collapse) {
        // The panel is gone, so move focus to the button that brings it back,
        // and make that button glow briefly so people see where it went.
        introToggle.focus();
        introToggle.classList.remove('header-button--pulse');
        void introToggle.offsetWidth; // restart the animation if clicked twice
        introToggle.classList.add('header-button--pulse');
      }
    });
  }
  introToggle.addEventListener('animationend', () => {
    introToggle.classList.remove('header-button--pulse');
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

    // Close the form again; it's replaced by the "Add a new habit" button.
    state.addFormOpen = false;
    addHabit(name, descriptionInput.value.trim());
    showError('');
    form.reset();
    openButton.focus();
  });

  // Clear the error as soon as the user starts fixing it.
  nameInput.addEventListener('input', () => showError(''));

  const openButton = document.getElementById('open-add-form');
  const cancelButton = document.getElementById('cancel-add');

  openButton.addEventListener('click', () => {
    state.addFormOpen = true;
    render();
    nameInput.focus();
  });

  function closeAddForm() {
    if (state.habits.length === 0) return; // nothing to go back to
    state.addFormOpen = false;
    form.reset();
    showError('');
    render();
    openButton.focus();
  }

  cancelButton.addEventListener('click', closeAddForm);
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAddForm();
  });

  // One listener for all habits (event delegation), since the list is re-rendered.
  list.addEventListener('change', (event) => {
    if (event.target.dataset.action !== 'toggle-today') return;
    const id = event.target.closest('.habit').dataset.id;
    setDoneToday(id, event.target.checked);
    // Keep keyboard focus on the same checkbox after re-render.
    list.querySelector(`[data-id="${id}"] [data-action="toggle-today"]`)?.focus();
  });

  // After a re-render the old elements are gone, so move focus to the new one.
  function focusInHabit(id, selector) {
    list.querySelector(`[data-id="${id}"] ${selector}`)?.focus();
  }

  list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = button.closest('.habit').dataset.id;
    const habit = state.habits.find((h) => h.id === id);
    if (!habit) return;

    switch (button.dataset.action) {
      case 'edit':
        startEdit(id);
        focusInHabit(id, '[data-field="name"]');
        break;
      case 'cancel-edit':
        cancelEdit();
        focusInHabit(id, '[data-action="edit"]');
        break;
      case 'remove':
        if (confirm(`Remove "${habit.name}"? This deletes its history too.`)) {
          removeHabit(id);
        }
        break;
    }
  });

  list.addEventListener('submit', (event) => {
    if (event.target.dataset.action !== 'save-edit') return;
    event.preventDefault();
    const id = event.target.closest('.habit').dataset.id;
    if (saveEdit()) {
      focusInHabit(id, '[data-action="edit"]');
    } else {
      focusInHabit(id, '[data-field="name"]');
    }
  });

  // Keep the unsaved changes in state, so ticking another habit (which re-renders) doesn't lose them.
  list.addEventListener('input', (event) => {
    const field = event.target.dataset.field;
    if (!field || !state.edit) return;
    state.edit[field] = event.target.value;
    if (field === 'name' && state.edit.error) {
      state.edit.error = '';
      event.target.removeAttribute('aria-invalid');
      event.target.closest('form').querySelector('.form-error').textContent = '';
    }
  });

  // Escape cancels editing.
  list.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !event.target.closest('.habit__edit')) return;
    const id = event.target.closest('.habit').dataset.id;
    cancelEdit();
    focusInHabit(id, '[data-action="edit"]');
  });

  render();
});
