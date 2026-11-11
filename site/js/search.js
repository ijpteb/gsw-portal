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

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function match(q) {
  const query = norm(q).replace(/^#/, '').trim();
  if (!query) return players;
  const digits = /^\d+$/.test(query);
  const scored = [];
  for (const p of players) {
    const name = norm(p.name);
    let score = -1;
    if (digits && p.jersey === query) score = 0;
    else if (digits && (p.jersey || '').startsWith(query)) score = 1;
    else if (name.startsWith(query) || norm(p.lastName).startsWith(query)) score = 2;
    else if (query.split(/\s+/).every((t) => name.split(/\s+/).some((w) => w.startsWith(t)))) score = 3;
    else if (name.includes(query)) score = 4;
    if (score >= 0) scored.push([score, p]);
  }
  return scored.sort((a, b) => a[0] - b[0]).map(([, p]) => p);
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
      ? `Никого не нашли по запросу «${input.value.trim()}». Попробуйте фамилию латиницей или номер.`
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
