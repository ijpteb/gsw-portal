// Какой матч последний, какой следующий и идёт ли игра сейчас — по расписанию и live-данным ESPN.
import {ms} from './format.js?v=__V__';

export function sortedGames(scheduleEnv) {
  const games = scheduleEnv?.data?.games || [];
  return [...games].filter((g) => g.date).sort((a, b) => ms(a.date) - ms(b.date));
}

/** Матч на табло прямо сейчас (из live.json), если он идёт. */
export function liveGame(liveEnv) {
  const g = liveEnv?.data?.game;
  return g && g.state === 'in' ? g : null;
}

/** Последний сыгранный: из расписания или только что завершившийся (live успевает раньше расписания). */
export function lastGame(scheduleEnv, liveEnv) {
  const done = sortedGames(scheduleEnv).filter((g) => g.completed && g.score);
  let last = done[done.length - 1] || null;
  const lg = liveEnv?.data?.game;
  if (lg && lg.state === 'post' && lg.score && (!last || ms(lg.date) > ms(last.date))) last = lg;
  return last;
}

/** Следующий: первый не завершённый (не идущий сейчас и не только что закончившийся). */
export function nextGame(scheduleEnv, liveEnv) {
  const lg = liveEnv?.data?.game;
  const skip = lg && (lg.state === 'in' || lg.state === 'post') ? lg.id : null;
  const now = Date.now();
  return sortedGames(scheduleEnv).find((g) => !g.completed && g.state !== 'post' && g.id !== skip
    && ms(g.date) > now - 6 * 3600e3) || null;
}
