import { api, uploadFile } from '../api.js';
import { h, hook, formatSeconds } from '../dom.js';

const CLIP_STATES = {
  queued: ['Antre', ''],
  cutting: ['Lagi dipotong', 'badge--working'],
  done: ['Jadi', 'badge--ok'],
  failed: ['Gagal', 'badge--error'],
};

export function createClipsView() {
  const form = hook('upload-form');
  const progress = hook('upload-progress');
  const error = hook('upload-error');
  const list = hook('video-list');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = form.elements.file.files[0];
    if (!file) {
      error.textContent = 'Pilih file videonya dulu.';
      return;
    }
    const button = event.submitter;
    button.disabled = true;
    error.textContent = '';
    progress.hidden = false;
    progress.value = 0;
    try {
      await uploadFile(`/api/videos?name=${encodeURIComponent(file.name)}`, file, (pct) => {
        progress.value = pct;
      });
      form.reset();
      await refresh({ force: true });
    } catch (err) {
      error.textContent = err.message;
    } finally {
      button.disabled = false;
      progress.hidden = true;
    }
  });

  list.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const card = target.closest('[data-id]');

    if (target.dataset.action === 'seek-line') {
      const player = card.querySelector('video');
      player.currentTime = Number(target.dataset.start);
      player.play().catch(() => {});
      return;
    }

    if (target.dataset.action === 'use-candidate') {
      const cut = card.querySelector('[data-hook="cut-form"]');
      cut.elements.start.value = target.dataset.start;
      cut.elements.end.value = target.dataset.end;
      if (target.dataset.title) cut.elements.title.value = target.dataset.title;
      cut.elements.title.focus();
      card.dataset.editing = 'true';
      const player = card.querySelector('video');
      player.currentTime = Number(target.dataset.start);
      player.play().catch(() => {});
      return;
    }

    if (target.dataset.action === 'mark-start' || target.dataset.action === 'mark-end') {
      const player = card.querySelector('video');
      const field = target.dataset.action === 'mark-start' ? 'start' : 'end';
      card.querySelector('[data-hook="cut-form"]').elements[field].value = player.currentTime.toFixed(1);
      card.dataset.editing = 'true';
      return;
    }

    if (target.dataset.action === 'delete-video' && window.confirm('Hapus video ini beserta semua klipnya?')) {
      try {
        await api(`/api/videos/${card.dataset.id}`, { method: 'DELETE' });
        await refresh({ force: true });
      } catch (err) {
        window.alert(err.message);
      }
    }
  });

  list.addEventListener('submit', async (event) => {
    event.preventDefault();
    const cut = event.target;
    const card = cut.closest('[data-id]');
    const values = Object.fromEntries(new FormData(cut));
    const errorEl = cut.querySelector('.error-text');
    errorEl.textContent = '';
    try {
      await api(`/api/videos/${card.dataset.id}/clips`, {
        method: 'POST',
        body: { ...values, start: Number(values.start), end: Number(values.end), subtitles: values.subtitles === 'on' },
      });
      delete card.dataset.editing;
      await refresh({ force: true });
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  // Transcripts can be long, so they load only when someone opens them.
  list.addEventListener('toggle', async (event) => {
    const details = event.target;
    if (!details.matches('[data-hook="transcript"]') || !details.open || details.dataset.loaded) return;
    details.dataset.loaded = 'true';
    const card = details.closest('[data-id]');
    card.dataset.editing = 'true';
    const body = details.querySelector('.transcript');
    try {
      const lines = await api(`/api/videos/${card.dataset.id}/transcript`);
      body.replaceChildren(...lines.map((line) => h('button', {
        class: 'transcript__line', type: 'button', dataset: { action: 'seek-line', start: String(line.start) },
      }, h('span', { class: 'muted' }, formatSeconds(line.start)), ` ${line.text}`)));
    } catch (err) {
      body.replaceChildren(h('p', { class: 'error-text' }, err.message));
    }
  }, true);

  list.addEventListener('focusin', (event) => {
    const card = event.target.closest('[data-id]');
    if (card && event.target.matches('input, select')) card.dataset.editing = 'true';
  });

  function renderVideo(video) {
    const ready = video.state === 'ready';
    return h('li', { class: 'video-card', dataset: { id: String(video.id) } },
      h('div', { class: 'content-card__head' },
        h('h2', { class: 'content-card__title' }, video.name),
        video.duration && h('span', { class: 'badge' }, formatSeconds(video.duration)),
        h('span', { class: `badge ${ready ? 'badge--ok' : 'badge--working'}` }, ready ? 'Siap dipotong' : 'Dimas lagi nganalisis'),
        h('button', { class: 'btn btn--small btn--danger', type: 'button', dataset: { action: 'delete-video' } }, 'Hapus'),
      ),
      h('video', { class: 'video-card__player', src: video.url, controls: true, preload: 'metadata' }),
      ready && video.hasTranscript && h('details', { dataset: { hook: 'transcript' } },
        h('summary', {}, 'Transkrip (klik kalimat buat lompat ke situ)'),
        h('div', { class: 'transcript' }, h('p', { class: 'muted' }, 'Memuat…')),
      ),
      ready && renderCandidates(video),
      ready && renderCutForm(video),
      video.clips.length > 0 && h('div', { class: 'form' },
        h('h3', {}, 'Klip yang udah dipotong'),
        h('ul', { class: 'list' }, video.clips.map(renderClip)),
      ),
    );
  }

  function renderCandidates(video) {
    if (!video.candidates.length) return h('p', { class: 'muted' }, 'Dimas gak nemu bagian yang cocok otomatis. Tandai sendiri pakai pemutar di atas.');
    const fromTranscript = video.candidates.some((c) => c.title);
    return h('div', { class: 'form' },
      h('h3', {}, 'Saran Dimas'),
      h('p', { class: 'panel__hint' }, fromTranscript
        ? 'Dimas baca transkripnya dan milih momen yang punya hook dan utuh. Klik buat pakai.'
        : 'Gak ada transkrip, jadi dipilih dari bagian yang paling padat omongan dan dipotong di jeda.'),
      h('div', { class: 'candidates' }, video.candidates.map((c) => h('button', {
        class: 'candidate', type: 'button',
        dataset: { action: 'use-candidate', start: String(c.start), end: String(c.end), title: c.title ?? '' },
      },
      c.thumbUrl && h('img', { src: c.thumbUrl, alt: '', width: '320', height: '180', loading: 'lazy' }),
      c.title && h('strong', {}, c.title),
      h('span', {}, `${formatSeconds(c.start)} – ${formatSeconds(c.end)} · ${Math.round(c.end - c.start)} detik`),
      c.reason ? h('span', { class: 'muted' }, c.reason) : h('span', { class: 'muted' }, `${Math.round(c.speech * 100)}% ngomong`),
      ))),
    );
  }

  function renderCutForm(video) {
    const id = video.id;
    return h('form', { class: 'form', dataset: { hook: 'cut-form' } },
      h('h3', {}, 'Potong klip'),
      h('div', { class: 'field field--row' },
        h('div', { class: 'field' },
          h('label', { for: `cut-start-${id}` }, 'Mulai (detik)'),
          h('input', { id: `cut-start-${id}`, name: 'start', type: 'number', min: '0', step: '0.1', inputmode: 'decimal', required: true }),
        ),
        h('div', { class: 'field' },
          h('label', { for: `cut-end-${id}` }, 'Selesai (detik)'),
          h('input', { id: `cut-end-${id}`, name: 'end', type: 'number', min: '0', step: '0.1', inputmode: 'decimal', required: true }),
        ),
        h('div', { class: 'field' },
          h('label', { for: `cut-layout-${id}` }, 'Format'),
          h('select', { id: `cut-layout-${id}`, name: 'layout' },
            h('option', { value: 'vertical' }, 'Vertikal 9:16 (reels/tiktok)'),
            h('option', { value: 'original' }, 'Ukuran asli'),
          ),
        ),
      ),
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn--small', type: 'button', dataset: { action: 'mark-start' } }, 'Mulai dari posisi video sekarang'),
        h('button', { class: 'btn btn--small', type: 'button', dataset: { action: 'mark-end' } }, 'Selesai di posisi video sekarang'),
      ),
      h('div', { class: 'field' },
        h('label', { for: `cut-title-${id}` }, 'Judul klip'),
        h('input', { id: `cut-title-${id}`, name: 'title', maxlength: '120', required: true }),
      ),
      video.hasTranscript
        ? h('label', { class: 'check' },
          h('input', { type: 'checkbox', name: 'subtitles', checked: true }),
          ' Tempel subtitle (gaya TikTok, kata yang diucapin jadi kuning)')
        : h('p', { class: 'panel__hint' }, 'Subtitle gak tersedia: video ini belum ada transkripnya.'),
      h('p', { class: 'error-text', role: 'alert' }),
      h('button', { class: 'btn btn--primary', type: 'submit' }, 'Suruh Dimas potong'),
    );
  }

  function renderClip(clip) {
    const [label, tone] = CLIP_STATES[clip.state] ?? [clip.state, ''];
    return h('li', { class: 'clip-out' },
      clip.url ? h('video', { src: clip.url, controls: true, preload: 'metadata' }) : h('span', {}),
      h('div', { class: 'form' },
        h('strong', {}, clip.title),
        h('span', { class: 'muted' }, `${formatSeconds(clip.start)} – ${formatSeconds(clip.end)} · ${clip.layout === 'vertical' ? '9:16' : 'ukuran asli'}${clip.subtitles ? ' · subtitle' : ''}`),
        h('span', { class: `badge ${tone}` }, label),
        clip.url && h('a', { class: 'btn btn--small', href: clip.url, download: `${clip.title}.mp4` }, 'Download'),
      ),
    );
  }

  async function refresh({ force = false } = {}) {
    if (!force && list.querySelector('[data-editing]')) return;
    // Re-rendering would restart any playing video.
    if (!force && [...list.querySelectorAll('video')].some((v) => !v.paused)) return;
    const videos = await api('/api/videos');
    list.replaceChildren(...(videos.length
      ? videos.map(renderVideo)
      : [h('li', { class: 'empty' }, 'Belum ada video. Upload video panjang (podcast, live, vlog) di atas.')]));
  }

  return { show: () => refresh({ force: true }), hide() {}, refresh };
}
