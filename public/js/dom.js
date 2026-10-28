// Small element builder: h('p', { class: 'muted' }, 'teks', childNode).
// Strings always become text nodes, so data from the server is never parsed as HTML.
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    // The value attribute does nothing on <textarea>; the property works on every control.
    else if (key === 'value') node.value = value;
    else if (key in node && typeof value !== 'string') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

export const hook = (name, root = document) => root.querySelector(`[data-hook="${name}"]`);

const dateTime = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});
const relative = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });
const number = new Intl.NumberFormat('id-ID');

export function formatDateTime(value) {
  if (!value) return 'belum dijadwal';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date);
}

// SQLite's datetime('now') is UTC without a zone marker: "2026-10-27 12:00:00".
export function parseDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)) {
    return new Date(`${value.replace(' ', 'T')}Z`);
  }
  return new Date(value);
}

export function formatRelative(value) {
  const diff = parseDate(value).getTime() - Date.now();
  const hours = diff / 3_600_000;
  if (Math.abs(hours) < 1) return relative.format(Math.round(diff / 60_000), 'minute');
  if (Math.abs(hours) < 48) return relative.format(Math.round(hours), 'hour');
  return relative.format(Math.round(hours / 24), 'day');
}

export const formatNumber = (n) => number.format(n);

export function formatSeconds(total) {
  const s = Math.max(0, Math.round(total));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function formValues(form) {
  return Object.fromEntries(new FormData(form));
}

// Wraps a submit handler: disables the button and shows errors in the given element.
export function handleSubmit(form, errorEl, run) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter;
    if (errorEl) errorEl.textContent = '';
    if (button) button.disabled = true;
    try {
      await run(formValues(form), form);
    } catch (err) {
      if (errorEl) errorEl.textContent = err.message;
      else window.alert(err.message);
    } finally {
      if (button) button.disabled = false;
    }
  });
}
