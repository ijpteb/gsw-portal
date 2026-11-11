// Даты, время и числа по-русски — в часовом поясе устройства посетителя.

const L = 'ru-RU';
const dtf = (o) => new Intl.DateTimeFormat(L, o);
const F = {
  time: dtf({hour: '2-digit', minute: '2-digit'}),
  day: dtf({day: 'numeric', month: 'long'}),
  dayYear: dtf({day: 'numeric', month: 'long', year: 'numeric'}),
  wday: dtf({weekday: 'short', day: 'numeric', month: 'long'}),
  wdayYear: dtf({weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'}),
};

export function toDate(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t);
}

export function ms(iso) {
  const d = toDate(iso);
  return d ? d.getTime() : NaN;
}

/** Подпись часового пояса устройства, например «GMT+3». */
export function tzLabel() {
  try {
    const p = dtf({timeZoneName: 'short'}).formatToParts(new Date()).find((x) => x.type === 'timeZoneName');
    return p ? p.value : '';
  } catch {
    return '';
  }
}

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const shiftDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** «сегодня» / «завтра» / «вчера» или null. */
export function relDay(d, now = new Date()) {
  const k = dayKey(d);
  if (k === dayKey(now)) return 'сегодня';
  if (k === dayKey(shiftDays(now, 1))) return 'завтра';
  if (k === dayKey(shiftDays(now, -1))) return 'вчера';
  return null;
}

const sameYear = (d) => d.getFullYear() === new Date().getFullYear();

/** «чт, 12 ноября» (год — только если не текущий). */
export function gameDate(iso) {
  const d = toDate(iso);
  return d ? (sameYear(d) ? F.wday : F.wdayYear).format(d) : '—';
}

/** «12 ноября». */
export function date(iso) {
  const d = toDate(iso);
  return d ? (sameYear(d) ? F.day : F.dayYear).format(d) : '—';
}

/** «05:30». */
export function time(iso) {
  const d = toDate(iso);
  return d ? F.time.format(d) : '—';
}

/** Когда обновлено: «18:20 (6 мин назад)», «вчера в 18:20», «10 ноября в 18:20». */
export function stamp(iso) {
  const d = toDate(iso);
  if (!d) return '—';
  const rd = relDay(d);
  if (rd === 'сегодня') return `${F.time.format(d)} (${ago(iso)})`;
  if (rd === 'вчера') return `вчера в ${F.time.format(d)}`;
  return `${date(iso)} в ${F.time.format(d)}`;
}

/** Полная отметка для «данные от …»: «11 ноября в 15:20». */
export function stampFull(iso) {
  const d = toDate(iso);
  return d ? `${date(iso)} в ${F.time.format(d)}` : '—';
}

/** «только что», «12 мин назад», «3 ч назад», «2 дня назад». */
export function ago(iso) {
  const d = toDate(iso);
  if (!d) return '—';
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'только что';
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  const n = Math.floor(s / 86400);
  return `${n} ${plural(n, 'день', 'дня', 'дней')} назад`;
}

/** Для ленты: до суток — «3 ч назад», дальше — дата. */
export function agoOrDate(iso) {
  const d = toDate(iso);
  if (!d) return '—';
  return Date.now() - d.getTime() < 86400e3 ? ago(iso) : date(iso);
}

const PR = new Intl.PluralRules(L);
/** Русские формы: plural(5, 'игра', 'игры', 'игр'). Дробные — как «few»: «1,5 игры». */
export function plural(n, one, few, many) {
  const c = PR.select(n);
  if (c === 'one') return one;
  if (c === 'many') return many;
  return few;
}

const NF = new Map();
/** Число с запятой: num(30.555) → «30,6». Нет данных → «—». */
export function num(x, digits = 1) {
  if (x == null || Number.isNaN(Number(x))) return '—';
  if (!NF.has(digits)) {
    NF.set(digits, new Intl.NumberFormat(L, {minimumFractionDigits: digits, maximumFractionDigits: digits}));
  }
  return NF.get(digits).format(x);
}

/** Целое или с одним знаком: 3 → «3», 1.5 → «1,5». */
export function smart(x) {
  return Number.isInteger(x) ? num(x, 0) : num(x, 1);
}

export function pct(x, digits = 1) {
  return x == null ? '—' : `${num(x, digits)}%`;
}

/** «0,5 игры», «1 игра», «5 игр». */
export function games(x) {
  return `${smart(x)} ${plural(x, 'игра', 'игры', 'игр')}`;
}

export function countdown(msLeft) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return {d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60};
}

export const pad2 = (n) => String(n).padStart(2, '0');

/** Что сейчас в матче: «3-я четверть · 5:21», «Большой перерыв», «Овертайм · 2:10». */
export function periodLabel(g) {
  const p = Number(g.period) || 0;
  if (g.statusName === 'STATUS_HALFTIME') return 'Большой перерыв';
  if (g.statusName === 'STATUS_END_PERIOD') {
    if (p <= 4) return `Конец ${p}-й четверти`;
    return p === 5 ? 'Конец овертайма' : `Конец ${p - 4}-го овертайма`;
  }
  if (p < 1) return 'Начало матча';
  const name = p <= 4 ? `${p}-я четверть` : (p === 5 ? 'Овертайм' : `${p - 4}-й овертайм`);
  return g.clock ? `${name} · ${g.clock}` : name;
}

const POS = {
  PG: 'разыгрывающий', SG: 'атакующий защитник', SF: 'лёгкий форвард', PF: 'тяжёлый форвард',
  C: 'центровой', G: 'защитник', F: 'форвард', 'G-F': 'защитник-форвард', 'F-C': 'форвард-центровой',
};
export function position(code) {
  return POS[code] || code || '—';
}

const INJ = {
  Out: 'не играет', 'Day-To-Day': 'под вопросом', Questionable: 'под вопросом',
  Doubtful: 'вряд ли сыграет', Probable: 'скорее сыграет', Suspension: 'дисквалификация',
};
export function injuryStatus(s) {
  return INJ[s] || s || '';
}

export function placeText(lo, hi) {
  if (lo == null) return '—';
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}
