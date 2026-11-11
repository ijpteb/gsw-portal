// Таблица Запада: все 15 команд — место, победы, поражения, % побед, отставание от лидера, дома / в гостях,
// последние 10 матчей, серия. Зоны по регламенту НБА: 1–6 — сразу плей-офф, 7–10 — плей-ин, 11–15 — без
// плей-офф; где ГСВ и сколько до каждой зоны. Порядок и все числа — готовые из таблицы ESPN.
import * as data from '../data.js?v=__V__';
import * as fmt from '../format.js?v=__V__';
import {h, sourceLine, noData, usable, teamLogo, stagger} from '../ui.js?v=__V__';

const RULES_URL = 'https://www.nba.com/news/nba-play-in-tournament';
const ZONES = {
  playoff: {title: 'Плей-офф', range: '1–6', text: 'сразу в плей-офф'},
  playin: {title: 'Плей-ин', range: '7–10', text: 'турнир плей-ин за 7-е и 8-е места в плей-офф'},
  out: {title: 'Без плей-офф', range: '11–15', text: 'сезон заканчивается'},
};
const zoneOf = (pos) => (pos <= 6 ? 'playoff' : pos <= 10 ? 'playin' : 'out');

export default {
  section: () => 'standings',
  title: () => 'Таблица',
  async render(view) {
    const draw = async (quiet) => {
      const env = await data.get('standings');
      const page = build(env);
      if (quiet) page.classList.add('quiet');
      view.replaceChildren(page);
    };
    await draw(false);
    return {update: () => draw(true)};
  },
};

const dash = (s) => (s ? String(s).replace('-', '–') : '—');
const gamesText = (x) => fmt.games(x);

/** Серия: «W8» → «+8» (победы подряд), «L1» → «−1» (поражения подряд). */
function streak(s) {
  const m = /^([WL])(\d+)$/.exec(s || '');
  if (!m) return h('span', {class: 'muted'}, '—');
  const n = Number(m[2]);
  const win = m[1] === 'W';
  return h('span', {class: win ? 'st-up' : 'st-down',
    title: win ? `${n} ${fmt.plural(n, 'победа', 'победы', 'побед')} подряд` : `${n} ${fmt.plural(n, 'поражение', 'поражения', 'поражений')} подряд`},
  `${win ? '+' : '−'}${n}`);
}

// --- Где ГСВ ----------------------------------------------------------------------------

function zoneTile(zone, g) {
  const z = ZONES[zone];
  const inZone = g.zones.includes(zone);
  let status;
  let detail;
  if (zone === 'playoff') {
    status = inZone ? (g.zone === 'boundary' ? 'На границе' : 'В зоне') : 'Ниже зоны';
    detail = g.aheadOfPlayin != null ? `Запас над 7-м местом — ${gamesText(g.aheadOfPlayin)}`
      : g.behindPlayoff != null ? (g.behindPlayoff > 0 ? `До 6-го места — ${gamesText(g.behindPlayoff)}` : 'Вровень с 6-м местом') : null;
  } else {
    const above = !inZone && g.placeHi <= 6;
    status = above ? 'Выше зоны' : inZone ? (g.zone === 'boundary' ? 'На границе' : 'В зоне') : 'Ниже зоны';
    detail = g.aheadOfOut != null ? `Запас над 11-м местом — ${gamesText(g.aheadOfOut)}`
      : g.behindPlayin != null ? (g.behindPlayin > 0 ? `До 10-го места — ${gamesText(g.behindPlayin)}` : 'Вровень с 10-м местом') : null;
  }
  return h('div', {class: `st-zone st-zone-${zone}${inZone ? ' is-in' : ''}`},
    h('p', {class: 'st-zone-name'}, `${z.title} · ${z.range}`),
    h('p', {class: 'st-zone-status'}, status),
    detail ? h('p', {class: 'st-zone-detail'}, detail) : null);
}

function summary(st, me) {
  const g = st.gsw;
  const names = new Map(st.entries.map((e) => [e.team.abbr, e.team.name || e.team.abbr]));
  return h('section', {class: 'card st-summary', 'aria-label': 'Где Golden State Warriors'},
    h('header', {class: 'card-head'}, h('h2', {class: 'eyebrow'}, 'Golden State Warriors')),
    h('div', {class: 'standing-top'},
      h('div', {class: 'standing-place'}, h('span', {class: 'big-num'}, fmt.placeText(g.placeLo, g.placeHi)),
        h('span', {class: 'big-label'}, `место из ${st.entries.length}`)),
      me ? h('div', {class: 'standing-record'},
        h('p', null, h('b', null, `${me.wins}–${me.losses}`), h('span', {class: 'muted'}, ` · ${fmt.pct(me.pct * 100)} побед`)),
        h('p', {class: 'muted'}, me.gb ? `Отставание от 1-го места: ${gamesText(me.gb)}` : 'Лидер конференции')) : null),
    h('div', {class: 'st-zones'}, zoneTile('playoff', g), zoneTile('playin', g)),
    g.tiedWith?.length ? h('p', {class: 'note'},
      `Такой же баланс побед и поражений у ${g.tiedWith.map((a) => names.get(a) || a).join(', ')}. ${st.tieNote || ''}`) : null);
}

// --- Таблица ------------------------------------------------------------------------------

function sepRow(zone, cols) {
  const z = ZONES[zone];
  return h('tr', {class: `st-sep st-sep-${zone}`},
    h('td', {class: 'col-first', colspan: '1'}, `${z.title} · ${z.range}`), h('td', {colspan: String(cols - 1)}, ''));
}

function table(st, me) {
  const head = [['Команда', 'col-first'], ['В', 'num', 'Победы'], ['П', 'num', 'Поражения'], ['% побед', 'num'],
    ['Отст.', 'num', 'Отставание от 1-го места, в матчах'], ['Дома', 'num'], ['В гостях', 'num'],
    ['Посл. 10', 'num', 'Последние 10 матчей'], ['Серия', 'num', 'Серия: + победы подряд, − поражения подряд']];
  const rows = [];
  st.entries.forEach((e, i) => {
    const zone = zoneOf(e.pos ?? i + 1);
    const prev = i > 0 ? zoneOf(st.entries[i - 1].pos ?? i) : null;
    if (zone !== prev) rows.push(sepRow(zone, head.length));
    const isMe = e === me;
    rows.push(h('tr', {class: `st-row z-${zone}${isMe ? ' is-gsw' : ''}`, 'aria-current': isMe ? 'true' : null},
      h('th', {scope: 'row', class: 'col-first st-team'},
        h('span', {class: 'st-place'}, fmt.placeText(e.placeLo, e.placeHi)),
        teamLogo(e.team, 26),
        h('span', {class: 'st-name'}, h('span', {class: 'st-full'}, e.team.name || e.team.abbr),
          h('span', {class: 'st-short'}, e.team.shortName || e.team.abbr))),
      h('td', {class: 'num'}, String(e.wins ?? '—')),
      h('td', {class: 'num'}, String(e.losses ?? '—')),
      h('td', {class: 'num'}, e.pct != null ? fmt.pct(e.pct * 100) : '—'),
      h('td', {class: 'num'}, e.gb ? fmt.smart(e.gb) : '—'),
      h('td', {class: 'num'}, dash(e.home)),
      h('td', {class: 'num'}, dash(e.road)),
      h('td', {class: 'num'}, dash(e.last10)),
      h('td', {class: 'num'}, streak(e.streak))));
  });
  return h('div', {class: 'table-scroll', tabindex: '0', role: 'region', 'aria-label': 'Таблица Западной конференции, прокручивается вбок'},
    h('table', {class: 'data-table st-table'},
      h('caption', {class: 'visually-hidden'}, 'Западная конференция НБА, сезон 2026/27'),
      h('thead', null, h('tr', null, head.map(([label, cls, title]) => h('th', {scope: 'col', class: cls || null},
        title ? h('abbr', {title}, label) : label)))),
      h('tbody', null, rows)));
}

function rulesNote() {
  return h('div', {class: 'st-rules'},
    h('h3', {class: 'sub-title'}, 'Зоны по регламенту НБА'),
    h('ul', {class: 'st-legend'},
      Object.entries(ZONES).map(([zone, z]) => h('li', {class: `st-legend-${zone}`}, h('b', null, `${z.range}`), ` — ${z.text}`))),
    h('p', {class: 'small muted'},
      'Плей-ин: 7-я команда принимает 8-ю — победитель получает 7-й номер в плей-офф. 9-я принимает 10-ю — проигравший выбывает. ',
      'Затем проигравший в паре 7–8 принимает победителя пары 9–10 — победитель получает 8-й номер. ',
      h('a', {href: RULES_URL, target: '_blank', rel: 'noopener'}, 'Регламент на NBA.com'), '.'),
    h('p', {class: 'small muted'},
      'Отставание — на сколько матчей команда позади: (разница в победах + разница в поражениях) ÷ 2, как считает НБА.'));
}

function build(env) {
  const head = h('header', {class: 'page-head'},
    h('p', {class: 'eyebrow'}, 'Сезон 2026/27 · Западная конференция'),
    h('h1', {class: 'page-title'}, 'Таблица Запада'));
  if (!usable(env) || !env.data.entries?.length) {
    return h('div', {class: 'page standings'}, head, noData(env, 'Таблица'));
  }
  const st = env.data;
  const me = st.entries.find((e) => e.team.abbr === 'GS') || null;
  if (me && st.gsw) {
    head.append(h('p', {class: 'page-lead'},
      `Golden State Warriors — ${fmt.placeText(st.gsw.placeLo, st.gsw.placeHi)}-е место, ${me.wins}–${me.losses}.`));
  }
  const blocks = [
    st.gsw ? summary(st, me) : null,
    h('section', {class: 'card table-card', 'aria-label': 'Таблица'},
      h('header', {class: 'card-head'}, h('h2', {class: 'eyebrow'}, 'Все команды Запада'),
        h('span', {class: 'muted small'}, 'по % побед')),
      table(st, me),
      rulesNote(),
      sourceLine(env, {extra: 'места при равном балансе — диапазоном'})),
  ].filter(Boolean);
  stagger(blocks, 1);
  return h('div', {class: 'page standings'}, head, ...blocks);
}
