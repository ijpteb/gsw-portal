"""ESPN — основной источник (неофициальные открытые JSON, без ключа).

ВСЯ работа с ESPN — только в этом файле. Если ESPN поменяет формат, чинить здесь
и прогонять tests/test_espn.py (там настоящие сохранённые ответы).

Каждая функция parse_* принимает сырой ответ и возвращает данные в едином формате
или бросает SourceError с понятной причиной.
"""
from __future__ import annotations

from datetime import datetime
from fractions import Fraction

from .. import config
from ..http import SourceError, fetch_json

NAME = "ESPN"
SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
SITE_WEB = "https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba"
COMMON = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba"
STANDINGS = "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings"

T = config.ESPN_TEAM_SLUG
Y = config.SEASON_ESPN_YEAR

URLS = {
    "team": f"{SITE}/teams/{T}",
    "teams": f"{SITE}/teams",
    "schedule": f"{SITE}/teams/{T}/schedule?season={Y}&seasontype=2",
    "roster": f"{SITE}/teams/{T}/roster",
    "injuries": f"{SITE}/injuries",
    "player_stats": f"{SITE_WEB}/teams/{T}/athletes/statistics?season={Y}&seasontype=2",
    "team_stats_league": f"{COMMON}/statistics/byteam?season={Y}&seasontype=2",
    "standings": f"{STANDINGS}?season={Y}&seasontype=2",
    "news": f"{SITE}/news?team={T}&limit=40",
}


def scoreboard_url(yyyymmdd: str) -> str:
    return f"{SITE}/scoreboard?dates={yyyymmdd}"


def gamelog_url(player_id: str) -> str:
    return f"{COMMON}/athletes/{player_id}/gamelog?season={Y}&seasontype=2"


def source(key: str, url: str | None = None) -> dict:
    return {"name": NAME, "url": url or URLS.get(key)}


def fetch(key: str) -> dict:
    return fetch_json(URLS[key])


# --- вспомогательное -----------------------------------------------------------

def _logo_path(abbr: str | None) -> str | None:
    return f"img/teams/{abbr.lower()}.png" if abbr else None


def _check_season(raw: dict, what: str, key: str = "season") -> None:
    season = raw.get(key) or raw.get("requestedSeason") or {}
    year = season.get("year")
    if year != Y:
        label = season.get("displayName") or year or "неизвестный"
        raise SourceError(f"{what}: источник отдал сезон {label} вместо {config.SEASON_LABEL}")


def _num(v):
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return int(f) if f.is_integer() else f


def _team_brief(t: dict) -> dict:
    abbr = t.get("abbreviation")
    return {
        "id": str(t.get("id")) if t.get("id") is not None else None,
        "abbr": abbr,
        "name": t.get("displayName"),
        "shortName": t.get("shortDisplayName") or t.get("name"),
        "logo": _logo_path(abbr),
    }


# --- команда -------------------------------------------------------------------

def parse_team(raw: dict) -> dict:
    t = raw.get("team") or {}
    if str(t.get("id")) != config.ESPN_TEAM_ID:
        raise SourceError("команда: источник вернул не ту команду")
    rec = (t.get("record") or {}).get("items") or []
    total = next((r for r in rec if r.get("type") == "total"), rec[0] if rec else {})
    logos = t.get("logos") or []
    return {
        **_team_brief(t),
        "location": t.get("location"),
        "record": total.get("summary"),
        "standingSummary": t.get("standingSummary"),
        "logoSrc": logos[0]["href"] if logos else None,
    }


def parse_teams_logos(raw: dict) -> list[dict]:
    """Список всех команд лиги с адресами логотипов (для кэша картинок)."""
    out = []
    for sp in raw.get("sports", []):
        for lg in sp.get("leagues", []):
            for item in lg.get("teams", []):
                t = item.get("team", {})
                logos = t.get("logos") or []
                if t.get("abbreviation") and logos:
                    out.append({"abbr": t["abbreviation"], "src": logos[0]["href"]})
    if len(out) < 30:
        raise SourceError(f"логотипы: в ответе {len(out)} команд вместо 30")
    return out


# --- расписание и счёт ---------------------------------------------------------

def _parse_event(e: dict) -> dict:
    c = (e.get("competitions") or [{}])[0]
    comps = c.get("competitors") or []
    us = next((x for x in comps if str(x.get("id") or x.get("team", {}).get("id")) == config.ESPN_TEAM_ID), None)
    them = next((x for x in comps if x is not us), None)
    if us is None or them is None:
        raise SourceError("расписание: в матче нет ГСВ или соперника")
    st = c.get("status") or e.get("status") or {}
    stype = st.get("type") or {}
    state = stype.get("state")  # pre / in / post

    def score(x):
        s = x.get("score")
        if isinstance(s, dict):
            s = s.get("displayValue", s.get("value"))
        return _num(s)

    sc = None
    if state in ("in", "post"):
        a, b = score(us), score(them)
        if a is not None and b is not None:
            sc = {"team": a, "opp": b}
    result = None
    if stype.get("completed") and sc:
        if us.get("winner") is True:
            result = "W"
        elif them.get("winner") is True:
            result = "L"
        else:
            result = "W" if sc["team"] > sc["opp"] else "L"
    venue = c.get("venue") or {}
    addr = venue.get("address") or {}
    notes = [n.get("headline") for n in c.get("notes", []) if n.get("headline")]
    return {
        "id": str(e.get("id")),
        "date": e.get("date"),
        "timeValid": c.get("timeValid", True),
        "home": us.get("homeAway") == "home",
        "opponent": _team_brief(them.get("team") or {}),
        "venue": {"name": venue.get("fullName"), "city": addr.get("city"), "state": addr.get("state")},
        "state": state,
        "statusName": stype.get("name"),
        "completed": bool(stype.get("completed")),
        "detail": stype.get("detail"),
        "shortDetail": stype.get("shortDetail"),
        "period": st.get("period"),
        "clock": st.get("displayClock"),
        "score": sc,
        "result": result,
        "cup": any("NBA Cup" in n for n in notes),
        "notes": notes,
    }


def parse_schedule(raw: dict) -> dict:
    _check_season(raw, "расписание")
    st = raw.get("requestedSeason") or {}
    if st.get("type") not in (None, 2):
        raise SourceError("расписание: источник отдал не регулярный чемпионат")
    events = raw.get("events") or []
    if not events:
        raise SourceError("расписание: источник отдал пустой календарь")
    games = [_parse_event(e) for e in events]
    games.sort(key=lambda g: g["date"] or "")
    # Санити-проверка: матчи должны лежать в датах регулярки 2026/27
    first, last = games[0]["date"][:10], games[-1]["date"][:10]
    if first < "2026-10-15" or last > "2027-04-20":
        raise SourceError(f"расписание: даты {first}…{last} не похожи на сезон {config.SEASON_LABEL}")
    missing = max(0, config.REGULAR_SEASON_GAMES - len(games))
    return {
        "season": config.SEASON_LABEL,
        "games": games,
        "expectedGames": config.REGULAR_SEASON_GAMES,
        "missingGames": missing,
    }


def parse_scoreboard(raw: dict) -> dict | None:
    """Матч ГСВ на табло дня (для live). None — если ГСВ в этот день не играет."""
    for e in raw.get("events", []):
        for c in e.get("competitions", []):
            ids = [str(x.get("id") or x.get("team", {}).get("id")) for x in c.get("competitors", [])]
            if config.ESPN_TEAM_ID in ids:
                return _parse_event(e)
    return None


# --- состав и травмы -----------------------------------------------------------

def parse_roster(raw: dict) -> dict:
    _check_season(raw, "состав")
    athletes = raw.get("athletes") or []
    if athletes and isinstance(athletes[0], dict) and "items" in athletes[0]:
        athletes = [a for grp in athletes for a in grp.get("items", [])]
    if not athletes:
        raise SourceError("состав: источник отдал пустой список игроков")
    players = []
    for a in athletes:
        h = _num(a.get("height"))
        w = _num(a.get("weight"))
        inj = (a.get("injuries") or [None])[0]
        pos = a.get("position") or {}
        players.append({
            "id": str(a["id"]),
            "name": a.get("fullName") or a.get("displayName"),
            "firstName": a.get("firstName"),
            "lastName": a.get("lastName"),
            "jersey": a.get("jersey"),
            "position": pos.get("abbreviation"),
            "positionName": pos.get("displayName"),
            "heightIn": h,
            "heightCm": round(h * 2.54) if h else None,
            "weightLb": w,
            "weightKg": round(w * 0.45359237) if w else None,
            "birthDate": (a.get("dateOfBirth") or "")[:10] or None,
            "age": a.get("age"),
            "experience": (a.get("experience") or {}).get("years"),
            "headshot": f"img/players/{a['id']}.png" if a.get("headshot") else None,
            "headshotSrc": (a.get("headshot") or {}).get("href"),
            "injury": {"status": inj.get("status"), "date": inj.get("date")} if inj else None,
        })
    players.sort(key=lambda p: (int(p["jersey"]) if (p["jersey"] or "").isdigit() else 999, p["name"] or ""))
    return {"season": config.SEASON_LABEL, "players": players}


def parse_injuries(raw: dict) -> dict:
    out = {}
    found_team = False
    for t in raw.get("injuries", []):
        if str(t.get("id")) != config.ESPN_TEAM_ID and "Golden State" not in (t.get("displayName") or ""):
            continue
        found_team = True
        for i in t.get("injuries", []):
            ath = i.get("athlete") or {}
            pid = str(ath.get("id") or "") or None
            if not pid:
                # у ESPN id игрока лежит в ссылке на него
                for l in ath.get("links", []):
                    href = l.get("href", "")
                    if "/id/" in href:
                        pid = href.split("/id/")[1].split("/")[0]
                        break
            if not pid:
                continue
            out[pid] = {
                "name": ath.get("displayName"),
                "status": i.get("status"),
                "type": (i.get("type") or {}).get("description"),
                "date": i.get("date"),
                "short": i.get("shortComment"),
                "long": i.get("longComment"),
                "detail": _injury_detail(i.get("details") or {}),
            }
    if not raw.get("injuries"):
        raise SourceError("травмы: источник отдал пустой ответ")
    # Если ГСВ нет в списке — значит, травмированных нет (ESPN перечисляет только команды с травмами)
    return {"players": out, "teamListed": found_team}


def _injury_detail(d: dict) -> dict | None:
    if not d:
        return None
    return {
        "type": d.get("type"),
        "location": d.get("location"),
        "side": d.get("side"),
        "returnDate": d.get("returnDate"),
    }


# --- статистика игроков --------------------------------------------------------

# имя показателя у ESPN → наш ключ
PLAYER_STAT_KEYS = {
    "gamesPlayed": "gp", "gamesStarted": "gs", "avgMinutes": "min", "minutes": "minTotal",
    "avgPoints": "pts", "avgRebounds": "reb", "avgAssists": "ast", "avgSteals": "stl",
    "avgBlocks": "blk", "avgTurnovers": "tov", "avgFouls": "pf",
    "avgOffensiveRebounds": "oreb", "avgDefensiveRebounds": "dreb",
    "avgFieldGoalsMade": "fgm", "avgFieldGoalsAttempted": "fga", "fieldGoalPct": "fgPct",
    "avgThreePointFieldGoalsMade": "fg3m", "avgThreePointFieldGoalsAttempted": "fg3a",
    "threePointFieldGoalPct": "fg3Pct",
    "avgFreeThrowsMade": "ftm", "avgFreeThrowsAttempted": "fta", "freeThrowPct": "ftPct",
    "twoPointFieldGoalPct": "fg2Pct", "assistTurnoverRatio": "astTov",
    "points": "ptsTotal", "totalRebounds": "rebTotal", "assists": "astTotal", "steals": "stlTotal",
    "blocks": "blkTotal", "turnovers": "tovTotal",
    "fieldGoalsMade": "fgmTotal", "fieldGoalsAttempted": "fgaTotal",
    "threePointFieldGoalsMade": "fg3mTotal", "threePointFieldGoalsAttempted": "fg3aTotal",
    "freeThrowsMade": "ftmTotal", "freeThrowsAttempted": "ftaTotal",
}


def _flat_stats(categories: list) -> dict:
    out = {}
    for c in categories or []:
        for s in c.get("stats", []):
            key = PLAYER_STAT_KEYS.get(s.get("name"))
            if key and key not in out:
                out[key] = _num(s.get("value"))
    return out


def parse_player_stats(raw: dict) -> dict:
    _check_season(raw, "статистика игроков", key="requestedSeason")
    results = raw.get("results") or []
    leaders = results[0].get("leaders", []) if results else []
    if not leaders:
        raise SourceError("статистика игроков: источник отдал пустой список")
    players = []
    for L in leaders:
        a = L.get("athlete") or {}
        players.append({
            "id": str(a.get("id")),
            "name": a.get("displayName"),
            "position": (a.get("position") or {}).get("abbreviation"),
            "stats": _flat_stats(L.get("statistics")),
        })
    return {"season": config.SEASON_LABEL, "players": players}


def parse_gamelog(raw: dict, player_id: str) -> dict:
    names = raw.get("names") or []
    events_meta = raw.get("events") or {}
    games = []
    for st in raw.get("seasonTypes", []):
        dn = st.get("displayName") or ""
        if config.SEASON_LABEL not in dn:
            continue
        if "Regular Season" not in dn:
            continue
        for cat in st.get("categories", []):
            for ev in cat.get("events", []):
                meta = events_meta.get(ev.get("eventId"), {})
                vals = dict(zip(names, ev.get("stats", [])))
                opp = meta.get("opponent") or {}

                def ma(key):
                    v = vals.get(key)
                    if not v or "-" not in v:
                        return None, None
                    m, a = v.split("-", 1)
                    return _num(m), _num(a)

                fgm, fga = ma("fieldGoalsMade-fieldGoalsAttempted")
                f3m, f3a = ma("threePointFieldGoalsMade-threePointFieldGoalsAttempted")
                ftm, fta = ma("freeThrowsMade-freeThrowsAttempted")
                games.append({
                    "eventId": ev.get("eventId"),
                    "date": meta.get("gameDate"),
                    "home": meta.get("atVs") == "vs",
                    "opponent": {"abbr": opp.get("abbreviation"), "name": opp.get("displayName"),
                                 "logo": _logo_path(opp.get("abbreviation"))},
                    "result": meta.get("gameResult"),
                    "score": meta.get("score"),
                    "min": _num(vals.get("minutes")),
                    "pts": _num(vals.get("points")),
                    "reb": _num(vals.get("totalRebounds")),
                    "ast": _num(vals.get("assists")),
                    "stl": _num(vals.get("steals")),
                    "blk": _num(vals.get("blocks")),
                    "tov": _num(vals.get("turnovers")),
                    "pf": _num(vals.get("fouls")),
                    "fgm": fgm, "fga": fga, "fgPct": _num(vals.get("fieldGoalPct")),
                    "fg3m": f3m, "fg3a": f3a, "fg3Pct": _num(vals.get("threePointPct")),
                    "ftm": ftm, "fta": fta, "ftPct": _num(vals.get("freeThrowPct")),
                })
    games.sort(key=lambda g: g["date"] or "", reverse=True)
    return {"playerId": player_id, "season": config.SEASON_LABEL, "games": games}


# --- статистика команды и места в лиге ---------------------------------------

TEAM_METRICS = {
    # наш ключ: (имя у ESPN, больше = лучше?)
    "pts": ("avgPoints", True),
    "reb": ("avgRebounds", True),
    "ast": ("avgAssists", True),
    "stl": ("avgSteals", True),
    "blk": ("avgBlocks", True),
    "fgPct": ("fieldGoalPct", True),
    "fg3Pct": ("threePointFieldGoalPct", True),
    "ftPct": ("freeThrowPct", True),
    "tov": ("avgTurnovers", False),
    "fga": ("avgFieldGoalsAttempted", None),
    "fg3a": ("avgThreePointFieldGoalsAttempted", None),
    "fgaTotal": ("fieldGoalsAttempted", None),
    "fg3aTotal": ("threePointFieldGoalsAttempted", None),
    "gp": ("gamesPlayed", None),
}


def parse_team_stats_league(raw: dict) -> dict:
    _check_season(raw, "статистика команд", key="requestedSeason")
    cats = raw.get("categories") or []
    teams = raw.get("teams") or []
    if len(teams) < 30:
        raise SourceError(f"статистика команд: в ответе {len(teams)} команд вместо 30")
    table = {}
    for t in teams:
        abbr = (t.get("team") or {}).get("abbreviation")
        vals = {}
        for i, cat in enumerate(cats):
            names = cat.get("names")
            if not names or i >= len(t.get("categories", [])):
                continue  # категории без names — показатели соперников
            tv = t["categories"][i].get("values") or []
            for n, v in zip(names, tv):
                vals.setdefault(n, v)
        table[abbr] = {k: _num(vals.get(src)) for k, (src, _) in TEAM_METRICS.items()}
    us = table.get(config.ESPN_TEAM_ABBR)
    if not us:
        raise SourceError("статистика команд: нет ГСВ в ответе")
    ranks = {}
    for k, (_, higher) in TEAM_METRICS.items():
        if higher is None or us.get(k) is None:
            continue
        mine = us[k]
        vals = [row[k] for row in table.values() if row.get(k) is not None]
        better = sum(1 for v in vals if (v > mine if higher else v < mine))
        same = sum(1 for v in vals if v == mine)
        ranks[k] = {"rank": better + 1, "of": len(vals), "tied": same > 1}
    return {"season": config.SEASON_LABEL, "team": us, "ranks": ranks, "teamsCount": len(table)}


# --- таблица ------------------------------------------------------------------

def parse_standings(raw: dict) -> dict:
    conf = next((c for c in raw.get("children", []) if c.get("name") == config.CONFERENCE), None)
    if not conf:
        raise SourceError("таблица: нет Западной конференции в ответе")
    s = conf.get("standings") or {}
    if s.get("season") != Y:
        raise SourceError(f"таблица: источник отдал сезон {s.get('season')} вместо {config.SEASON_LABEL}")
    entries = []
    for e in s.get("entries", []):
        st = {x.get("name"): x for x in e.get("stats", [])}

        def v(name, disp=False):
            x = st.get(name) or {}
            return x.get("displayValue") if disp else _num(x.get("value"))

        entries.append({
            "seed": v("playoffSeed"),
            "team": _team_brief(e.get("team") or {}),
            "wins": v("wins"),
            "losses": v("losses"),
            "pct": v("winPercent"),
            "gb": v("gamesBehind"),
            "streak": v("streak", True),
            "last10": (st.get("Last Ten Games") or {}).get("summary") or v("Last Ten Games", True),
            "home": (st.get("Home") or {}).get("summary") or v("Home", True),
            "road": (st.get("Road") or {}).get("summary") or v("Road", True),
        })
    if len(entries) != 15:
        raise SourceError(f"таблица: на Западе {len(entries)} команд вместо 15")
    # Порядок мест. ВАЖНО (проверено 11.11.2026): при равенстве побед/поражений ESPN
    # (playoffSeed — «прогноз BPI») и NBA.com расставляют команды по-разному.
    # Поэтому: сортируем по % побед, внутри равенства — как у ESPN, но место
    # показываем ДИАПАЗОНОМ («3–6-е») и списком команд, с которыми ГСВ делит баланс.
    entries.sort(key=lambda x: (-_pct(x), x["seed"] if x["seed"] is not None else 99))
    for i, e in enumerate(entries, 1):
        e["pos"] = i
        same = [o for o in entries if _pct(o) == _pct(e)]
        e["placeLo"] = 1 + sum(1 for o in entries if _pct(o) > _pct(e))
        e["placeHi"] = e["placeLo"] + len(same) - 1
        e["tiedWith"] = [o["team"]["abbr"] for o in same if o is not e]
        e.pop("seed", None)
    return {"season": config.SEASON_LABEL, "conference": "West", "entries": entries,
            "gsw": gsw_position(entries),
            "tieNote": "При равном балансе порядок определяют правила НБА (личные встречи и др.); "
                       "источник их не отдаёт, поэтому для таких команд показан общий диапазон мест."}


def _pct(e: dict) -> Fraction:
    w, l = e.get("wins") or 0, e.get("losses") or 0
    return Fraction(w, w + l) if (w + l) else Fraction(0)


def games_between(a: dict, b: dict) -> float:
    """На сколько матчей команда b позади команды a (стандартная формула НБА)."""
    return ((a["wins"] - b["wins"]) + (b["losses"] - a["losses"])) / 2


def _zone_of(place: int) -> str:
    if place <= config.PLAYOFF_SEEDS[1]:
        return "playoff"
    if place <= config.PLAYIN_SEEDS[1]:
        return "playin"
    return "out"


def gsw_position(entries: list[dict]) -> dict | None:
    """Где ГСВ и сколько матчей до каждой зоны. Считается по балансу побед/поражений,
    поэтому не зависит от того, как источник разбил равенство."""
    me = next((e for e in entries if e["team"]["abbr"] == config.ESPN_TEAM_ABBR), None)
    if not me:
        return None
    lo, hi = me["placeLo"], me["placeHi"]
    z_lo, z_hi = _zone_of(lo), _zone_of(hi)
    out = {"placeLo": lo, "placeHi": hi, "tiedWith": me["tiedWith"],
           "zone": z_lo if z_lo == z_hi else "boundary", "zones": sorted({z_lo, z_hi})}
    po, pi = config.PLAYOFF_SEEDS[1], config.PLAYIN_SEEDS[1]
    sixth, seventh = entries[po - 1], entries[po] if len(entries) > po else None
    tenth, eleventh = entries[pi - 1], entries[pi] if len(entries) > pi else None
    # До зоны плей-офф: отставание от 6-го места (0 — вровень) или запас над 7-м.
    if hi > po:
        out["behindPlayoff"] = games_between(sixth, me)
    elif seventh is not None:
        out["aheadOfPlayin"] = games_between(me, seventh)
    # До зоны плей-ин: отставание от 10-го или запас над 11-м.
    if hi > pi:
        out["behindPlayin"] = games_between(tenth, me)
    elif eleventh is not None:
        out["aheadOfOut"] = games_between(me, eleventh)
    return out


# --- новости ------------------------------------------------------------------

def parse_news(raw: dict) -> list[dict]:
    arts = raw.get("articles")
    if arts is None:
        raise SourceError("новости ESPN: неожиданный формат ответа")
    out = []
    for a in arts:
        url = ((a.get("links") or {}).get("web") or {}).get("href")
        if not url or not a.get("headline"):
            continue
        out.append({
            "title": a.get("headline"),
            "date": a.get("published") or a.get("lastModified"),
            "url": url,
            "text": a.get("description") or "",
            "source": "ESPN",
            "lang": "en",
            "kind": a.get("type"),
            "image": ((a.get("images") or [{}])[0]).get("url"),
            "tags": [c.get("description") for c in a.get("categories", []) if c.get("description")],
        })
    return out


def us_date(dt_iso: str) -> str:
    """Дата матча по времени США (для запроса табло дня), формат YYYYMMDD."""
    from zoneinfo import ZoneInfo
    dt = datetime.fromisoformat(dt_iso.replace("Z", "+00:00"))
    return dt.astimezone(ZoneInfo("America/New_York")).strftime("%Y%m%d")


def fetch_json_url(url: str) -> dict:
    return fetch_json(url)
