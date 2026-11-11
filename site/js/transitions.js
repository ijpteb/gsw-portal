// Плавные переходы на View Transitions API (браузер сам анимирует смену «до → после»).
// Это украшение: где браузер не умеет или включено «уменьшить движение», всё меняется сразу.

const reduce = matchMedia('(prefers-reduced-motion: reduce)');

export const canAnimate = () => typeof document.startViewTransition === 'function' && !reduce.matches && !document.hidden;

function onScreen(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
}

/** Фото игрока с этим id, которое сейчас видно на экране (или null). */
export function findPhoto(root, id) {
  if (!id) return null;
  return [...root.querySelectorAll('[data-photo-id]')].find((el) => el.dataset.photoId === id && onScreen(el)) || null;
}

function settle(t, cleanup) {
  // Переход может быть пропущен (например, быстро нажали ещё одну ссылку) — это не ошибка.
  t.ready.catch(() => {});
  t.updateCallbackDone.catch(() => {});
  t.finished.then(cleanup, cleanup);
}

const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

/**
 * Смена страницы, при которой фото игрока «перелетает» со старого места на новое
 * (карточка в составе → большое фото в карточке игрока и обратно).
 * update() рисует новую страницу; дольше 0,8 с не ждём — показываем как есть.
 */
export function morphPage(fromEl, id, root, update) {
  let toEl = null;
  fromEl.style.viewTransitionName = 'player-photo';
  const t = document.startViewTransition(async () => {
    fromEl.style.viewTransitionName = '';
    await Promise.race([update(), wait(800)]);
    toEl = findPhoto(root, id);
    if (toEl) toEl.style.viewTransitionName = 'player-photo';
  });
  settle(t, () => {
    fromEl.style.viewTransitionName = '';
    if (toEl) toEl.style.viewTransitionName = '';
  });
  return t;
}

/** Перестановка карточек (фильтр, сортировка): каждая плавно едет на новое место. */
export function animateList(els, update) {
  els.forEach((el) => { el.style.viewTransitionName = `item-${el.dataset.id}`; });
  const t = document.startViewTransition(update);
  settle(t, () => els.forEach((el) => { el.style.viewTransitionName = ''; }));
  return t;
}
