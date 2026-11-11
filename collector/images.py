"""Кэш официальных изображений (логотипы, фото игроков) в site/img/.

Страницы берут картинки только отсюда — к ESPN браузер не обращается.
Картинку не перекачиваем, если ей меньше IMAGE_MAX_AGE.
"""
from __future__ import annotations

import time
from pathlib import Path
from urllib.parse import quote

from . import config
from .http import SourceError, fetch_bytes

PNG_MAGIC = b"\x89PNG"


def _espn_resized(src: str, w: int, h: int) -> str | None:
    """Официальный сервис ESPN для уменьшения картинок (тот же сервер, меньше вес)."""
    prefix = "https://a.espncdn.com"
    if not src.startswith(prefix):
        return None
    return f"{prefix}/combiner/i?img={quote(src[len(prefix):])}&w={w}&h={h}"


def _fresh(p: Path) -> bool:
    return p.exists() and p.stat().st_size > 0 and (time.time() - p.stat().st_mtime) < config.IMAGE_MAX_AGE


def save_image(src: str, dest: Path, w: int, h: int, force: bool = False) -> bool:
    if not force and _fresh(dest):
        return True
    urls = [u for u in (_espn_resized(src, w, h), src) if u]
    for u in urls:
        try:
            body = fetch_bytes(u)
        except SourceError:
            continue
        if not body.startswith(PNG_MAGIC) and not body[:3] == b"\xff\xd8\xff":
            continue  # не картинка
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix(".tmp")
        tmp.write_bytes(body)
        tmp.replace(dest)
        return True
    return dest.exists()  # старая копия лучше, чем ничего


def team_logo_path(abbr: str, img_dir: Path | None = None) -> Path:
    return (img_dir or config.IMG_DIR) / "teams" / f"{abbr.lower()}.png"


def player_photo_path(pid: str, img_dir: Path | None = None) -> Path:
    return (img_dir or config.IMG_DIR) / "players" / f"{pid}.png"


def cache_logos(teams: list[dict], img_dir: Path | None = None, force: bool = False) -> tuple[int, int]:
    ok = 0
    for t in teams:
        if save_image(t["src"], team_logo_path(t["abbr"], img_dir), 200, 200, force):
            ok += 1
    return ok, len(teams)


def cache_headshots(players: list[dict], img_dir: Path | None = None, force: bool = False) -> tuple[int, int]:
    """Качает фото и проставляет headshot=None тем, у кого фото нет (будет заглушка)."""
    ok = 0
    for p in players:
        dest = player_photo_path(p["id"], img_dir)
        if p.get("headshotSrc") and save_image(p["headshotSrc"], dest, 520, 380, force):
            p["headshot"] = f"img/players/{p['id']}.png"
            ok += 1
        else:
            p["headshot"] = None
    return ok, len(players)
