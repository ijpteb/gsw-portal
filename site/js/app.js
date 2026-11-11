// Каркас сайта: меню, переходы между разделами (адреса вида #/schedule), кнопка «Обновить»,
// поиск, избранное и автоматическая подгрузка свежих данных (раз в минуту, во время матча — чаще).
import * as data from './data.js?v=__V__';
import * as fmt from './format.js?v=__V__';
import * as fav from './favorites.js?v=__V__';
import {h, icon, toast, errorState} from './ui.js?v=__V__';
import {SECTIONS} from './sections.js?v=__V__';
import {openSearch} from './search.js?v=__V__';
import {openOverlay, closeOverlay, currentOverlay} from './overlay.js?v=__V__';
import home from './pages/home.js?v=__V__';
import newsItem from './pages/news-item.js?v=__V__';
import player from './pages/player.js?v=__V__';
import favorites from './pages/favorites.js?v=__V__';
import soon from './pages/soon.js?v=__V__';
import status from './pages/status.js?v=__V__';

const notFound = {
  section: () => null,
  title: () => 'Страница не найдена',
  async render(view) {
    view.append(h('div', {class: 'page narrow'}, errorState({title: 'Такой страницы нет',
      text: 'Возможно, ссылка устарела.', action: h('a', {class: 'btn', href: '#/'}, 'На главную')})));
    return {};
  },
};

const soonIds = SECTIONS.filter((s) => s.stage).map((s) => s.id).join('|');
const ROUTES = [
  [/^\/?$/, home],
  [/^\/news\/([\w-]+)$/, newsItem],
  [/^\/player\/(\d+)$/, player],
  [/^\/favorites$/, favorites],
  [/^\/status$/, status],
  [new RegExp(`^/(${soonIds})$`), soon],
];

const main = document.getElementById('main');
let current = null;
let navToken = 0;
let firstRoute = true;

// --- Меню ------------------------------------------------------------------------------

function buildNav() {
  const linkTo = (s, cls, withIcon) => h('a', {class: cls, href: `#${s.path}`, 'data-section': s.id},
    withIcon ? icon(s.icon, 22) : null, h('span', null, s.title));
  document.querySelector('.nav-desktop').replaceChildren(
    ...SECTIONS.filter((s) => s.id !== 'favorites').map((s) => linkTo(s, 'nav-link', false)));
  document.querySelector('.tabbar').replaceChildren(
    ...SECTIONS.filter((s) => s.tab).sort((a, b) => a.tab - b.tab).map((s) => linkTo(s, 'tab', true)),
    h('button', {class: 'tab', type: 'button', 'data-action': 'menu', 'aria-haspopup': 'dialog'}, icon('menu', 22), h('span', null, 'Ещё')));
  document.querySelector('.sheet-nav').replaceChildren(
    ...SECTIONS.map((s) => linkTo(s, 'sheet-link', true)),
    h('a', {class: 'sheet-link sheet-link-minor', href: '#/status', 'data-section': 'status'}, icon('info', 22), h('span', null, 'Состояние данных')));
  document.querySelector('[data-action="search"]').append(icon('search', 22));
  document.querySelector('a.icon-btn[href="#/favorites"]').prepend(icon('star', 22));
  document.querySelector('[data-action="refresh"]').append(icon('refresh', 22));
  const tz = fmt.tzLabel();
  document.querySelectorAll('[data-tz]').forEach((el) => { el.textContent = tz ? ` (${tz})` : ''; });
}

function setActive(sectionId) {
  document.querySelectorAll('[data-section]').forEach((a) => {
    if (a.dataset.section === sectionId) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const inTabs = SECTIONS.some((s) => s.tab && s.id === sectionId);
  document.querySelector('.tab[data-action="menu"]').classList.toggle('is-current', Boolean(sectionId) && !inTabs);
}

function updateFavBadge() {
  const n = fav.list().length;
  const b = document.querySelector('[data-fav-count]');
  b.hidden = n === 0;
  b.textContent = String(n);
}

// --- Переходы ----------------------------------------------------------------------------

async function route() {
  const token = ++navToken;
  const path = location.hash.replace(/^#/, '') || '/';
  let page = notFound;
  let params = [];
  for (const [re, p] of ROUTES) {
    const m = path.match(re);
    if (m) { page = p; params = m.slice(1).map(decodeURIComponent); break; }
  }
  if (currentOverlay()) closeOverlay(currentOverlay(), {restoreFocus: false});
  current?.destroy?.();
  current = null;
  const view = h('div', {class: 'view'});
  main.replaceChildren(view);
  setActive(page.section(params));
  document.title = `${page.title(params)} · Golden State Warriors 2026/27`;
  if (!firstRoute) {
    window.scrollTo(0, 0);
    main.focus({preventScroll: true});
  }
  firstRoute = false;
  try {
    const ctrl = await page.render(view, params);
    if (token !== navToken) { ctrl?.destroy?.(); return; }
    current = ctrl || {};
  } catch (err) {
    if (token !== navToken) return;
    console.error(err);
    view.replaceChildren(h('div', {class: 'page narrow'}, errorState({title: 'Страница не открылась',
      text: 'Внутренняя ошибка сайта. Нажмите «Обновить» или откройте страницу позже.'})));
  }
}

// --- Свежие данные -------------------------------------------------------------------------

let checking = false;
async function check() {
  if (checking) return;
  checking = true;
  try {
    if (await data.checkForUpdates()) await current?.update?.();
  } catch {
    // нет сети — попробуем в следующий раз
  } finally {
    checking = false;
  }
}

async function loop() {
  await check();
  setTimeout(loop, (await data.isLive()) ? 30000 : 60000);
}

async function refresh(btn) {
  if (btn.classList.contains('is-spinning')) return;
  btn.classList.add('is-spinning');
  try {
    const prev = (await data.get('status')).data?.generatedAt;
    const st = await data.reloadAll();
    await current?.update?.();
    const gen = st.data?.generatedAt;
    if (st.missing) toast(st.error);
    else if (gen !== prev) toast(`Готово: загружены свежие данные (обновлены ${fmt.stamp(gen)})`);
    else toast(`Готово: у вас самые свежие данные (обновлены ${fmt.stamp(gen)})`);
  } catch {
    toast('Не удалось связаться с сайтом — проверьте интернет');
  } finally {
    btn.classList.remove('is-spinning');
  }
}

// --- Запуск -------------------------------------------------------------------------------

buildNav();
updateFavBadge();
window.addEventListener('favorites-change', updateFavBadge);
window.addEventListener('hashchange', route);

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'search') openSearch();
  else if (action === 'refresh') refresh(btn);
  else if (action === 'menu') openOverlay(document.getElementById('menu'));
});

document.getElementById('menu').addEventListener('click', (e) => {
  if (e.target.closest('a')) closeOverlay(document.getElementById('menu'), {restoreFocus: false});
});

document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if (e.key === '/' && !typing && !currentOverlay() && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    openSearch();
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) check();
});

data.get('status');
route().then(() => setTimeout(loop, 30000));
