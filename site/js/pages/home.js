// Главная: баннер, матч сейчас / следующий (с обратным отсчётом), последний матч,
// место на Западе, последние новости, избранные игроки.
import * as data from '../data.js?v=__V__';
import * as fmt from '../format.js?v=__V__';
import {h, icon, sourceLine, teamLogo, emptyState, noData, skeleton, stagger, usable} from '../ui.js?v=__V__';
import {lastGame, nextGame, liveGame} from '../games.js?v=__V__';
import {loadFavorites, favoritesBlock} from '../components.js?v=__V__';

const GS_FALLBACK = {abbr: 'GS', name: 'Golden State Warriors', shortName: 'Warriors', logo: 'img/teams/gs.png'};
const CATS = {injury: 'Травмы', trade: 'Обмены', interview: 'Интервью', other: 'Остальное'};

export default {
  section: () => 'home',
  title: () => 'Главная',
  async render(view) {
    view.append(loadingHome());
    let timers = [];
    const draw = async (quiet) => {
      const names = ['status', 'team', 'schedule', 'live', 'standings', 'news', 'roster', 'player_stats'];
      const envs = await Promise.all(names.map((n) => data.get(n)));
      const d = Object.fromEntries(names.map((n, i) => [n, envs[i]]));
      d.fav = await loadFavorites();
      timers.forEach(clearInterval);
      timers = [];
      const page = build(d, timers);
      if (quiet) page.classList.add('quiet');
      view.replaceChildren(page);
    };
    await draw(false);
    const onFav = () => draw(true);
    window.addEventListener('favorites-change', onFav);
    return {
      update: () => draw(true),
      destroy: () => {
        timers.forEach(clearInterval);
        window.removeEventListener('favorites-change', onFav);
      },
    };
  },
};

function loadingHome() {
  return h('div', {class: 'home', 'aria-busy': 'true'},
    h('p', {class: 'visually-hidden'}, 'Загружаю данные…'),
    skeleton('skeleton-hero'),
    h('div', {class: 'home-grid'}, ['area-next', 'area-last', 'area-standings', 'area-news'].map((a) => skeleton(a))));
}

function build(d, timers) {
  const gs = usable(d.team) ? {...GS_FALLBACK, ...d.team.data} : GS_FALLBACK;
  const grid = h('div', {class: 'home-grid'},
    matchNowCard(d, gs, timers),
    lastGameCard(d, gs),
    standingsCard(d),
    newsCard(d),
    favoritesCard(d));
  stagger([...grid.children], 1);
  return h('div', {class: 'home'}, hero(d, gs), grid);
}

// --- Карточка-обёртка ----------------------------------------------------------------

function card(area, title, extra, ...body) {
  return h('section', {class: `card ${area}`, 'aria-label': title},
    h('header', {class: 'card-head'}, h('h2', {class: 'eyebrow'}, title), extra),
    ...body);
}

// --- Баннер --------------------------------------------------------------------------

function gswEntry(env) {
  return usable(env) ? env.data.entries.find((e) => e.team.abbr === 'GS') : null;
}

function streakFact(streak) {
  const m = /^([WL])(\d+)$/.exec(streak || '');
  if (!m) return null;
  const n = Number(m[2]);
  return m[1] === 'W'
    ? {value: String(n), label: `${fmt.plural(n, 'победа', 'победы', 'побед')} подряд`}
    : {value: String(n), label: `${fmt.plural(n, 'поражение', 'поражения', 'поражений')} подряд`};
}

function topScorers(d, n = 5) {
  if (!usable(d.player_stats) || !usable(d.roster)) return [];
  const roster = new Map(d.roster.data.players.map((p) => [p.id, p]));
  const me = gswEntry(d.standings);
  const teamGames = me ? me.wins + me.losses : Math.max(0, ...d.player_stats.data.players.map((p) => p.stats?.gp || 0));
  const minGames = Math.max(1, Math.ceil(teamGames * 0.3)); // чтобы не попал игрок с одним удачным матчем
  return d.player_stats.data.players
    .filter((p) => (p.stats?.gp || 0) >= minGames && p.stats?.pts != null && roster.get(p.id)?.headshot)
    .sort((a, b) => b.stats.pts - a.stats.pts)
    .slice(0, n)
    .map((p) => ({...roster.get(p.id), ppg: p.stats.pts}));
}

function hero(d, gs) {
  const me = gswEntry(d.standings);
  const pos = usable(d.standings) ? d.standings.data.gsw : null;
  const record = me ? `${me.wins}–${me.losses}` : (gs.record ? gs.record.replace('-', '–') : '—');
  const streak = me ? streakFact(me.streak) : null;
  const facts = [
    {value: record, label: 'победы — поражения'},
    {value: pos ? fmt.placeText(pos.placeLo, pos.placeHi) : '—', label: 'место на Западе'},
    streak,
  ].filter(Boolean);

  const players = topScorers(d);
  // Визуально лучший бомбардир — в центре; в разметке порядок по месту (для чтения с экрана).
  const order = [3, 2, 4, 1, 5];
  const strip = players.length ? h('div', {class: 'hero-players'},
    h('p', {class: 'hero-players-label'}, 'Лучшие бомбардиры · очки за матч'),
    h('ul', {class: 'hero-players-list'}, players.map((p, i) => h('li', {
      class: `hero-player${i === 0 ? ' is-top' : ''}`, style: {order: String(order[i]), '--i': String(i)}},
    h('a', {href: `#/player/${p.id}`, 'aria-label': `${p.name}: ${fmt.num(p.ppg)} очка за матч`},
      h('img', {src: p.headshot, alt: '', width: 520, height: 380, decoding: 'async'}),
      h('span', {class: 'hero-player-tag', 'aria-hidden': 'true'}, h('b', null, p.lastName || p.name), h('span', null, fmt.num(p.ppg)))))))) : null;

  const logo = h('img', {class: 'hero-logo', src: 'img/teams/gs-500.png', alt: 'Логотип Golden State Warriors',
    width: 500, height: 500, decoding: 'async'});
  logo.addEventListener('error', () => {
    if (!logo.dataset.fallback) { logo.dataset.fallback = '1'; logo.src = 'img/teams/gs.png'; } else logo.hidden = true;
  });

  return h('section', {class: 'hero reveal', 'aria-labelledby': 'hero-title'},
    h('div', {class: 'hero-glow', 'aria-hidden': 'true'}),
    h('div', {class: 'hero-main'},
      logo,
      h('p', {class: 'eyebrow'}, 'Сезон НБА 2026/27'),
      h('h1', {class: 'hero-title', id: 'hero-title'}, h('span', null, 'Golden State'), h('span', null, 'Warriors')),
      h('dl', {class: 'hero-facts'}, facts.map((f) => h('div', {class: 'hero-fact'},
        h('dt', null, f.label), h('dd', null, f.value))))),
    strip,
    h('div', {class: 'hero-source'}, sourceLine([d.standings, d.player_stats, d.roster])));
}

// --- Матч сейчас или следующий --------------------------------------------------------

function sideTeam(team, score, {win} = {}) {
  return h('div', {class: `side${win === true ? ' is-win' : ''}${win === false ? ' is-loss' : ''}`},
    teamLogo(team, 64),
    h('span', {class: 'side-name'}, team.shortName || team.name || team.abbr),
    score != null ? h('span', {class: 'side-score'}, String(score)) : null);
}

function homeAwayChip(g) {
  return h('span', {class: `chip ${g.home ? 'chip-home' : 'chip-away'}`}, g.home ? 'Дома' : 'В гостях');
}

function venueLine(g) {
  const v = g.venue || {};
  if (!v.name) return null;
  const city = v.city && !v.name.includes(v.city) ? `, ${v.city}` : '';
  return h('p', {class: 'venue'}, icon('pin', 16), ` ${v.name}${city}`);
}

function matchNowCard(d, gs, timers) {
  const live = liveGame(d.live);
  if (live) return liveCard(d, gs, live);
  if (!usable(d.schedule)) return card('area-next', 'Следующий матч', null, noData(d.schedule, 'Расписание'));
  const g = nextGame(d.schedule, d.live);
  if (!g) {
    return card('area-next', 'Следующий матч', null,
      emptyState({iconName: 'calendar', title: 'Следующий матч ещё не опубликован',
        text: 'Регулярный чемпионат закончился или календарь дальше ещё не объявлен.'}),
      sourceLine(d.schedule));
  }
  const opp = g.opponent || {abbr: '?', name: 'соперник уточняется'};
  const when = g.timeValid === false
    ? `${fmt.gameDate(g.date)} · время уточняется`
    : `${fmt.gameDate(g.date)} · ${fmt.time(g.date)}`;
  const rel = fmt.relDay(fmt.toDate(g.date));
  const cd = g.timeValid === false ? null : countdown(g, timers);
  return card('area-next card-next', 'Следующий матч', h('span', {class: 'chips'}, g.cup ? h('span', {class: 'chip chip-cup'}, 'Кубок НБА') : null, homeAwayChip(g)),
    h('div', {class: 'matchup'}, sideTeam(gs), h('span', {class: 'vs', 'aria-hidden': 'true'}, g.home ? 'vs' : '@'), sideTeam(opp)),
    h('p', {class: 'when'},
      rel ? h('span', {class: 'when-rel'}, rel) : null,
      h('span', null, when), g.timeValid === false ? null : h('span', {class: 'tz'}, fmt.tzLabel())),
    venueLine(g),
    cd,
    sourceLine(d.schedule));
}

function startingNote() {
  return h('p', {class: 'starting'}, h('span', {class: 'live-dot'}),
    ' Матч начинается или уже идёт — счёт появится здесь в течение пары минут');
}

function countdown(g, timers) {
  const target = fmt.ms(g.date);
  if (!(target > Date.now())) return startingNote();
  const units = [
    ['d', ['день', 'дня', 'дней']], ['h', ['час', 'часа', 'часов']],
    ['m', ['минута', 'минуты', 'минут']], ['s', ['секунда', 'секунды', 'секунд']],
  ].map(([key, forms]) => {
    const num = h('span', {class: 'cd-num'});
    const label = h('span', {class: 'cd-label'});
    return {key, forms, num, label, el: h('div', {class: `cd-unit cd-${key}`}, num, label)};
  });
  const box = h('div', {class: 'countdown', role: 'timer', 'aria-label': 'До начала матча'}, units.map((u) => u.el));
  const tick = () => {
    const left = target - Date.now();
    if (left <= 0) {
      box.replaceWith(startingNote());
      timers.forEach(clearInterval);
      return;
    }
    const c = fmt.countdown(left);
    for (const u of units) {
      const v = c[u.key];
      u.num.textContent = u.key === 'd' ? String(v) : fmt.pad2(v);
      u.label.textContent = fmt.plural(v, ...u.forms);
    }
    units[0].el.hidden = c.d === 0;
  };
  tick();
  timers.push(setInterval(tick, 1000));
  return box;
}

function liveCard(d, gs, g) {
  const opp = g.opponent || {abbr: '?'};
  const sc = g.score || {};
  return card('area-next card-live', 'Идёт матч', h('span', {class: 'chips'}, homeAwayChip(g)),
    h('p', {class: 'live-badge'}, h('span', {class: 'live-dot'}), ' В эфире'),
    h('div', {class: 'matchup matchup-score'}, sideTeam(gs, sc.team ?? '—'), h('span', {class: 'vs', 'aria-hidden': 'true'}, ':'), sideTeam(opp, sc.opp ?? '—')),
    h('p', {class: 'period'}, fmt.periodLabel(g)),
    venueLine(g),
    sourceLine(d.live, {extra: 'счёт обновляется каждую минуту'}));
}

// --- Последний матч --------------------------------------------------------------------

function lastGameCard(d, gs) {
  const g = lastGame(d.schedule, d.live);
  if (!usable(d.schedule) && !g) return card('area-last', 'Последний матч', null, noData(d.schedule, 'Расписание'));
  if (!g) {
    return card('area-last', 'Последний матч', null,
      emptyState({iconName: 'calendar', title: 'Сыгранных матчей пока нет'}), sourceLine(d.schedule));
  }
  const win = g.result === 'W';
  const opp = g.opponent || {abbr: '?'};
  const fromLive = d.live?.data?.game?.id === g.id && !g.completed;
  return card('area-last', 'Последний матч',
    h('span', {class: `chip ${win ? 'chip-win' : 'chip-loss'}`}, g.result ? (win ? 'Победа' : 'Поражение') : 'Завершён'),
    h('div', {class: 'matchup matchup-score'},
      sideTeam(gs, g.score.team, {win: g.result ? win : undefined}),
      h('span', {class: 'vs', 'aria-hidden': 'true'}, ':'),
      sideTeam(opp, g.score.opp, {win: g.result ? !win : undefined})),
    h('p', {class: 'when'}, h('span', null, `${fmt.gameDate(g.date)} · ${fmt.time(g.date)}`),
      h('span', {class: 'tz'}, fmt.tzLabel()), h('span', {class: 'muted'}, g.home ? 'дома' : 'в гостях')),
    sourceLine(fromLive ? d.live : d.schedule));
}

// --- Место на Западе ----------------------------------------------------------------------

const ZONE = {
  playoff: 'Зона плей-офф (1–6)',
  playin: 'Зона плей-ин (7–10)',
  out: 'Вне плей-офф и плей-ин (11–15)',
};

function standingsCard(d) {
  const env = d.standings;
  if (!usable(env) || !env.data.gsw) return card('area-standings', 'Место на Западе', null, noData(env, 'Таблица'));
  const st = env.data;
  const g = st.gsw;
  const me = gswEntry(env);
  const zoneText = g.zones.length === 1 ? ZONE[g.zones[0]] : `На границе зон: ${g.zones.map((z) => ZONE[z].split(' (')[0].toLowerCase()).join(' / ')}`;
  const gaps = [
    g.aheadOfPlayin != null && `Запас над 7-м местом (плей-ин): ${fmt.games(g.aheadOfPlayin)}`,
    g.behindPlayoff != null && `До 6-го места (плей-офф): ${fmt.games(g.behindPlayoff)}`,
    g.aheadOfOut != null && `Запас над 11-м местом: ${fmt.games(g.aheadOfOut)}`,
    g.behindPlayin != null && `До 10-го места (плей-ин): ${fmt.games(g.behindPlayin)}`,
  ].filter(Boolean);
  const names = new Map(st.entries.map((e) => [e.team.abbr, e.team.shortName || e.team.name]));
  const tie = g.tiedWith?.length
    ? h('p', {class: 'note'}, `Такой же баланс у ${g.tiedWith.map((a) => names.get(a) || a).join(', ')}. ${st.tieNote || ''}`)
    : null;

  return card('area-standings', 'Место на Западе', h('a', {class: 'card-link', href: '#/standings'}, 'Вся таблица', icon('chevron', 16)),
    h('div', {class: 'standing-top'},
      h('div', {class: 'standing-place'}, h('span', {class: 'big-num'}, fmt.placeText(g.placeLo, g.placeHi)),
        h('span', {class: 'big-label'}, `место из ${st.entries.length}`)),
      me ? h('div', {class: 'standing-record'},
        h('p', null, h('b', null, `${me.wins}–${me.losses}`), h('span', {class: 'muted'}, ` · ${fmt.pct(me.pct * 100)} побед`)),
        h('p', {class: 'muted'}, me.gb ? `Отставание от 1-го места: ${fmt.games(me.gb)}` : 'Лидер конференции')) : null),
    h('p', {class: `zone zone-${g.zone}`}, zoneText),
    gaps.length ? h('ul', {class: 'gaps'}, gaps.map((t) => h('li', null, t))) : null,
    miniTable(st.entries, me),
    tie,
    sourceLine(env));
}

function miniTable(entries, me) {
  if (!me) return null;
  const i = entries.indexOf(me);
  const from = Math.max(0, Math.min(i - 2, entries.length - 5));
  const rows = entries.slice(from, from + 5);
  const body = [];
  rows.forEach((e, k) => {
    const prev = k > 0 ? rows[k - 1] : null;
    if (prev && prev.pos <= 6 && e.pos >= 7) body.push(sepRow('плей-ин'));
    if (prev && prev.pos <= 10 && e.pos >= 11) body.push(sepRow('вне плей-ин'));
    body.push(h('tr', {class: e === me ? 'is-gsw' : ''},
      h('td', {class: 'num'}, fmt.placeText(e.placeLo, e.placeHi)),
      h('td', null, h('span', {class: 'team-cell'}, teamLogo(e.team, 22), h('span', null, e.team.shortName || e.team.abbr))),
      h('td', {class: 'num'}, `${e.wins}–${e.losses}`),
      h('td', {class: 'num muted'}, e.gb ? fmt.smart(e.gb) : '—')));
  });
  return h('table', {class: 'mini-table'},
    h('caption', {class: 'visually-hidden'}, 'Соседи ГСВ по таблице'),
    h('thead', null, h('tr', null, h('th', {scope: 'col'}, '#'), h('th', {scope: 'col'}, 'Команда'),
      h('th', {scope: 'col', class: 'num'}, 'В–П'), h('th', {scope: 'col', class: 'num'}, 'Отст.'))),
    h('tbody', null, body));
}

function sepRow(label) {
  return h('tr', {class: 'zone-sep'}, h('td', {colspan: '4'}, label));
}

// --- Новости ----------------------------------------------------------------------------

function newsCard(d) {
  const env = d.news;
  const more = h('a', {class: 'card-link', href: '#/news'}, 'Все новости', icon('chevron', 16));
  if (!usable(env)) return card('area-news', 'Последние новости', more, noData(env, 'Новости'));
  const items = [...env.data.items].sort((a, b) => fmt.ms(b.date) - fmt.ms(a.date)).slice(0, 5);
  if (!items.length) {
    return card('area-news', 'Последние новости', more, emptyState({iconName: 'news', title: 'Новостей пока нет'}), sourceLine(env));
  }
  return card('area-news', 'Последние новости', more,
    h('ul', {class: 'news-list'}, items.map((it) => h('li', null,
      h('a', {class: 'news-link', href: `#/news/${it.id}`},
        h('span', {class: 'news-meta'},
          h('span', {class: `cat cat-${it.category || 'other'}`}, CATS[it.category] || CATS.other),
          h('span', null, it.source),
          h('time', {datetime: it.date}, fmt.agoOrDate(it.date)),
          it.lang && it.lang !== 'ru' ? h('span', {class: 'lang', title: 'Язык источника'}, it.lang.toUpperCase()) : null),
        h('span', {class: 'news-title'}, it.title))))),
    sourceLine(env));
}

// --- Избранные игроки -------------------------------------------------------------------

function favoritesCard(d) {
  return card('area-fav', 'Мои игроки', h('a', {class: 'card-link', href: '#/favorites'}, 'Избранное', icon('chevron', 16)),
    favoritesBlock(d.fav));
}
