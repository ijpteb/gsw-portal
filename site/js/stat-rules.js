// Правила сайта для лидеров, сортировки по процентам и сравнения игроков: чтобы «лучшим» не стал
// игрок с парой бросков или одним удачным матчем. Пороги растут вместе с числом матчей команды.
import * as fmt from './format.js?v=__V__';

export const RULE = {
  gamesShare: 0.5, // лидеры по средним за матч — сыгравшие не меньше половины матчей команды
  fga: 3, // % с игры — не меньше 3 бросков с игры за каждый матч команды
  fg3a: 2, // % трёхочковых — не меньше 2 трёхочковых за матч команды
  fta: 1, // % штрафных — не меньше 1 штрафного за матч команды
};

// Проценты: откуда брать попадания и попытки (ключи — как в статистике ESPN).
// what — формы после «не меньше N»: «не меньше 21 броска», «не меньше 33 бросков».
export const PCT = {
  fgPct: {made: 'fgmTotal', att: 'fgaTotal', rule: 'fga', what: ['броска с игры', 'бросков с игры', 'бросков с игры']},
  fg3Pct: {made: 'fg3mTotal', att: 'fg3aTotal', rule: 'fg3a', what: ['трёхочкового', 'трёхочковых', 'трёхочковых']},
  ftPct: {made: 'ftmTotal', att: 'ftaTotal', rule: 'fta', what: ['штрафного', 'штрафных', 'штрафных']},
};

/** Сколько матчей сыграла команда: по статистике команды ESPN, иначе — наибольшее число игр у игроков. */
export function teamGames(teamStatsEnv, players = []) {
  const gp = teamStatsEnv?.data?.team?.gp;
  if (Number.isFinite(gp) && gp > 0) return gp;
  return Math.max(0, ...players.map((p) => p.stats?.gp || 0));
}

/** Пороги при нынешнем числе матчей команды. */
export function limits(teamGp) {
  const gp = Math.max(0, teamGp || 0);
  return {
    gp,
    games: Math.max(1, Math.ceil(gp * RULE.gamesShare)),
    fgPct: Math.max(1, Math.ceil(gp * RULE.fga)),
    fg3Pct: Math.max(1, Math.ceil(gp * RULE.fg3a)),
    ftPct: Math.max(1, Math.ceil(gp * RULE.fta)),
  };
}

/** Попадания и попытки за сезон: {made, att}. */
export function shots(s, key) {
  const d = PCT[key];
  return {made: s?.[d.made] ?? null, att: s?.[d.att] ?? null};
}

/** Процент попаданий; если бросков не было — null: «0 из 0» — это не 0 %, процента просто нет. */
export function pctOf(s, key) {
  return s?.[PCT[key].att] === 0 ? null : (s?.[key] ?? null);
}

/** Набрал ли игрок порог попыток для процента. */
export function pctQualified(s, key, lim) {
  return (s?.[PCT[key].att] ?? 0) >= lim[key];
}

/** «79 из 157». */
export function shotsText(s, key) {
  const {made, att} = shots(s, key);
  return made == null || att == null ? '' : `${fmt.num(made, 0)} из ${fmt.num(att, 0)}`;
}

/** «не меньше 33 бросков с игры (3 за каждый из 11 матчей команды)». */
export function limitText(key, lim) {
  const n = lim[key];
  const [one, few, many] = PCT[key].what;
  const word = fmt.plural(n, one, few, many);
  const per = RULE[PCT[key].rule];
  return `не меньше ${n} ${word} (${fmt.smart(per)} за каждый из ${lim.gp} ${fmt.plural(lim.gp, 'матча', 'матчей', 'матчей')} команды)`;
}
