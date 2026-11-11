"""Командная строка сборщика: python3 -m collector <команда>."""
from __future__ import annotations

import argparse
import sys

from . import config, store
from .http import REQUEST_LOG


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python3 -m collector", description="Сборщик данных портала ГСВ")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="обновить данные")
    r.add_argument("--force", action="store_true", help="обновить всё прямо сейчас")
    r.add_argument("--only", default="", help="через запятую: schedule,live,roster,injuries,player_stats,"
                                              "gamelog,standings,team_stats,news,team,logos")
    r.add_argument("--live-loop", action="store_true", help="во время матча обновлять счёт раз в минуту")
    r.add_argument("--max-minutes", type=int, default=300)
    r.add_argument("--after-update", default=None, help="команда, выполняемая после каждого live-обновления")
    sub.add_parser("status", help="показать состояние данных")
    a = ap.parse_args(argv)

    if a.cmd == "status":
        env = store.load("status")
        if not env:
            print("Данных ещё нет. Запустите: python3 -m collector run")
            return 1
        for name, d in env["data"]["datasets"].items():
            print(f"{name:28} {d['status']:6} получено {d['fetchedAt'] or '—'}  {d['error'] or ''}")
        return 0

    from .run import live_loop, run_once
    if a.live_loop:
        live_loop(max_minutes=a.max_minutes, after_update=a.after_update)
        return 0
    only = {x.strip() for x in a.only.split(",") if x.strip()} or None
    res = run_once(force=a.force, only=only)
    for name, msg in res.items():
        print(f"{name:28} {msg}")
    print(f"Запросов к источникам: {len(REQUEST_LOG)}")
    bad = [k for k, v in res.items() if not v.startswith("ok")]
    return 1 if bad and len(bad) == len(res) else 0


if __name__ == "__main__":
    sys.exit(main())
