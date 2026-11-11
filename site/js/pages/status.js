// Состояние данных: что, откуда и когда обновлялось (из status.json сборщика).
import * as data from '../data.js?v=__V__';
import * as fmt from '../format.js?v=__V__';
import {h, errorState} from '../ui.js?v=__V__';

const SETS = [
  ['schedule', 'Расписание и результаты', 'раз в час, в день матча — каждые 5 мин'],
  ['live', 'Счёт идущего матча', 'во время матча — каждую минуту'],
  ['team', 'Команда: баланс и место', 'раз в час'],
  ['standings', 'Таблица Западной конференции', 'раз в час'],
  ['roster', 'Состав', 'раз в час'],
  ['injuries', 'Травмы', 'раз в час'],
  ['player_stats', 'Статистика игроков', 'раз в час'],
  ['team_stats', 'Статистика команды и места в лиге', 'раз в час'],
  ['news', 'Новости', 'каждые 20 мин'],
  ['logos', 'Логотипы команд', 'раз в неделю'],
];

export default {
  section: () => 'status',
  title: () => 'Состояние данных',
  async render(view) {
    const draw = async (quiet) => {
      const env = await data.get('status');
      const page = h('div', {class: `page narrow${quiet ? ' quiet' : ''}`},
        h('header', {class: 'page-head'},
          h('p', {class: 'eyebrow'}, 'Служебная страница'),
          h('h1', {class: 'page-title'}, 'Состояние данных'),
          h('p', {class: 'page-lead'}, 'Данные собирает сервер (GitHub) из бесплатных источников и публикует на сайт. Здесь видно, что и когда обновлялось.')));
      if (env.missing || !env.data) {
        page.append(errorState({title: 'Состояние неизвестно', text: env.error}));
      } else {
        const st = env.data;
        let lead = `Последняя публикация данных: ${fmt.stamp(st.generatedAt)}.`;
        if (st.liveWindow) lead += ' Сейчас идёт матч — счёт обновляется каждую минуту.';
        else if (st.gameday) lead += ' Сегодня день матча — расписание обновляется каждые 5 минут.';
        page.append(h('p', {class: 'muted'}, lead), h('ul', {class: 'status-list'}, SETS.map(([key, name, freq]) => {
          const d = st.datasets[key];
          let label = '✓ в порядке';
          let cls = 'ok';
          if (!d) { label = '— ещё не собиралось'; cls = 'error'; }
          else if (d.status === 'stale') { label = '⚠ источник не ответил, показаны прошлые данные'; cls = 'stale'; }
          else if (d.status !== 'ok') { label = '✗ данных нет'; cls = 'error'; }
          return h('li', null,
            h('div', {class: 'status-row'}, h('span', {class: 'status-name'}, name), h('span', {class: `status-st is-${cls}`}, label)),
            d ? h('p', {class: 'source'}, `Получено: ${fmt.stamp(d.fetchedAt)} · источник: ${d.source?.name || '—'} · обновляется ${freq}`
              + (key === 'live' && !st.liveWindow ? ' (сейчас матча нет)' : '')) : null,
            d && d.status !== 'ok' && d.error ? h('p', {class: 'source is-error'}, `Последняя попытка ${fmt.stamp(d.checkedAt)}: ${d.error}`) : null);
        })));
      }
      view.replaceChildren(page);
    };
    await draw(false);
    return {update: () => draw(true)};
  },
};
