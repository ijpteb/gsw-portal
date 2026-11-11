// Карточка игрока: фото, номер, позиция, рост, вес, возраст, статус (в строю / травма — по данным ESPN),
// вся статистика сезона (за матч и всего), броски, последние матчи; кнопка «В избранное».
import * as data from '../data.js?v=__V__';
import * as fmt from '../format.js?v=__V__';
import {h, playerPhoto, starButton, sourceLine, noData, errorState, emptyState, usable, injuryOf, statusChip, teamLogo,
  problemText, stagger} from '../ui.js?v=__V__';
import {backButton} from './news-item.js?v=__V__';

const FIRST_GAMES = 5; // сколько последних матчей видно сразу (остальные — по кнопке)
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

export default {
  section: () => 'roster',
  title: () => 'Игрок',
  async render(view, [id]) {
    const ui = {showAll: false};
    const draw = async (quiet) => {
      const [roster, stats, injuries, schedule] = await Promise.all(
        ['roster', 'player_stats', 'injuries', 'schedule'].map((n) => data.get(n)));
      const inRoster = usable(roster) && roster.data.players.some((p) => p.id === id);
      // Журнал матчей есть только у игроков нынешнего состава — для остальных его не запрашиваем.
      const log = inRoster ? await data.get(`gamelog/${id}`) : null;
      const page = build({roster, stats, injuries, schedule, log}, id, ui);
      if (quiet) page.classList.add('quiet');
      view.replaceChildren(page);
    };
    await draw(false);
    return {update: () => draw(true)};
  },
};

function section(cls, title, extra, ...body) {
  return h('section', {class: `card ${cls}`, 'aria-label': title},
    h('header', {class: 'card-head'}, h('h2', {class: 'eyebrow'}, title), extra),
    ...body);
}

function build(env, id, ui) {
  const p = usable(env.roster) ? env.roster.data.players.find((x) => x.id === id) : null;
  if (!p) {
    return h('div', {class: 'page narrow'}, backButton(), errorState({
      title: 'Игрок не найден',
      text: usable(env.roster) ? 'Его нет в текущем составе ГСВ по данным ESPN.'
        : `Состав не загрузился: ${lowerFirst(problemText(env.roster))}.`,
      action: h('a', {class: 'btn', href: '#/roster'}, 'Весь состав')}));
  }
  document.title = `${p.name} · Golden State Warriors 2026/27`;
  const s = usable(env.stats) ? env.stats.data.players.find((x) => x.id === id)?.stats || null : null;
  const inj = injuryOf(p, env.injuries);
  const blocks = [
    hero(p, inj, env),
    inj ? injuryCard(inj, usable(env.injuries) && env.injuries.data.players?.[id] ? env.injuries : env.roster) : null,
    h('div', {class: 'player-grid'}, seasonCard(s, env.stats), detailsCard(s, env.stats)),
    gamesCard(env.log, env.schedule, ui),
  ].filter(Boolean);
  stagger(blocks.slice(1)); // блоки под шапкой появляются по очереди
  return h('article', {class: 'page player'}, backButton(), blocks);
}

// --- Шапка: фото, имя, статус, факты ---------------------------------------------------------

function fact(label, value, sub) {
  return h('div', {class: 'ph-fact'}, h('dt', null, label), h('dd', null, value, sub ? h('small', null, sub) : null));
}

function hero(p, inj, env) {
  const name = p.firstName && p.lastName && p.name === `${p.firstName} ${p.lastName}`
    ? [h('span', {class: 'ph-first'}, p.firstName), ' ', h('span', {class: 'ph-last'}, p.lastName)]
    : h('span', {class: 'ph-last'}, p.name);
  return h('header', {class: 'ph'},
    h('div', {class: 'ph-photo'},
      p.jersey != null ? h('span', {class: 'ph-num', 'aria-hidden': 'true'}, p.jersey) : null,
      playerPhoto(p, {eager: true})),
    h('div', {class: 'ph-main'},
      h('p', {class: 'eyebrow'}, [p.jersey != null ? `#${p.jersey}` : null, cap(fmt.position(p.position))].filter(Boolean).join(' · ')),
      h('h1', {class: 'ph-name'}, name),
      h('div', {class: 'ph-actions'}, statusChip(inj), starButton(p, {withText: true})),
      h('dl', {class: 'ph-facts'},
        fact('Рост', p.heightCm ? `${p.heightCm} см` : '—'),
        fact('Вес', p.weightKg ? `${p.weightKg} кг` : '—'),
        fact('Возраст', p.age != null ? fmt.years(p.age) : '—', p.birthDate ? `род. ${fmt.calDate(p.birthDate, {withYear: true})}` : null),
        // ESPN считает текущий сезон: у Карри (с 2009 г.) в 2026/27 — 18; новичок — 0.
        fact('В НБА', p.experience != null ? (p.experience === 0 ? 'новичок' : `${p.experience}-й сезон`) : '—'))),
    h('div', {class: 'ph-source'}, sourceLine(usable(env.injuries) ? [env.roster, env.injuries] : env.roster)));
}

// --- Травма ------------------------------------------------------------------------------

function kv(label, value) {
  return h('div', {class: 'kv-row'}, h('dt', null, label), h('dd', null, value));
}

function injuryCard(inj, env) {
  const what = fmt.injuryWhat(inj.detail);
  const ret = inj.detail?.returnDate;
  return section('injury-card', 'Травма', null,
    h('dl', {class: 'kv'},
      kv('Статус', [h('span', null, cap(fmt.injuryLabel(inj))),
        ['GTD', 'DTD'].includes(inj.espnStatus) ? h('small', null, 'окончательное решение — перед матчем') : null]),
      what ? kv('Что', what) : null,
      ret ? kv('Возвращение', [h('span', null, `ориентировочно ${fmt.calDate(ret)}`),
        h('small', null, 'прогноз ESPN, не официальная дата')]) : null,
      inj.date ? kv('Сообщение от', fmt.stampFull(inj.date)) : null),
    inj.short ? h('figure', {class: 'inj-quote'},
      h('blockquote', {lang: 'en'}, inj.short),
      h('figcaption', null, 'Комментарий ESPN — на английском, как в источнике')) : null,
    inj.long ? h('details', {class: 'inj-more'}, h('summary', null, 'Подробнее (на английском)'), h('p', {lang: 'en'}, inj.long)) : null,
    sourceLine(env));
}

// --- Сезон: главное и броски ----------------------------------------------------------------

const SEASON = 'Сезон 2026/27';

function startsText(s) {
  if (s.gs == null || s.gp == null) return '';
  if (s.gs === s.gp) return s.gp === 1 ? ', в стартовой пятёрке' : ', все — в стартовой пятёрке';
  if (s.gs === 0) return ', все — со скамейки';
  return `, из них в стартовой пятёрке — ${s.gs}`;
}

function shotRow(label, made, att, pct, madeTotal, attTotal) {
  if (attTotal === 0 || (attTotal == null && att === 0)) {
    return h('div', {class: 'shot'},
      h('div', {class: 'shot-top'}, h('span', {class: 'shot-label'}, label), h('span', {class: 'shot-pct muted'}, '—')),
      h('p', {class: 'shot-sub'}, 'Бросков не было'));
  }
  const width = Math.max(0, Math.min(100, Number(pct) || 0));
  return h('div', {class: 'shot'},
    h('div', {class: 'shot-top'}, h('span', {class: 'shot-label'}, label), h('span', {class: 'shot-pct'}, fmt.pct(pct))),
    h('div', {class: 'shot-bar', 'aria-hidden': 'true'}, h('span', {style: {width: `${width}%`}})),
    h('p', {class: 'shot-sub'}, `${fmt.num(made)} из ${fmt.num(att)} за матч · за сезон ${madeTotal ?? '—'} из ${attTotal ?? '—'}`));
}

function tile(label, value) {
  return h('div', {class: 'mini-stat'}, h('span', {class: 'mini-stat-value'}, value), h('span', {class: 'mini-stat-label'}, label));
}

function notPlayed() {
  // ESPN не включает в статистику тех, кто не провёл ни одного матча, — это не нули, а «не играл».
  return emptyState({iconName: 'chart', title: 'В этом сезоне не играл',
    text: 'В регулярном чемпионате 2026/27 ещё не выходил на площадку, поэтому статистики нет.'});
}

function seasonCard(s, env) {
  if (!usable(env)) return section('season-card', SEASON, null, noData(env, 'Статистика'));
  if (!s) return section('season-card', SEASON, null, notPlayed(), sourceLine(env));
  return section('season-card', SEASON, null,
    h('p', {class: 'season-games'}, `${fmt.games(s.gp)}${startsText(s)}. В среднем за матч:`),
    h('div', {class: 'mini-stats mini-stats-lg season-tiles'},
      tile('очки', fmt.num(s.pts)), tile('подборы', fmt.num(s.reb)), tile('передачи', fmt.num(s.ast)),
      tile('минуты', fmt.num(s.min)), tile('перехваты', fmt.num(s.stl)), tile('блок-шоты', fmt.num(s.blk))),
    h('h3', {class: 'sub-title'}, 'Броски'),
    h('div', {class: 'shots'},
      shotRow('С игры', s.fgm, s.fga, s.fgPct, s.fgmTotal, s.fgaTotal),
      shotRow('Трёхочковые', s.fg3m, s.fg3a, s.fg3Pct, s.fg3mTotal, s.fg3aTotal),
      shotRow('Штрафные', s.ftm, s.fta, s.ftPct, s.ftmTotal, s.ftaTotal)),
    s.fg2Pct != null ? h('p', {class: 'muted small'}, `Двухочковые — ${fmt.pct(s.fg2Pct)} попаданий.`) : null,
    sourceLine(env, {extra: 'регулярный сезон'}));
}

// --- Сезон: все показатели таблицей -------------------------------------------------------------

function detailsCard(s, env) {
  if (!usable(env) || !s) return null; // причина уже показана в соседнем блоке
  const rows = [
    ['Минуты', s.min, s.minTotal],
    ['Очки', s.pts, s.ptsTotal],
    ['Подборы', s.reb, s.rebTotal],
    ['в нападении', s.oreb, null, true],
    ['в защите', s.dreb, null, true],
    ['Передачи', s.ast, s.astTotal],
    ['Перехваты', s.stl, s.stlTotal],
    ['Блок-шоты', s.blk, s.blkTotal],
    ['Потери', s.tov, s.tovTotal],
    ['Фолы', s.pf, null],
  ];
  const hasGaps = rows.some((r) => r[2] == null);
  return section('details-card', 'Все показатели', null,
    h('table', {class: 'stat-table'},
      h('caption', {class: 'visually-hidden'}, 'Показатели за сезон: в среднем за матч и всего'),
      h('thead', null, h('tr', null, h('th', {scope: 'col'}, 'Показатель'), h('th', {scope: 'col', class: 'num'}, 'За матч'),
        h('th', {scope: 'col', class: 'num'}, 'За сезон'))),
      h('tbody', null, rows.map(([label, avg, total, sub]) => h('tr', {class: sub ? 'is-sub' : null},
        h('th', {scope: 'row'}, label),
        h('td', {class: 'num'}, fmt.num(avg)),
        h('td', {class: 'num'}, total == null ? h('span', {class: 'muted', title: 'ESPN не даёт итог за сезон по этому показателю'}, '—')
          : fmt.num(total, 0)))))),
    s.astTov != null ? h('p', {class: 'small'}, `Передач на одну потерю — ${fmt.num(s.astTov)}.`) : null,
    hasGaps ? h('p', {class: 'muted small'}, '«—» в столбце «За сезон»: источник не даёт итог по этому показателю.') : null,
    sourceLine(env, {extra: 'регулярный сезон'}));
}

// --- Последние матчи ------------------------------------------------------------------------

function shots(m, a) {
  return h('td', {class: 'num'}, m == null || a == null ? '—' : `${m}/${a}`);
}

function numCell(v, cls) {
  return h('td', {class: `num${cls ? ` ${cls}` : ''}`}, v == null ? '—' : String(v));
}

const otText = (ot) => (ot ? ot.replace(/^(\d*)OT$/, (m, n) => (n ? `${n} ОТ` : 'ОТ')) : null);

function gameRow(g, shortNames) {
  const opp = g.opponent || {};
  const result = {W: 'победа', L: 'поражение'}[g.result];
  return h('tr', null,
    h('th', {scope: 'row', class: 'g-first'},
      h('span', {class: 'g-date'}, fmt.dateShort(g.date), h('small', null, g.home ? 'дома' : 'в гостях')),
      h('span', {class: 'g-opp', title: opp.name || ''}, teamLogo(opp, 22), shortNames.get(g.eventId) || opp.abbr || '—')),
    h('td', {class: `g-score${g.result === 'W' ? ' is-win' : g.result === 'L' ? ' is-loss' : ''}`},
      h('b', null, g.teamScore != null && g.oppScore != null ? `${g.teamScore}:${g.oppScore}` : '—'),
      h('small', null, [result, otText(g.ot)].filter(Boolean).join(', ') || '—')),
    numCell(g.min), numCell(g.pts, 'is-key'), numCell(g.reb), numCell(g.ast), numCell(g.stl), numCell(g.blk),
    numCell(g.tov), numCell(g.pf), shots(g.fgm, g.fga), shots(g.fg3m, g.fg3a), shots(g.ftm, g.fta));
}

const COLS = [
  ['Мин', 'Минуты на площадке'], ['Очки', 'Очки'], ['Подб', 'Подборы'], ['Пер', 'Передачи'], ['Перех', 'Перехваты'],
  ['Блок', 'Блок-шоты'], ['Пот', 'Потери'], ['Фол', 'Фолы'], ['С игры', 'Броски с игры: попал/бросал'],
  ['3-очк', 'Трёхочковые: попал/бросал'], ['Штраф', 'Штрафные: попал/бросал'],
];

function gamesCard(env, schedule, ui) {
  const title = 'Последние матчи';
  if (!env) return null;
  if (!usable(env)) return section('games-card', title, null, noData(env, 'Матчи игрока'));
  const games = [...(env.data.games || [])].sort((a, b) => fmt.ms(b.date) - fmt.ms(a.date));
  if (!games.length) {
    return section('games-card', title, null,
      emptyState({iconName: 'calendar', title: 'В матчах сезона ещё не выходил'}), sourceLine(env));
  }
  // Короткое название соперника («Pelicans») — из расписания по номеру матча; нет — сокращение ESPN.
  const shortNames = new Map((usable(schedule) ? schedule.data.games : [])
    .filter((g) => g.opponent?.shortName).map((g) => [g.id, g.opponent.shortName]));
  const rows = games.map((g) => gameRow(g, shortNames));
  const sync = () => rows.forEach((r, i) => { r.hidden = !ui.showAll && i >= FIRST_GAMES; });
  sync();
  const more = games.length > FIRST_GAMES ? h('button', {type: 'button', class: 'more-btn', 'aria-expanded': String(ui.showAll)}) : null;
  const label = () => { if (more) more.textContent = ui.showAll ? 'Свернуть' : `Показать все матчи (${games.length})`; };
  label();
  more?.addEventListener('click', () => {
    ui.showAll = !ui.showAll;
    more.setAttribute('aria-expanded', String(ui.showAll));
    sync();
    label();
  });
  return section('games-card', title, h('span', {class: 'muted small nowrap'}, fmt.games(games.length)),
    h('div', {class: 'table-scroll', tabindex: '0', role: 'region', 'aria-label': 'Таблица матчей, прокручивается вбок'},
      h('table', {class: 'games-table'},
        h('caption', {class: 'visually-hidden'}, 'Последние матчи игрока: дата, соперник, счёт и личная статистика'),
        h('thead', null, h('tr', null,
          h('th', {scope: 'col', class: 'g-first'}, 'Матч'), h('th', {scope: 'col'}, 'Счёт'),
          COLS.map(([short, full]) => h('th', {scope: 'col', class: 'num', title: full}, h('abbr', {title: full}, short))))),
        h('tbody', null, rows))),
    more,
    h('p', {class: 'muted small'}, 'Мин — минуты на площадке, подб — подборы, пер — передачи, перех — перехваты, '
      + 'пот — потери; броски — «попал/бросал». Счёт — очки ГСВ : очки соперника; ОТ — овертайм.'),
    sourceLine(env, {extra: 'регулярный сезон, время матчей — по вашему часовому поясу'}));
}
