// Лента новостей о ГСВ: фильтры по языку ленты и категории (травмы, обмены, интервью, остальное).
// Обновляется сама: когда сервер публикует свежие данные, app.js вызывает update() — новые новости помечаются.
// Адрес: #/news?lang=ru&cat=injury&all=1 — выбор сохраняется, «Назад» из новости возвращает к нему.
import * as data from '../data.js?v=__V__';
import * as fmt from '../format.js?v=__V__';
import {h, sourceLine, noData, usable, emptyState} from '../ui.js?v=__V__';
import {CATS, CAT_ORDER, LANG_NAMES, catOf, langOf, byDate, newsMeta, feedTitle} from '../news.js?v=__V__';

const LANGS = [['all', 'Все ленты'], ['en', 'На английском'], ['ru', 'На русском']];
const FIRST = 30; // сколько новостей показываем сразу, остальные — по кнопке

export default {
  section: () => 'news',
  title: () => 'Новости',
  async render(view, params, query) {
    const ui = readState(query);
    const known = new Set(); // какие новости уже были на экране
    const fresh = new Set(); // пришли при автообновлении — помечаем «новое»
    const draw = async (quiet) => {
      const env = await data.get('news');
      if (usable(env)) {
        const first = known.size === 0;
        for (const it of env.data.items) {
          if (!known.has(it.id) && !first) fresh.add(it.id);
          known.add(it.id);
        }
      }
      const focusKey = document.activeElement?.dataset?.focusKey;
      const page = build(env, ui, fresh);
      if (quiet) page.classList.add('quiet');
      view.replaceChildren(page);
      if (quiet && focusKey) view.querySelector(`[data-focus-key="${focusKey}"]`)?.focus({preventScroll: true});
    };
    await draw(false);
    return {update: () => draw(true)};
  },
};

function readState(query) {
  const lang = query?.get('lang');
  const cat = query?.get('cat');
  return {
    lang: lang === 'en' || lang === 'ru' ? lang : 'all',
    cat: CAT_ORDER.includes(cat) ? cat : 'all',
    more: query?.get('all') === '1',
  };
}

function writeState(ui) {
  const q = new URLSearchParams();
  if (ui.lang !== 'all') q.set('lang', ui.lang);
  if (ui.cat !== 'all') q.set('cat', ui.cat);
  if (ui.more) q.set('all', '1');
  const qs = q.toString();
  const url = `#/news${qs ? `?${qs}` : ''}`;
  if (location.hash !== url) {
    try { history.replaceState(history.state, '', url); } catch { /* не страшно */ }
  }
}

const newsCount = (n) => `${n} ${fmt.plural(n, 'новость', 'новости', 'новостей')}`;

function item(it, isNew) {
  const text = (it.text || '').replace(/\s+/g, ' ').trim();
  return h('li', {class: `nf-item${isNew ? ' is-new' : ''}`},
    h('a', {class: 'news-link nf-link', href: `#/news/${it.id}`, 'data-focus-key': `n-${it.id}`},
      h('span', {class: 'news-meta-row'}, newsMeta(it), isNew ? h('span', {class: 'nf-new'}, 'новое') : null),
      h('span', {class: 'news-title'}, it.title),
      text ? h('span', {class: 'nf-text'}, text) : null));
}

/** Какие ленты собраны и в каком они состоянии — у каждой своё время проверки. */
function feedsNote(env) {
  const feeds = env.data.feeds || [];
  if (!feeds.length) return null;
  const parts = feeds.map((f) => {
    const lang = LANG_NAMES[f.lang] ? `, ${LANG_NAMES[f.lang]}` : '';
    if (f.ok) return `${feedTitle(f.name)}${lang} — ${f.count} ${fmt.plural(f.count, 'новость', 'новости', 'новостей')} в ленте`;
    return `${feedTitle(f.name)}${lang} — не ответила (${f.error || 'ошибка'}), показаны новости из прошлых загрузок`;
  });
  const bad = feeds.some((f) => !f.ok);
  return h('p', {class: `small ${bad ? 'nf-feeds is-bad' : 'nf-feeds muted'}`}, `Ленты: ${parts.join('; ')}.`);
}

function build(env, ui, fresh) {
  const head = h('header', {class: 'page-head'},
    h('p', {class: 'eyebrow'}, 'Сезон 2026/27'),
    h('h1', {class: 'page-title'}, 'Новости'));
  const page = h('div', {class: 'page news-page'}, head);
  if (!usable(env)) {
    page.append(noData(env, 'Новости'));
    return page;
  }
  const feeds = env.data.feeds || [];
  const names = (lang) => feeds.filter((f) => f.lang === lang).map((f) => feedTitle(f.name));
  const en = names('en');
  const ru = names('ru');
  head.append(h('p', {class: 'page-lead'},
    'Новости о «Голден Стэйт»'
    + (en.length ? `: ${en.join(' и ')} — на английском, как в источнике` : '')
    + (ru.length ? `; отдельно — ${ru.join(', ')} на русском` : '')
    + '. Лента обновляется сама.'));

  const all = byDate(env.data.items);
  const inLang = (it, lang) => lang === 'all' || langOf(it) === lang;
  const inCat = (it, cat) => cat === 'all' || catOf(it) === cat;

  const listBox = h('div', {class: 'nf-groups'});
  const count = h('p', {class: 'roster-count', 'aria-live': 'polite'});
  const moreBtn = h('button', {type: 'button', class: 'more-btn', 'data-focus-key': 'more',
    onclick: () => {
      set({more: true}, false);
      listBox.querySelectorAll('.nf-link')[FIRST]?.focus(); // кнопка исчезла — фокус на первую из открывшихся
    }});
  const empty = emptyState({iconName: 'news', title: 'В этой категории пока нет новостей',
    text: 'Категорию сайт определяет по заголовку; когда она неочевидна, новость попадает в «Остальное».',
    action: h('button', {type: 'button', class: 'btn', onclick: () => set({cat: 'all', lang: 'all'})}, 'Показать все')});

  const segButtons = [];
  const seg = (label, key, options) => h('div', {class: 'seg', role: 'group', 'aria-label': label},
    options.map(([v, text]) => {
      const b = h('button', {type: 'button', class: 'seg-btn', 'data-key': key, 'data-v': v, 'data-focus-key': `${key}-${v}`,
        onclick: () => set({[key]: v, more: false})}, text, h('span', {class: 'seg-count'}));
      segButtons.push(b);
      return b;
    }));
  const toolbar = h('div', {class: 'roster-tools'},
    seg('Язык ленты', 'lang', LANGS),
    seg('Категория', 'cat', [['all', 'Все'], ...CAT_ORDER.map((c) => [c, CATS[c]])]),
    h('p', {class: 'small muted nf-hint'},
      'Категорию сайт определяет по заголовку, а если она неочевидна — «Остальное». В «Обменах» — и подписания, контракты.'));

  function renderList(animate) {
    for (const b of segButtons) {
      const {key, v} = b.dataset;
      b.setAttribute('aria-pressed', String(ui[key] === v));
      const n = all.filter((it) => (key === 'lang' ? inLang(it, v) && inCat(it, ui.cat) : inLang(it, ui.lang) && inCat(it, v))).length;
      b.querySelector('.seg-count').textContent = String(n);
    }
    const shown = all.filter((it) => inLang(it, ui.lang) && inCat(it, ui.cat));
    const visible = ui.more ? shown : shown.slice(0, FIRST);
    // По дням — по часовому поясу устройства.
    const groups = [];
    let cur = null;
    for (const it of visible) {
      const day = fmt.localDay(it.date) || 'none';
      if (!cur || cur.day !== day) {
        cur = {day, title: fmt.dayTitle(it.date), items: []};
        groups.push(cur);
      }
      cur.items.push(it);
    }
    const nodes = groups.map((g, i) => {
      const sec = h('section', {class: 'nf-group'},
        h('header', {class: 'sg-head'}, h('h2', {class: 'sg-title'}, g.title), h('span', {class: 'sg-count'}, newsCount(g.items.length))),
        h('ul', {class: 'nf-list'}, g.items.map((it) => item(it, fresh.has(it.id)))));
      if (animate) { sec.classList.add('reveal'); sec.style.setProperty('--i', String(Math.min(i, 4))); }
      return sec;
    });
    listBox.replaceChildren(...nodes);
    count.textContent = shown.length === all.length ? `Всего в ленте: ${newsCount(all.length)} за последние 30 дней`
      : `Показано ${shown.length} из ${all.length}`;
    const rest = shown.length - visible.length;
    moreBtn.hidden = rest <= 0;
    moreBtn.textContent = `Показать ещё ${newsCount(rest)}`;
    empty.hidden = shown.length > 0;
  }

  function set(patch, animate = true) {
    Object.assign(ui, patch);
    writeState(ui);
    renderList(animate);
  }

  writeState(ui);
  renderList(true);
  page.append(toolbar, count, listBox, empty, moreBtn, feedsNote(env), sourceLine(env));
  return page;
}

