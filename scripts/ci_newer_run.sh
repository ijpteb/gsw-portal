#!/usr/bin/env bash
# Ждёт ли своей очереди следующий запуск «Сбора данных»?
# Код 0 — да (текущему дежурству пора уступить ему место), 1 — нет или не удалось узнать.
# Запуски одной группы concurrency идут по одному: новый ждёт в статусе pending/queued.
set -uo pipefail
: "${GITHUB_REPOSITORY:?}" "${GITHUB_RUN_ID:?}"
n="$(gh run list -R "$GITHUB_REPOSITORY" --workflow collect.yml --limit 10 --json databaseId,status \
      --jq "[.[] | select(.databaseId != ${GITHUB_RUN_ID})
                 | select(.status == \"pending\" or .status == \"queued\"
                          or .status == \"waiting\" or .status == \"requested\")] | length" 2>/dev/null)" || exit 1
[ "${n:-0}" -gt 0 ]
