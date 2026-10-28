import { h } from './dom.js';

export function renderScript(script, format) {
  if (!script) return h('p', { class: 'muted' }, 'Naskah lagi ditulis…');

  const body = format === 'reels' ? renderScenes(script) : renderSlides(script);
  const tags = Array.isArray(script.hashtags) ? script.hashtags.join(' ') : '';
  return h('div', { class: 'form' },
    script.hook && h('p', {}, h('strong', {}, 'Hook: '), script.hook),
    body,
    h('div', {},
      h('p', { class: 'muted' }, 'Caption'),
      h('p', { class: 'caption' }, script.caption ?? ''),
      tags && h('p', { class: 'muted' }, tags),
    ),
  );
}

function renderScenes(script) {
  const scenes = Array.isArray(script.scenes) ? script.scenes : [];
  return h('div', { class: 'table-scroll' },
    h('table', { class: 'scenes' },
      h('thead', {}, h('tr', {},
        h('th', { scope: 'col' }, 'Detik'),
        h('th', { scope: 'col' }, 'Visual'),
        h('th', { scope: 'col' }, 'Teks layar'),
        h('th', { scope: 'col' }, 'Suara'),
      )),
      h('tbody', {}, scenes.map((s) => h('tr', {},
        h('td', {}, `${s.from ?? '?'}–${s.to ?? '?'}`),
        h('td', {}, s.visual ?? ''),
        h('td', {}, s.onscreen ?? ''),
        h('td', {}, s.voice ?? ''),
      ))),
    ),
  );
}

function renderSlides(script) {
  const slides = Array.isArray(script.slides) ? script.slides : [];
  return h('div', { class: 'slides' }, slides.map((slide, i) => h('div', { class: 'slide' },
    h('span', { class: 'muted' }, `${i + 1}/${slides.length}`),
    h('p', { class: 'slide__headline' }, slide.headline ?? ''),
    h('p', {}, slide.body ?? ''),
    h('p', { class: 'slide__visual' }, slide.visual ?? ''),
  )));
}
