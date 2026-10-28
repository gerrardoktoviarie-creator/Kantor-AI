import { api } from './api.js';
import { handleSubmit, hook } from './dom.js';

handleSubmit(hook('login-form'), hook('login-error'), async ({ password }) => {
  await api('/api/login', { method: 'POST', body: { password } });
  // Only follow same-site paths back, never a full URL from the query string.
  const next = new URLSearchParams(window.location.search).get('next') ?? '';
  window.location.href = next.startsWith('/') && !next.startsWith('//') ? next : '/';
});
