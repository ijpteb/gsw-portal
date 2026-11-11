"""Общие настройки сборщика: команда, сезон, адреса, частота обновлений."""
from __future__ import annotations

import os
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_DIR = ROOT / "site"
DATA_DIR = SITE_DIR / "data"
IMG_DIR = SITE_DIR / "img"

# --- Команда -----------------------------------------------------------------
ESPN_TEAM_ID = "9"          # Golden State Warriors в ESPN
ESPN_TEAM_ABBR = "GS"
ESPN_TEAM_SLUG = "gs"
NBA_TEAM_ID = "1610612744"  # Golden State Warriors в NBA.com
CONFERENCE = "Western Conference"

# --- Сезон 2026/27 -------------------------------------------------------------
# Источники называют сезон по-разному: ESPN — 2027 / "2026-27", NBA.com — "2026-27".
SEASON_ESPN_YEAR = 2027
SEASON_LABEL = "2026-27"
# Регулярный чемпионат по времени США (из задания).
REGULAR_SEASON_START = date(2026, 10, 20)
REGULAR_SEASON_END = date(2027, 4, 11)
REGULAR_SEASON_GAMES = 82

# --- Зоны таблицы (действующий регламент НБА) -----------------------------------
PLAYOFF_SEEDS = (1, 6)   # 1–6 — прямо в плей-офф
PLAYIN_SEEDS = (7, 10)   # 7–10 — плей-ин

# --- Частота обновлений, секунды ---------------------------------------------
HOUR = 3600
INTERVALS = {
    "team": HOUR,
    "schedule": HOUR,          # в день матча — SCHEDULE_GAMEDAY
    "roster": HOUR,
    "injuries": HOUR,
    "player_stats": HOUR,
    "gamelogs": HOUR,
    "standings": HOUR,
    "team_stats": HOUR,
    "news": 20 * 60,
    "logos": 7 * 24 * HOUR,
}
SCHEDULE_GAMEDAY = 5 * 60
LIVE_POLL = 60                 # во время матча
RETRY_AFTER_FAILURE = 10 * 60  # если источник не ответил — не чаще раза в 10 мин
IMAGE_MAX_AGE = 7 * 24 * HOUR

# Окно «день матча»: от 12 ч до начала и до 5 ч после начала.
GAMEDAY_BEFORE = 12 * HOUR
GAMEDAY_AFTER = 5 * HOUR
# Окно «матч может идти»: за 20 мин до начала и до 4 ч после.
LIVE_BEFORE = 20 * 60
LIVE_AFTER = 4 * HOUR

# --- Сеть ----------------------------------------------------------------------
HTTP_TIMEOUT = 25
HTTP_RETRIES = 2
USER_AGENT = "gsw-fan-portal/1.0 (personal non-commercial fan site)"

# --- Ключи (только из переменных окружения / GitHub Secrets) -------------------
BALLDONTLIE_API_KEY = os.environ.get("BALLDONTLIE_API_KEY", "").strip()
