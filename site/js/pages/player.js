// Игрок (этап 2 — коротко: фото, номер, позиция, рост, возраст, средние за сезон, избранное).
// Полная карточка со всей статистикой и последними матчами — этап 3.
import * as data from '../data.js?v=__V__';
import * as fmt from '../format.js?v=__V__';
import {h, avatar, starButton, sourceLine, errorState, usable} from '../ui.js?v=__V__';
import {backButton} from './news-item.js?v=__V__';

function fact(label, value) {
  return h('div', {class: 'fact'}, h('dt', null, label), h('dd', null, value));
}

export default {
  section: () => 'roster',
  title: () => 'Игрок',
  async render(view, [id]) {
    const [roster, stats, injuries] = await Promise.all([data.get('roster'), data.get('player_stats'), data.get('injuries')]);
    const p = usable(roster) ? roster.data.players.find((x) => x.id === id) : null;
    if (!p) {
      view.append(h('div', {class: 'page narrow'}, backButton(), errorState({
        title: 'Игрок не найден',
        text: usable(roster) ? 'Его нет в текущем составе ГСВ по данным ESPN.' : `Состав не загрузился: ${roster?.error || 'источник не ответил'}.`,
        action: h('a', {class: 'btn', href: '#/'}, 'На главную')})));
      return {};
    }
    document.title = `${p.name} · Golden State Warriors 2026/27`;
    const s = usable(stats) ? stats.data.players.find((x) => x.id === id)?.stats : null;
    const inj = usable(injuries) ? injuries.data.players?.[id] : null;
    const injury = inj || (p.injury ? {status: p.injury.status} : null);
    view.append(h('article', {class: 'page narrow player'},
      backButton(),
      h('header', {class: 'player-head'},
        avatar(p, 'avatar-xl'),
        h('div', {class: 'player-who'},
          h('p', {class: 'eyebrow'}, [p.jersey != null ? `#${p.jersey}` : null, fmt.position(p.position)].filter(Boolean).join(' · ')),
          h('h1', {class: 'player-name'}, p.name),
          injury ? h('p', {class: 'chip chip-injury'}, `Травма: ${fmt.injuryStatus(injury.status)}`)
            : h('p', {class: 'chip chip-ok'}, 'В строю'),
          starButton(p, {withText: true}))),
      injury?.short ? h('p', {class: 'note'}, `${injury.short} (ESPN, на английском)`) : null,
      h('dl', {class: 'facts'},
        fact('Рост', p.heightCm ? `${p.heightCm} см` : '—'),
        fact('Вес', p.weightKg ? `${p.weightKg} кг` : '—'),
        fact('Возраст', p.age != null ? `${p.age} ${fmt.plural(p.age, 'год', 'года', 'лет')}` : '—'),
        // ESPN считает текущий сезон: у Карри (с 2009 г.) в 2026/27 — 18; новичок — 0.
        fact('В НБА', p.experience != null ? (p.experience === 0 ? 'новичок' : `${p.experience}-й сезон`) : '—')),
      sourceLine(usable(injuries) ? [roster, injuries] : roster),
      h('h2', {class: 'section-title'}, 'Сезон 2026/27, в среднем за матч'),
      s ? h('div', {class: 'mini-stats mini-stats-lg'},
        ...[['очки', s.pts], ['подборы', s.reb], ['передачи', s.ast], ['минуты', s.min]].map(([l, v]) =>
          h('div', {class: 'mini-stat'}, h('span', {class: 'mini-stat-value'}, fmt.num(v)), h('span', {class: 'mini-stat-label'}, l))),
        h('div', {class: 'mini-stat'}, h('span', {class: 'mini-stat-value'}, fmt.num(s.gp, 0)), h('span', {class: 'mini-stat-label'}, 'матчи')))
        : h('p', {class: 'muted'}, usable(stats) ? 'В этом сезоне ещё не играл — статистики нет.' : `Статистика не загрузилась: ${stats?.error || 'источник не ответил'}.`),
      sourceLine(stats),
      h('p', {class: 'note'}, 'Полная карточка — вся статистика сезона и последние матчи — появится на следующем этапе вместе с разделом «Состав».')));
    return {};
  },
};
