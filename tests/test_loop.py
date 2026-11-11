"""Дежурство сборщика (python3 -m collector loop): публикует только изменения,
передаёт дежурство следующему запуску, не падает от единичного сбоя."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from collector import http, run, store


class FakeClock:
    def __init__(self):
        self.t = 0.0
        self.sleeps = []

    def __call__(self):
        return self.t

    def sleep(self, s):
        self.sleeps.append(s)
        self.t += s


class FakeRunner:
    """Проход, который «получил» данные с заданным отпечатком (или упал, если отпечаток — исключение)."""

    def __init__(self, fp):
        self.fp = fp
        self.last_fingerprint = None

    def run(self):
        if isinstance(self.fp, Exception):
            raise self.fp
        self.last_fingerprint = self.fp
        return {}


def runners(*fps, firsts=None):
    it = iter(fps)

    def make(first):
        if firsts is not None:
            firsts.append(first)
        return FakeRunner(next(it))
    return make


class Loop(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        (self.dir / "fingerprint.txt").write_text("A", encoding="utf-8")  # уже опубликовано
        self.clock = FakeClock()
        self.published = []

    def tearDown(self):
        self.tmp.cleanup()

    def loop(self, make, handover=lambda: False, publish=None, **kw):
        def default_publish():
            self.published.append(True)
            return True
        return run.loop(after_update=publish or default_publish, handover=handover, make_runner=make,
                        data_dir=self.dir, log=lambda *_: None, sleep=self.clock.sleep, clock=self.clock,
                        **kw)

    def test_publishes_only_changes_and_hands_over(self):
        checks = iter([False, False, False, True])
        reason = self.loop(runners("A", "B", "B", "C"), handover=lambda: next(checks))
        self.assertEqual(reason, "handover")
        self.assertEqual(len(self.published), 2)   # B и C; повторный B и уже опубликованный A — нет
        self.assertEqual(len(self.clock.sleeps), 3)

    def test_failed_publish_is_retried(self):
        results = iter([False, True])
        calls = []

        def publish():
            calls.append(1)
            return next(results)
        checks = iter([False, True])
        self.loop(runners("B", "B"), handover=lambda: next(checks), publish=publish)
        self.assertEqual(len(calls), 2)

    def test_time_limit(self):
        reason = self.loop(runners(*["A"] * 10), max_minutes=3, tick=60)
        self.assertEqual(reason, "time")
        self.assertEqual(self.clock.sleeps, [60, 60, 60])

    def test_tick_counts_from_pass_start(self):
        class Slow(FakeRunner):
            def run(inner):
                self.clock.t += 20  # проход занял 20 с
                return super().run()
        checks = iter([False, True])
        it = iter(["A", "A"])
        self.loop(lambda first: Slow(next(it)), handover=lambda: next(checks), tick=60)
        self.assertEqual(self.clock.sleeps, [40])

    def test_force_only_on_first_pass(self):
        firsts = []
        checks = iter([False, False, True])
        self.loop(runners("A", "A", "A", firsts=firsts), handover=lambda: next(checks))
        self.assertEqual(firsts, [True, False, False])

    def test_single_crash_does_not_stop(self):
        checks = iter([True])
        reason = self.loop(runners(RuntimeError("сбой"), "B"), handover=lambda: next(checks))
        self.assertEqual(reason, "handover")
        self.assertEqual(len(self.published), 1)

    def test_repeated_crashes_stop_with_error(self):
        reason = self.loop(runners(*[RuntimeError("сбой")] * run.LOOP_MAX_CRASHES))
        self.assertEqual(reason, "error")

    def test_no_handover_during_game(self):
        class Live(FakeRunner):
            def __init__(inner, fp, state):
                super().__init__(fp)
                inner.live_state = state
        states = iter(["pre", "in", "in", "post"])
        asked = []

        def handover():  # следующий запуск ждёт в очереди всё время
            asked.append(1)
            return True
        reason = self.loop(lambda first: Live("A", next(states)), handover=handover)
        self.assertEqual(reason, "handover")
        self.assertEqual(len(asked), 1)              # спросили только после конца матча
        self.assertEqual(len(self.clock.sleeps), 3)  # три прохода до и во время матча

    def test_time_limit_during_game(self):
        class Live(FakeRunner):
            live_state = "in"
        reason = self.loop(lambda first: Live("A"), handover=lambda: True, max_minutes=2, tick=60)
        self.assertEqual(reason, "time")

    def test_handover_command(self):
        self.assertTrue(run._succeeds("exit 0"))
        self.assertFalse(run._succeeds("exit 1"))
        self.assertFalse(run._succeeds("command-that-does-not-exist-gsw 2>/dev/null"))


class LoopOffline(unittest.TestCase):
    """Настоящий сборщик, все источники «отключены»: первый проход публикует, второй — нечего."""

    def test_real_runner(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            clock, published = FakeClock(), []
            checks = iter([False, True])
            with mock.patch.dict(os.environ, {"GSW_BLOCK_HOSTS": "espn,goldenstateofmind,sport-express"}):
                reason = run.loop(after_update=lambda: published.append(1) or True,
                                  handover=lambda: next(checks), force=True,
                                  data_dir=d, img_dir=d / "img", log=lambda *_: None,
                                  sleep=clock.sleep, clock=clock)
            self.assertEqual(reason, "handover")
            self.assertEqual(len(published), 1)
            self.assertEqual(store.load("schedule", d)["status"], "error")
            self.assertTrue((d / "fingerprint.txt").read_text())


class RequestProblems(unittest.TestCase):
    def test_only_failed_and_slow(self):
        log = [("https://site.api.espn.com/a", 200, 0.4), ("https://site.api.espn.com/b", 200, 7.25),
               ("https://www.sport-express.ru/c", "TimeoutError", 25.0), ("https://x.example/d", 404, 0.2)]
        with mock.patch.object(http, "REQUEST_LOG", log):
            self.assertEqual(http.problems(), ["site.api.espn.com 200 7.2 с",
                                               "www.sport-express.ru TimeoutError 25.0 с",
                                               "x.example 404 0.2 с"])


class Logos(unittest.TestCase):
    def test_big_gsw_logo(self):
        from collector import images
        calls = []
        with mock.patch.object(images, "save_image", lambda src, dest, w, h, force=False: calls.append((dest.name, w)) or True):
            ok, total = images.cache_logos([{"abbr": "GS", "src": "x"}, {"abbr": "HOU", "src": "y"}], Path("/tmp/i"))
        self.assertEqual((ok, total), (2, 2))
        self.assertEqual(calls, [("gs.png", 200), ("gs-500.png", 500), ("hou.png", 200)])


if __name__ == "__main__":
    unittest.main()
