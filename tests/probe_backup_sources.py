"""Проверка запасных источников с того компьютера, где запущен скрипт (на GitHub — с его серверов).

    python3 tests/probe_backup_sources.py [папка_для_ответов]

Обычные запросы с честным User-Agent — никаких подменённых заголовков и обхода защит.
Если источник отдаёт данные, ответ сохраняется в папку (по умолчанию probe_out/) —
из него потом делается тестовая фикстура для разборщика запасного источника.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from collector import config  # noqa: E402
from collector.http import SourceError, fetch_bytes  # noqa: E402

PROBES = [
    ("nba_cdn_schedule", "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json", "json"),
    ("nba_cdn_scoreboard", "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json", "json"),
    ("nba_cdn_headshot", "https://cdn.nba.com/headshots/nba/latest/1040x760/201939.png", "image"),
    ("nba_stats_standings", "https://stats.nba.com/stats/leaguestandingsv3?LeagueID=00&Season=2026-27"
                            "&SeasonType=Regular%20Season", "json"),
    ("balldontlie_teams", "https://api.balldontlie.io/v1/teams", "json"),
]


def describe_json(name: str, body: bytes) -> str:
    try:
        d = json.loads(body)
    except ValueError:
        return "ответ не JSON"
    if name == "nba_cdn_schedule":
        ls = d.get("leagueSchedule") or {}
        games = [g for day in ls.get("gameDates", []) for g in day.get("games", [])]
        gsw = [g for g in games if config.NBA_TEAM_ID in (str(g.get("homeTeam", {}).get("teamId")),
                                                          str(g.get("awayTeam", {}).get("teamId")))]
        return f"сезон {ls.get('seasonYear')}, всего матчей {len(games)}, матчей ГСВ {len(gsw)}"
    if name == "nba_cdn_scoreboard":
        sb = d.get("scoreboard") or {}
        return f"дата {sb.get('gameDate')}, матчей {len(sb.get('games', []))}"
    if name == "balldontlie_teams":
        return f"команд {len(d.get('data', []))}"
    return f"ключи: {list(d)[:5]}"


def main() -> int:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "probe_out")
    out.mkdir(parents=True, exist_ok=True)
    key = os.environ.get("BALLDONTLIE_API_KEY", "").strip()
    for name, url, kind in PROBES:
        headers = {"Authorization": key} if name.startswith("balldontlie") and key else None
        try:
            body = fetch_bytes(url, headers=headers, timeout=20)
        except SourceError as e:
            print(f"✗ {name:22} {e}")
            continue
        if kind == "image":
            ok = body[:4] == b"\x89PNG"
            print(f"{'✓' if ok else '✗'} {name:22} картинка {len(body) // 1024} КБ")
            continue
        print(f"✓ {name:22} {describe_json(name, body)}")
        (out / f"{name}.json").write_bytes(body)
    return 0


if __name__ == "__main__":
    sys.exit(main())
