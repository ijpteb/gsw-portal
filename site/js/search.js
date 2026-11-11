// Быстрый поиск игрока по имени или номеру — открывается с любой страницы (лупа или клавиша «/»).
import * as data from './data.js?v=__V__';
import * as fmt from './format.js?v=__V__';
import {h, icon, avatar, starButton, sourceLine, usable, problemText} from './ui.js?v=__V__';
import {openOverlay, closeOverlay} from './overlay.js?v=__V__';

const overlay = document.getElementById('search');
const input = document.getElementById('search-input');
const results = document.getElementById('search-results');
const foot = overlay.querySelector('.search-foot');
let players = [];
let rosterEnv = null;
let active = -1;

const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Поиск по-русски: имена в источнике латиницей («Curry»), а ищут часто кириллицей («Карри»).
// Переводим обе записи в «скелет» из согласных: Карри → karri → kr, Curry → kurry → kr.
// Это приблизительно — такие совпадения показываем после точных.
const CYR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '',
  ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
const latin = (word) => [...word].map((c) => CYR[c] ?? c).join('').replace(/[^a-z]/g, '');
function skeleton(word) {
  let w = latin(word);
  w = w.replace(/dzh|dj/g, 'j').replace(/tch/g, 'ch').replace(/sch/g, 'sh').replace(/ch/g, 'C').replace(/sh/g, 'S')
    .replace(/zh/g, 'Z').replace(/kh/g, 'h').replace(/ph/g, 'f').replace(/th/g, 't').replace(/ck/g, 'k')
    .replace(/qu/g, 'kv').replace(/x/g, 'ks').replace(/[cq]/g, 'k').replace(/z/g, 's');
  return w.replace(/[aeiouyhw]/g, '').replace(/(.)\1+/g, '$1');
}
const words = (text) => norm(text).split(/[\s'’.-]+/).filter(Boolean);
const skeletons = (text) => words(text).map(skeleton).filter(Boolean);

// Если «скелет» совпал у нескольких (Карри → Curry и Cryer), выше тот, чьё написание ближе:
// считаем, сколько букв надо поменять (расстояние Левенштейна) после простого выравнивания написания.
const lite = (w) => latin(w).replace(/ph/g, 'f').replace(/th/g, 't').replace(/x/g, 'ks').replace(/[cq]/g, 'k')
  .replace(/y/g, 'i').replace(/w/g, 'u').replace(/(.)\1+/g, '$1');
function lev(a, b) {
  let prev = Array.from({length: b.length + 1}, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const closeness = (query, name) => {
  const nw = words(name).map(lite);
  return words(query).map(lite).reduce((sum, q) => sum + Math.min(...nw.map((w) => lev(q, w.slice(0, Math.max(q.length, 1) + 2)))), 0);
};

function match(q) {
  const query = norm(q).replace(/^#/, '').trim();
  if (!query) return players;
  const digits = /^\d+$/.test(query);
  const qSk = digits ? [] : skeletons(query);
  const scored = [];
  for (const p of players) {
    const name = norm(p.name);
    let score = -1;
    if (digits && p.jersey === query) score = 0;
    else if (digits && (p.jersey || '').startsWith(query)) score = 1;
    else if (name.startsWith(query) || norm(p.lastName).startsWith(query)) score = 2;
    else if (query.split(/\s+/).every((t) => name.split(/\s+/).some((w) => w.startsWith(t)))) score = 3;
    else if (name.includes(query)) score = 4;
    else if (qSk.length) {
      const nSk = skeletons(p.name);
      if (qSk.every((t) => nSk.includes(t))) score = 5;
      else if (qSk.every((t) => nSk.some((w) => w.startsWith(t)))) score = 6;
    }
    if (score >= 0) scored.push([score, score >= 5 ? closeness(query, p.name) : 0, p]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, , p]) => p);
}

function render() {
  const found = match(input.value);
  active = found.length ? 0 : -1;
  results.replaceChildren(...found.map((p, i) => h('li', {class: `search-item${i === active ? ' is-active' : ''}`},
  h('a', {href: `#/player/${p.id}`, class: 'search-link'},
    avatar(p, 'avatar-sm'),
    h('span', {class: 'search-main'},
      h('span', {class: 'search-name'}, p.name),
      h('span', {class: 'search-sub'}, [p.jersey != null ? `#${p.jersey}` : null, fmt.position(p.position)]
        .filter(Boolean).join(' · '))),
    icon('chevron', 18)),
  starButton(p))));
  if (!found.length) {
    results.append(h('li', {class: 'search-empty'}, input.value.trim()
      ? `Никого не нашли по запросу «${input.value.trim()}». Попробуйте написать фамилию иначе (можно латиницей, как у ESPN) или номер.`
      : (usable(rosterEnv) ? 'В составе пока никого нет.' : `Состав не загрузился: ${problemText(rosterEnv)}`)));
  }
}

function move(delta) {
  const items = [...results.querySelectorAll('.search-item')];
  if (!items.length) return;
  active = (active + delta + items.length) % items.length;
  items.forEach((li, i) => li.classList.toggle('is-active', i === active));
  items[active].scrollIntoView({block: 'nearest'});
}

export async function openSearch() {
  openOverlay(overlay, input);
  input.value = '';
  results.replaceChildren(h('li', {class: 'search-empty'}, 'Загружаю состав…'));
  const env = await data.get('roster');
  rosterEnv = env;
  players = usable(env) ? env.data.players : [];
  foot.replaceChildren(sourceLine(env));
  render();
}

input.addEventListener('input', render);
input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
  else if (e.key === 'Enter') {
    const link = results.querySelectorAll('.search-link')[active];
    if (link) { e.preventDefault(); location.hash = link.getAttribute('href'); closeOverlay(overlay); }
  }
});
results.addEventListener('click', (e) => {
  if (e.target.closest('.search-link')) closeOverlay(overlay, {restoreFocus: false});
});
