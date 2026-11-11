// Блоки, которые встречаются на нескольких страницах.
import * as data from './data.js?v=__V__';
import * as fmt from './format.js?v=__V__';
import * as fav from './favorites.js?v=__V__';
import {h, avatar, starButton, sourceLine, emptyState, usable, problemText} from './ui.js?v=__V__';

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
import {openSearch} from './search.js?v=__V__';

/** Всё, что нужно блоку «Мои игроки»: состав, статистика, травмы и журналы матчей избранных. */
export async function loadFavorites() {
  const ids = fav.list();
  const [roster, stats, injuries] = await Promise.all([data.get('roster'), data.get('player_stats'), data.get('injuries')]);
  // Журналы матчей — только для игроков нынешнего состава: для ушедших файла нет, незачем его запрашивать.
  const inRoster = new Set(usable(roster) ? roster.data.players.map((p) => p.id) : []);
  const withLog = ids.filter((id) => inRoster.has(id));
  const logs = await Promise.all(withLog.map((id) => data.get(`gamelog/${id}`)));
  return {ids, roster, stats, injuries, gamelogs: Object.fromEntries(withLog.map((id, i) => [id, logs[i]]))};
}

function statCell(label, value) {
  return h('div', {class: 'mini-stat'}, h('span', {class: 'mini-stat-value'}, value), h('span', {class: 'mini-stat-label'}, label));
}

function countWord(n, one, few, many) {
  return n == null ? '—' : `${n} ${fmt.plural(n, one, few, many)}`;
}

function lastGameLine(env) {
  if (!usable(env)) return null;
  const games = [...(env.data.games || [])].sort((a, b) => fmt.ms(b.date) - fmt.ms(a.date));
  const g = games[0];
  if (!g) return h('p', {class: 'fav-last muted'}, 'В матчах сезона ещё не выходил');
  const opp = g.opponent?.name || g.opponent?.abbr || 'соперник';
  const res = {W: ', победа', L: ', поражение'}[g.result] || '';
  return h('p', {class: 'fav-last'},
    h('span', {class: 'muted'}, `Последний матч — ${fmt.date(g.date)}, ${g.home ? 'дома' : 'в гостях'} против ${opp}${res}: `),
    `${countWord(g.pts, 'очко', 'очка', 'очков')}, ${countWord(g.reb, 'подбор', 'подбора', 'подборов')}, `
      + countWord(g.ast, 'передача', 'передачи', 'передач'),
    g.min != null ? h('span', {class: 'muted'}, ` · ${g.min} мин на площадке`) : null);
}

/** Карточки избранных игроков со свежей статистикой (или подсказка, как их добавить). */
export function favoritesBlock(d) {
  if (!d.ids.length) {
    return emptyState({iconName: 'star', title: 'Избранных игроков пока нет',
      text: 'Нажмите на лупу вверху, найдите игрока и отметьте его звёздочкой — здесь появится его свежая статистика.',
      action: h('button', {type: 'button', class: 'btn', onclick: () => openSearch()}, 'Найти игрока')});
  }
  const roster = new Map((usable(d.roster) ? d.roster.data.players : []).map((p) => [p.id, p]));
  const stats = new Map((usable(d.stats) ? d.stats.data.players : []).map((p) => [p.id, p.stats]));
  const inj = usable(d.injuries) ? d.injuries.data.players || {} : {};
  const cards = d.ids.map((id) => {
    const p = roster.get(id);
    if (!p) {
      const name = fav.nameOf(id);
      return h('article', {class: 'fav-card'},
        h('div', {class: 'fav-head'}, avatar({id, name}), h('div', {class: 'fav-who'},
          h('p', {class: 'fav-name'}, name || 'Игрок больше не в составе ГСВ'),
          h('p', {class: 'muted'}, name ? 'Больше не в составе ГСВ по данным ESPN.' : 'Его нет в текущем составе по данным ESPN.')),
        starButton({id, name})));
    }
    const s = stats.get(id);
    let statsPart;
    if (s) {
      statsPart = [h('div', {class: 'mini-stats'},
        statCell('очки', fmt.num(s.pts)), statCell('подборы', fmt.num(s.reb)),
        statCell('передачи', fmt.num(s.ast)), statCell('матчи', fmt.num(s.gp, 0))), lastGameLine(d.gamelogs[id])];
    } else if (usable(d.stats)) {
      // ESPN не включает в статистику игроков без матчей — это не ноль, а «не играл».
      statsPart = h('p', {class: 'muted'}, 'В этом сезоне ещё не играл — статистики нет.');
    } else {
      statsPart = [h('p', {class: 'muted'}, `Средние за сезон сейчас недоступны: ${lowerFirst(problemText(d.stats))}.`),
        lastGameLine(d.gamelogs[id])];
    }
    const injury = inj[id] || (p.injury ? {status: p.injury.status} : null);
    return h('article', {class: 'fav-card'},
      h('div', {class: 'fav-head'},
        h('a', {href: `#/player/${id}`, class: 'fav-photo', tabindex: '-1', 'aria-hidden': 'true'}, avatar(p)),
        h('div', {class: 'fav-who'},
          h('a', {href: `#/player/${id}`, class: 'fav-name'}, p.name),
          h('p', {class: 'muted'}, [p.jersey != null ? `#${p.jersey}` : null, fmt.position(p.position)].filter(Boolean).join(' · ')),
          injury && h('p', {class: 'chip chip-injury'}, `Травма: ${fmt.injuryStatus(injury.status)}`)),
        starButton(p)),
      statsPart);
  });
  return h('div', {class: 'fav-wrap'},
    h('div', {class: 'fav-grid'}, cards),
    // Журнал матчей нового игрока может ещё не появиться — это не повод писать «нет данных» про весь блок.
    sourceLine([d.roster, d.stats, ...Object.values(d.gamelogs).filter((e) => !e.missing)],
      {extra: 'средние за матч в сезоне 2026/27'}));
}
