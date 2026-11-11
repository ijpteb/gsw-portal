// История клуба: достижения, чемпионские сезоны, легенды, рекорды, интересные факты и список источников.
// Факты — из history-data.js: только сверенные с NBA.com и сайтом клуба; у каждого блока — ссылки на источники.
// Рекорды, которые ещё могут обновиться, помечены датой проверки.
import * as fmt from '../format.js?v=__V__';
import {h, icon, stagger} from '../ui.js?v=__V__';
import {CHECKED, SOURCES, ACHIEVEMENTS, TITLES, LEGENDS, RECORDS, FACTS} from '../history-data.js?v=__V__';

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const day = (ymd) => fmt.calDate(ymd, {withYear: true});
const dmy = (ymd) => ymd.split('-').reverse().join('.');

/** Ссылка на источник: «NBA.com · Обзор сезона 2015/16 · 13.09.2021» — открывается в новой вкладке. */
function srcLink(key) {
  const s = SOURCES[key];
  if (!s) return null;
  return h('a', {class: 'hs-src', href: s.url, target: '_blank', rel: 'noopener noreferrer',
    title: `${s.title} — ${s.stats ? `данные на ${day(s.date)}` : day(s.date)}`},
  h('span', null, `${s.site} · ${s.short} · ${s.stats ? `на ${dmy(s.date)}` : dmy(s.date)}`), icon('external', 13));
}

function sourcesLine(keys) {
  return h('p', {class: 'hs-sources'}, h('span', {class: 'hs-sources-label'}, keys.length > 1 ? 'Источники:' : 'Источник:'),
    keys.map(srcLink));
}

/** Самая свежая дата среди источников факта — «по данным на …». */
const newest = (keys) => keys.map((k) => SOURCES[k]?.date).filter(Boolean).sort().pop();

/** Пометка о свежести: перепроверено сегодня — или по данным источника на его дату. */
function freshness(item) {
  if (item.checked) {
    return h('p', {class: 'hs-check'}, icon('clock', 15),
      h('span', null, h('b', null, `Проверено ${day(CHECKED)}.`), item.check ? ` ${item.check}` : ''));
  }
  return h('p', {class: 'hs-asof'}, `По данным источника на ${day(newest(item.src))}`);
}

function sectionHead(id, title, count, lead) {
  return h('header', {class: 'hs-head'},
    h('div', {class: 'sg-head'}, h('h2', {class: 'sg-title', id, tabindex: '-1'}, title), count ? h('span', {class: 'sg-count'}, count) : null),
    lead ? h('p', {class: 'small muted hs-lead'}, lead) : null);
}

/** Плавно прокрутить к блоку и поставить на него фокус (для клавиатуры и экранного диктора). */
function jumpTo(el) {
  if (!el) return;
  el.scrollIntoView({block: 'start', behavior: reduce.matches ? 'auto' : 'smooth'});
  el.focus({preventScroll: true});
  el.classList.remove('is-flash');
  void el.offsetWidth; // перезапуск подсветки при повторном нажатии
  el.classList.add('is-flash');
}

// --- Блоки ---------------------------------------------------------------------------------

function hero() {
  const tiles = ACHIEVEMENTS.map((a) => h('div', {class: 'hs-tile'},
    h('p', {class: 'hs-tile-value'}, a.value),
    h('p', {class: 'hs-tile-label'}, a.label),
    h('p', {class: 'hs-tile-note'}, a.note),
    a.checked ? h('p', {class: 'hs-tile-check'}, icon('clock', 13), `проверено ${day(CHECKED)}`) : null));
  const banners = TITLES.map((t) => h('li', null,
    h('button', {type: 'button', class: 'hs-banner', 'aria-label': `Чемпионы ${t.year} года: подробнее о сезоне ${t.season}`,
      onclick: () => jumpTo(document.getElementById(`hs-title-${t.year}`))},
    h('span', {class: 'hs-banner-cap'}, 'Чемпион'),
    h('span', {class: 'hs-banner-year'}, String(t.year)))));
  const keys = [...new Set(ACHIEVEMENTS.flatMap((a) => a.src))];
  return h('section', {class: 'card hs-hero', 'aria-labelledby': 'hs-ach'},
    h('h2', {class: 'eyebrow', id: 'hs-ach'}, 'Достижения'),
    h('div', {class: 'hs-tiles'}, tiles),
    h('ol', {class: 'hs-banners', 'aria-label': 'Чемпионские сезоны'}, banners),
    sourcesLine(keys));
}

function nav() {
  const items = [['hs-titles', 'Титулы'], ['hs-legends', 'Легенды'], ['hs-records', 'Рекорды'], ['hs-facts', 'Факты'],
    ['hs-sources', 'Источники']];
  return h('nav', {class: 'seg hs-nav', 'aria-label': 'Разделы истории'},
    items.map(([id, text]) => h('button', {type: 'button', class: 'seg-btn', onclick: () => jumpTo(document.getElementById(id))}, text)));
}

function titles() {
  const list = TITLES.map((t) => h('li', {class: 'hs-season'},
    h('article', {class: 'hs-season-card', id: `hs-title-${t.year}`, tabindex: '-1', 'aria-labelledby': `hs-tn-${t.year}`},
      h('div', {class: 'hs-season-year'},
        h('span', {class: 'hs-season-num'}, String(t.year)),
        h('span', {class: 'hs-season-sub'}, `сезон ${t.season}`)),
      h('div', {class: 'hs-season-body'},
        h('h3', {class: 'hs-season-name', id: `hs-tn-${t.year}`}, t.team, h('span', {class: 'hs-vs'}, ' — '), t.opp),
        h('p', {class: 'hs-season-meta'},
          h('span', {class: 'chip chip-win'}, `Финал ${t.series}`),
          t.mvp ? h('span', {class: 'chip'}, `MVP финала: ${t.mvp}`) : null),
        h('ul', {class: 'hs-list'}, t.facts.map((f) => h('li', null, f))),
        sourcesLine(t.src)))));
  return h('section', {class: 'hs-section', 'aria-labelledby': 'hs-titles'},
    sectionHead('hs-titles', 'Чемпионские сезоны', `${TITLES.length} ${fmt.plural(TITLES.length, 'титул', 'титула', 'титулов')}`,
      'Два первых титула клуб выиграл в Филадельфии, остальные — уже как «Голден Стэйт». MVP финала — по списку NBA.com.'),
    h('ol', {class: 'hs-timeline'}, list));
}

function initials(name) {
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function legends() {
  const cards = LEGENDS.map((l) => h('article', {class: 'card hs-legend', 'aria-labelledby': `hs-ln-${l.num}`},
    h('div', {class: 'hs-legend-head'},
      h('span', {class: 'hs-jersey', role: 'img', 'aria-label': `Номер ${l.num}`},
        h('span', {class: 'hs-jersey-num'}, String(l.num)),
        h('span', {class: 'hs-jersey-ini', 'aria-hidden': 'true'}, initials(l.name))),
      h('div', {class: 'hs-legend-who'},
        h('h3', {class: 'hs-legend-name', id: `hs-ln-${l.num}`}, l.name),
        h('p', {class: 'small muted'}, l.role),
        l.hof ? h('span', {class: 'chip hs-hof'}, `Зал славы — ${l.hof}`) : null)),
    h('ul', {class: 'hs-list'}, l.facts.map((f) => h('li', null, f))),
    sourcesLine(l.src)));
  return h('section', {class: 'hs-section', 'aria-labelledby': 'hs-legends'},
    sectionHead('hs-legends', 'Легенды', `${LEGENDS.length} ${fmt.plural(LEGENDS.length, 'номер', 'номера', 'номеров')}`,
      'Номера, выведенные клубом из обращения: под ними в команде больше никто не играет. «Зал славы» — Зал славы баскетбола, год включения.'),
    h('div', {class: 'hs-legends'}, cards));
}

function records() {
  const cards = RECORDS.map((r) => h('article', {class: 'card hs-record'},
    h('p', {class: 'hs-record-value'}, r.value),
    h('h3', {class: 'hs-record-what'}, r.what),
    h('p', {class: 'hs-record-who'}, h('b', null, r.who), ` · ${r.when}`),
    r.text ? h('p', {class: 'small hs-record-text'}, r.text) : null,
    freshness(r),
    sourcesLine(r.src)));
  return h('section', {class: 'hs-section', 'aria-labelledby': 'hs-records'},
    sectionHead('hs-records', 'Рекорды НБА', `${RECORDS.length} ${fmt.plural(RECORDS.length, 'рекорд', 'рекорда', 'рекордов')}`,
      `Рекорды лиги, установленные игроками и командой «Уорриорз». Те, что ещё могут обновиться, сверены заново ${day(CHECKED)}; у остальных — дата источника.`),
    h('div', {class: 'hs-records'}, cards));
}

function facts() {
  const items = FACTS.map((f) => h('li', {class: 'hs-fact'},
    h('span', {class: 'hs-fact-year'}, f.year),
    h('div', {class: 'hs-fact-body'},
      h('p', null, f.text),
      f.checked ? freshness(f) : null,
      sourcesLine(f.src))));
  return h('section', {class: 'hs-section', 'aria-labelledby': 'hs-facts'},
    sectionHead('hs-facts', 'Интересные факты', `${FACTS.length} ${fmt.plural(FACTS.length, 'факт', 'факта', 'фактов')}`),
    h('ol', {class: 'card hs-fact-list'}, items));
}

function sourceList() {
  const items = Object.values(SOURCES).map((s) => h('li', null,
    h('a', {href: s.url, target: '_blank', rel: 'noopener noreferrer', lang: 'en'}, s.title),
    h('span', {class: 'muted'}, ` — ${s.site}, ${s.stats ? `данные на ${day(s.date)}` : day(s.date)}`)));
  return h('section', {class: 'hs-section', 'aria-labelledby': 'hs-sources'},
    sectionHead('hs-sources', 'Источники', `${items.length}`,
      `Все факты сверены ${day(CHECKED)} с официальными сайтами НБА (NBA.com) и клуба (nba.com/warriors). Что подтвердить не удалось — на страницу не попало.`),
    h('div', {class: 'card'}, h('ol', {class: 'hs-source-list'}, items)));
}

export default {
  section: () => 'history',
  title: () => 'История',
  async render(view) {
    const blocks = [hero(), nav(), titles(), legends(), records(), facts(), sourceList()];
    stagger(blocks.slice(0, 3), 1);
    view.append(h('div', {class: 'page history'},
      h('header', {class: 'page-head'},
        h('p', {class: 'eyebrow'}, 'Golden State Warriors · с 1946 года'),
        h('h1', {class: 'page-title'}, 'История клуба'),
        h('p', {class: 'page-lead'},
          'Чемпионские сезоны, легенды, рекорды и интересные факты. Каждый факт сверен с официальными сайтами НБА и клуба — ссылки у каждого блока и списком внизу страницы.')),
      blocks));
    return {};
  },
};
