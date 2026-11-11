"""Хранилище: каждый набор данных — JSON-«конверт» в site/data/.

Конверт:
  dataset     — имя набора
  status      — "ok" (свежие), "stale" (источник не ответил, показаны прошлые), "error" (данных нет)
  source      — {"name", "url"} откуда данные
  fetchedAt   — время последнего УСПЕШНОГО получения (UTC, ISO)
  checkedAt   — время последней попытки
  error       — понятная причина, если последняя попытка не удалась
  fallback    — true, если данные из запасного источника
  data        — сами данные (None, если их никогда не было)

Прошлые данные никогда не затираются неудачной попыткой.
"""
from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from . import config


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    s = s.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        # ESPN иногда пишет "2026-10-22T02:00+00:00" без секунд — fromisoformat это понимает;
        # остальное считаем неразборчивым
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def path_for(name: str, data_dir: Path | None = None) -> Path:
    return (data_dir or config.DATA_DIR) / f"{name}.json"


def load(name: str, data_dir: Path | None = None) -> dict | None:
    p = path_for(name, data_dir)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _write(name: str, env: dict, data_dir: Path | None = None) -> None:
    p = path_for(name, data_dir)
    p.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=p.parent, prefix=".tmp-", suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(env, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, p)  # атомарно: страница никогда не увидит полузаписанный файл


def save_ok(name: str, data, source: dict, fallback: bool = False,
            data_dir: Path | None = None, when: datetime | None = None) -> dict:
    t = iso(when or now_utc())
    env = {
        "dataset": name,
        "status": "ok",
        "source": source,
        "fetchedAt": t,
        "checkedAt": t,
        "error": None,
        "fallback": fallback,
        "data": data,
    }
    _write(name, env, data_dir)
    return env


def save_failure(name: str, error: str, source: dict | None = None,
                 data_dir: Path | None = None, when: datetime | None = None) -> dict:
    """Попытка не удалась: сохраняем прошлые данные как есть, помечаем stale/error."""
    prev = load(name, data_dir) or {}
    has_data = prev.get("data") is not None
    env = {
        "dataset": name,
        "status": "stale" if has_data else "error",
        "source": prev.get("source") or source,
        "fetchedAt": prev.get("fetchedAt"),
        "checkedAt": iso(when or now_utc()),
        "error": error,
        "fallback": prev.get("fallback", False),
        "data": prev.get("data"),
    }
    _write(name, env, data_dir)
    return env


def seconds_since(ts: str | None, now: datetime | None = None) -> float:
    dt = parse_iso(ts)
    if dt is None:
        return float("inf")
    return ((now or now_utc()) - dt).total_seconds()
