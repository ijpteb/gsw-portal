#!/usr/bin/env bash
# Сохраняет site/data и site/img в ветку "data" (одна перезаписываемая версия)
# и, если содержимое изменилось, запускает публикацию сайта (deploy.yml).
set -euo pipefail
DB=.databranch
mkdir -p site/data site/img
OLD_FP="$(cat "$DB/data/fingerprint.txt" 2>/dev/null || true)"
NEW_FP="$(cat site/data/fingerprint.txt 2>/dev/null || true)"
mkdir -p "$DB/data" "$DB/img"
rsync -a --delete site/data/ "$DB/data/"
rsync -a --delete site/img/ "$DB/img/"
cd "$DB"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
MSG="data $(date -u +%Y-%m-%dT%H:%M:%SZ)"
if git rev-parse -q --verify HEAD >/dev/null; then
  git commit -q --amend -m "$MSG" --allow-empty
else
  git commit -q -m "$MSG"
fi
git push -fq origin HEAD:data
cd ..
if [ "$OLD_FP" != "$NEW_FP" ]; then
  echo "Данные изменились ($OLD_FP → $NEW_FP) — публикую сайт."
  gh workflow run deploy.yml --ref "${GITHUB_REF_NAME:-main}"
else
  echo "Содержимое не изменилось — сайт не переопубликовываю."
fi
