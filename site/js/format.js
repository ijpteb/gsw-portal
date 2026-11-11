// Даты, время и числа по-русски — в часовом поясе устройства посетителя.

const L = 'ru-RU';
const dtf = (o) => new Intl.DateTimeFormat(L, o);
const F = {
  time: dtf({hour: '2-digit', minute: '2-digit'}),
  day: dtf({day: 'numeric', month: 'long'}),
  dayYear: dtf({day: 'numeric', month: 'long', year: 'numeric'}),
  wday: dtf({weekday: 'short', day: 'numeric', month: 'long'}),
  wdayYear: dtf({weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'}),
  dayShort: dtf({day: 'numeric', month: 'short'}),
  dayShortYear: dtf({day: 'numeric', month: 'short', year: 'numeric'}),
  // Календарные даты без времени (день рождения, «вернётся к …») — без сдвига по часовому поясу.
  cal: dtf({day: 'numeric', month: 'long', timeZone: 'UTC'}),
  calYear: dtf({day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'}),
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

/** «10 нояб.» — для таблиц. */
export function dateShort(iso) {
  const d = toDate(iso);
  return d ? (sameYear(d) ? F.dayShort : F.dayShortYear).format(d) : '—';
}

/** Календарная дата «2026-11-13» → «13 ноября» (год — если не текущий; withYear — всегда). */
export function calDate(ymd, {withYear = false} = {}) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || '');
  if (!m) return '—';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  // «14 марта 1988» без хвоста « г.», который добавляет браузер
  return (withYear || +m[1] !== new Date().getFullYear() ? F.calYear : F.cal).format(d).replace(/\s*г\.$/, '');
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

/** «38 лет», «21 год». */
export function years(n) {
  return n == null ? '—' : `${n} ${plural(n, 'год', 'года', 'лет')}`;
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
// Статус к ближайшему матчу, как его пишет ESPN на своих страницах (OUT, GTD…).
const INJ_GAME = {
  OUT: 'не играет', O: 'не играет', GTD: 'под вопросом', DTD: 'под вопросом', Q: 'под вопросом',
  D: 'вряд ли сыграет', P: 'скорее сыграет', SUSP: 'дисквалификация',
};
/** Что с травмированным сейчас: «не играет», «под вопросом»… (как на сайте ESPN, иначе — общий статус). */
export function injuryLabel(inj) {
  if (!inj) return '';
  return INJ_GAME[inj.espnStatus] || INJ[inj.status] || inj.espnStatus || inj.status || 'травма';
}

// Что травмировано — по полю ESPN detail.type. Чего нет в словаре — показываем как в источнике.
const INJ_TYPE = {
  Ankle: 'голеностоп', Knee: 'колено', Hamstring: 'задняя поверхность бедра', Back: 'спина', 'Lower Back': 'поясница',
  Calf: 'икроножная мышца', Foot: 'стопа', Toe: 'палец ноги', Heel: 'пятка', 'Plantar Fascia': 'подошвенная фасция',
  Achilles: 'ахиллово сухожилие', Groin: 'паховая мышца', Hip: 'тазобедренный сустав', 'Hip Flexor': 'сгибатель бедра',
  Thigh: 'бедро', Quadriceps: 'четырёхглавая мышца бедра', Adductor: 'приводящая мышца бедра', Shin: 'голень',
  'Lower Leg': 'голень', Leg: 'нога', Shoulder: 'плечо', Elbow: 'локоть', Forearm: 'предплечье', Arm: 'рука',
  Wrist: 'запястье', Hand: 'кисть', Finger: 'палец руки', Thumb: 'большой палец руки', Neck: 'шея', Head: 'голова',
  Face: 'лицо', Nose: 'нос', Eye: 'глаз', Jaw: 'челюсть', Mouth: 'рот', Concussion: 'сотрясение мозга',
  Chest: 'грудная клетка', Ribs: 'рёбра', Abdomen: 'мышцы живота', Oblique: 'косые мышцы живота', Pelvis: 'таз',
  Glute: 'ягодичная мышца', Illness: 'болезнь', Rest: 'отдых', Personal: 'личные причины',
  'Not Injury Related': 'не связано с травмой', Suspension: 'дисквалификация', Undisclosed: 'не раскрывается',
};
const LIMB = {Leg: 'нога', Arm: 'рука'};

/** «Колено, левая нога», «Большой палец левой руки», «Болезнь»; типа нет в словаре — пишем как у ESPN. */
export function injuryWhat(detail) {
  if (!detail?.type) return null;
  const what = INJ_TYPE[detail.type] || detail.type;
  const left = detail.side === 'Left';
  const sided = detail.side === 'Left' || detail.side === 'Right';
  const limb = LIMB[detail.location];
  const ofLimb = /^(.*) (руки|ноги)$/.exec(what); // «палец руки» → «палец левой руки»
  let text = what;
  if (sided && ofLimb) text = `${ofLimb[1]} ${left ? 'левой' : 'правой'} ${ofLimb[2]}`;
  else if (sided && limb) text = `${what}, ${left ? 'левая' : 'правая'} ${limb}`;
  else if (sided) text = `${what} (${left ? 'слева' : 'справа'})`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function placeText(lo, hi) {
  if (lo == null) return '—';
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}
