// Состав: все игроки — фото, номер, позиция, рост, возраст, средние за сезон, травмы.
// Фильтры (позиция, в строю / травмированы) и сортировка хранятся в адресе страницы:
// #/roster?pos=G&status=out&sort=pts — так «Назад» из карточки игрока возвращает тот же вид.
import * as data from '../data.js?v=__V__';
import * as fmt from '../format.js?v=__V__';
import {h, playerPhoto, starButton, sourceLine, noData, emptyState, usable, injuryOf, statusChip} from '../ui.js?v=__V__';
import {canAnimate, animateList} from '../transitions.js?v=__V__';

const POSITIONS = [['all', 'Все'], ['G', 'Защитники'], ['F', 'Форварды'], ['C', 'Центровые']];
const STATUSES = [['all', 'Все'], ['ok', 'В строю'], ['out', 'Травмированы']];
// ESPN отдаёт позицию буквой (G, F, C), но на всякий случай понимаем и подробные обозначения.
const GROUP = {G: 'G', PG: 'G', SG: 'G', 'G-F': 'G', F: 'F', SF: 'F', PF: 'F', 'F-G': 'F', 'F-C': 'F', C: 'C', 'C-F': 'C'};

const jerseyNum = (p) => {
  const n = parseInt(p.jersey, 10);
  return Number.isNaN(n) ? 999 : n + (p.jersey.length > 1 && p.jersey.startsWith('0') ? 0.5 : 0); // «00» — после «0»
};
const byJersey = (a, b) => jerseyNum(a.p) - jerseyNum(b.p);

// Сортировка: по номеру и фамилии — по возрастанию; по показателям, возрасту и росту — от большего к меньшему.
// У кого показателя нет (не играл в сезоне) — в конце, по номеру.
const SORTS = {
  num: {label: 'по номеру'},
  name: {label: 'по фамилии', cmp: (a, b) => (a.p.lastName || a.p.name || '').localeCompare(b.p.lastName || b.p.name || '', 'en')},
  pts: {label: 'по очкам', key: (x) => x.s?.pts},
  reb: {label: 'по подборам', key: (x) => x.s?.reb},
  ast: {label: 'по передачам', key: (x) => x.s?.ast},
  min: {label: 'по минутам', key: (x) => x.s?.min},
  gp: {label: 'по числу игр', key: (x) => x.s?.gp},
  // по возрасту — старшие выше; точнее, чем по полным годам, — по дате рождения
  age: {label: 'по возрасту', key: (x) => (x.p.birthDate ? -Date.parse(x.p.birthDate) : null)},
  height: {label: 'по росту', key: (x) => x.p.heightCm},
};

function sorted(list, sort) {
  const rule = SORTS[sort] || SORTS.num;
  return [...list].sort((a, b) => {
    if (rule.cmp) return rule.cmp(a, b) || byJersey(a, b);
    if (rule.key) {
      const ka = rule.key(a);
      const kb = rule.key(b);
      if (ka == null && kb != null) return 1;
      if (kb == null && ka != null) return -1;
      if (ka != null && kb != null && ka !== kb) return kb - ka;
    }
    return byJersey(a, b);
  });
}

function readState(query) {
  const pick = (v, allowed, dflt) => (allowed.includes(v) ? v : dflt);
  return {
    pos: pick(query?.get('pos'), POSITIONS.map(([v]) => v), 'all'),
    st: pick(query?.get('status'), STATUSES.map(([v]) => v), 'all'),
    sort: pick(query?.get('sort'), Object.keys(SORTS), 'num'),
  };
}

function writeState(state) {
  const q = new URLSearchParams();
  if (state.pos !== 'all') q.set('pos', state.pos);
  if (state.st !== 'all') q.set('status', state.st);
  if (state.sort !== 'num') q.set('sort', state.sort);
  const qs = q.toString();
  const url = `#/roster${qs ? `?${qs}` : ''}`;
  if (location.hash !== url) {
    try { history.replaceState(history.state, '', url); } catch { /* браузер ограничил частоту — не страшно */ }
  }
}

const STAT_CELLS = [['pts', 'очки'], ['reb', 'подборы'], ['ast', 'передачи'], ['min', 'минуты']];

function statsPart(x, statsOk) {
  if (x.s) {
    return h('div', {class: 'rc-stats'},
      h('p', {class: 'rc-cap'}, `В среднем за матч · ${fmt.games(x.s.gp)}`),
      h('div', {class: 'mini-stats'}, STAT_CELLS.map(([k, label]) => h('div', {class: 'mini-stat', 'data-stat': k},
        h('span', {class: 'mini-stat-value'}, fmt.num(x.s[k])), h('span', {class: 'mini-stat-label'}, label)))));
  }
  // ESPN не включает в статистику тех, кто не провёл ни одного матча, — это «не играл», а не нули.
  return h('p', {class: 'rc-none'}, statsOk ? 'В этом сезоне не играл' : 'Статистика сейчас недоступна — причина ниже');
}

function card(x, statsOk) {
  const {p, inj} = x;
  const href = `#/player/${p.id}`;
  return h('article', {class: 'rc', 'data-id': p.id},
    h('div', {class: 'rc-photo'},
      p.jersey != null ? h('span', {class: 'rc-num', 'aria-hidden': 'true'}, p.jersey) : null,
      playerPhoto(p)),
    h('div', {class: 'rc-body'},
      h('p', {class: 'rc-eyebrow'}, [p.jersey != null ? `#${p.jersey}` : null, fmt.position(p.position)].filter(Boolean).join(' · ')),
      h('h2', {class: 'rc-name'}, h('a', {class: 'rc-link', href}, p.name)),
      h('p', {class: 'rc-meta'}, [p.heightCm ? `${p.heightCm} см` : null, p.age != null ? fmt.years(p.age) : null].filter(Boolean).join(' · ') || '—'),
      inj ? h('p', {class: 'rc-status'}, statusChip(inj)) : null),
    statsPart(x, statsOk),
    h('span', {class: 'rc-star'}, starButton(p)));
}

export default {
  section: () => 'roster',
  title: () => 'Состав',
  async render(view, params, query) {
    const state = readState(query);
    const draw = async (quiet) => {
      const [roster, stats, injuries] = await Promise.all([data.get('roster'), data.get('player_stats'), data.get('injuries')]);
      const page = build({roster, stats, injuries}, state);
      if (quiet) page.classList.add('quiet');
      view.replaceChildren(page);
    };

    await draw(false);
    return {update: () => draw(true)};
  },
};

function build(env, state) {
  const head = h('header', {class: 'page-head'},
    h('p', {class: 'eyebrow'}, 'Сезон 2026/27'),
    h('h1', {class: 'page-title'}, 'Состав'));
  if (!usable(env.roster)) {
    return h('div', {class: 'page roster'}, head, noData(env.roster, 'Состав'));
  }

  const statsOk = usable(env.stats);
  const statsById = new Map((statsOk ? env.stats.data.players : []).map((x) => [x.id, x.stats]));
  const all = env.roster.data.players.map((p) => ({
    p, s: statsById.get(p.id) || null, inj: injuryOf(p, env.injuries), group: GROUP[p.position] || null,
  }));
  const out = all.filter((x) => x.inj).length;
  head.append(h('p', {class: 'page-lead'},
    `${all.length} ${fmt.plural(all.length, 'игрок', 'игрока', 'игроков')} · в строю ${all.length - out} · травмированы ${out}`));

  // Карточки создаются один раз; фильтры только прячут и переставляют их (так работает плавная перестановка).
  const cards = new Map(all.map((x) => [x.p.id, card(x, statsOk)]));
  const grid = h('div', {class: 'roster-grid'});
  [...cards.values()].forEach((c, i) => {
    c.classList.add('reveal');
    c.style.setProperty('--i', String(Math.min(i, 8)));
  });
  const count = h('p', {class: 'roster-count', 'aria-live': 'polite'});
  const empty = emptyState({iconName: 'users', title: 'Никто не подходит под выбранные условия',
    action: h('button', {type: 'button', class: 'btn', onclick: () => set({pos: 'all', st: 'all'})}, 'Показать всех')});

  const matches = (x, s) => (s.pos === 'all' || x.group === s.pos)
    && (s.st === 'all' || (s.st === 'out' ? Boolean(x.inj) : !x.inj));

  const segButtons = [];
  const seg = (label, key, options) => h('div', {class: 'seg', role: 'group', 'aria-label': label},
    options.map(([v, text]) => {
      const b = h('button', {type: 'button', class: 'seg-btn', 'data-key': key, 'data-v': v,
        onclick: () => set({[key]: v})}, text, h('span', {class: 'seg-count'}));
      segButtons.push(b);
      return b;
    }));
  const select = h('select', {class: 'sort-select', onchange: (e) => set({sort: e.target.value})},
  Object.entries(SORTS).map(([v, r]) => h('option', {value: v}, r.label)));

  const toolbar = h('div', {class: 'roster-tools'},
    seg('Позиция', 'pos', POSITIONS),
    seg('Состояние', 'st', STATUSES),
    h('label', {class: 'sort'}, h('span', {class: 'sort-label'}, 'Сортировка'), select));

  function apply() {
    for (const b of segButtons) {
      const {key, v} = b.dataset;
      b.setAttribute('aria-pressed', String(state[key] === v));
      // число на кнопке — сколько будет показано, если её нажать (при остальных фильтрах как сейчас)
      const n = all.filter((x) => matches(x, {...state, [key]: v})).length;
      b.querySelector('.seg-count').textContent = String(n);
    }
    select.value = state.sort;
    const shown = sorted(all.filter((x) => matches(x, state)), state.sort);
    const shownIds = new Set(shown.map((x) => x.p.id));
    for (const [id, c] of cards) c.hidden = !shownIds.has(id);
    grid.append(...shown.map((x) => cards.get(x.p.id)), ...all.filter((x) => !shownIds.has(x.p.id)).map((x) => cards.get(x.p.id)));
    grid.dataset.sort = state.sort;
    count.textContent = shown.length === all.length ? `Показаны все: ${all.length}`
      : `Показано ${shown.length} из ${all.length}`;
    empty.hidden = shown.length > 0;
  }

  function set(patch) {
    Object.assign(state, patch);
    writeState(state);
    // Карточки плавно переезжают на новые места (если браузер умеет и не включено «уменьшить движение»).
    grid.classList.add('quiet'); // появление карточек «снизу» — только при первом показе
    if (canAnimate()) animateList([...cards.values()], apply);
    else apply();
  }

  apply();
  return h('div', {class: 'page roster'}, head, toolbar, count, grid, empty,
    sourceLine([env.roster, env.stats, env.injuries], {extra: 'статистика — средние за матч в регулярном сезоне 2026/27'}));
}
