// Новости: категории и строка «категория · источник · когда · язык» — общие для главной, ленты и страницы новости.
import * as fmt from './format.js?v=__V__';
import {h} from './ui.js?v=__V__';

export const CATS = {injury: 'Травмы', trade: 'Обмены', interview: 'Интервью', other: 'Остальное'};
export const CAT_ORDER = ['injury', 'trade', 'interview', 'other'];
export const LANG_NAMES = {en: 'на английском', ru: 'на русском'};

/** Название ленты в тексте: русские — в кавычках-«ёлочках» («Спорт-Экспресс»). */
export const feedTitle = (name) => (/[А-Яа-яЁё]/.test(name || '') && !/^«/.test(name) ? `«${name}»` : name);

export const catOf = (it) => (CATS[it?.category] ? it.category : 'other');
export const langOf = (it) => it?.lang || 'en';
export const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);

/** Свежие сверху. */
export const byDate = (items) => [...items].sort((a, b) => (fmt.ms(b.date) || 0) - (fmt.ms(a.date) || 0));

/** Строка над заголовком новости. full — с датой и временем (для страницы новости). */
export function newsMeta(it, {full = false, tag = 'span'} = {}) {
  const c = catOf(it);
  return h(tag, {class: 'news-meta'},
    h('span', {class: `cat cat-${c}`}, CATS[c]),
    h('span', null, it.source),
    it.date ? h('time', {datetime: it.date, title: fmt.stampFull(it.date)},
      full ? `${fmt.date(it.date)}, ${fmt.time(it.date)}` : fmt.agoOrDate(it.date)) : null,
    langOf(it) !== 'ru' ? h('span', {class: 'lang', title: 'Язык источника'}, langOf(it).toUpperCase()) : null);
}
