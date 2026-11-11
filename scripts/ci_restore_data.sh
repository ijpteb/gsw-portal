#!/usr/bin/env bash
# Достаёт сохранённые данные из ветки "data" в site/data и site/img.
# Ветка хранит одну (перезаписываемую) версию данных — так они переживают любые перезапуски.
set -euo pipefail
URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
rm -rf .databranch
mkdir -p site/data site/img
if git clone -q --depth 1 --branch data "$URL" .databranch 2>/dev/null; then
  echo "Ветка data найдена — восстанавливаю сохранённые данные."
  if [ -d .databranch/data ]; then rsync -a .databranch/data/ site/data/; fi
  if [ -d .databranch/img ]; then rsync -a .databranch/img/ site/img/; fi
else
  echo "Ветки data ещё нет — первый запуск, начинаем с пустых данных."
  mkdir -p .databranch && git -C .databranch init -q -b data && git -C .databranch remote add origin "$URL"
fi
