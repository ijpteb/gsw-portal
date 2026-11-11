// Статистика 2026/27: лидеры команды по категориям, таблица игроков с сортировкой по любому столбцу
// (в среднем за матч или за весь сезон), показатели команды и её места среди всех команд НБА.
// Все числа — готовые из ESPN. Адрес: #/stats?sort=fg3Pct&dir=asc&mode=total — «Назад» вернёт тот же вид.
import * as data from '../data.js?v=__V__';
import * as fmt from '../format.js?v=__V__';
import {h, sourceLine, noData, usable, avatar, stagger} from '../ui.js?v=__V__';
import {PCT, teamGames, limits, pctQualified, shotsText, limitText, pctOf} from '../stat-rules.js?v=__V__';

const COLS = [
  {key: 'gp', label: 'Игры', title: 'Сыгранные матчи', avg: 'gp', total: 'gp', int: true},
  {key: 'min', label: 'Минуты', avg: 'min', total: 'minTotal'},
  {key: 'pts', label: 'Очки', avg: 'pts', total: 'ptsTotal'},
  {key: 'reb', label: 'Подборы', avg: 'reb', total: 'rebTotal'},
  {key: 'ast', label: 'Передачи', avg: 'ast', total: 'astTotal'},
  {key: 'stl', label: 'Перехваты', avg: 'stl', total: 'stlTotal'},
  {key: 'blk', label: 'Блок-шоты', avg: 'blk', total: 'blkTotal'},
  {key: 'fgPct', label: '% с игры', pct: true},
  {key: 'fg3Pct', label: '% трёхочк.', title: '% трёхочковых', pct: true},
];
const MODES = [['avg', 'За матч'], ['total', 'За сезон']];
const LEADERS = [
  ['pts', 'Очки'], ['reb', 'Подборы'], ['ast', 'Передачи'], ['stl', 'Перехваты'],
  ['blk', 'Блок-шоты'], ['min', 'Минуты'], ['fgPct', '% с игры'], ['fg3Pct', '% трёхочковых'],
];
const TEAM = [
  ['pts', 'Очки за матч'], ['reb', 'Подборы за матч'], ['ast', 'Передачи за матч'], ['stl', 'Перехваты за матч'],
  ['blk', 'Блок-шоты за матч'], ['fgPct', '% с игры'], ['fg3Pct', '% трёхочковых'],
];

export default {
  section: () => 'stats',
  title: () => 'Статистика',
  async render(view, params, query) {
    const ui = {state: readState(query)};
    const draw = async (quiet) => {
      const [stats, roster, team] = await Promise.all([data.get('player_stats'), data.get('roster'), data.get('team_stats')]);
      const prevLeft = view.querySelector('.ps-box .table-scroll')?.scrollLeft;
      const page = build({stats, roster, team}, ui);
      if (quiet) page.classList.add('quiet');
      view.replaceChildren(page);
      const scroller = page.querySelector('.ps-box .table-scroll');
      if (scroller && prevLeft != null) scroller.scrollLeft = prevLeft; // пришли свежие данные — таблица на том же месте
      else if (scroller) revealSorted(scroller);
    };
    await draw(false);
    return {update: () => draw(true)};
  },
};

function readState(query) {
  const sort = query?.get('sort');
  const okSort = sort === 'name' || COLS.some((c) => c.key === sort);
  return {
    sort: okSort ? sort : 'pts',
    dir: query?.get('dir') === 'asc' ? 'asc' : (query?.get('dir') === 'desc' ? 'desc' : (sort === 'name' ? 'asc' : 'desc')),
    mode: query?.get('mode') === 'total' ? 'total' : 'avg',
  };
}

function writeState(s) {
  const q = new URLSearchParams();
  if (s.sort !== 'pts') q.set('sort', s.sort);
  if (s.dir !== (s.sort === 'name' ? 'asc' : 'desc')) q.set('dir', s.dir);
  if (s.mode !== 'avg') q.set('mode', s.mode);
  const qs = q.toString();
  const url = `#/stats${qs ? `?${qs}` : ''}`;
  if (location.hash !== url) {
    try { history.replaceState(history.state, '', url); } catch { /* не страшно */ }
  }
}

// --- Вспомогательное --------------------------------------------------------------------

/** На узком экране столбец, по которому отсортировано, может оказаться за краем — сдвигаем таблицу к нему. */
function revealSorted(scroller) {
  const th = scroller.querySelector('thead th[aria-sort]:not(.col-first)');
  if (!th || scroller.scrollWidth <= scroller.clientWidth) return;
  const box = scroller.getBoundingClientRect();
  const r = th.getBoundingClientRect();
  const sticky = scroller.querySelector('thead .col-first')?.getBoundingClientRect().width || 0;
  const left = r.left - box.left + scroller.scrollLeft;
  const right = left + r.width;
  if (right > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = right - scroller.clientWidth;
  else if (left < scroller.scrollLeft + sticky) scroller.scrollLeft = left - sticky;
}

const valueOf = (s, col, mode) => (col.pct ? pctOf(s, col.key) : s?.[mode === 'total' ? col.total : col.avg] ?? null);

function show(v, col, mode) {
  if (v == null) return '—';
  if (col.pct) return fmt.pct(v);
  return col.int || mode === 'total' ? fmt.num(v, 0) : fmt.num(v, 1);
}

const subLine = (p, s) => [p?.jersey != null ? `#${p.jersey}` : null, s ? fmt.games(s.gp) : null].filter(Boolean).join(' · ');

function nameLink(x, cls = '') {
  return x.p ? h('a', {class: cls, href: `#/player/${x.id}`}, x.name) : h('span', {class: cls}, x.name);
}

// --- Лидеры ----------------------------------------------------------------------------------

function leaderCard([key, label], players, lim) {
  const isPct = Boolean(PCT[key]);
  const pool = players.filter((x) => x.s?.[key] != null
    && (isPct ? pctQualified(x.s, key, lim) : (x.s.gp || 0) >= lim.games));
  const top = pool.sort((a, b) => b.s[key] - a.s[key] || (b.s.gp || 0) - (a.s.gp || 0)).slice(0, 3);
  const val = (x) => (isPct ? fmt.pct(x.s[key]) : fmt.num(x.s[key], 1));
  const cat = h('p', {class: 'lc-cat'}, h('span', null, label), h('span', {class: 'lc-kind'}, isPct ? 'за сезон' : 'за матч'));
  if (!top.length) {
    return h('article', {class: 'leader-card'}, cat, h('p', {class: 'muted small'}, 'Пока никто не набрал порог — см. условие ниже.'));
  }
  const [first, ...rest] = top;
  // Место — по числу игроков с бóльшим значением: при равенстве у обоих одно и то же место.
  const rankOf = (x) => 1 + pool.filter((y) => y.s[key] > x.s[key]).length;
  return h('article', {class: 'leader-card'},
    cat,
    h('div', {class: 'lc-top'},
      first.p ? h('a', {href: `#/player/${first.id}`, tabindex: '-1', 'aria-hidden': 'true', class: 'lc-photo'}, avatar(first.p))
        : avatar({name: first.name}),
      h('div', {class: 'lc-who'}, nameLink(first, 'lc-name'),
        h('span', {class: 'lc-sub'}, isPct ? shotsText(first.s, key) : subLine(first.p, first.s))),
      h('span', {class: 'lc-val'}, val(first))),
    rest.length ? h('ol', {class: 'lc-rest'}, rest.map((x) => h('li', null,
      h('span', {class: 'lc-rank', title: rankOf(x) === 1 ? 'делит 1-е место' : null}, rankOf(x)),
      nameLink(x, 'lc-rest-name'),
      h('span', {class: 'lc-rest-val'}, val(x)),
      isPct ? h('span', {class: 'lc-rest-sub'}, shotsText(x.s, key)) : null))) : null);
}

function leadersBlock(players, lim, env) {
  const cards = LEADERS.map((cat) => leaderCard(cat, players, lim));
  return h('section', {class: 'stats-block', 'aria-labelledby': 'leaders-title'},
    h('h2', {class: 'section-title', id: 'leaders-title'}, 'Лидеры команды'),
    h('div', {class: 'leaders'}, cards),
    h('p', {class: 'note'},
      `Чтобы лидером не стал игрок после одного удачного матча или пары бросков, у сайта есть пороги. `
      + `По средним за матч — только сыгравшие не меньше половины матчей команды (сейчас — ${lim.games} из ${lim.gp}). `
      + `% с игры — ${limitText('fgPct', lim)}. % трёхочковых — ${limitText('fg3Pct', lim)}.`),
    sourceLine(env, {extra: 'регулярный чемпионат 2026/27'}));
}

// --- Таблица игроков --------------------------------------------------------------------

function sortRows(rows, state, lim) {
  const sign = state.dir === 'asc' ? 1 : -1;
  if (state.sort === 'name') {
    return [...rows].sort((a, b) => sign * (a.last || a.name).localeCompare(b.last || b.name, 'en'));
  }
  const col = COLS.find((c) => c.key === state.sort);
  return [...rows].sort((a, b) => {
    const va = valueOf(a.s, col, state.mode);
    const vb = valueOf(b.s, col, state.mode);
    if (va == null || vb == null) return va == null && vb == null ? 0 : (va == null ? 1 : -1);
    if (col.pct) { // набравшие порог — выше остальных при любом направлении
      const qa = pctQualified(a.s, col.key, lim);
      const qb = pctQualified(b.s, col.key, lim);
      if (qa !== qb) return qa ? -1 : 1;
    }
    return sign * (va - vb) || (b.s.pts ?? 0) - (a.s.pts ?? 0);
  });
}

function playersTable(players, notPlayed, state, lim, env, rerender) {
  const setState = (patch) => {
    Object.assign(state, patch);
    writeState(state);
    rerender(document.activeElement?.dataset?.focusKey); // фокус остаётся на нажатой кнопке
  };
  const sortBtn = (key, label, title) => {
    const active = state.sort === key;
    return h('button', {type: 'button', class: `th-sort${active ? ' is-active' : ''}`, title: title || null, 'data-focus-key': key,
      onclick: () => setState(active ? {dir: state.dir === 'asc' ? 'desc' : 'asc'}
        : {sort: key, dir: key === 'name' ? 'asc' : 'desc'})},
    label, h('span', {class: 'th-arrow', 'aria-hidden': 'true'}, active ? (state.dir === 'asc' ? '↑' : '↓') : ''));
  };
  const ariaSort = (key) => (state.sort === key ? (state.dir === 'asc' ? 'ascending' : 'descending') : null);
  const rows = sortRows(players, state, lim).map((x) => h('tr', {class: x.p ? '' : 'is-gone'},
    h('th', {scope: 'row', class: 'col-first ps-first'},
      h('span', {class: 'ps-who'}, avatar(x.p || {name: x.name}, 'avatar-sm'),
        h('span', {class: 'ps-name'}, nameLink(x, 'ps-link'),
          h('small', null, x.p ? [x.p.jersey != null ? `#${x.p.jersey}` : null, fmt.position(x.p.position)].filter(Boolean).join(' · ')
            : 'не в нынешнем составе')))),
    COLS.map((col) => {
      const v = valueOf(x.s, col, state.mode);
      const low = col.pct && !pctQualified(x.s, col.key, lim);
      return h('td', {class: `num${state.sort === col.key ? ' is-sorted' : ''}${low ? ' is-low' : ''}`,
        title: low ? `Попыток меньше порога: нужно ${limitText(col.key, lim)}` : null},
      col.pct ? [h('span', null, show(v, col)), h('small', {class: 'ps-shots'}, shotsText(x.s, col.key))] : show(v, col, state.mode));
    })));
  const table = h('div', {class: 'table-scroll', tabindex: '0', role: 'region', 'aria-label': 'Статистика игроков, прокручивается вбок'},
    h('table', {class: 'data-table ps-table'},
      h('caption', {class: 'visually-hidden'},
        `Статистика игроков ГСВ, ${state.mode === 'total' ? 'всего за сезон' : 'в среднем за матч'}; нажмите на заголовок столбца, чтобы отсортировать`),
      h('thead', null, h('tr', null,
        h('th', {scope: 'col', class: 'col-first', 'aria-sort': ariaSort('name')}, sortBtn('name', 'Игрок')),
        COLS.map((col) => h('th', {scope: 'col', class: 'num', 'aria-sort': ariaSort(col.key)}, sortBtn(col.key, col.label, col.title))))),
      h('tbody', null, rows)));
  const modeSeg = h('div', {class: 'seg seg-inline', role: 'group', 'aria-label': 'Показатели'},
    MODES.map(([v, text]) => h('button', {type: 'button', class: 'seg-btn', 'aria-pressed': String(state.mode === v), 'data-focus-key': `mode-${v}`,
      onclick: () => setState({mode: v})}, text)));
  return h('section', {class: 'card table-card', 'aria-labelledby': 'players-title'},
    h('header', {class: 'card-head ps-head'}, h('h2', {class: 'eyebrow', id: 'players-title'}, 'Игроки'), modeSeg),
    h('p', {class: 'small muted'}, state.mode === 'total'
      ? 'Всего за сезон. Нажмите на заголовок столбца — таблица отсортируется по нему (повторное нажатие — в обратном порядке).'
      : 'В среднем за матч. Нажмите на заголовок столбца — таблица отсортируется по нему (повторное нажатие — в обратном порядке).'),
    table,
    h('p', {class: 'small muted'}, 'Под процентом — попадания из попыток за сезон. Бледным — меньше порога: такие игроки при сортировке по проценту идут после остальных.'),
    notPlayed.length ? h('p', {class: 'small'}, h('span', {class: 'muted'}, 'В этом сезоне не играли (по данным ESPN): '),
      notPlayed.map((p, i) => [i ? ', ' : '', h('a', {href: `#/player/${p.id}`}, p.name)])) : null,
    sourceLine(env, {extra: 'регулярный чемпионат 2026/27'}));
}

// --- Команда ------------------------------------------------------------------------------------

function teamBlock(env) {
  const title = h('header', {class: 'card-head'}, h('h2', {class: 'eyebrow'}, 'Команда · место среди всех команд НБА'));
  if (!usable(env)) return h('section', {class: 'card'}, title, noData(env, 'Статистика команды'));
  const {team: t, ranks = {}, teamsCount} = env.data;
  if (t?.gp != null) title.append(h('span', {class: 'muted small'}, fmt.games(t.gp)));
  const rows = TEAM.map(([key, label]) => {
    const v = t?.[key];
    const r = ranks[key];
    const of = r?.of || teamsCount || 30;
    const share = r ? Math.max(4, Math.round(((of - r.rank + 1) / of) * 100)) : 0;
    const tier = !r ? '' : r.rank <= 10 ? ' is-top' : r.rank > 20 ? ' is-low' : '';
    return h('div', {class: `tm-row${tier}`},
      h('span', {class: 'tm-label'}, label),
      h('span', {class: 'tm-val'}, v == null ? '—' : (PCT[key] ? fmt.pct(v) : fmt.num(v, 1))),
      h('div', {class: 'tm-rank'},
        h('span', {class: 'rank-bar', 'aria-hidden': 'true'}, h('span', {style: {'--w': `${share}%`}})),
        h('span', {class: 'tm-rank-text'}, r ? `${fmt.place(r.rank)} из ${of}${r.tied ? ' (делит с другими)' : ''}` : 'место неизвестно')));
  });
  return h('section', {class: 'card', 'aria-label': 'Показатели команды'},
    title,
    h('div', {class: 'tm-rows'}, rows),
    sourceLine(env, {extra: 'места — по средним за матч среди всех команд лиги'}));
}

// --- Страница ---------------------------------------------------------------------------------------

function build(env, ui) {
  const head = h('header', {class: 'page-head'},
    h('p', {class: 'eyebrow'}, 'Сезон 2026/27'),
    h('h1', {class: 'page-title'}, 'Статистика'));
  const page = h('div', {class: 'page stats'}, head);
  if (!usable(env.stats)) {
    page.append(noData(env.stats, 'Статистика игроков'), teamBlock(env.team));
    return page;
  }
  const roster = usable(env.roster) ? env.roster.data.players : [];
  const byId = new Map(roster.map((p) => [p.id, p]));
  const players = env.stats.data.players.map((x) => {
    const p = byId.get(x.id) || null;
    return {id: x.id, p, s: x.stats || {}, name: p?.name || x.name, last: p?.lastName || (x.name || '').split(' ').slice(-1)[0]};
  });
  const played = new Set(players.map((x) => x.id));
  const notPlayed = roster.filter((p) => !played.has(p.id));
  const lim = limits(teamGames(env.team, env.stats.data.players));
  head.append(h('p', {class: 'page-lead'},
    `Регулярный чемпионат: ${fmt.games(lim.gp)} команды, в статистике ${players.length} ${fmt.plural(players.length, 'игрок', 'игрока', 'игроков')}.`));

  const tableBox = h('div', {class: 'ps-box'});
  // Перерисовка после сортировки: таблица остаётся прокрученной вбок там же, фокус — на нажатой кнопке.
  const renderTable = (focusKey) => {
    const left = tableBox.querySelector('.table-scroll')?.scrollLeft || 0;
    tableBox.replaceChildren(playersTable(players, notPlayed, ui.state, lim, [env.stats, env.roster], renderTable));
    const scroller = tableBox.querySelector('.table-scroll');
    if (scroller) scroller.scrollLeft = left;
    if (focusKey) tableBox.querySelector(`[data-focus-key="${focusKey}"]`)?.focus({preventScroll: true});
  };
  renderTable();

  const blocks = [leadersBlock(players, lim, [env.stats, env.roster]), tableBox, teamBlock(env.team)];
  stagger(blocks, 1);
  page.append(...blocks);
  return page;
}
