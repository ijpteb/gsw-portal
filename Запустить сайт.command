#!/bin/bash
# Двойной щелчок по этому файлу (macOS): скачать свежие данные и открыть сайт на этом компьютере.
# Обычно это не нужно — сайт и так работает по ссылке https://ijpteb.github.io/gsw-portal/
cd "$(dirname "$0")" || exit 1
echo "Скачиваю свежие данные (до пары минут)…"
python3 -m collector run
echo
echo "Сайт: http://localhost:8765 — откроется в браузере. Чтобы остановить, закройте это окно."
( sleep 1; open "http://localhost:8765" ) &
exec python3 scripts/dev_server.py 8765
