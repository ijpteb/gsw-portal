#!/usr/bin/env python3
"""Замер задержки счёта во время матча: очко забито → сборщик его увидел → сайт опубликован.

Входные файлы (собрать после матча; журнал GitHub отдаёт только у завершённого запуска — если
дежурство ещё идёт, запустить «Сбор данных» вручную: после матча смена передаётся в течение минуты):
  ESPN:        curl -o summary.json 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=<id>'
               plays[].wallclock — время события по UTC до секунды, awayScore/homeScore — счёт после него
  дежурство:   gh run view <id> -R ijpteb/gsw-portal --log > run-<id>.log   (все запуски «Сбор данных» за матч)
               строка прохода: «<время> live: ok (54:50, 5:12 - 2nd), … | запросов: 3» — очки ГСВ первыми
  публикации:  gh run list -R ijpteb/gsw-portal --workflow deploy.yml --limit 500 \\
                 --json databaseId,createdAt,updatedAt,status,conclusion > deploys.json

  python3 scripts/live_delay.py --summary summary.json --log run-1.log --log run-2.log --deploys deploys.json [--rows]

«До сайта» — когда закончился запуск публикации с этим счётом. Страница во время матча проверяет
свежие данные раз в 30 с, поэтому посетитель видит счёт ещё до 30 с позже.
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
from datetime import datetime, timedelta, timezone

TEAM_ID = "9"  # ГСВ в ESPN (collector/config.py → ESPN_TEAM_ID)
PAGE_POLL = 30  # страница во время матча проверяет свежие данные раз в 30 с (site/js/app.js)
# Строка журнала GitHub: «<задача>\t<шаг>\t<время GitHub> <текст>»; текст прохода начинается со времени сборщика.
LINE_RE = re.compile(r"(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z) (.*)$")
PASS_RE = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ .*\| запросов: \d+")
LIVE_RE = re.compile(r"live: ok \((?:(\d+):(\d+), )?([^)]*)\)")
EVENTS = ("Скоро матч", "Время дежурства вышло", "передаю ему дежурство", "ставлю его сам",
          "уже ждёт своей очереди", "падает раз за разом", "after-update завершился")


def parse_time(s: str) -> datetime:
    s = s.strip().rstrip("Z")
    if "." in s:
        head, frac = s.split(".", 1)
        return datetime.strptime(f"{head}.{frac[:6]}", "%Y-%m-%dT%H:%M:%S.%f").replace(tzinfo=timezone.utc)
    fmt = "%Y-%m-%dT%H:%M:%S" if s.count(":") == 2 else "%Y-%m-%dT%H:%M"
    return datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)


def plays(summary: dict, team_id: str = TEAM_ID) -> list[dict]:
    """События матча ESPN со временем и счётом (очки команды первыми)."""
    comp = summary["header"]["competitions"][0]
    side = next(c["homeAway"] for c in comp["competitors"] if str(c.get("id") or c["team"]["id"]) == team_id)
    out = []
    for p in summary.get("plays") or []:
        if not p.get("wallclock") or p.get("awayScore") is None or p.get("homeScore") is None:
            continue
        away, home = int(p["awayScore"]), int(p["homeScore"])
        team, opp = (away, home) if side == "away" else (home, away)
        out.append({"t": parse_time(p["wallclock"]), "team": team, "opp": opp,
                    "scoring": bool(p.get("scoringPlay")), "period": (p.get("period") or {}).get("number"),
                    "clock": (p.get("clock") or {}).get("displayValue", ""), "type": (p.get("type") or {}).get("text", "")})
    return out


def read_log(lines) -> tuple[list[dict], list[tuple[datetime, str]], tuple[datetime, datetime] | None]:
    """Проходы дежурства (время по журналу GitHub, счёт), заметные события (пересменки, выход по времени)
    и время работы запуска (первая и последняя строка журнала).

    Строку прохода сборщик пишет, только если что-то обновлял; во время матча (и за 20 мин до него)
    live обновляется каждый проход, поэтому перерывы ищем только между проходами с live."""
    passes, events, first, last = [], [], None, None
    for line in lines:
        m = LINE_RE.search(line)
        if not m:
            continue
        t, msg = parse_time(m.group(1)), m.group(2).strip()
        first, last = first or t, t
        if PASS_RE.match(msg):
            lm = LIVE_RE.search(msg)
            passes.append({"t": t, "live": "live: " in msg, "team": int(lm.group(1)) if lm and lm.group(1) else None,
                           "opp": int(lm.group(2)) if lm and lm.group(2) else None, "note": lm.group(3) if lm else ""})
        elif "echo " not in msg and any(e in msg for e in EVENTS):  # «echo …» — текст самого шага, не вывод
            events.append((t, msg))
    return passes, events, (first, last) if first else None


def deploys(runs: list[dict]) -> list[dict]:
    return sorted(({"id": r["databaseId"], "created": parse_time(r["createdAt"]), "done": parse_time(r["updatedAt"]),
                    "conclusion": r.get("conclusion") or r.get("status") or "?"} for r in runs),
                  key=lambda d: d["created"])


def stats(xs: list[float]) -> dict | None:
    q = sorted(xs)
    if not q:
        return None
    return {"n": len(q), "median": statistics.median(q), "p90": q[int(0.9 * (len(q) - 1))], "min": q[0], "max": q[-1]}


def measure(pl: list[dict], passes: list[dict], dep: list[dict]) -> dict:
    passes = sorted(passes, key=lambda x: x["t"])
    scored = [x for x in passes if x["team"] is not None]
    ok = [d for d in dep if d["conclusion"] == "success"]

    def published(t):  # первая успешная публикация, запущенная после прохода (данные к тому времени уже в ветке data)
        return next((d for d in ok if d["created"] >= t - timedelta(seconds=2)), None)

    rows = []
    for p in pl:
        if not p["scoring"]:
            continue
        # У штрафных ESPN иногда ставит время позже следующей замены, где счёт уже новый: момент, когда
        # счёт стал таким, — самое раннее время среди событий с этим (или большим) счётом.
        t0 = min(q["t"] for q in pl if q["team"] >= p["team"] and q["opp"] >= p["opp"])
        seen = next((x for x in scored if x["team"] >= p["team"] and x["opp"] >= p["opp"]), None)
        d = published(seen["t"]) if seen else None
        rows.append({"play": p, "t0": t0, "seen": seen, "deploy": d,
                     "to_collector": (seen["t"] - t0).total_seconds() if seen else None,
                     "to_site": (d["done"] - t0).total_seconds() if d else None})
    start = min((p["t"] for p in pl), default=None)
    end_play = next((p for p in pl if p["type"] == "End Game"), None)
    end = end_play["t"] if end_play else max((p["t"] for p in pl), default=None)
    window = (start - timedelta(minutes=45), end + timedelta(minutes=15)) if start and end else None
    inside = [x for x in passes if x["live"] and window and window[0] <= x["t"] <= window[1]]
    gaps = [(a["t"], b["t"], (b["t"] - a["t"]).total_seconds()) for a, b in zip(inside, inside[1:])
            if (b["t"] - a["t"]).total_seconds() > 90]
    final = next((x for x in scored if x["note"].startswith("Final")), None)
    dep_in = [d for d in dep if window and window[0] <= d["created"] <= window[1]]
    by_conclusion: dict[str, int] = {}
    for d in dep_in:
        by_conclusion[d["conclusion"]] = by_conclusion.get(d["conclusion"], 0) + 1
    ticks = [(b["t"] - a["t"]).total_seconds() for a, b in zip(scored, scored[1:])]
    return {"rows": rows, "start": start, "end": end, "end_is_final": bool(end_play), "window": window,
            "scored_passes": scored, "tick": stats(ticks), "gaps": gaps,
            "to_collector": stats([r["to_collector"] for r in rows if r["to_collector"] is not None]),
            "to_site": stats([r["to_site"] for r in rows if r["to_site"] is not None]),
            "missed": sum(1 for r in rows if r["seen"] is None),
            "final": final, "final_deploy": published(final["t"]) if final else None, "deploys": by_conclusion}


def _s(st: dict | None) -> str:
    if not st:
        return "нет данных"
    return (f"медиана {st['median']:.0f} с, 90% очков — не дольше {st['p90']:.0f} с, "
            f"мин {st['min']:.0f} с, макс {st['max']:.0f} с (очков: {st['n']})")


def report(res: dict, events: list[tuple[datetime, str]], rows: bool = False,
           spans: list[tuple[datetime, datetime]] = ()) -> list[str]:
    out = []
    spans = sorted(spans)
    if spans:
        out.append("Запуски дежурства по журналам (UTC): " + ", ".join(f"{a:%H:%M:%S}–{b:%H:%M:%S}" for a, b in spans)
                   + "".join(f"; пересменка {b1:%H:%M:%S}→{a2:%H:%M:%S} ({(a2 - b1).total_seconds():.0f} с)"
                             for (_, b1), (a2, _) in zip(spans, spans[1:])))
    if res["start"]:
        out.append(f"Матч по ESPN: первое событие {res['start']:%H:%M:%S}, "
                   f"{'конец' if res['end_is_final'] else 'последнее событие'} {res['end']:%H:%M:%S} UTC; "
                   f"очков: {len(res['rows'])}.")
    sc = res["scored_passes"]
    if sc:
        out.append(f"Проходы дежурства со счётом: {len(sc)} ({sc[0]['t']:%H:%M:%S}–{sc[-1]['t']:%H:%M:%S} UTC), "
                   + (f"интервал: медиана {res['tick']['median']:.0f} с, макс {res['tick']['max']:.0f} с." if res["tick"] else ""))
    win = res["window"]
    shown = [(t, m) for t, m in events if not win or win[0] - timedelta(hours=1) <= t <= win[1]]
    out.append("События дежурства: " + ("нет" if not shown else "; ".join(f"{t:%H:%M:%S} {m}" for t, m in shown)))
    out.append("Перерывы дольше 90 с между проходами с live (от 45 мин до начала до 15 мин после конца): "
               + ("нет" if not res["gaps"] else "; ".join(f"{a:%H:%M:%S}→{b:%H:%M:%S} ({g:.0f} с)" for a, b, g in res["gaps"])))
    out.append(f"До сборщика: {_s(res['to_collector'])}.")
    out.append(f"До сайта (конец публикации): {_s(res['to_site'])}; посетитель видит ещё до {PAGE_POLL} с позже.")
    if res["missed"]:
        out.append(f"Очков, которых сборщик не увидел ни в одном проходе: {res['missed']}.")
    fin, fd = res["final"], res["final_deploy"]
    if fin and res["end_is_final"]:
        out.append(f"Финальный счёт {fin['team']}:{fin['opp']}: конец матча {res['end']:%H:%M:%S}, сборщик {fin['t']:%H:%M:%S} "
                   f"(+{(fin['t'] - res['end']).total_seconds():.0f} с)"
                   + (f", сайт {fd['done']:%H:%M:%S} (+{(fd['done'] - res['end']).total_seconds():.0f} с, публикация {fd['id']})." if fd else "."))
    out.append("Публикации за время матча: " + (", ".join(f"{k} — {v}" for k, v in sorted(res["deploys"].items())) or "нет"))
    if rows:
        for r in res["rows"]:
            p, d = r["play"], r["deploy"]
            col = "—" if r["to_collector"] is None else f"+{r['to_collector']:.0f} с"
            site = "—" if r["to_site"] is None else f"+{r['to_site']:.0f} с"
            out.append(f"  {r['t0']:%H:%M:%S} Q{p['period']} {p['clock']:>5} {p['team']:>3}:{p['opp']:<3} "
                       f"сборщик {col:>7}  сайт {site:>7}" + (f"  (публикация {d['id']})" if d else ""))
    return out


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--summary", required=True, help="ответ ESPN summary?event=<id>")
    ap.add_argument("--log", action="append", default=[], help="журнал запуска «Сбор данных» (можно несколько)")
    ap.add_argument("--deploys", help="список запусков «Публикация сайта» (gh run list --json …)")
    ap.add_argument("--team", default=TEAM_ID)
    ap.add_argument("--rows", action="store_true", help="показать каждое очко")
    a = ap.parse_args(argv)
    with open(a.summary, encoding="utf-8") as f:
        pl = plays(json.load(f), a.team)
    passes, events, spans = [], [], []
    for path in a.log:
        with open(path, encoding="utf-8", errors="replace") as f:
            p, e, span = read_log(f)
        passes += p
        events += e
        spans += [span] if span else []
    dep = []
    if a.deploys:
        with open(a.deploys, encoding="utf-8") as f:
            dep = deploys(json.load(f))
    print("\n".join(report(measure(pl, passes, dep), sorted(events), rows=a.rows, spans=spans)))


if __name__ == "__main__":
    main()
