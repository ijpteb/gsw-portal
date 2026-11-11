"""Командная строка сборщика: python3 -m collector <команда>."""
from __future__ import annotations

import argparse
import sys

from . import config, store
from .http import REQUEST_LOG, problems


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python3 -m collector", description="Сборщик данных портала ГСВ")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="обновить данные")
    r.add_argument("--force", action="store_true", help="обновить всё прямо сейчас")
    r.add_argument("--only", default="", help="через запятую: schedule,live,roster,injuries,player_stats,"
                                              "gamelog,standings,team_stats,news,team,logos")
    lp = sub.add_parser("loop", help="дежурство: обновлять данные непрерывно (раз в минуту — то, что пора)")
    lp.add_argument("--force", action="store_true", help="в первом проходе обновить всё")
    lp.add_argument("--max-minutes", type=int, default=config.LOOP_MAX_MINUTES)
    lp.add_argument("--tick", type=float, default=config.LOOP_TICK, help="секунд между проходами")
    lp.add_argument("--after-update", default=None, help="команда публикации — когда данные изменились")
    lp.add_argument("--handover", default=None,
                    help="команда-проверка после каждого прохода: код 0 — ждёт следующий запуск, пора выйти")
    lp.add_argument("--exit-reason-file", default=None, help="куда записать причину выхода: handover / time")
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

    from .run import loop, run_once
    if a.cmd == "loop":
        reason = loop(max_minutes=a.max_minutes, after_update=a.after_update, handover=a.handover,
                      force=a.force, tick=a.tick, log=lambda m: print(m, flush=True))
        if a.exit_reason_file:
            with open(a.exit_reason_file, "w", encoding="utf-8") as f:
                f.write(reason)
        return 1 if reason == "error" else 0
    only = {x.strip() for x in a.only.split(",") if x.strip()} or None
    res = run_once(force=a.force, only=only)
    for name, msg in res.items():
        print(f"{name:28} {msg}")
    print(f"Запросов к источникам: {len(REQUEST_LOG)}")
    for line in problems():
        print(f"  сбой или медленно: {line}")
    bad = [k for k, v in res.items() if not v.startswith("ok")]
    return 1 if bad and len(bad) == len(res) else 0


if __name__ == "__main__":
    sys.exit(main())
