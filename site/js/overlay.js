// Всплывающие окна (поиск, меню «Ещё»): открытие, закрытие по Esc и по фону, фокус внутри окна.

let lastFocus = null;
let openEl = null;

export function openOverlay(el, focusEl) {
  if (openEl && openEl !== el) closeOverlay(openEl, {restoreFocus: false});
  lastFocus = document.activeElement;
  el.hidden = false;
  el.classList.remove('is-closing');
  document.documentElement.classList.add('has-overlay');
  openEl = el;
  requestAnimationFrame(() => (focusEl || el.querySelector('a, button, input'))?.focus());
}

export function closeOverlay(el = openEl, {restoreFocus = true} = {}) {
  if (!el || el.hidden) return;
  el.hidden = true;
  document.documentElement.classList.remove('has-overlay');
  if (openEl === el) openEl = null;
  if (restoreFocus && lastFocus?.isConnected) lastFocus.focus();
}

export const currentOverlay = () => openEl;

document.addEventListener('click', (e) => {
  const closer = e.target.closest('[data-close]');
  if (closer && openEl?.contains(closer)) closeOverlay(openEl);
});

document.addEventListener('keydown', (e) => {
  if (!openEl) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    closeOverlay(openEl);
  } else if (e.key === 'Tab') {
    // фокус не уходит из окна
    const items = [...openEl.querySelectorAll('a[href], button, input')].filter((x) => x.offsetParent !== null && x.tabIndex !== -1);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
