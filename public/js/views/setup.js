import { api } from '../api.js';
import { h, hook } from '../dom.js';
import { avatarCanvas, paintAvatar } from '../sprites.js';
import { createOffice } from '../office-canvas.js';

const STYLES = [
  { id: 'modern', name: 'Modern', blurb: 'Marmer, kaca, warna kalem.' },
  { id: 'hangat', name: 'Kayu hangat', blurb: 'Lantai kayu, dinding cokelat.' },
  { id: 'mewah', name: 'Mewah gelap', blurb: 'Dinding gelap, marmer, lampu kuning.' },
];

const FACILITIES = [
  { id: 'rapat', name: 'Ruang rapat' },
  { id: 'pantry', name: 'Pantry' },
  { id: 'musala', name: 'Musala' },
  { id: 'kolam', name: 'Kolam renang' },
];

const LINES = {
  new: [
    'Halo! Gw Builder, pengurus kantor lu nanti. Gw cuma nanya 3 hal, terus kantor lu gw pasangin. Kira-kira 5 menit.',
    'Tinggal centang. Nama dan tugasnya udah gw siapin. Saran gw mulai dua dulu, nambah tim gampang nanti.',
    'Terakhir: kantor lu mau keliatan kayak apa? Ini yang lu lihat tiap buka dashboard, karakternya gerak sendiri ngikutin kerjaan tim.',
  ],
  edit: [
    'Mau ganti apa? Data bisnis, tim, atau tampilan kantor, semuanya di sini. Kerjaan yang udah ada gak hilang.',
    'Centang tim yang mau aktif. Tim yang dimatiin cuma disembunyiin, datanya tetap disimpen.',
    'Mau ganti suasana? Pilih gaya dan fasilitasnya, preview-nya langsung berubah.',
  ],
};

export function createSetupView({ onDone }) {
  const form = hook('setup-form');
  const steps = [...form.querySelectorAll('[data-step]')];
  const line = hook('builder-line');
  const progress = hook('setup-progress');
  const bar = hook('setup-bar');
  const error = hook('setup-error');
  const next = hook('setup-next');
  const cancel = hook('setup-cancel');
  const back = form.querySelector('[data-action="setup-back"]');
  const preview = createOffice(hook('setup-preview'), { onSelect() {} });
  let current = 0;
  let mode = 'new';
  let catalog = [];
  let builder = null;

  paintAvatar(hook('builder-avatar'), { hair: '#5c4033', shirt: '#f4f1de', skin: '#e0ac69' });

  function chosenLook() {
    const data = new FormData(form);
    return { style: data.get('style') ?? 'modern', facilities: data.getAll('facilities') };
  }

  // The preview uses the real office engine, fed with the teams ticked in step 2.
  function updatePreview() {
    if (!builder) return;
    const picked = new FormData(form).getAll('divisions');
    const divisions = catalog.filter((team) => picked.includes(team.id)).map((team) => ({
      id: team.id,
      room: team.room,
      agents: team.agents.map((agent) => ({ ...agent, status: { state: 'idle', text: '' } })),
    }));
    preview.update(divisions, { ...builder, status: { state: 'idle', text: '' } }, chosenLook());
  }

  function render() {
    steps.forEach((el, i) => {
      el.hidden = i !== current;
    });
    line.textContent = LINES[mode][current];
    progress.textContent = `${current + 1} dari ${steps.length}`;
    [...bar.children].forEach((segment, i) => segment.classList.toggle('steps-bar__done', i <= current));
    back.hidden = current === 0;
    cancel.hidden = mode !== 'edit';
    const last = current === steps.length - 1;
    next.textContent = last ? (mode === 'edit' ? 'Simpan' : 'Pasang kantornya') : current === 0 && mode === 'new' ? 'Mulai' : 'Lanjut';
    error.textContent = '';
    if (last) {
      updatePreview();
      preview.start();
    } else {
      preview.stop();
    }
    steps[current].querySelector('input, textarea')?.focus();
  }

  function validateStep() {
    if (current === 0 && [...steps[0].querySelectorAll('input, textarea')].some((field) => !field.value.trim())) {
      return 'Isi tiga-tiganya dulu ya, biar timnya ngerti konteks.';
    }
    if (current === 1 && !form.querySelector('[name="divisions"]:checked')) return 'Pilih minimal satu tim.';
    return '';
  }

  back.addEventListener('click', () => {
    current = Math.max(0, current - 1);
    render();
  });

  form.addEventListener('change', (event) => {
    if (event.target.matches('[name="style"], [name="facilities"]')) updatePreview();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const problem = validateStep();
    if (problem) {
      error.textContent = problem;
      return;
    }
    if (current < steps.length - 1) {
      current += 1;
      render();
      return;
    }

    const data = new FormData(form);
    next.disabled = true;
    try {
      await api('/api/setup', {
        method: 'POST',
        body: {
          name: data.get('name'),
          about: data.get('about'),
          audience: data.get('audience'),
          divisions: data.getAll('divisions'),
          office: chosenLook(),
        },
      });
      preview.stop();
      onDone();
    } catch (err) {
      error.textContent = err.message;
    } finally {
      next.disabled = false;
    }
  });

  function teamCard(team, checked) {
    return h('label', { class: 'team-card' },
      h('input', { type: 'checkbox', name: 'divisions', value: team.id, checked }),
      h('span', { class: 'team-card__body' },
        h('strong', {}, team.name),
        h('span', { class: 'team-card__blurb' }, team.blurb),
        h('span', { class: 'team-card__manager' }, `Manajer: ${team.manager} · ${team.size} orang`),
      ),
      h('span', { class: 'team-card__people', 'aria-hidden': 'true' }, team.agents.slice(0, 4).map((agent) => avatarCanvas(agent.look, 'avatar avatar--small'))),
    );
  }

  return {
    fill(setup, { editing = false } = {}) {
      mode = editing ? 'edit' : 'new';
      catalog = setup.catalog;
      builder = setup.builder;
      hook('setup-heading').textContent = editing ? 'Atur kantor lu' : 'Pasang kantor AI lu';

      hook('team-options').replaceChildren(...catalog.map((team, i) => teamCard(team,
        setup.done ? setup.divisions.includes(team.id) : i < 2)));
      hook('style-options').replaceChildren(...STYLES.map((style) => h('label', { class: 'style-option' },
        h('input', { type: 'radio', name: 'style', value: style.id, checked: setup.office.style === style.id }),
        h('span', {}, h('strong', {}, style.name), h('span', { class: 'muted' }, style.blurb)),
      )));
      hook('facility-options').replaceChildren(...FACILITIES.map((facility) => h('label', { class: 'check' },
        h('input', { type: 'checkbox', name: 'facilities', value: facility.id, checked: setup.office.facilities.includes(facility.id) }),
        facility.name,
      )));

      form.elements.name.value = setup.business.name ?? '';
      form.elements.about.value = setup.business.about ?? '';
      form.elements.audience.value = setup.business.audience ?? '';
      current = 0;
      render();
    },
    show() {},
    hide() {
      preview.stop();
    },
    refresh() {},
  };
}
