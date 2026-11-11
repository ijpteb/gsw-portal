// Избранные игроки — хранятся в этом браузере (на телефоне и компьютере списки свои).
// Кроме номеров игроков запоминаем имена: если игрок уйдёт из команды, карточка всё равно скажет, кто это.

const KEY = 'gsw.favorites.v1';
const NAMES_KEY = 'gsw.favorites.names.v1';
let cache = null;
let names = null;

function load(key, fallback, ok) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return ok(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // приватный режим или запрет хранения — список живёт до закрытия вкладки
  }
}

function read() {
  if (!cache) cache = load(KEY, [], Array.isArray).map(String);
  return cache;
}

function readNames() {
  if (!names) names = load(NAMES_KEY, {}, (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v));
  return names;
}

function changed(detail) {
  window.dispatchEvent(new CustomEvent('favorites-change', {detail}));
}

export function list() {
  return [...read()];
}

export function has(id) {
  return read().includes(String(id));
}

/** Имя, запомненное, когда игрока добавили в избранное (или null). */
export function nameOf(id) {
  const n = readNames()[String(id)];
  return typeof n === 'string' && n ? n : null;
}

/** Переключить; возвращает true, если игрок теперь в избранном. */
export function toggle(id, name) {
  const key = String(id);
  const cur = read();
  const on = !cur.includes(key);
  cache = on ? [...cur, key] : cur.filter((x) => x !== key);
  const nm = {...readNames()};
  if (on && name) nm[key] = String(name);
  if (!on) delete nm[key];
  names = nm;
  save(KEY, cache);
  save(NAMES_KEY, names);
  changed({id: key, on});
  return on;
}

// Изменили в другой вкладке — подхватываем.
window.addEventListener('storage', (e) => {
  if (e.key === KEY || e.key === NAMES_KEY) {
    cache = null;
    names = null;
    changed({});
  }
});
