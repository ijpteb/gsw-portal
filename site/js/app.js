// Каркас сайта: меню, переходы между разделами (адреса вида #/schedule), кнопка «Обновить»,
// поиск, избранное и автоматическая подгрузка свежих данных (раз в минуту, во время матча — чаще).
import * as data from './data.js?v=__V__';
import * as fmt from './format.js?v=__V__';
import * as fav from './favorites.js?v=__V__';
import {h, icon, toast, errorState} from './ui.js?v=__V__';
import {SECTIONS} from './sections.js?v=__V__';
import {openSearch} from './search.js?v=__V__';
import {openOverlay, closeOverlay, currentOverlay} from './overlay.js?v=__V__';
import {canAnimate, findPhoto, morphPage} from './transitions.js?v=__V__';
import home from './pages/home.js?v=__V__';
import newsItem from './pages/news-item.js?v=__V__';
import player from './pages/player.js?v=__V__';
import roster from './pages/roster.js?v=__V__';
import schedule from './pages/schedule.js?v=__V__';
import standings from './pages/standings.js?v=__V__';
import stats from './pages/stats.js?v=__V__';
import compare from './pages/compare.js?v=__V__';
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
  [/^\/roster$/, roster],
  [/^\/schedule$/, schedule],
  [/^\/standings$/, standings],
  [/^\/stats$/, stats],
  [/^\/compare$/, compare],
  [/^\/favorites$/, favorites],
  [/^\/status$/, status],
  [new RegExp(`^/(${soonIds})$`), soon],
];

const main = document.getElementById('main');
let current = null;
let navToken = 0;
let firstRoute = true;
let lastPath = null;

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
// Адрес — после «#»: #/roster?sort=pts → путь «/roster» и параметры sort=pts.

function resolve() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const qi = raw.indexOf('?');
  const path = qi >= 0 ? raw.slice(0, qi) : raw;
  const query = new URLSearchParams(qi >= 0 ? raw.slice(qi + 1) : '');
  for (const [re, page] of ROUTES) {
    const m = path.match(re);
    if (m) return {page, params: m.slice(1).map(decodeURIComponent), query, path};
  }
  return {page: notFound, params: [], query, path};
}

const playerIdOf = (path) => path?.match(/^\/player\/(\d+)$/)?.[1] || null;

// Где была прокрутка: запоминаем в записи истории, чтобы «Назад» вернул на то же место
// (например, к тому же игроку в длинном списке состава).
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
let saveTimer = 0;
function saveScroll() {
  clearTimeout(saveTimer);
  try {
    history.replaceState({...(history.state || {}), y: Math.round(window.scrollY)}, '');
  } catch {
    // браузер ограничивает частоту — не страшно
  }
}
window.addEventListener('scroll', () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveScroll, 250);
}, {passive: true});
// Перед переходом по ссылке — сразу (прокрутка могла не успеть сохраниться).
document.addEventListener('click', (e) => {
  if (e.target.closest?.('a[href^="#"]')) saveScroll();
}, true);

async function route() {
  clearTimeout(saveTimer); // не записать прокрутку старой страницы в новую запись истории
  const token = ++navToken;
  const {page, params, query, path} = resolve();
  const savedY = history.state?.y;
  const fromPath = lastPath;
  lastPath = path;
  const first = firstRoute;
  firstRoute = false;
  if (currentOverlay()) closeOverlay(currentOverlay(), {restoreFocus: false});

  const swap = async (animated) => {
    if (token !== navToken) return; // пока ждали, уже ушли на другую страницу
    current?.destroy?.();
    current = null;
    const view = h('div', {class: animated ? 'view no-anim' : 'view'});
    main.replaceChildren(view);
    setActive(page.section(params));
    document.title = `${page.title(params)} · Golden State Warriors 2026/27`;
    if (!first && savedY == null) window.scrollTo(0, 0);
    if (!first) main.focus({preventScroll: true});
    try {
      const ctrl = await page.render(view, params, query);
      if (token !== navToken) { ctrl?.destroy?.(); return; }
      current = ctrl || {};
      if (savedY != null) {
        window.scrollTo(0, savedY);
        // Вернулись из карточки игрока — фокус на его ссылке в списке (удобно с клавиатуры).
        const back = playerIdOf(fromPath);
        if (back && !first) main.querySelector(`a[href="#/player/${back}"]`)?.focus({preventScroll: true});
      }
    } catch (err) {
      if (token !== navToken) return;
      console.error(err);
      view.replaceChildren(h('div', {class: 'page narrow'}, errorState({title: 'Страница не открылась',
        text: 'Внутренняя ошибка сайта. Нажмите «Обновить» или откройте страницу позже.'})));
    }
  };

  // «Раскрытие» карточки игрока: фото перелетает из списка (или с главной) в карточку и обратно.
  const id = playerIdOf(path) || playerIdOf(fromPath);
  const fromEl = !first && id && canAnimate() ? findPhoto(main, id) : null;
  if (fromEl) await morphPage(fromEl, id, main, () => swap(true)).updateCallbackDone.catch(() => {});
  else await swap(false);
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
