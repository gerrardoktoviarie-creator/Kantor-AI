import { api } from '../api.js';
import { h, hook, formatDateTime, formatRelative } from '../dom.js';

const DONE = new Set(['TURNED_IN', 'RETURNED']);

export function createTugasView() {
  const status = hook('classroom-status');
  const setup = hook('classroom-setup');
  const actions = hook('classroom-actions');
  const list = hook('homework-list');
  const telegram = hook('telegram-panel');

  telegram.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const status = telegram.querySelector('[data-hook="telegram-result"]');
    button.disabled = true;
    status.textContent = '';
    try {
      if (button.dataset.action === 'tg-connect') await api('/api/telegram/connect', { method: 'POST' });
      if (button.dataset.action === 'tg-test') {
        await api('/api/telegram/test', { method: 'POST' });
        status.textContent = 'Pesan tes dikirim, cek Telegram.';
      }
      if (button.dataset.action === 'tg-disconnect') await api('/api/telegram/disconnect', { method: 'POST' });
      if (button.dataset.action === 'hermes-toggle') await api('/api/hermes/telegram', { method: 'POST' });
      if (button.dataset.action === 'hermes-skill') {
        await api('/api/hermes/skill', { method: 'POST' });
        status.textContent = 'Skill kepasang. Hermes bisa baca skill baru di sesi chat berikutnya.';
      }
      if (button.dataset.action !== 'tg-test') {
        const note = status.textContent;
        await renderTelegram();
        telegram.querySelector('[data-hook="telegram-result"]').textContent = note;
      }
    } catch (err) {
      status.textContent = err.message;
      status.className = 'error-text';
    } finally {
      button.disabled = false;
    }
  });

  function hermesSection(hermes) {
    if (!hermes.found) return '';
    const toggle = h('button', {
      class: hermes.using ? 'btn btn--small' : 'btn btn--primary btn--small',
      type: 'button',
      dataset: { action: 'hermes-toggle' },
      disabled: !hermes.telegram,
    }, hermes.using ? 'Balik ke bot Kantor AI' : 'Pakai bot Hermes');
    const skill = h('button', {
      class: 'btn btn--small',
      type: 'button',
      dataset: { action: 'hermes-skill' },
      disabled: hermes.skillInstalled,
    }, hermes.skillInstalled ? 'Skill Kantor AI udah di Hermes' : 'Pasang skill Kantor AI ke Hermes');
    let about = 'Hermes ketemu di laptop ini. Pesan Kantor AI bisa dikirim lewat bot Hermes, jadi cukup satu bot.';
    if (hermes.using) about = `Pesan Kantor AI dikirim lewat bot Hermes ke ${hermes.chat.name}.`;
    if (!hermes.telegram) about = 'Hermes ketemu, tapi token bot atau chat utamanya belum diisi di .env Hermes.';
    return h('div', { class: 'hermes' },
      h('h3', {}, 'Hermes'),
      h('p', {}, about),
      h('div', { class: 'actions' }, toggle, skill),
      h('p', { class: 'panel__hint' }, 'Dengan skill itu, kamu bisa chat ke Hermes: "kantor gimana?", "suruh Dewi catat kopi keluar 10", atau "tanya Raka iklan minggu ini".'),
    );
  }

  async function renderTelegram() {
    const [data, hermes] = await Promise.all([api('/api/telegram'), api('/api/hermes')]);
    const result = h('p', { class: 'muted', role: 'status', dataset: { hook: 'telegram-result' } });

    if (!data.configured) {
      telegram.replaceChildren(
        h('ol', { class: 'steps-guide' },
          h('li', {}, 'Di Telegram, buka ', h('strong', {}, '@BotFather'), ', kirim /newbot, kasih nama bebas.'),
          h('li', {}, 'Salin token yang dikasih BotFather ke file .env di folder kantor-ai: ', h('span', { class: 'code' }, 'TELEGRAM_BOT_TOKEN=tokennya')),
          h('li', {}, 'Restart Kantor AI, lalu balik ke sini.'),
        ),
        h('p', { class: 'panel__hint' }, 'Token itu kunci bot kamu, jangan dibagi ke siapa-siapa.'),
        hermesSection(hermes),
        result,
      );
      return;
    }

    const bot = data.bot?.username ? `@${data.bot.username}` : 'bot kamu';
    const who = 'Mira (tugas), Dewi (stok tipis), dan Rudi (rekap mingguan)';
    let summary = h('p', {}, `Buka ${bot} di Telegram, kirim /start, terus klik Sambungkan.`);
    if (data.chat) summary = h('p', {}, `Nyambung ke ${data.chat.name || 'chat kamu'} lewat ${bot}. ${who} ngirim kabar ke sini.`);
    telegram.replaceChildren(
      summary,
      // replaceChildren() stringifies null, so empty slots are '' here, unlike inside h().
      data.lastError ? h('p', { class: 'error-text' }, `Error terakhir: ${data.lastError}`) : '',
      h('div', { class: 'actions' },
        data.chat
          ? [
            h('button', { class: 'btn', type: 'button', dataset: { action: 'tg-test' } }, 'Kirim pesan tes'),
            data.viaHermes ? '' : h('button', { class: 'btn btn--small btn--danger', type: 'button', dataset: { action: 'tg-disconnect' } }, 'Putuskan'),
          ]
          : h('button', { class: 'btn btn--primary', type: 'button', dataset: { action: 'tg-connect' } }, 'Sambungkan'),
      ),
      hermesSection(hermes),
      result,
    );
  }

  actions.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    button.disabled = true;
    try {
      if (button.dataset.action === 'classroom-sync') {
        const { fresh } = await api('/api/classroom/sync', { method: 'POST' });
        status.textContent = fresh ? `${fresh} tugas baru masuk, Mira lagi ngecek.` : 'Gak ada tugas baru.';
      }
      if (button.dataset.action === 'classroom-disconnect' && window.confirm('Putuskan akun Google dari Kantor AI?')) {
        await api('/api/classroom/disconnect', { method: 'POST' });
      }
      await refresh();
    } catch (err) {
      window.alert(err.message);
    } finally {
      button.disabled = false;
    }
  });

  function renderSetup(data) {
    if (!data.configured) {
      return [
        h('h2', {}, 'Sambungin Google Classroom (sekali aja)'),
        h('p', {}, 'Google mewajibkan tiap aplikasi punya "OAuth client" sendiri. Bikinnya gratis, sekitar 10 menit:'),
        h('ol', { class: 'steps-guide' },
          h('li', {}, 'Buka ', h('a', { href: 'https://console.cloud.google.com/projectcreate', target: '_blank', rel: 'noopener' }, 'Google Cloud Console'), ' dan bikin project baru (nama bebas).'),
          h('li', {}, 'Di menu "APIs & Services → Library", cari dan Enable ', h('strong', {}, 'Google Classroom API'), '.'),
          h('li', {}, 'Di "OAuth consent screen": pilih External, isi nama app, lalu di bagian Test users tambahkan email Google kampus/akun yang dipakai Classroom.'),
          h('li', {}, 'Di "Credentials → Create credentials → OAuth client ID": pilih ', h('strong', {}, 'Web application'), ', lalu di Authorized redirect URIs isi:'),
          h('li', { class: 'code' }, data.redirectUri),
          h('li', {}, 'Salin Client ID dan Client secret ke file .env di folder kantor-ai (GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET), lalu restart server.'),
        ),
        h('p', { class: 'panel__hint' }, 'Kalau akun kampus diblok admin buat aplikasi luar, login-nya bakal ditolak Google. Itu aturan kampus, bukan error di sini.'),
      ];
    }
    if (!data.connected) {
      return [
        h('h2', {}, 'Tinggal login'),
        h('p', {}, 'Klik tombol di bawah, login pakai akun Google yang dipakai di Classroom, terus izinkan akses baca kelas dan tugas.'),
        data.lastError && h('p', { class: 'error-text', role: 'alert' }, data.lastError),
        h('a', { class: 'btn btn--primary', href: '/api/classroom/connect' }, 'Sambungkan Google Classroom'),
      ];
    }
    return null;
  }

  function renderItem(item) {
    const done = DONE.has(item.submission);
    const due = item.dueAt ? new Date(item.dueAt) : null;
    const urgent = !done && due && due.getTime() - Date.now() < 48 * 3_600_000;
    const late = !done && due && due.getTime() < Date.now();

    let badge = h('span', { class: 'badge' }, 'Belum dikumpul');
    if (done) badge = h('span', { class: 'badge badge--ok' }, 'Udah dikumpul');
    else if (late) badge = h('span', { class: 'badge badge--error' }, 'Lewat deadline');
    else if (urgent) badge = h('span', { class: 'badge badge--attention' }, 'Deadline dekat');

    return h('li', { class: `homework${done ? ' homework--done' : ''}` },
      h('div', { class: 'homework__head' },
        h('h2', { class: 'homework__title' }, item.title),
        !item.seen && h('span', { class: 'badge badge--attention' }, 'Baru'),
        badge,
      ),
      h('p', { class: 'muted' }, `${item.course} · deadline ${due ? `${formatDateTime(item.dueAt)} (${formatRelative(item.dueAt)})` : 'gak ada'}`),
      item.brief && h('div', { class: 'form' },
        h('p', {}, h('strong', {}, 'Kata Mira: '), item.brief.summary),
        item.brief.plan?.length > 0 && h('ol', { class: 'homework__plan' }, item.brief.plan.map((s) => h('li', {}, s))),
      ),
      item.link && h('a', { class: 'btn btn--small', href: item.link, target: '_blank', rel: 'noopener' }, 'Buka di Classroom'),
    );
  }

  async function refresh() {
    const data = await api('/api/classroom');
    const setupContent = renderSetup(data);
    setup.hidden = !setupContent;
    if (setupContent) setup.replaceChildren(...setupContent);
    actions.hidden = !data.connected;

    if (data.connected) {
      const parts = [data.syncedAt ? `Terakhir dicek ${formatRelative(data.syncedAt)}` : 'Belum pernah dicek'];
      parts.push('otomatis tiap 15 menit');
      status.textContent = parts.join(', ') + '.';
      if (data.lastError) status.append(h('span', { class: 'error-text' }, ` Error terakhir: ${data.lastError}`));
    } else {
      status.textContent = 'Mira bakal ngecek tugas baru dan bikinin ringkasan + rencana ngerjain.';
    }

    list.replaceChildren(...(data.items.length
      ? data.items.map(renderItem)
      : data.connected ? [h('li', { class: 'empty' }, 'Belum ada tugas yang ketarik.')] : []));
    return data;
  }

  return {
    async show() {
      renderTelegram().catch((err) => telegram.replaceChildren(h('p', { class: 'error-text' }, err.message)));
      const data = await refresh();
      if (data.items.some((i) => !i.seen)) api('/api/classroom/seen', { method: 'POST' }).catch(() => {});
    },
    hide() {},
    refresh,
  };
}
