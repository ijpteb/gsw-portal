"""Сборка ленты новостей из нескольких источников: категории, склейка, дубли."""
from __future__ import annotations

import hashlib
import re
from datetime import timedelta

from .store import now_utc, parse_iso

CATEGORIES = ("injury", "trade", "interview", "other")

# Категория — только когда она очевидна; если неочевидна — «остальное».
# Порядок важен: травмы → обмены → интервью. Смотрим заголовок; текст ленты — только для обменов
# и только у статей (в отчётах о матчах «traded baskets» и упоминания травм ничего не значат).
_INJURY = re.compile(
    r"\binjur|\bMRI\b|\bsprain|\bstrain|\bhamstring|\bankle\b(?!-break)|\bknee\b|\bconcussion|\bsurgery|"
    r"\bday-to-day|\bruled out|\bquestionable\b|\bdoubtful\b|\b(?:will|to) miss\b|\bsidelined|\btorn\b|\btore\b|"
    r"\b(?:ligament|ACL|MCL|meniscus|labrum) tear|\bAchilles\b|\bUCL\b|\bfracture|\bsoreness|"
    r"\bout (?:at least|indefinitely|for the season)|\bstep(?:ping)? away\b|\bhealth\b|"
    r"травм|растяж|поврежд|операц|перелом|надрыв|разрыв\w* связ|ушиб|выбыл|"
    r"пропустит|пропустил\w* (?:\w+ )?(?:матч|игр|встреч|сезон)|не сыграет|под вопросом", re.I)
_TRADE = re.compile(
    r"\btrades?\b|\btraded\b|\btrading\b|\bacquir|\bwaive[ds]?\b|\bsign(?:s|ed|ing)? (?:a |with |two-|multi|contract|deal|to )|"
    r"\bcontract\b|\bextension\b|\bfree agen|\bbuyout|\btwo-way|\bG League assign|"
    r"обмен|трейд|подписал|контракт|отчисл|расторг|свободн\w* агент|переш[её]л в «", re.I)
_TRADE_TEXT = re.compile(
    r"\bto trade\b|\btrade (?:talks?|rumou?rs?|deadline|market|package|offers?|requests?|targets?|candidates?|"
    r"chips?|value|options?|partners?|for|with|involving)\b|\btraded (?:to|for|by)\b|\btrading (?:for|away)\b|обмен", re.I)
_INTERVIEW = re.compile(
    r"\binterview|\bpodcast\b|\bQ&A\b|\bpress conference|\bpresser\b|\bmedia day\b|\bsits? down with|"
    r"\bone-on-one\b|\b1-on-1\b|интервью|пресс-конференц", re.I)
# Слова речи — только не у видео ESPN (там «Stephen A. says…» — мнение ведущего шоу, а не интервью).
_SPEECH = re.compile(
    r"\bsays\b|\bsaid\b|\bexplains?\b|\breflects?\b|\bopens? up\b|\breacts?\b|\btalks?\b|\bspeaks?\b|"
    r"^[A-Z][\w.'’ -]{1,40}(?: on [^:]{2,60})?:\s*[\"“‘']|"
    r"заявил|рассказал|признал|высказал|ответил|отметил|считает|"
    r"^[А-ЯЁA-Z][^:«»]{1,60}:\s*«|^«[^»]+»\s*[.:—–]|[А-ЯЁ][а-яё]+ — о\b", re.I)
_NOT_SPEECH = re.compile(r"\bsources?\b|\breport(?:s|ed)?\b|\bper\b", re.I)
ARTICLE_KINDS = (None, "Story", "HeadlineNews")  # у RSS kind = None


def categorize(title: str, text: str = "", kind: str | None = None) -> str:
    title = title or ""
    text = (text or "")[:400]
    if _INJURY.search(title):
        return "injury"
    if _TRADE.search(title) or (kind in ARTICLE_KINDS and _TRADE_TEXT.search(text)):
        return "trade"
    if _INTERVIEW.search(title):
        return "interview"
    if kind != "Media" and _SPEECH.search(title) and not _NOT_SPEECH.search(title):
        return "interview"
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
