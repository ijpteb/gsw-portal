"""Оркестратор: решает, что пора обновить, обходит источники по цепочке
«основной → запасной», сохраняет результат или помечает данные устаревшими.

Запуск: python3 -m collector run            — обновить то, что пора
        python3 -m collector run --force    — обновить всё сейчас (кнопка «Обновить» для владельца)
        python3 -m collector run --live-loop — во время матча обновлять счёт раз в минуту
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import time
import traceback
from datetime import datetime, timedelta
from pathlib import Path
from typing import Callable

from . import config, images, news, store
from .http import REQUEST_LOG, SourceError
from .sources import espn, rss

Attempt = tuple[dict, Callable[[], object]]  # (описание источника, функция «скачать и разобрать»)


class Runner:
    def __init__(self, force: bool = False, only: set[str] | None = None,
                 data_dir: Path | None = None, img_dir: Path | None = None,
                 now: datetime | None = None, log: Callable[[str], None] = print):
        self.force = force
        self.only = only
        self.data_dir = data_dir or config.DATA_DIR
        self.img_dir = img_dir or config.IMG_DIR
        self.now = now or store.now_utc()
        self.log = log
        self.results: dict[str, str] = {}

    # --- общие механизмы ------------------------------------------------------

    def load(self, name: str) -> dict | None:
        return store.load(name, self.data_dir)

    def wanted(self, name: str) -> bool:
        if not self.only:
            return True
        base = name.split("/")[0]
        return name in self.only or base in self.only

    def due(self, name: str, interval: int) -> bool:
        if not self.wanted(name):
            return False
        if self.force:
            return True
        env = self.load(name)
        if not env:
            return True
        since = store.seconds_since(env.get("checkedAt"), self.now)
        if env.get("status") != "ok":
            return since >= min(interval, config.RETRY_AFTER_FAILURE)
        return since >= interval - 30  # небольшой запас: cron может сработать чуть раньше

    def attempt(self, name: str, attempts: list[Attempt]) -> dict:
        """Пробуем источники по очереди. Ни один не ответил — оставляем прошлые данные."""
        errors = []
        for i, (src, fn) in enumerate(attempts):
            try:
                data = fn()
            except SourceError as e:
                errors.append(f"{src['name']}: {e}")
                continue
            except Exception as e:  # формат ответа поменялся — не падаем, а сообщаем
                self.log(traceback.format_exc())
                errors.append(f"{src['name']}: неожиданный формат ответа ({type(e).__name__})")
                continue
            env = store.save_ok(name, data, src, fallback=i > 0, data_dir=self.data_dir, when=self.now)
            self.results[name] = "ok" + (" (запасной источник)" if i > 0 else "")
            return env
        err = "; ".join(errors) or "нет источника"
        env = store.save_failure(name, err, attempts[0][0] if attempts else None,
                                 data_dir=self.data_dir, when=self.now)
        self.results[name] = f"{env['status']}: {err}"
        return env

    # --- расписание и «день матча» ----------------------------------------------

    def games(self) -> list[dict]:
        env = self.load("schedule")
        return ((env or {}).get("data") or {}).get("games") or []

    def _game_dt(self, g: dict) -> datetime | None:
        return store.parse_iso(g.get("date"))

    def is_gameday(self) -> bool:
        for g in self.games():
            dt = self._game_dt(g)
            if dt and -config.GAMEDAY_AFTER <= (dt - self.now).total_seconds() <= config.GAMEDAY_BEFORE:
                return True
        return False

    def live_game(self) -> dict | None:
        """Матч, который может идти прямо сейчас (по расписанию), если не завершён."""
        for g in self.games():
            dt = self._game_dt(g)
            if not dt:
                continue
            delta = (self.now - dt).total_seconds()
            if -config.LIVE_BEFORE <= delta <= config.LIVE_AFTER and not g.get("completed"):
                return g
        return None

    # --- задачи -------------------------------------------------------------

    def task_schedule(self, now_anyway: bool = False):
        interval = config.SCHEDULE_GAMEDAY if self.is_gameday() else config.INTERVALS["schedule"]
        if self.due("schedule", interval) or (now_anyway and self.wanted("schedule")):
            self.attempt("schedule", [
                (espn.source("schedule"), lambda: espn.parse_schedule(espn.fetch("schedule"))),
                # Запасные источники (NBA.com cdn, balldontlie) подключаются после проверки
                # с серверов GitHub — см. CLAUDE.md.
            ])

    def task_live(self) -> str | None:
        """Возвращает состояние матча ('pre'/'in'/'post') или None, если матча нет."""
        if not self.wanted("live"):
            return None
        g = self.live_game()
        prev = self.load("live")
        if not g:
            prev_game = ((prev or {}).get("data") or {}).get("game")
            if prev is None or (prev_game and prev_game.get("state") != "post") or (
                    prev_game and store.seconds_since(prev_game.get("date"), self.now) > 12 * 3600):
                store.save_ok("live", {"game": None}, {"name": "по расписанию ESPN", "url": None},
                              data_dir=self.data_dir, when=self.now)
            return None
        day = espn.us_date(g["date"])
        url = espn.scoreboard_url(day)
        env = self.attempt("live", [
            (espn.source("live", url), lambda: {"game": espn.parse_scoreboard(espn.fetch_json_url(url))}),
        ])
        game = ((env.get("data") or {}).get("game")) if env.get("status") == "ok" else None
        return game.get("state") if game else None

    def task_team(self):
        if self.due("team", config.INTERVALS["team"]):
            self.attempt("team", [(espn.source("team"), lambda: espn.parse_team(espn.fetch("team")))])

    def task_logos(self):
        if not self.due("logos", config.INTERVALS["logos"]):
            return

        def go():
            teams = espn.parse_teams_logos(espn.fetch("teams"))
            ok, total = images.cache_logos(teams, self.img_dir, self.force)
            if ok == 0:
                raise SourceError("логотипы не скачались")
            return {"cached": ok, "total": total, "teams": sorted(t["abbr"] for t in teams)}

        self.attempt("logos", [(espn.source("teams"), go)])

    def task_roster(self):
        if self.due("injuries", config.INTERVALS["injuries"]):
            self.attempt("injuries", [(espn.source("injuries"),
                                       lambda: espn.parse_injuries(espn.fetch("injuries")))])
        if self.due("roster", config.INTERVALS["roster"]):
            def go():
                data = espn.parse_roster(espn.fetch("roster"))
                images.cache_headshots(data["players"], self.img_dir, self.force)
                return data
            self.attempt("roster", [(espn.source("roster"), go)])

    def task_stats(self, after_game: bool = False):
        for name, parser in (("player_stats", espn.parse_player_stats),
                             ("team_stats", None), ("standings", espn.parse_standings)):
            if not (self.due(name, config.INTERVALS[name]) or (after_game and self.wanted(name))):
                continue
            if name == "team_stats":
                self.attempt(name, [(espn.source("team_stats_league"),
                                     lambda: espn.parse_team_stats_league(espn.fetch("team_stats_league")))])
            else:
                self.attempt(name, [(espn.source(name), lambda p=parser, n=name: p(espn.fetch(n)))])

    def task_gamelogs(self, after_game: bool = False):
        roster = ((self.load("roster") or {}).get("data") or {}).get("players") or []
        for p in roster:
            name = f"gamelog/{p['id']}"
            if not (self.due(name, config.INTERVALS["gamelogs"]) or (after_game and self.wanted(name))):
                continue
            url = espn.gamelog_url(p["id"])
            self.attempt(name, [(espn.source("gamelog", url),
                                 lambda u=url, pid=p["id"]: espn.parse_gamelog(espn.fetch_json_url(u), pid))])

    def task_news(self):
        if not self.due("news", config.INTERVALS["news"]):
            return
        prev = self.load("news")
        prev_items = ((prev or {}).get("data") or {}).get("items") or []
        prev_items = [i for i in prev_items if rss.still_relevant(i)]
        fresh, feeds = [], []
        sources = [("ESPN", espn.URLS["news"], lambda: espn.parse_news(espn.fetch("news")))] + [
            (f["name"], f["url"], lambda f=f: rss.fetch_feed(f)) for f in rss.FEEDS]
        for name, url, fn in sources:
            try:
                items = fn()
                fresh += items
                feeds.append({"name": name, "url": url, "ok": True, "count": len(items),
                              "error": None, "checkedAt": store.iso(self.now)})
            except Exception as e:  # одна лента упала — остальные работают
                msg = str(e) if isinstance(e, SourceError) else f"неожиданный формат ({type(e).__name__})"
                feeds.append({"name": name, "url": url, "ok": False, "count": 0,
                              "error": msg, "checkedAt": store.iso(self.now)})
        if not any(f["ok"] for f in feeds):
            env = store.save_failure("news", "; ".join(f"{f['name']}: {f['error']}" for f in feeds),
                                     {"name": "ESPN, RSS", "url": None}, self.data_dir, self.now)
            self.results["news"] = f"{env['status']}: все ленты недоступны"
            return
        # Новости упавших лент берём из прошлой версии — лента не пустеет.
        failed = {f["name"] for f in feeds if not f["ok"]}
        keep = [i for i in prev_items if i.get("source") in failed]
        items = news.merge(fresh, keep + prev_items)
        store.save_ok("news", {"items": items, "feeds": feeds},
                      {"name": ", ".join(f["name"] for f in feeds), "url": None},
                      data_dir=self.data_dir, when=self.now)
        self.results["news"] = "ok" + (f" (не ответили: {', '.join(sorted(failed))})" if failed else "")

    # --- сводка для страниц ---------------------------------------------------

    def write_status(self):
        datasets = {}
        for p in sorted(self.data_dir.glob("*.json")):
            if p.stem == "status":
                continue
            env = store.load(p.stem, self.data_dir) or {}
            datasets[p.stem] = {k: env.get(k) for k in ("status", "source", "fetchedAt", "checkedAt", "error",
                                                       "fallback")}
        live = self.live_game()
        status = {
            "generatedAt": store.iso(self.now),
            "season": config.SEASON_LABEL,
            "liveWindow": bool(live),
            "liveGameId": live["id"] if live else None,
            "gameday": self.is_gameday(),
            "datasets": datasets,
        }
        store.save_ok("status", status, {"name": "сборщик", "url": None}, data_dir=self.data_dir, when=self.now)
        (self.data_dir / "fingerprint.txt").write_text(self.fingerprint(), encoding="utf-8")

    def fingerprint(self) -> str:
        """Отпечаток содержимого без отметок «проверено в…»: меняется — значит, сайт пора переопубликовать."""
        h = hashlib.sha256()
        for p in sorted(self.data_dir.rglob("*.json")):
            if p.name == "status.json":
                continue
            try:
                env = json.loads(p.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            env.pop("checkedAt", None)
            h.update(str(p.relative_to(self.data_dir)).encode())
            h.update(json.dumps(env, sort_keys=True, ensure_ascii=False).encode())
        if self.img_dir.exists():
            for p in sorted(self.img_dir.rglob("*.png")):
                h.update(f"{p.relative_to(self.img_dir)}:{p.stat().st_size}".encode())
        h.update(str(bool(self.live_game())).encode())
        return h.hexdigest()[:16]

    # --- полный проход --------------------------------------------------------

    def run(self) -> dict[str, str]:
        self.task_schedule()
        state_before = (((self.load("live") or {}).get("data") or {}).get("game") or {}).get("state")
        state = self.task_live()
        # Матч только что закончился — сразу обновляем счёт в расписании, таблицу и статистику.
        after_game = state == "post" and state_before in ("in", "pre")
        if after_game:
            self.task_schedule(now_anyway=True)
        self.task_team()
        self.task_logos()
        self.task_roster()
        self.task_stats(after_game)
        self.task_gamelogs(after_game)
        self.task_news()
        self.write_status()
        return self.results


def run_once(**kw) -> dict[str, str]:
    REQUEST_LOG.clear()
    r = Runner(**kw)
    res = r.run()
    return res


def live_loop(max_minutes: int = 300, after_update: str | None = None, log=print, **kw):
    """Пока идёт (или вот-вот начнётся) матч: каждые LIVE_POLL секунд — обычный проход
    (счёт матча обновляется всегда, остальное — по своему расписанию) и публикация."""
    deadline = time.time() + max_minutes * 60
    while time.time() < deadline:
        r = Runner(log=log, **kw)
        res = r.run()
        log(f"{store.iso(store.now_utc())} " + ", ".join(f"{k}: {v}" for k, v in res.items()))
        _hook(after_update, log)
        if not r.live_game():
            log("Матча сейчас нет — выходим из режима live.")
            return
        time.sleep(config.LIVE_POLL)


def _hook(cmd: str | None, log):
    if not cmd:
        return
    res = subprocess.run(cmd, shell=True)
    if res.returncode != 0:
        log(f"after-update завершился с кодом {res.returncode}")
