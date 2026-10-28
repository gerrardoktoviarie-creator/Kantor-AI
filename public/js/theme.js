// Classic script loaded in <head> (not a module) so the saved theme is applied before first paint.
// Dark is the default; light is opt-in and remembered per browser.
const THEME_KEY = 'kantor-ai:theme';

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  for (const button of document.querySelectorAll('[data-action="toggle-theme"]')) {
    button.textContent = theme === 'light' ? 'Mode gelap' : 'Mode terang';
  }
}

applyTheme(readTheme());
document.addEventListener('DOMContentLoaded', () => applyTheme(document.documentElement.dataset.theme));

document.addEventListener('click', (event) => {
  if (!event.target.closest('[data-action="toggle-theme"]')) return;
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Storage blocked (private mode): the switch still works until reload.
  }
  applyTheme(next);
});
