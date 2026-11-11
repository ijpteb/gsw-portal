"""Замер задержки счёта (scripts/live_delay.py): ESPN → журнал дежурства → публикации сайта."""
import importlib.util
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from collector import run

spec = importlib.util.spec_from_file_location("live_delay", Path(__file__).parent.parent / "scripts" / "live_delay.py")
ld = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ld)

STEP = "collect\tДежурство — обновлять данные, пока не придёт следующий запуск\t"


def at(h, m, s=0):
    return datetime(2026, 11, 12, h, m, s, tzinfo=timezone.utc)


def play(t, gs, hou, kind="Jump Shot", scoring=True):
    return {"wallclock": f"{t:%Y-%m-%dT%H:%M:%SZ}", "awayScore": gs, "homeScore": hou, "scoringPlay": scoring,
            "period": {"number": 1}, "clock": {"displayValue": "11:30"}, "type": {"text": kind}}


def log_line(t, text):
    return f"{STEP}{t:%Y-%m-%dT%H:%M:%S.%f}0Z {text}\n"


def pass_line(t, game):
    # как в collector/run.py → loop: «<время> live: ok (<live_note>), … | запросов: N»
    return log_line(t, f"{t:%Y-%m-%dT%H:%M:%SZ} live: ok ({run.live_note(game)}), schedule: ok | запросов: 2")


class LiveDelay(unittest.TestCase):
    def setUp(self):
        # ГСВ в гостях (как 12.11.2026 @HOU): счёт ГСВ — awayScore
        self.summary = {"header": {"competitions": [{"competitors": [
            {"id": "10", "homeAway": "home", "team": {"id": "10"}},
            {"id": "9", "homeAway": "away", "team": {"id": "9"}}]}]},
            "plays": [play(at(2, 40), 0, 0, "Jumpball", False),
                      play(at(2, 40, 30), 2, 0),
                      play(at(2, 41, 10), 2, 2),
                      play(at(2, 42), 3, 2, "Free Throw - 1 of 2"),
                      play(at(2, 42, 40), 4, 2, "Free Throw - 2 of 2"),
                      play(at(2, 42, 20), 4, 2, "Substitution", False),  # время раньше штрафного — как у ESPN
                      play(at(5, 0), 4, 2, "End Game", False)]}
        seen = [(at(2, 40, 50), 2, 0, "11:40 - 1st"), (at(2, 41, 50), 2, 2, "11:00 - 1st"),
                (at(2, 42, 50), 4, 2, "10:05 - 1st"), (at(5, 0, 40), 4, 2, "Final")]
        self.lines = [log_line(at(1, 45, 10), "Скоро матч, а дежурства на весь матч не хватит — уступаю смену свежему запуску."),
                      log_line(at(1, 45, 11), '\x1b[36;1m  echo "Следующего запуска в очереди нет — ставлю его сам."\x1b[0m'),
                      log_line(at(1, 45, 12), "Следующего запуска в очереди нет — ставлю его сам."),
                      # строка настоящего журнала (11.11.2026) — проход без матча
                      STEP + "2026-11-12T02:20:05.7837623Z 2026-11-12T02:20:05Z schedule: ok | запросов: 1\n",
                      pass_line(at(2, 25), {"state": "pre", "shortDetail": "11/11 - 9:30 PM EST", "score": {}})]
        self.lines += [pass_line(t, {"score": {"team": gs, "opp": hou}, "shortDetail": d}) for t, gs, hou, d in seen]
        self.deploys = [{"databaseId": i, "createdAt": f"{t + timedelta(seconds=3):%Y-%m-%dT%H:%M:%SZ}",
                         "updatedAt": f"{t + timedelta(seconds=25):%Y-%m-%dT%H:%M:%SZ}",
                         "status": "completed", "conclusion": "success"} for i, (t, *_) in enumerate(seen)]
        self.deploys.append({"databaseId": 99, "createdAt": "2026-11-12T02:42:52Z", "updatedAt": "2026-11-12T02:43:05Z",
                             "status": "completed", "conclusion": "failure"})  # упала — счёт принесла следующая

    def measure(self):
        passes, events, span = ld.read_log(self.lines)
        self.span = span
        return ld.measure(ld.plays(self.summary), passes, ld.deploys(self.deploys)), passes, events

    def test_log_parsing(self):
        _, passes, events = self.measure()
        self.assertEqual(len(passes), 6)
        self.assertEqual([(p["team"], p["opp"]) for p in passes][:2], [(None, None), (None, None)])
        self.assertEqual([m[:10] for _, m in events], ["Скоро матч", "Следующего"])  # «echo …» — не событие
        self.assertEqual([p["live"] for p in passes], [False, True, True, True, True, True])
        self.assertEqual(self.span, (at(1, 45, 10), at(5, 0, 40)))

    def test_delays(self):
        res, _, _ = self.measure()
        self.assertEqual([r["to_collector"] for r in res["rows"]], [20, 40, 50, 30])  # 4:2 — с замены в 02:42:20
        self.assertEqual([r["to_site"] for r in res["rows"]], [45, 65, 75, 55])      # упавшая публикация пропущена
        self.assertEqual(res["to_collector"]["median"], 35)
        self.assertEqual(res["final"]["t"], at(5, 0, 40))
        self.assertEqual(res["final_deploy"]["done"], at(5, 1, 5))
        self.assertEqual(res["deploys"], {"failure": 1, "success": 4})
        # перерывы — только между проходами с live (строку прохода без обновлений сборщик не пишет);
        # в тесте проходы редкие: 02:25→02:40 и от 1-й четверти до конца
        self.assertEqual([round(g) for _, _, g in res["gaps"]], [950, 8270])
        spans = [(at(1, 0), at(1, 45, 30)), (at(1, 46, 40), at(5, 30))]
        text = "\n".join(ld.report(res, self.measure()[2], rows=True, spans=spans))
        self.assertIn("пересменка 01:45:30→01:46:40 (70 с)", text)
        self.assertIn("медиана 35 с", text)
        self.assertIn("Финальный счёт 4:2", text)


if __name__ == "__main__":
    unittest.main()
