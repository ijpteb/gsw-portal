"""Сборка ленты новостей из нескольких источников: категории, склейка, дубли."""
from __future__ import annotations

import hashlib
import re
from datetime import timedelta

from .store import now_utc, parse_iso

CATEGORIES = ("injury", "trade", "interview", "other")

# Порядок важен: первая подходящая категория побеждает.
_RULES = [
    ("injury", re.compile(
        r"\binjur|\bMRI\b|\bsprain|\bstrain|\bhamstring|\bankle|\bknee\b|\bconcussion|\bsurgery|"
        r"\bday-to-day|\bruled out|\bquestionable\b|\bdoubtful\b|\bwill miss|\bsidelined|\btorn\b|\btore\b|"
        r"\bUCL\b|\bfracture|\bsoreness|\bstepping away|\bhealth and safety|"
        r"травм|растяж|поврежд|операц|пропуст|выбыл|надрыв|перелом|ушиб|"
        r"не сыграет|под вопросом", re.I)),
    ("trade", re.compile(
        r"\btrades?\b|\btraded\b|\btrade deadline|\bacquir|\bwaive|\bsigned\b|\bsigns (?:a |with |two|multi|contract|deal)|"
        r"\bsigning\b|\bcontract\b|\bextension\b|\bfree agen|\bbuyout|\btwo-way|\bG League assign|"
        r"\brelease[ds]?\b|\bdeal\b|"
        r"обмен|подписал|контракт|отчислен|расторг|продлил|свободн\w* агент|переш[её]л", re.I)),
    ("interview", re.compile(
        r"\binterview|\bpodcast|\bQ&A\b|\bpostgame\b|\bpress conference|\bsaid\b|\bsays\b|\bexplains?\b|"
        r"\breflects?\b|\bopens up|\bon what|\breacts?\b|\btalks?\b|\bspeaks?\b|"
        r"интервью|заявил|рассказал|признал|высказал|ответил|отметил|считает|^«[^»]+»\s*[.:—–]", re.I)),
]


def categorize(title: str, text: str = "", kind: str | None = None) -> str:
    # Сначала заголовок (он точнее), затем текст.
    for field in (title or "", (text or "")[:400]):
        for cat, rx in _RULES:
            if rx.search(field):
                return cat
    return "other"


def item_id(url: str) -> str:
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]


def _norm_title(t: str) -> str:
    return re.sub(r"[^\w]+", " ", (t or "").lower()).strip()


def merge(fresh: list[dict], previous: list[dict] | None, keep_days: int = 30, limit: int = 150) -> list[dict]:
    """Свежие новости + прошлые (чтобы лента не пустела, если одна лента упала)."""
    by_url: dict[str, dict] = {}
    seen_titles: set[str] = set()
    for it in fresh + (previous or []):
        url = it.get("url")
        if not url or url in by_url:
            continue
        nt = _norm_title(it.get("title"))
        if nt in seen_titles:
            continue
        seen_titles.add(nt)
        it = dict(it)
        it["id"] = item_id(url)
        it["category"] = categorize(it.get("title", ""), it.get("text", ""), it.get("kind"))
        by_url[url] = it
    cutoff = now_utc() - timedelta(days=keep_days)
    items = [i for i in by_url.values() if (parse_iso(i.get("date")) or now_utc()) >= cutoff]
    items.sort(key=lambda i: i.get("date") or "", reverse=True)
    return items[:limit]
