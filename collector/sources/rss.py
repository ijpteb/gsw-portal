"""RSS-ленты новостей. ВСЯ работа с RSS — в этом файле.

Берём только то, что отдаёт сама лента: заголовок, дату, ссылку и короткий текст.
Если лента кладёт статью целиком — обрезаем до начала (полностью статьи не копируем).
"""
from __future__ import annotations

import html
import re
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

from ..http import SourceError, fetch_text
from ..store import iso, parse_iso

FEEDS = [
    {
        "id": "gsom",
        "name": "Golden State of Mind",
        "url": "https://www.goldenstateofmind.com/rss/current.xml",
        "lang": "en",
        "filter": None,  # лента целиком о ГСВ
    },
    {
        "id": "sportexpress",
        "name": "Спорт-Экспресс",
        "url": "https://www.sport-express.ru/services/materials/news/basketball/se/",
        "lang": "ru",
        # лента обо всём баскетболе — оставляем только новости о ГСВ
        "filter": re.compile(r"Голден\s*Стэйт|Голден\s*Стейт|Уорриорз|Уорриорс|Golden State|Warriors|(?<!Эдди\s)(?<!Сет\s)(?<!Делл\s)(?<!Эдди\xa0)(?<!Сет\xa0)(?<!Делл\xa0)Карри",
                             re.I),
    },
]

ATOM = "{http://www.w3.org/2005/Atom}"
MAX_TEXT = 700


def clean_text(raw: str | None, limit: int = MAX_TEXT) -> str:
    """HTML → обычный текст, обрезанный по границе предложения."""
    if not raw:
        return ""
    t = re.sub(r"(?is)<(script|style|figure|figcaption|iframe).*?</\1>", " ", raw)
    t = re.sub(r"(?i)<br\s*/?>|</p>|</li>|</h\d>", "\n", t)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t)
    t = re.sub(r"[ \t\r\f\v]+", " ", t)
    t = re.sub(r"\s*\n\s*", "\n", t).strip()
    if len(t) <= limit:
        return t
    cut = t[:limit]
    m = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "), cut.rfind("\n"))
    if m > limit * 0.5:
        cut = cut[: m + 1]
    return cut.rstrip() + " …"


def _date(s: str | None) -> str | None:
    if not s:
        return None
    s = s.strip()
    try:
        return iso(parsedate_to_datetime(s))
    except (TypeError, ValueError):
        dt = parse_iso(s)
        return iso(dt) if dt else None


def parse_feed(xml_text: str, feed: dict) -> list[dict]:
    try:
        root = ET.fromstring(xml_text.encode("utf-8") if isinstance(xml_text, str) else xml_text)
    except ET.ParseError:
        raise SourceError(f"{feed['name']}: лента прислала повреждённый XML")
    items = root.findall(".//item")
    atom = False
    if not items:
        items = root.findall(f".//{ATOM}entry")
        atom = True
    if not items and root.tag not in ("rss", f"{ATOM}feed"):
        raise SourceError(f"{feed['name']}: это не RSS-лента")
    out = []
    for it in items:
        if atom:
            title = it.findtext(f"{ATOM}title")
            link_el = it.find(f"{ATOM}link[@rel='alternate']")
            if link_el is None:  # у Element нет «истинности» — сравниваем с None явно
                link_el = it.find(f"{ATOM}link")
            url = link_el.get("href") if link_el is not None else None
            date = it.findtext(f"{ATOM}published") or it.findtext(f"{ATOM}updated")
            body = it.findtext(f"{ATOM}summary") or it.findtext(f"{ATOM}content")
        else:
            title = it.findtext("title")
            url = it.findtext("link")
            date = it.findtext("pubDate")
            body = it.findtext("description") or it.findtext("{http://purl.org/rss/1.0/modules/content/}encoded")
        title = clean_text(title, 300)
        url = (url or "").strip()
        if not title or not url:
            continue
        text = clean_text(body)
        if feed.get("filter") and not (feed["filter"].search(title) or feed["filter"].search(text)):
            continue
        out.append({
            "title": title,
            "date": _date(date),
            "url": url,
            "text": text,
            "source": feed["name"],
            "lang": feed["lang"],
            "kind": None,
            "image": None,
            "tags": [],
        })
    return out


def fetch_feed(feed: dict) -> list[dict]:
    return parse_feed(fetch_text(feed["url"]), feed)


def still_relevant(item: dict) -> bool:
    """Прошлая новость проходит текущий фильтр ленты (если фильтр уточнили — старый мусор уходит)."""
    feed = next((f for f in FEEDS if f["name"] == item.get("source")), None)
    if not feed or not feed.get("filter"):
        return True
    return bool(feed["filter"].search(item.get("title", "")) or feed["filter"].search(item.get("text", "")))
