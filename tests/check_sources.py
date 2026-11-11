"""Проверка источников вживую: скачать свежие ответы и прогнать их через те же разборщики.

    python3 tests/check_sources.py           — только проверить (ничего не меняет)
    python3 tests/check_sources.py --save    — ещё и сохранить свежие ответы в tests/fixtures/new/

Когда источник «сломался»: запустите проверку, посмотрите, какой разборщик падает,
почините его файл в collector/sources/, затем: python3 -m unittest discover -s tests -t .
Сохранённые в fixtures/new ответы можно положить вместо старых (тогда обновите ожидаемые числа в тестах).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from collector.http import SourceError, fetch_json, fetch_text  # noqa: E402
from collector.sources import espn, rss  # noqa: E402

OUT = Path(__file__).parent / "fixtures" / "new"


def checks():
    yield "espn_schedule", espn.URLS["schedule"], "json", lambda r: f"{len(espn.parse_schedule(r)['games'])} матчей"
    yield "espn_roster", espn.URLS["roster"], "json", lambda r: f"{len(espn.parse_roster(r)['players'])} игроков"
    yield "espn_injuries", espn.URLS["injuries"], "json", lambda r: f"{len(espn.parse_injuries(r)['players'])} травм у ГСВ"
    yield "espn_player_stats", espn.URLS["player_stats"], "json", \
        lambda r: f"{len(espn.parse_player_stats(r)['players'])} игроков со статистикой"
    yield "espn_team_stats_league", espn.URLS["team_stats_league"], "json", \
        lambda r: "место по очкам: {}".format(espn.parse_team_stats_league(r)["ranks"]["pts"]["rank"])
    yield "espn_standings", espn.URLS["standings"], "json", \
        lambda r: "ГСВ: места {placeLo}–{placeHi}".format(**espn.parse_standings(r)["gsw"])
    yield "espn_team", espn.URLS["team"], "json", lambda r: f"баланс {espn.parse_team(r)['record']}"
    yield "espn_news", espn.URLS["news"], "json", lambda r: f"{len(espn.parse_news(r))} новостей"
    yield "espn_gamelog_3975", espn.gamelog_url("3975"), "json", \
        lambda r: f"{len(espn.parse_gamelog(r, '3975')['games'])} матчей Карри"
    for f in rss.FEEDS:
        yield f"rss_{f['id']}", f["url"], "text", lambda r, f=f: f"{len(rss.parse_feed(r, f))} новостей о ГСВ"


def main() -> int:
    save = "--save" in sys.argv
    bad = 0
    for name, url, kind, check in checks():
        try:
            raw = fetch_json(url) if kind == "json" else fetch_text(url)
        except SourceError as e:
            print(f"✗ {name:24} не скачалось: {e}")
            bad += 1
            continue
        try:
            msg = check(raw)
            print(f"✓ {name:24} {msg}")
        except Exception as e:
            print(f"✗ {name:24} НЕ РАЗБИРАЕТСЯ: {type(e).__name__}: {e}")
            bad += 1
        if save:
            OUT.mkdir(parents=True, exist_ok=True)
            ext = "json" if kind == "json" else "xml"
            body = json.dumps(raw, ensure_ascii=False) if kind == "json" else raw
            (OUT / f"{name}.{ext}").write_text(body, encoding="utf-8")
    print("Всё читается." if not bad else f"Проблем: {bad}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
