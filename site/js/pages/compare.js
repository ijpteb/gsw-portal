// Сравнение двух игроков ГСВ: показатели сезона рядом, лучший по каждому подсвечен золотым.
// Адрес: #/compare?a=3975&b=4709138 — выбор сохраняется, «Назад» возвращает к нему.
import * as data from '../data.js?v=__V__';
import * as fmt from '../format.js?v=__V__';
import {h, icon, sourceLine, noData, usable, playerPhoto, avatar, stagger} from '../ui.js?v=__V__';
import {teamGames, limits, pctOf, pctQualified, shotsText, limitText} from '../stat-rules.js?v=__V__';

// lower — меньше значит лучше; pct — процент (сравниваем, только если у обоих бросков не меньше порога).
const ROWS = [
  {key: 'gp', label: 'Сыграно матчей', digits: 0},
  {key: 'min', label: 'Минуты'},
  {key: 'pts', label: 'Очки'},
  {key: 'reb', label: 'Подборы'},
  {key: 'ast', label: 'Передачи'},
  {key: 'stl', label: 'Перехваты'},
  {key: 'blk', label: 'Блок-шоты'},
  {key: 'fgPct', label: '% с игры', pct: true},
  {key: 'fg3Pct', label: '% трёхочковых', pct: true},
  {key: 'ftPct', label: '% штрафных', pct: true},
  {key: 'tov', label: 'Потери', lower: true},
];

export default {
  section: () => 'compare',
  title: () => 'Сравнение',
  async render(view, params, query) {
    const ui = {a: query?.get('a') || null, b: query?.get('b') || null};
    let envs = null;
    const paint = (quiet, focusSide) => {
      const page = build(envs, ui, () => paint(true, document.activeElement?.dataset?.side));
      if (quiet) page.classList.add('quiet');
      view.replaceChildren(page);
      if (focusSide) view.querySelector(`[data-side="${focusSide}"]`)?.focus({preventScroll: true});
    };
    const draw = async (quiet) => {
      const [roster, stats, team] = await Promise.all([data.get('roster'), data.get('player_stats'), data.get('team_stats')]);
      envs = {roster, stats, team};
      paint(quiet);
    };
    await draw(false);
    return {update: () => draw(true)};
  },
};

function writeState(ui) {
  const url = `#/compare?a=${encodeURIComponent(ui.a)}&b=${encodeURIComponent(ui.b)}`;
  if (location.hash !== url) {
    try { history.replaceState(history.state, '', url); } catch { /* не страшно */ }
  }
}

const jerseyNum = (p) => {
  const n = parseInt(p.jersey, 10);
  return Number.isNaN(n) ? 999 : n + (p.jersey.length > 1 && p.jersey.startsWith('0') ? 0.5 : 0);
};

/** Кого показать, если в адресе никого (или кого-то уже нет в составе): двух самых результативных. */
function pickDefaults(ui, players, statsById, lim) {
  const ids = new Set(players.map((p) => p.id));
  const ranked = players.filter((p) => statsById.has(p.id)).sort((x, y) => {
    const sx = statsById.get(x.id);
    const sy = statsById.get(y.id);
    const qx = (sx.gp || 0) >= lim.games;
    const qy = (sy.gp || 0) >= lim.games;
    return (qx === qy ? 0 : qx ? -1 : 1) || (sy.pts ?? 0) - (sx.pts ?? 0);
  }).map((p) => p.id);
  const order = [...ranked, ...players.map((p) => p.id).filter((id) => !ranked.includes(id))];
  if (!ids.has(ui.a)) ui.a = order.find((id) => id !== ui.b) || null;
  if (!ids.has(ui.b) || ui.b === ui.a) ui.b = order.find((id) => id !== ui.a) || null;
}

// --- Части страницы --------------------------------------------------------------------

function picker(side, p, players, ui, repaint) {
  const select = h('select', {class: 'sort-select cmp-select', 'data-side': side,
    'aria-label': side === 'a' ? 'Первый игрок' : 'Второй игрок',
    onchange: (e) => {
      ui[side] = e.target.value;
      if (ui.a === ui.b) ui[side === 'a' ? 'b' : 'a'] = p.id; // выбрали того же — меняем местами
      writeState(ui);
      repaint();
    }},
  players.map((x) => h('option', {value: x.id}, `${x.jersey != null ? `#${x.jersey} ` : ''}${x.name}`)));
  select.value = p.id;
  return h('div', {class: `cmp-pick cmp-pick-${side}`},
    h('a', {class: 'cmp-photo', href: `#/player/${p.id}`, tabindex: '-1', 'aria-hidden': 'true'},
      p.jersey != null ? h('span', {class: 'cmp-num'}, p.jersey) : null, playerPhoto(p)),
    h('p', {class: 'rc-eyebrow'}, [p.jersey != null ? `#${p.jersey}` : null, fmt.position(p.position)].filter(Boolean).join(' · ')),
    h('a', {class: 'cmp-name', href: `#/player/${p.id}`}, p.name),
    select);
}

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

function statRow(row, A, B, lim) {
  const digits = row.digits ?? 1;
  const value = (x) => (row.pct ? pctOf(x.s, row.key) : x.s?.[row.key] ?? null);
  const va = value(A);
  const vb = value(B);
  let note = null;
  if (row.pct && A.s && B.s && !(pctQualified(A.s, row.key, lim) && pctQualified(B.s, row.key, lim))) {
    note = 'мало бросков — не сравниваем';
  }
  let best = null;
  if (va != null && vb != null && !note) {
    // сравниваем то, что видно на экране (с одним знаком после запятой)
    const ra = round(va, digits);
    const rb = round(vb, digits);
    best = ra === rb ? 'tie' : (row.lower ? ra < rb : ra > rb) ? 'a' : 'b';
  }
  const isBest = (side) => best === side || best === 'tie';
  const show = (v) => (v == null ? '—' : row.pct ? fmt.pct(v) : fmt.num(v, digits));
  const max = Math.max(va ?? 0, vb ?? 0) || 1;
  const width = (v) => `${v == null ? 0 : Math.max(2, Math.round((v / max) * 100))}%`;
  const val = (side, x, v) => h('div', {class: `cmp-val cmp-${side}${isBest(side) ? ' is-best' : ''}`},
    h('b', null, show(v)),
    isBest(side) ? h('span', {class: 'visually-hidden'}, best === 'tie' ? ' (поровну)' : ' (лучше)') : null,
    row.pct && x.s ? h('small', null, shotsText(x.s, row.key) || '—') : null);
  return h('div', {class: 'cmp-row'},
    val('a', A, va),
    h('div', {class: 'cmp-label'}, row.label,
      row.lower ? h('small', null, 'меньше — лучше') : null,
      note ? h('small', {class: 'cmp-note'}, note) : null),
    val('b', B, vb),
    h('div', {class: 'cmp-bars', 'aria-hidden': 'true'},
      h('span', {class: `cmp-bar cmp-bar-a${isBest('a') ? ' is-best' : ''}`}, h('span', {style: {'--w': width(va)}})),
      h('span', {class: `cmp-bar cmp-bar-b${isBest('b') ? ' is-best' : ''}`}, h('span', {style: {'--w': width(vb)}}))));
}

function bioRow(label, a, b) {
  return h('div', {class: 'cmp-row cmp-row-plain'},
    h('div', {class: 'cmp-val cmp-a'}, h('b', null, a)), h('div', {class: 'cmp-label'}, label), h('div', {class: 'cmp-val cmp-b'}, h('b', null, b)));
}

const exp = (p) => (p.experience == null ? '—' : p.experience === 0 ? 'новичок' : `${p.experience}-й`);

// --- Страница ------------------------------------------------------------------------------

function build(env, ui, repaint) {
  const head = h('header', {class: 'page-head'},
    h('p', {class: 'eyebrow'}, 'Сезон 2026/27'),
    h('h1', {class: 'page-title'}, 'Сравнение игроков'),
    h('p', {class: 'page-lead'}, 'Выберите двух игроков ГСВ — по каждому показателю лучший подсвечен золотым.'));
  const page = h('div', {class: 'page compare'}, head);
  if (!usable(env.roster) || env.roster.data.players.length < 2) {
    page.append(noData(env.roster, 'Состав'));
    return page;
  }
  const players = [...env.roster.data.players].sort((x, y) => jerseyNum(x) - jerseyNum(y));
  const statsOk = usable(env.stats);
  const statsById = new Map((statsOk ? env.stats.data.players : []).map((x) => [x.id, x.stats]));
  const lim = limits(teamGames(env.team, statsOk ? env.stats.data.players : []));
  pickDefaults(ui, players, statsById, lim);
  writeState(ui);
  const byId = new Map(players.map((p) => [p.id, p]));
  const A = {p: byId.get(ui.a), s: statsById.get(ui.a) || null};
  const B = {p: byId.get(ui.b), s: statsById.get(ui.b) || null};

  const swap = h('button', {type: 'button', class: 'cmp-swap', 'aria-label': 'Поменять игроков местами', title: 'Поменять местами',
    onclick: () => { [ui.a, ui.b] = [ui.b, ui.a]; writeState(ui); repaint(); }}, icon('compare', 20));
  const picks = h('div', {class: 'cmp-picks'}, picker('a', A.p, players, ui, repaint), swap, picker('b', B.p, players, ui, repaint));

  const notPlayed = [A, B].filter((x) => statsOk && !x.s).map((x) => x.p.name);
  const statsCard = h('section', {class: 'card cmp-card', 'aria-label': 'Показатели сезона'},
    h('header', {class: 'card-head'}, h('h2', {class: 'eyebrow'}, 'Сезон 2026/27 · в среднем за матч')),
    // Имена «прилипают» к верху экрана — при прокрутке видно, где кто.
    !statsOk ? null : h('div', {class: 'cmp-sticky', 'aria-hidden': 'true'},
      h('span', {class: 'cmp-sticky-a'}, avatar(A.p, 'avatar-xs'), h('span', null, A.p.lastName || A.p.name)),
      h('span', {class: 'cmp-sticky-b'}, h('span', null, B.p.lastName || B.p.name), avatar(B.p, 'avatar-xs'))),
    !statsOk ? noData(env.stats, 'Статистика игроков') : null,
    notPlayed.length ? h('p', {class: 'note'}, `${notPlayed.join(' и ')} в этом сезоне не ${notPlayed.length > 1 ? 'играли' : 'играл'} — статистики нет, сравнивать нечего.`) : null,
    statsOk ? h('div', {class: 'cmp-rows'}, ROWS.map((row) => statRow(row, A, B, lim))) : null,
    statsOk ? h('p', {class: 'small muted'},
      `Проценты сравниваем, только если у обоих достаточно бросков: с игры — ${limitText('fgPct', lim)}, `
      + `трёхочковые — ${limitText('fg3Pct', lim)}, штрафные — ${limitText('ftPct', lim)}. `
      + 'Под процентом — попадания из попыток за сезон.') : null,
    sourceLine([env.stats, env.team], {extra: 'регулярный чемпионат 2026/27'}));

  const bioCard = h('section', {class: 'card cmp-card', 'aria-label': 'Об игроках'},
    h('header', {class: 'card-head'}, h('h2', {class: 'eyebrow'}, 'Об игроках')),
    h('div', {class: 'cmp-rows'},
      bioRow('Позиция', fmt.position(A.p.position), fmt.position(B.p.position)),
      bioRow('Рост', A.p.heightCm ? `${A.p.heightCm} см` : '—', B.p.heightCm ? `${B.p.heightCm} см` : '—'),
      bioRow('Вес', A.p.weightKg ? `${A.p.weightKg} кг` : '—', B.p.weightKg ? `${B.p.weightKg} кг` : '—'),
      bioRow('Возраст', fmt.years(A.p.age), fmt.years(B.p.age)),
      bioRow('Сезон в НБА', exp(A.p), exp(B.p))),
    sourceLine(env.roster));

  const blocks = [picks, statsCard, bioCard];
  stagger(blocks, 1);
  page.append(...blocks);
  return page;
}
