// Данные сайта — JSON-«конверты», которые собирает и публикует сборщик (site/data/*.json):
// {status: ok|stale|error, source, fetchedAt, checkedAt, error, data}.
// Браузер к источникам (ESPN и др.) не ходит — только к файлам этого сайта.
// cache: 'no-cache' — браузер каждый раз сверяется с сервером (иначе держал бы старое до 10 мин).

const store = new Map(); // имя → Promise<конверт>
let lastGenerated = null; // status.generatedAt — когда сервер последний раз публиковал данные

async function fetchEnv(name) {
  const miss = (error, extra) => ({missing: true, dataset: name, error, ...extra});
  let r;
  try {
    r = await fetch(`data/${name}.json`, {cache: 'no-cache'});
  } catch {
    return miss('Нет связи с сайтом — проверьте интернет', {offline: true});
  }
  if (r.status === 404) return miss('Данные ещё не опубликованы');
  if (!r.ok) return miss(`Сайт не отдал данные (ошибка ${r.status})`);
  try {
    return await r.json();
  } catch {
    return miss('Файл данных повреждён');
  }
}

/** Конверт набора данных (из памяти, если уже загружен). */
export function get(name) {
  if (!store.has(name)) {
    store.set(name, fetchEnv(name).then((env) => {
      if (name === 'status' && !env.missing) lastGenerated ??= env.data?.generatedAt ?? null;
      return env;
    }));
  }
  return store.get(name);
}

/** Перечитать всё, что уже загружено. Нет связи — оставляем прежнюю версию. */
async function reloadLoaded() {
  await Promise.all([...store.keys()].map(async (name) => {
    const old = await store.get(name);
    const env = await fetchEnv(name);
    store.set(name, Promise.resolve(env.offline && old && !old.missing ? old : env));
  }));
}

/** Проверка раз в минуту: если сервер опубликовал новые данные — перечитываем. true — что-то обновилось. */
export async function checkForUpdates() {
  const st = await fetchEnv('status');
  if (st.missing) return false;
  const gen = st.data?.generatedAt ?? null;
  if (gen === lastGenerated) return false;
  lastGenerated = gen;
  store.set('status', Promise.resolve(st));
  await reloadLoaded();
  return true;
}

/** Кнопка «Обновить»: перечитать всё сейчас. Возвращает свежий status. */
export async function reloadAll() {
  if (!store.has('status')) get('status');
  await reloadLoaded();
  const st = await store.get('status');
  if (!st.missing) lastGenerated = st.data?.generatedAt ?? lastGenerated;
  return st;
}

/** Идёт ли матч (по последнему status) — тогда проверяем чаще. */
export async function isLive() {
  const st = await get('status');
  return Boolean(st?.data?.liveWindow);
}
