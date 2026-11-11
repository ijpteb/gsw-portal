// Расписание: весь сезон 2026/27 — дата и время по часовому поясу устройства, соперник, арена и город,
// у сыгранных — счёт и исход. Фильтры (дома / в гостях, сыгранные / предстоящие, месяц) хранятся
// в адресе: #/schedule?where=home&when=played&month=2026-11 — так «Назад» возвращает тот же вид.
import * as data from '../data.js?v=__V__';
import * as fmt from '../format.js?v=__V__';
import {h, icon, sourceLine, noData, emptyState, usable, teamLogo} from '../ui.js?v=__V__';
import {freshen} from '../games.js?v=__V__';

const WHERE = [['all', 'Все'], ['home', 'Дома'], ['away', 'В гостях']];
const WHEN = [['all', 'Все'], ['played', 'Сыгранные'], ['upcoming', 'Предстоящие']];
const STAGE = {playin: 'Плей-ин', playoffs: 'Плей-офф'};
const RESULT = {W: 'победа', L: 'поражение'};
// Матч не состоялся в срок: так ESPN помечает перенесённые, отменённые и прерванные игры.
const FLAGS = {
  STATUS_POSTPONED: ['Перенесён', 'новую дату назначат'],
  STATUS_CANCELED: ['Отменён', 'по данным ESPN'],
  STATUS_SUSPENDED: ['Прерван', 'доиграют позже'],
  STATUS_DELAYED: ['Задержка', 'начало откладывается'],
};
// Регулярный чемпионат — по 11.04.2027 по времени США (из задания); с запасом на часовые пояса.
const REGULAR_END = '2027-04-12';
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

export default {
  section: () => 'schedule',
  title: () => 'Расписание',
  async render(view, params, query) {
    const ui = {query, state: null};
    const draw = async (quiet) => {
      const [schedule, live] = await Promise.all([data.get('schedule'), data.get('live')]);
      view.replaceChildren(build({schedule, live}, ui, quiet));
    };
    await draw(false);
    return {update: () => draw(true)};
  },
};

// --- Данные --------------------------------------------------------------------------

/** Все строки календаря: матчи (со свежим счётом из табло) и ещё не назначенные матчи. */
function collect(d, live) {
  const games = [...(d.games || []), ...(d.postseason?.games || [])]
    .filter((g) => g.date)
    .map((g) => freshen(g, live))
    .sort((a, b) => fmt.ms(a.date) - fmt.ms(b.date))
    .map((g) => ({kind: 'game', g, month: fmt.monthKey(g.date), stage: g.stage || 'regular'}));
  const tbd = Array.from({length: Math.max(0, d.missingGames || 0)},
    (_, i) => ({kind: 'tbd', i, month: null, stage: 'regular'}));
  return [...games, ...tbd];
}

/** Ближайший матч: первый не сыгранный и не идущий сейчас (как на главной). */
function nextOf(all) {
  const now = Date.now();
  return all.find((x) => x.kind === 'game' && !x.g.completed && x.g.state === 'pre'
    && fmt.ms(x.g.date) > now - 6 * 3600e3) || null;
}

function matches(x, s) {
  if (s.where !== 'all' && (x.kind !== 'game' || x.g.home !== (s.where === 'home'))) return false;
  if (s.when === 'played' && !(x.kind === 'game' && (x.g.completed || x.g.state === 'in'))) return false;
  if (s.when === 'upcoming' && x.kind === 'game' && x.g.completed) return false;
  if (s.month !== 'all' && x.month !== s.month) return false;
  return true;
}

function readState(query, months) {
  const pick = (v, allowed) => (allowed.includes(v) ? v : 'all');
  return {
    where: pick(query?.get('where'), WHERE.map(([v]) => v)),
    when: pick(query?.get('when'), WHEN.map(([v]) => v)),
    month: pick(query?.get('month'), months),
  };
}

function writeState(state) {
  const q = new URLSearchParams();
  for (const k of ['where', 'when', 'month']) if (state[k] !== 'all') q.set(k, state[k]);
  const qs = q.toString();
  const url = `#/schedule${qs ? `?${qs}` : ''}`;
  if (location.hash !== url) {
    try { history.replaceState(history.state, '', url); } catch { /* браузер ограничил частоту — не страшно */ }
  }
}

// --- Строки календаря -------------------------------------------------------------------

const countText = (n) => `${n} ${fmt.plural(n, 'матч', 'матча', 'матчей')}`;

function otLabel(period) {
  const p = Number(period) || 0;
  if (p <= 4) return null;
  return p === 5 ? 'ОТ' : `${p - 4} ОТ`;
}

function venueText(g) {
  const v = g.venue || {};
  if (!v.name) return null;
  return v.city && !v.name.includes(v.city) ? `${v.name}, ${v.city}` : v.name;
}

function result(g) {
  if (g.state === 'in') {
    const sc = g.score || {};
    return h('div', {class: 'sg-res'},
      h('span', {class: 'sg-live'}, h('span', {class: 'live-dot'}), 'идёт'),
      h('b', null, `${sc.team ?? '—'}:${sc.opp ?? '—'}`),
      h('small', null, fmt.periodLabel(g)));
  }
  if (g.completed && g.score) {
    return h('div', {class: 'sg-res'},
      h('b', null, `${g.score.team}:${g.score.opp}`),
      h('small', null, [RESULT[g.result] || 'завершён', otLabel(g.period)].filter(Boolean).join(', ')));
  }
  const flag = FLAGS[g.statusName];
  if (flag) return h('div', {class: 'sg-res'}, h('b', {class: 'sg-flag'}, flag[0]), h('small', null, flag[1]));
  if (g.completed) return h('div', {class: 'sg-res'}, h('b', null, '—'), h('small', null, 'завершён, счёта нет в источнике'));
  if (g.timeValid === false) return h('div', {class: 'sg-res'}, h('b', null, '—'), h('small', null, 'время уточняется'));
  return h('div', {class: 'sg-res'}, h('b', null, fmt.time(g.date)), h('small', null, fmt.tzLabel()));
}

function gameRow(x, nextId) {
  const g = x.g;
  const p = fmt.dateParts(g.date) || {wd: '', day: '—', mon: ''};
  const done = g.completed && g.score;
  const isNext = g.id === nextId;
  const cls = ['sg', g.state === 'in' && 'is-live', isNext && 'is-next',
    done && g.result === 'W' && 'is-win', done && g.result === 'L' && 'is-loss'].filter(Boolean).join(' ');
  const opp = g.opponent || {};
  const venue = venueText(g);
  return h('li', {class: cls, id: `game-${g.id}`, tabindex: isNext ? '-1' : null},
    h('div', {class: 'sg-date'},
      h('span', {class: 'sg-wd'}, p.wd), h('span', {class: 'sg-day'}, p.day), h('span', {class: 'sg-mon'}, p.mon)),
    h('div', {class: 'sg-main'},
      h('p', {class: 'sg-opp'}, teamLogo(opp, 30), h('span', {class: 'sg-name'}, opp.name || opp.abbr || 'Соперник уточняется')),
      h('p', {class: 'sg-chips'},
        isNext ? h('span', {class: 'chip chip-next'}, 'Ближайший') : null,
        h('span', {class: `chip ${g.home ? 'chip-home' : 'chip-away'}`}, g.home ? 'Дома' : 'В гостях'),
        g.cup ? h('span', {class: 'chip chip-cup'}, 'Кубок НБА') : null,
        // У матчей плей-ин и плей-офф ESPN пишет стадию по-английски («West 1st Round - Game 1») — как в источнике.
        x.stage !== 'regular' && g.notes?.[0] ? h('span', {class: 'sg-note', lang: 'en'}, g.notes[0]) : null)),
    venue ? h('p', {class: 'sg-venue'}, icon('pin', 14), h('span', null, venue)) : h('p', {class: 'sg-venue muted'}, 'Арена не указана'),
    result(g));
}

function tbdRow(missing) {
  // Два матча из 82 назначают по итогам группового этапа Кубка НБА (так в регламенте сезона);
  // если не хватает другого числа — честно пишем только, что матча нет в календаре источника.
  const why = missing === 2 ? 'Назначат по итогам группового этапа' : 'Матча пока нет в календаре источника';
  return h('li', {class: 'sg sg-tbd'},
    h('div', {class: 'sg-date'}, h('span', {class: 'sg-wd'}, 'дата'), h('span', {class: 'sg-day'}, '?'), h('span', {class: 'sg-mon'}, 'уточняется')),
    h('div', {class: 'sg-main'},
      h('p', {class: 'sg-opp'}, h('span', {class: 'team-logo sg-tbd-logo', style: {width: '30px', height: '30px'}},
        h('span', {class: 'team-logo-fallback'}, '?')), h('span', {class: 'sg-name'}, 'Соперник уточняется')),
      h('p', {class: 'sg-chips'}, missing === 2 ? h('span', {class: 'chip chip-cup'}, 'Кубок НБА') : null)),
    h('p', {class: 'sg-venue muted'}, why),
    h('div', {class: 'sg-res'}, h('b', null, '—'), h('small', null, 'дата и время уточняются')));
}

function group(title, count, rows, extraClass = '') {
  return h('section', {class: `sg-group ${extraClass}`.trim()},
    h('header', {class: 'sg-head'}, h('h2', {class: 'sg-title'}, title), h('span', {class: 'sg-count'}, count)),
    h('ol', {class: 'sg-list'}, rows));
}

function postseasonNote(d) {
  const p = d.postseason || {};
  if (p.games?.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const text = today > REGULAR_END && p.checked
    ? 'Матчей ГСВ в плей-ин и плей-офф в источнике нет: расписание ещё не опубликовано или команда в них не играет.'
    : 'Регулярный чемпионат идёт до 11 апреля 2027 года (по времени США). Расписание плей-ин и плей-офф ещё не опубликовано.';
  const failed = p.error ? ` Последняя проверка не удалась (${p.error}) — показано то, что было известно раньше.` : '';
  return h('div', {class: 'note sched-post'}, h('b', null, 'Плей-ин и плей-офф. '), text + failed);
}

// --- Страница ------------------------------------------------------------------------------

function build(env, ui, quiet) {
  const head = h('header', {class: 'page-head'},
    h('p', {class: 'eyebrow'}, 'Сезон 2026/27'),
    h('h1', {class: 'page-title'}, 'Расписание'));
  const page = h('div', {class: `page schedule${quiet ? ' quiet' : ''}`}, head);
  if (!usable(env.schedule)) {
    page.append(noData(env.schedule, 'Расписание'));
    return page;
  }

  const d = env.schedule.data;
  const all = collect(d, env.live);
  const months = [...new Set(all.map((x) => x.month).filter(Boolean))].sort();
  ui.state ??= readState(ui.query, months);
  if (ui.state.month !== 'all' && !months.includes(ui.state.month)) ui.state.month = 'all';
  const state = ui.state;

  const regular = all.filter((x) => x.kind === 'game' && x.stage === 'regular');
  const missing = Math.max(0, d.missingGames || 0);
  const total = regular.length + missing;
  const played = regular.filter((x) => x.g.completed).length;
  const tz = fmt.tzLabel();
  head.append(
    h('p', {class: 'page-lead'}, `${countText(total)} регулярного чемпионата: сыграно ${played}, впереди ${total - played}.`
      + (missing ? ` У ${missing} ${fmt.plural(missing, 'матча', 'матчей', 'матчей')} соперник и дата пока уточняются.` : '')),
    h('p', {class: 'sched-tz'}, icon('clock', 16), ` Время — по часовому поясу вашего устройства${tz ? ` (${tz})` : ''}.`));

  const liveX = all.find((x) => x.kind === 'game' && x.g.state === 'in') || null;
  const next = nextOf(all);
  const listBox = h('div', {class: 'sg-groups'});
  const count = h('p', {class: 'roster-count', 'aria-live': 'polite'});
  const empty = emptyState({iconName: 'calendar', title: 'Нет матчей с такими условиями',
    action: h('button', {type: 'button', class: 'btn', onclick: () => set({where: 'all', when: 'all', month: 'all'})}, 'Показать все')});

  // --- фильтры
  const segButtons = [];
  const seg = (label, key, options, cls = '') => h('div', {class: `seg ${cls}`.trim(), role: 'group', 'aria-label': label},
    options.map(([v, text]) => {
      const b = h('button', {type: 'button', class: 'seg-btn', 'data-key': key, 'data-v': v,
        onclick: () => set({[key]: v})}, text, h('span', {class: 'seg-count'}));
      segButtons.push(b);
      return b;
    }));
  const toolbar = h('div', {class: 'roster-tools sched-tools'},
    seg('Где', 'where', WHERE),
    seg('Матчи', 'when', WHEN),
    seg('Месяц', 'month', [['all', 'Все месяцы'], ...months.map((k) => [k, fmt.monthName(k, {withYear: false})])], 'seg-months'));

  function renderList(animate) {
    for (const b of segButtons) {
      const {key, v} = b.dataset;
      b.setAttribute('aria-pressed', String(state[key] === v));
      b.querySelector('.seg-count').textContent = String(all.filter((x) => matches(x, {...state, [key]: v})).length);
    }
    const shown = all.filter((x) => matches(x, state));
    const groups = [];
    for (const key of months) {
      const rows = shown.filter((x) => x.kind === 'game' && x.stage === 'regular' && x.month === key);
      if (rows.length) groups.push(group(fmt.monthName(key), countText(rows.length), rows.map((x) => gameRow(x, next?.g.id))));
    }
    const tbd = shown.filter((x) => x.kind === 'tbd');
    if (tbd.length) groups.push(group('Дата уточняется', countText(tbd.length), tbd.map(() => tbdRow(missing)), 'sg-group-tbd'));
    for (const [stage, title] of Object.entries(STAGE)) {
      const rows = shown.filter((x) => x.kind === 'game' && x.stage === stage);
      if (rows.length) groups.push(group(title, countText(rows.length), rows.map((x) => gameRow(x, next?.g.id)), 'sg-group-post'));
    }
    const note = state.month === 'all' && state.where === 'all' && state.when !== 'played' ? postseasonNote(d) : null;
    if (animate) groups.forEach((g, i) => { g.classList.add('reveal'); g.style.setProperty('--i', String(Math.min(i, 4))); });
    listBox.replaceChildren(...groups, ...(note ? [note] : []));
    const games = shown.length;
    count.textContent = games === all.length ? `Показаны все матчи: ${games}` : `Показано ${games} из ${all.length}`;
    empty.hidden = games > 0;
  }

  function set(patch) {
    Object.assign(state, patch);
    writeState(state);
    renderList(true);
  }

  // --- «Идёт матч» / «Ближайший матч» вверху, с переходом к строке в календаре
  function jumpTo(x) {
    if (!matches(x, state)) set({where: 'all', when: 'all', month: 'all'});
    const rowEl = listBox.querySelector(`#game-${x.g.id}`);
    if (!rowEl) return;
    rowEl.scrollIntoView({block: 'center', behavior: reduce.matches ? 'auto' : 'smooth'});
    rowEl.setAttribute('tabindex', '-1');
    rowEl.focus({preventScroll: true});
  }

  const spot = liveX || next;
  let banner = null;
  if (spot) {
    const g = spot.g;
    const opp = g.opponent || {};
    const when = g === liveX?.g
      ? [h('span', {class: 'sg-live', 'aria-hidden': 'true'}, h('span', {class: 'live-dot'})), // «Идёт матч» — уже в заголовке
        h('b', null, `${g.score?.team ?? '—'}:${g.score?.opp ?? '—'}`), h('span', {class: 'muted'}, fmt.periodLabel(g))]
      : [h('b', null, `${fmt.gameDate(g.date)} · ${g.timeValid === false ? 'время уточняется' : fmt.time(g.date)}`),
        g.timeValid === false || !tz ? null : h('span', {class: 'tz'}, tz)];
    banner = h('div', {class: `sched-spot${spot === liveX ? ' is-live' : ''}`},
      h('div', {class: 'sched-spot-main'},
        h('p', {class: 'eyebrow'}, spot === liveX ? 'Идёт матч' : 'Ближайший матч'),
        h('p', {class: 'sched-spot-when'}, when),
        h('p', {class: 'sched-spot-opp'}, teamLogo(opp, 26),
          h('span', null, `${g.home ? 'Дома' : 'В гостях'} · ${opp.name || opp.abbr || 'соперник уточняется'}`))),
      h('button', {type: 'button', class: 'more-btn', onclick: () => jumpTo(spot)}, 'Показать в календаре'));
  }

  renderList(!quiet);
  const usedLive = all.some((x) => x.kind === 'game' && x.g.fromLive);
  page.append(...[banner, toolbar, count, listBox, empty,
    sourceLine(usedLive ? [env.schedule, env.live] : env.schedule,
      {extra: 'время матчей — по часовому поясу устройства'})].filter(Boolean));
  return page;
}
