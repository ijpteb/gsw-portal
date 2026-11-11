// Общие кирпичики интерфейса: создание элементов, иконки, состояния, подпись «источник и время».
import * as fmt from './format.js?v=__V__';
import * as fav from './favorites.js?v=__V__';

/** h('a', {href: '#/', class: 'x', onclick: fn}, 'текст', детиУзлы…) — без innerHTML для данных. */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else el.style[sk] = sv;
        }
      }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : String(c));
  }
}

// Иконки — простые линии 24×24 (свои, без внешних библиотек).
const ICONS = {
  home: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v11.5h13V9"/><path d="M10 20.5v-5.5h4v5.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.7-3.7 3.3-6 6.5-6s5.8 2.3 6.5 6"/><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.5c2.1.8 3.4 2.8 4 5.5"/>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9 9.5v10"/>',
  chart: '<path d="M4 20.5h16"/><path d="M7 17v-5M12 17V6.5M17 17v-8"/>',
  news: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M7.5 9h9M7.5 12.5h9M7.5 16h5.5"/>',
  compare: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  trophy: '<path d="M8 4h8v5.5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5.5A2.5 2.5 0 0 0 8 10M16 6h2.5A2.5 2.5 0 0 1 16 10"/><path d="M12 13.5V17M9 20.5h6M10 17h4"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 0 1-13 5.1M4.5 12a7.5 7.5 0 0 1 13-5.1"/><path d="M17.5 3.5v3.4h-3.4M6.5 20.5v-3.4h3.4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevron: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  back: '<path d="M19.5 12h-15M10.5 6l-6 6 6 6"/>',
  external: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13"/><path d="M17.5 14v4.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1H10"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4L12 4z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
};

export function icon(name, size = 22) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('icon', `icon-${name}`);
  svg.innerHTML = ICONS[name] || ''; // только свои константы, не данные
  return svg;
}

// --- «Источник и время» под каждым блоком -------------------------------------------

const LABELS = {
  schedule: 'Расписание', live: 'Счёт матча', team: 'Команда', standings: 'Таблица', roster: 'Состав',
  injuries: 'Травмы', player_stats: 'Статистика игроков', team_stats: 'Статистика команды', news: 'Новости',
  status: 'Состояние данных', logos: 'Логотипы',
};

/** Человеческое название набора данных: «Таблица», «Статистика игроков»… */
export function datasetLabel(env) {
  const ds = env?.dataset || '';
  return LABELS[ds] || (ds.startsWith('gamelog/') ? 'Матчи игрока' : 'Данные');
}

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const isBad = (e) => e.missing || e.status === 'error' || !e.data;

/** Почему данных нет — одной фразой. */
export function problemText(env) {
  if (!env) return 'Данные не загрузились';
  if (env.missing) return env.error || 'Данные не загрузились';
  return `Данные ещё не получены (${env.error || 'источник не ответил'})`;
}

/**
 * Подпись «источник и время» по одному или нескольким конвертам. Честно говорит, каких данных нет
 * и почему, а если источник временно не ответил — от какого времени показанные данные.
 */
export function sourceLine(envs, {extra, name} = {}) {
  const list = [].concat(envs).filter(Boolean);
  const many = list.length > 1;
  const tag = (e, text) => (many ? `${datasetLabel(e)}: ${lowerFirst(text)}` : text);
  const bad = list.filter(isBad);
  const stale = list.filter((e) => !isBad(e) && e.status === 'stale');
  const good = list.filter((e) => !isBad(e) && e.status !== 'stale');
  const p = h('p', {class: 'source'});
  const parts = [];
  if (bad.length) parts.push(bad.map((e) => tag(e, problemText(e))).join('; '));
  if (stale.length) {
    parts.push(stale.map((e) => tag(e, `Источник временно недоступен — показаны данные от ${fmt.stampFull(e.fetchedAt)}`)).join('; '));
    p.title = stale.map((e) => e.error).filter(Boolean).join('; ');
  }
  if (good.length) {
    const names = name || [...new Set(good.map((e) => e.source?.name).filter(Boolean))].join(', ') || '—';
    const oldest = good.map((e) => e.fetchedAt).filter(Boolean).sort()[0];
    parts.push(`${parts.length ? 'Остальное' : 'Источник'}: ${names} · обновлено ${fmt.stamp(oldest)}`
      + (extra && !bad.length && !stale.length ? ` · ${extra}` : ''));
  }
  if (bad.length || stale.length) {
    p.classList.add(bad.length ? 'is-error' : 'is-stale');
    p.append(icon('alert', 15), ' ');
  }
  p.append(parts.join('. '));
  return p;
}

/** Набор данных пригоден для показа (есть data, пусть и устаревшие). */
export const usable = (env) => Boolean(env && !env.missing && env.data);

// --- Состояния ---------------------------------------------------------------------

export function emptyState({iconName = 'info', title, text, action} = {}) {
  return h('div', {class: 'state state-empty'},
    h('span', {class: 'state-icon'}, icon(iconName, 26)),
    title && h('p', {class: 'state-title'}, title),
    text && h('p', {class: 'state-text'}, text),
    action);
}

export function errorState({title = 'Не получилось загрузить', text, action} = {}) {
  return h('div', {class: 'state state-error', role: 'alert'},
    h('span', {class: 'state-icon'}, icon('alert', 26)),
    h('p', {class: 'state-title'}, title),
    text && h('p', {class: 'state-text'}, text),
    action);
}

/**
 * Блок без данных: что именно не так — из конверта (вместо подписи «источник и время»,
 * которой у отсутствующих данных нет).
 */
export function noData(env, what = 'Данные') {
  if (!env || env.missing) {
    return errorState({title: `${what}: нет данных`, text: problemText(env)});
  }
  const tried = env.checkedAt ? ` Последняя попытка — ${fmt.stamp(env.checkedAt)}.` : '';
  return errorState({title: `${what}: нет данных`,
    text: `Сервер ещё не получил их от источника (${env.source?.name || 'источник'}): ${env.error || 'источник не ответил'}.${tried}`});
}

export function skeleton(cls = '') {
  return h('div', {class: `skeleton ${cls}`, 'aria-hidden': 'true'});
}

// --- Команды и игроки --------------------------------------------------------------

/** Логотип команды; не загрузился — кружок с сокращением. */
export function teamLogo(team, size = 56) {
  const box = h('span', {class: 'team-logo', style: {width: `${size}px`, height: `${size}px`}});
  const abbr = team?.abbr || '?';
  const fallback = () => box.replaceChildren(h('span', {class: 'team-logo-fallback'}, abbr));
  if (team?.logo) {
    box.append(h('img', {src: team.logo, alt: '', width: size, height: size, loading: 'lazy', decoding: 'async',
      onerror: fallback}));
  } else {
    fallback();
  }
  return box;
}

function initials(name) {
  return (name || '').split(/\s+/).filter((w) => /^[A-Za-zА-Яа-яЁё]/.test(w)).slice(0, 2)
    .map((w) => w[0].toUpperCase()).join('');
}

/** Фото игрока; нет фото — аккуратная заглушка с номером и инициалами. */
export function avatar(p, cls = '') {
  const box = h('span', {class: `avatar ${cls}`});
  const ini = initials(p?.name);
  const num = p?.jersey != null ? `#${p.jersey}` : (ini ? '' : '?');
  const fallback = () => box.replaceChildren(h('span', {class: 'avatar-fallback'},
    num && h('span', {class: 'avatar-num'}, num),
    ini && h('span', {class: 'avatar-ini'}, ini)));
  if (p?.headshot) {
    box.append(h('img', {src: p.headshot, alt: '', loading: 'lazy', decoding: 'async', onerror: fallback}));
  } else {
    fallback();
  }
  return box;
}

/** Звёздочка «в избранное». Все звёздочки на странице синхронизируются одним общим слушателем. */
export function starButton(p, {withText = false} = {}) {
  const b = h('button', {type: 'button', class: `star-btn${withText ? ' star-btn-text' : ''}`,
    'data-player-id': p.id, 'data-player-name': p.name || ''});
  b.append(icon('star', withText ? 20 : 22), h('span', {class: withText ? 'star-label' : 'star-label visually-hidden'}));
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const on = fav.toggle(p.id, p.name);
    const who = p.name || 'Игрок';
    toast(on ? `${who} — в избранном` : `${who} убран из избранного`);
  });
  syncStar(b);
  return b;
}

function syncStar(b) {
  const on = fav.has(b.dataset.playerId);
  const name = b.dataset.playerName || 'игрока';
  b.setAttribute('aria-pressed', String(on));
  b.classList.toggle('is-on', on);
  b.title = on ? 'Убрать из избранного' : 'Добавить в избранное';
  const label = b.querySelector('.star-label');
  if (label) {
    label.textContent = b.classList.contains('star-btn-text') ? (on ? 'В избранном' : 'В избранное')
      : (on ? `Убрать ${name} из избранного` : `Добавить ${name} в избранное`);
  }
}

window.addEventListener('favorites-change', () => document.querySelectorAll('.star-btn').forEach(syncStar));

// --- Всплывающее сообщение -----------------------------------------------------------

let toastTimer = 0;
export function toast(text) {
  const t = document.querySelector('.toast');
  if (!t) return;
  t.textContent = text;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 3200);
}

/** Плавное появление блоков по очереди. */
export function stagger(nodes, start = 0) {
  nodes.forEach((n, i) => {
    n.classList.add('reveal');
    n.style.setProperty('--i', String(start + i));
  });
}
