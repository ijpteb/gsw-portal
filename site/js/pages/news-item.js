// Отдельная страница новости: заголовок, дата, источник, текст из самой ленты и ссылка на оригинал.
// Полный текст со страниц чужих сайтов не вытаскиваем — только то, что отдаёт лента.
import * as data from '../data.js?v=__V__';
import {h, icon, sourceLine, errorState, usable} from '../ui.js?v=__V__';
import {CATS, catOf, langOf, byDate, newsMeta, safeUrl} from '../news.js?v=__V__';

/** «Назад» по истории браузера; если пришли по прямой ссылке — на fallback. */
export function backButton(fallback = '#/') {
  return h('button', {type: 'button', class: 'back-btn', onclick: () => {
    if (history.length > 1) history.back();
    else location.hash = fallback;
  }}, icon('back', 18), 'Назад');
}

/** Ещё несколько свежих новостей — той же категории, если есть, и на том же языке. */
function moreNews(items, it) {
  const others = byDate(items).filter((x) => x.id !== it.id && langOf(x) === langOf(it));
  const same = others.filter((x) => catOf(x) === catOf(it));
  const pick = [...same, ...others.filter((x) => catOf(x) !== catOf(it))].slice(0, 4);
  if (!pick.length) return null;
  const c = catOf(it);
  return h('section', {class: 'card nf-more', 'aria-label': 'Ещё новости'},
    h('header', {class: 'card-head'}, h('h2', {class: 'eyebrow'}, same.length ? `Ещё: ${CATS[c]}` : 'Ещё новости'),
      h('a', {class: 'card-link', href: `#/news${c !== 'other' && same.length ? `?cat=${c}` : ''}`}, 'Вся лента', icon('chevron', 16))),
    h('ul', {class: 'news-list'}, pick.map((x) => h('li', null,
      h('a', {class: 'news-link', href: `#/news/${x.id}`}, newsMeta(x), h('span', {class: 'news-title'}, x.title))))));
}

export default {
  section: () => 'news',
  title: () => 'Новость',
  async render(view, [id]) {
    const env = await data.get('news');
    const it = usable(env) ? env.data.items.find((x) => x.id === id) : null;
    if (!it) {
      view.append(h('div', {class: 'page narrow'}, backButton('#/news'), errorState({
        title: 'Новость не найдена',
        text: usable(env) ? 'Возможно, она уже выпала из ленты: на сайте хранятся новости за последние 30 дней.'
          : `Новости не загрузились: ${env?.error || 'источник не ответил'}.`,
        action: h('a', {class: 'btn', href: '#/news'}, 'Все новости')})));
      return {};
    }
    document.title = `${it.title} · Golden State Warriors 2026/27`;
    const url = safeUrl(it.url);
    view.append(h('div', {class: 'page narrow'},
      h('article', {class: 'article'},
        backButton('#/news'),
        newsMeta(it, {full: true, tag: 'p'}),
        h('h1', {class: 'article-title'}, it.title),
        it.text ? h('p', {class: 'article-text', lang: langOf(it)}, it.text)
          : h('p', {class: 'muted'}, 'Лента передала только заголовок — текст можно прочитать в источнике.'),
        it.text ? h('p', {class: 'note'}, 'Это краткое описание из ленты источника; полная статья — по ссылке ниже.') : null,
        url ? h('a', {class: 'btn', href: url, target: '_blank', rel: 'noopener noreferrer'}, 'Читать в источнике', icon('external', 18)) : null,
        sourceLine(env, {name: it.source})),
      moreNews(env.data.items, it)));
    return {};
  },
};
