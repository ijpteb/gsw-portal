"""Сбор расписания: плей-ин и плей-офф спрашиваем только с весны и не теряем их при сбое источника."""
import copy
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

from collector import run, store
from collector.http import SourceError
from collector.sources import espn

FX = Path(__file__).parent / "fixtures"


def fx(name):
    return json.loads((FX / name).read_text(encoding="utf-8"))


def as_2027(raw):
    """Настоящий ответ ESPN за весну 2025, перенесённый на 2027 год (формат тот же, меняются год и даты)."""
    raw = copy.deepcopy(raw)
    raw["requestedSeason"]["year"] = 2027
    for e in raw["events"]:
        e["date"] = "2027" + e["date"][4:]
    return raw


class ScheduleTask(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.regular = fx("espn_schedule.json")

    def tearDown(self):
        self.tmp.cleanup()

    def runner(self, when):
        return run.Runner(data_dir=self.dir, img_dir=self.dir / "img", now=when, log=lambda *_: None)

    def collect(self, when, postseason):
        r = self.runner(when)
        with mock.patch.object(espn, "fetch", return_value=self.regular), \
                mock.patch.object(espn, "fetch_json_url", side_effect=postseason) as get:
            r.task_schedule()
        return r, get, store.load("schedule", self.dir)

    def test_autumn_no_postseason_requests(self):
        _, get, env = self.collect(datetime(2026, 11, 11, 12, tzinfo=timezone.utc), postseason=AssertionError)
        get.assert_not_called()
        self.assertEqual(env["status"], "ok")
        self.assertEqual(env["data"]["postseason"]["checked"], False)
        self.assertEqual(env["data"]["postseason"]["games"], [])
        self.assertEqual(len(env["data"]["games"]), 80)

    def test_spring_postseason_collected(self):
        playin, playoffs = as_2027(fx("espn_schedule_playin_2025.json")), as_2027(fx("espn_schedule_playoffs_2025.json"))

        def answer(url):
            return playin if url.endswith("seasontype=5") else playoffs
        when = datetime(2027, 4, 15, 20, tzinfo=timezone.utc)  # за 6 ч до матча плей-ин (16.04 02:00 UTC)
        r, get, env = self.collect(when, postseason=answer)
        self.assertEqual(get.call_count, 2)
        post = env["data"]["postseason"]
        self.assertTrue(post["checked"])
        self.assertIsNone(post["error"])
        self.assertEqual([g["stage"] for g in post["games"]], ["playin"] + ["playoffs"] * 12)
        # день матча и окно «матч может идти» видят и матчи плей-ин / плей-офф
        self.assertEqual(len(r.games()), 80 + 13)
        self.assertTrue(r.is_gameday())

    def test_source_failure_keeps_previous_postseason(self):
        playin = as_2027(fx("espn_schedule_playin_2025.json"))
        empty = fx("espn_schedule_postseason_empty.json")
        when = datetime(2027, 4, 12, tzinfo=timezone.utc)
        self.collect(when, postseason=lambda url: playin if url.endswith("seasontype=5") else empty)

        def broken(url):
            raise SourceError("таймаут")
        later = datetime(2027, 4, 12, 2, tzinfo=timezone.utc)
        _, _, env = self.collect(later, postseason=broken)
        post = env["data"]["postseason"]
        self.assertEqual(env["status"], "ok")  # регулярный чемпионат обновился как обычно
        self.assertEqual(len(post["games"]), 1)  # плей-ин остался от прошлого раза
        self.assertTrue(post["checked"])
        self.assertIn("таймаут", post["error"])
        self.assertEqual(post["fetchedAt"], store.iso(when))


class LiveTask(unittest.TestCase):
    """Идёт матч: счёт попадает и в live.json, и в строку журнала дежурства (по ней замеряем задержку)."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.raw = fx("espn_schedule.json")
        store.save_ok("schedule", espn.parse_schedule(self.raw), {"name": "ESPN", "url": None},
                      data_dir=self.dir, when=datetime(2026, 11, 11, 21, tzinfo=timezone.utc))

    def tearDown(self):
        self.tmp.cleanup()

    def scoreboard(self, state, detail, gs=None, hou=None):
        """Настоящее событие календаря ESPN (12.11.2026 @HOU) в нужном состоянии — как на табло дня."""
        ev = copy.deepcopy(next(e for e in self.raw["events"] if e["id"] == "401909974"))
        c = ev["competitions"][0]
        c["status"]["type"].update({"state": state, "shortDetail": detail})
        for comp in c["competitors"]:
            pts = gs if comp["id"] == "9" else hou
            if pts is not None:
                comp["score"] = {"value": float(pts), "displayValue": str(pts)}
        return {"events": [ev]}

    def live(self, board):
        r = run.Runner(data_dir=self.dir, img_dir=self.dir / "img",
                       now=datetime(2026, 11, 12, 3, tzinfo=timezone.utc), log=lambda *_: None)
        with mock.patch.object(espn, "fetch_json_url", return_value=board):
            state = r.task_live()
        return r, state

    def test_score_in_log(self):
        r, state = self.live(self.scoreboard("in", "5:12 - 2nd", gs=54, hou=50))
        self.assertEqual(state, "in")
        self.assertEqual(r.results["live"], "ok (54:50, 5:12 - 2nd)")
        self.assertEqual(store.load("live", self.dir)["data"]["game"]["score"], {"team": 54, "opp": 50})

    def test_not_started(self):
        r, state = self.live(self.scoreboard("pre", "11/11 - 9:30 PM EST"))
        self.assertEqual(state, "pre")
        self.assertEqual(r.results["live"], "ok (11/11 - 9:30 PM EST)")

    def test_source_failure_has_no_score(self):
        r = run.Runner(data_dir=self.dir, img_dir=self.dir / "img",
                       now=datetime(2026, 11, 12, 3, tzinfo=timezone.utc), log=lambda *_: None)
        with mock.patch.object(espn, "fetch_json_url", side_effect=SourceError("таймаут")):
            self.assertIsNone(r.task_live())
        self.assertNotIn("ok", r.results["live"])


if __name__ == "__main__":
    unittest.main()
