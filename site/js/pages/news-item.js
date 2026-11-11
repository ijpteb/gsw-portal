// Отдельная страница новости: заголовок, дата, источник, текст из самой ленты и ссылка на оригинал.
// Полный текст со страниц чужих сайтов не вытаскиваем — только то, что отдаёт лента.
import * as data from '../data.js?v=__V__';
import * as fmt from '../format.js?v=__V__';
import {h, icon, sourceLine, errorState, usable} from '../ui.js?v=__V__';

const CATS = {injury: 'Травмы', trade: 'Обмены', interview: 'Интервью', other: 'Остальное'};
const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);

export function backButton() {
  return h('button', {type: 'button', class: 'back-btn', onclick: () => {
    if (history.length > 1) history.back();
    else location.hash = '#/';
  }}, icon('back', 18), 'Назад');
}

export default {
  section: () => 'news',
  title: () => 'Новость',
  async render(view, [id]) {
    const env = await data.get('news');
    const it = usable(env) ? env.data.items.find((x) => x.id === id) : null;
    if (!it) {
      view.append(h('div', {class: 'page narrow'}, backButton(), errorState({
        title: 'Новость не найдена',
        text: usable(env) ? 'Возможно, она уже выпала из ленты: на сайте хранятся новости за последние 30 дней.'
          : `Новости не загрузились: ${env?.error || 'источник не ответил'}.`,
        action: h('a', {class: 'btn', href: '#/'}, 'На главную')})));
      return {};
    }
    document.title = `${it.title} · Golden State Warriors 2026/27`;
    const url = safeUrl(it.url);
    const d = fmt.toDate(it.date);
    view.append(h('article', {class: 'page narrow article'},
      backButton(),
      h('p', {class: 'news-meta'},
        h('span', {class: `cat cat-${it.category || 'other'}`}, CATS[it.category] || CATS.other),
        h('span', null, it.source),
        d ? h('time', {datetime: it.date}, `${fmt.date(it.date)}, ${fmt.time(it.date)}`) : null,
        it.lang && it.lang !== 'ru' ? h('span', {class: 'lang', title: 'Язык источника'}, it.lang.toUpperCase()) : null),
      h('h1', {class: 'article-title'}, it.title),
      it.text ? h('p', {class: 'article-text'}, it.text)
        : h('p', {class: 'muted'}, 'Лента передала только заголовок — текст можно прочитать в источнике.'),
      it.text ? h('p', {class: 'note'}, 'Это краткое описание из ленты источника; полная статья — по ссылке ниже.') : null,
      url ? h('a', {class: 'btn', href: url, target: '_blank', rel: 'noopener noreferrer'}, 'Читать в источнике', icon('external', 18)) : null,
      sourceLine(env, {name: it.source})));
    return {};
  },
};
