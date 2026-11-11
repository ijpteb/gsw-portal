"""Тесты разбора ESPN на НАСТОЯЩИХ сохранённых ответах (tests/fixtures/espn_*.json, 10–11.11.2026).

Если ESPN поменял формат: сохраните свежий ответ в fixtures (python3 tests/check_sources.py --save),
почините collector/sources/espn.py и прогоните: python3 -m unittest discover -s tests
Ожидаемые числа ниже сверены с NBA.com 11.11.2026.
"""
import json
import unittest
from pathlib import Path

from collector.http import SourceError
from collector.sources import espn

FX = Path(__file__).parent / "fixtures"


def fx(name):
    return json.loads((FX / name).read_text(encoding="utf-8"))


class Schedule(unittest.TestCase):
    def setUp(self):
        self.d = espn.parse_schedule(fx("espn_schedule.json"))

    def test_season_and_count(self):
        self.assertEqual(self.d["season"], "2026-27")
        self.assertEqual(len(self.d["games"]), 80)
        self.assertEqual(self.d["missingGames"], 2)  # 2 матча Кубка НБА ещё не назначены

    def test_last_completed_game(self):
        done = [g for g in self.d["games"] if g["completed"]]
        last = done[-1]
        self.assertEqual(last["opponent"]["abbr"], "NO")
        self.assertEqual(last["score"], {"team": 138, "opp": 87})
        self.assertEqual(last["result"], "W")
        self.assertTrue(last["home"])
        self.assertEqual(last["venue"]["name"], "Chase Center")

    def test_next_game(self):
        nxt = next(g for g in self.d["games"] if not g["completed"])
        self.assertEqual(nxt["opponent"]["abbr"], "HOU")
        self.assertEqual(nxt["date"], "2026-11-12T02:30Z")
        self.assertFalse(nxt["home"])
        self.assertIsNone(nxt["score"])  # у предстоящего матча счёта нет (не 0:0!)
        self.assertEqual(nxt["state"], "pre")

    def test_first_game_result(self):
        g = self.d["games"][0]
        self.assertEqual((g["opponent"]["abbr"], g["score"], g["result"]), ("LAL", {"team": 105, "opp": 127}, "L"))

    def test_cup_games_marked(self):
        self.assertTrue(any(g["cup"] for g in self.d["games"]))

    def test_wrong_season_rejected(self):
        raw = fx("espn_schedule.json")
        raw["requestedSeason"]["year"] = 2026
        raw["season"]["year"] = 2026
        with self.assertRaises(SourceError):
            espn.parse_schedule(raw)

    def test_empty_rejected(self):
        raw = fx("espn_schedule.json")
        raw["events"] = []
        with self.assertRaises(SourceError):
            espn.parse_schedule(raw)


class Roster(unittest.TestCase):
    def setUp(self):
        self.d = espn.parse_roster(fx("espn_roster.json"))
        self.by = {p["name"]: p for p in self.d["players"]}

    def test_count(self):
        self.assertEqual(len(self.d["players"]), 18)

    def test_curry(self):
        c = self.by["Stephen Curry"]
        self.assertEqual(c["jersey"], "30")
        self.assertEqual(c["position"], "G")
        self.assertEqual(c["heightCm"], 188)  # 6'2" = 74 дюйма
        self.assertEqual(c["birthDate"], "1988-03-14")
        self.assertEqual(c["id"], "3975")

    def test_injury_flag(self):
        self.assertEqual(self.by["Jimmy Butler III"]["injury"]["status"], "Out")
        self.assertIsNone(self.by["Stephen Curry"]["injury"])


class Injuries(unittest.TestCase):
    def test_parse(self):
        d = espn.parse_injuries(fx("espn_injuries_gs_only.json"))
        self.assertTrue(d["teamListed"])
        payton = d["players"]["3134903"]
        self.assertEqual(payton["status"], "Day-To-Day")
        self.assertEqual(payton["detail"]["type"], "Knee")


class PlayerStats(unittest.TestCase):
    def setUp(self):
        d = espn.parse_player_stats(fx("espn_player_stats.json"))
        self.by = {p["name"]: p["stats"] for p in d["players"]}

    def test_curry(self):
        s = self.by["Stephen Curry"]
        self.assertEqual(s["gp"], 9)
        self.assertAlmostEqual(s["pts"], 30.6, places=1)
        self.assertAlmostEqual(s["reb"], 4.1, places=1)
        self.assertAlmostEqual(s["ast"], 4.3, places=1)
        self.assertEqual(s["fgaTotal"], 157)
        self.assertEqual(s["fg3aTotal"], 92)
        self.assertEqual(s["blkTotal"], 1)

    def test_podziemski(self):
        s = self.by["Brandin Podziemski"]
        self.assertAlmostEqual(s["pts"], 16.8, places=1)
        self.assertAlmostEqual(s["reb"], 5.0, places=1)
        self.assertAlmostEqual(s["ast"], 4.2, places=1)


class TeamStats(unittest.TestCase):
    def test_ranks_match_nba_com(self):
        d = espn.parse_team_stats_league(fx("espn_team_stats_league.json"))
        self.assertEqual(d["teamsCount"], 30)
        self.assertAlmostEqual(d["team"]["pts"], 120.4, places=1)
        self.assertEqual(d["ranks"]["pts"]["rank"], 2)   # NBA.com: 2-е место по очкам
        self.assertEqual(d["ranks"]["reb"]["rank"], 14)  # 14-е по подборам
        self.assertEqual(d["ranks"]["ast"]["rank"], 3)   # 3-е по передачам


class Standings(unittest.TestCase):
    """Фикстура 10.11.2026: ГСВ, MIN и HOU — все 8–3."""

    def setUp(self):
        self.d = espn.parse_standings(fx("espn_standings.json"))

    def test_order_by_record(self):
        order = [e["team"]["abbr"] for e in self.d["entries"]]
        self.assertEqual(order[:3], ["LAL", "SA", "OKC"])
        self.assertEqual(set(order[3:6]), {"GS", "MIN", "HOU"})
        self.assertEqual(set(order[-2:]), {"SAC", "UTAH"})

    def test_gsw_row_and_tie_range(self):
        gs = next(e for e in self.d["entries"] if e["team"]["abbr"] == "GS")
        self.assertEqual((gs["wins"], gs["losses"], gs["gb"], gs["home"]), (8, 3, 1.5, "6-1"))
        self.assertEqual((gs["placeLo"], gs["placeHi"]), (4, 6))  # делит 4–6-е места
        self.assertEqual(set(gs["tiedWith"]), {"MIN", "HOU"})
        g = self.d["gsw"]
        self.assertEqual(g["zone"], "playoff")
        self.assertEqual(g["aheadOfPlayin"], 0.5)  # 7-е место MEM 7–3

    def test_tie_across_boundary(self):
        e = lambda abbr, w, l: {"team": {"abbr": abbr}, "wins": w, "losses": l}
        rows = [e("A%d" % i, 20 - i, i) for i in range(1, 6)] + [e("X6", 10, 10), e("GS", 10, 10)] + \
               [e("B%d" % i, 9 - i, 11 + i) for i in range(8, 16)]
        for i, r in enumerate(rows, 1):
            r["placeLo"] = 1 + sum(1 for o in rows if espn._pct(o) > espn._pct(r))
            r["placeHi"] = r["placeLo"] + sum(1 for o in rows if espn._pct(o) == espn._pct(r)) - 1
            r["tiedWith"] = []
        pos = espn.gsw_position(rows)
        self.assertEqual((pos["placeLo"], pos["placeHi"], pos["zone"]), (6, 7, "boundary"))
        self.assertEqual(pos["behindPlayoff"], 0)

    def test_distance_math(self):
        e = lambda abbr, w, l: {"team": {"abbr": abbr}, "wins": w, "losses": l}
        rows = [e("X%d" % i, 20 - i, i) for i in range(1, 16)]
        rows[11] = e("GS", 7, 13)
        rows.sort(key=lambda r: -espn._pct(r))
        for r in rows:
            r["placeLo"] = r["placeHi"] = 1 + sum(1 for o in rows if espn._pct(o) > espn._pct(r))
            r["tiedWith"] = []
        pos = espn.gsw_position(rows)
        self.assertEqual(pos["zone"], "out")
        self.assertEqual(pos["behindPlayoff"], ((14 - 7) + (13 - 6)) / 2)
        self.assertEqual(pos["behindPlayin"], ((10 - 7) + (13 - 10)) / 2)


class GameLog(unittest.TestCase):
    def test_curry_last_game(self):
        d = espn.parse_gamelog(fx("espn_gamelog_3975.json"), "3975")
        self.assertEqual(len(d["games"]), 9)  # только регулярка 2026-27, без предсезонки
        g = d["games"][0]
        self.assertEqual((g["pts"], g["min"], g["fgm"], g["fga"], g["blk"]), (25, 21, 6, 10, 0))
        self.assertEqual(g["opponent"]["abbr"], "NO")
        self.assertEqual(g["result"], "W")


class TeamAndScoreboard(unittest.TestCase):
    def test_team(self):
        t = espn.parse_team(fx("espn_team.json"))
        self.assertEqual(t["record"], "8-3")
        self.assertEqual(t["abbr"], "GS")

    def test_scoreboard_without_gsw(self):
        # 10.11.2026 ГСВ не играли — табло дня не должно выдумывать матч
        self.assertIsNone(espn.parse_scoreboard(fx("espn_scoreboard.json")))

    def test_us_date(self):
        self.assertEqual(espn.us_date("2026-11-12T02:30Z"), "20261111")


class News(unittest.TestCase):
    def test_parse(self):
        items = espn.parse_news(fx("espn_news.json"))
        self.assertGreater(len(items), 5)
        self.assertTrue(all(i["url"].startswith("http") for i in items))


if __name__ == "__main__":
    unittest.main()
