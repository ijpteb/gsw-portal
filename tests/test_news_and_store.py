"""Тесты RSS, категорий новостей и хранилища (последняя сохранённая версия при сбое)."""
import json
import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

from collector import news, store
from collector.http import SourceError
from collector.run import Runner
from collector.sources import rss

FX = Path(__file__).parent / "fixtures"


class Rss(unittest.TestCase):
    def test_gsom(self):
        feed = rss.FEEDS[0]
        items = rss.parse_feed((FX / "rss_goldenstateofmind.xml").read_text(encoding="utf-8"), feed)
        self.assertEqual(len(items), 10)
        # полный текст статьи не копируем — только начало
        self.assertTrue(all(len(i["text"]) <= rss.MAX_TEXT + 2 for i in items))
        self.assertTrue(items[0]["date"].startswith("2026-11-10"))

    def test_sportexpress_only_gsw(self):
        feed = rss.FEEDS[1]
        items = rss.parse_feed((FX / "rss_sportexpress.xml").read_text(encoding="utf-8"), feed)
        self.assertGreaterEqual(len(items), 1)
        for i in items:
            self.assertRegex(i["title"] + i["text"], feed["filter"])

    def test_broken_xml(self):
        with self.assertRaises(SourceError):
            rss.parse_feed("<html>not a feed", rss.FEEDS[0])


class Categories(unittest.TestCase):
    def test_rules(self):
        self.assertEqual(news.categorize("Richard tore the UCL in his left thumb"), "injury")
        self.assertEqual(news.categorize("Warriors acquire forward in three-team trade"), "trade")
        self.assertEqual(news.categorize("Kerr says Warriors need more from bench"), "interview")
        self.assertEqual(news.categorize("Warriors blow out Pelicans by 51 points"), "other")
        self.assertEqual(news.categorize("«Голден Стэйт» обыграл «Нью-Орлеан»"), "other")
        self.assertEqual(news.categorize("«Мы сделали то, что должны». Карри — о победе"), "interview")
        self.assertEqual(news.categorize("Карри пропустит матч из-за травмы"), "injury")

    def test_real_headlines(self):
        """Настоящие заголовки лент (10–11.11.2026): где категория неочевидна — «остальное»."""
        c = news.categorize
        # травмы
        self.assertEqual(c("Warriors lose guard Brandon Williams to mild hamstring strain", "", "HeadlineNews"), "injury")
        self.assertEqual(c("Warriors guard Will Richard out indefinitely with ligament tear in thumb"), "injury")
        self.assertEqual(c("Warriors vs. Pelicans injury report: No Zion Williamson or Trey Murphy III"), "injury")
        self.assertEqual(c("Warriors' Kristaps Porzingis to 'step away,' prioritize health", "", "HeadlineNews"), "injury")
        # финт «ankle-breaker» — не травма; вопрос «сыграет ли» без травмы — неочевидно
        self.assertEqual(c("Curry's ankle-breaker on Luka highlights Warriors' stunning 25-point comeback", "", "HeadlineNews"), "other")
        self.assertEqual(c("Will Jordan Poole play vs Warriors as Pelicans come to Chase?",
                           "He isn’t on the Pelicans’ injury report. He just sat"), "other")
        # обмены: по тексту статьи
        self.assertEqual(c("Warriors won’t give up picks for Myles Turner",
                           "The Golden State Warriors would like to trade Kristaps Porzingis by December 15."), "trade")
        self.assertEqual(c("What are the Warriors' options as Kristaps Porzingis remains away from the team?",
                           "Can the Warriors find a trade partner? Void Kristaps Porzingis' contract?", "Story"), "trade")
        # «продлили победную серию» — не продление контракта
        self.assertEqual(c("«Голден Стэйт» первым в истории НБА выиграл восемь матчей подряд после старта с трех поражений",
                           "«Уорриорз» разгромили «Нью-Орлеан» со счетом 138:87 и продлили победную серию до восьми игр."), "other")
        # отчёт о матче: «traded baskets» в тексте ничего не значит
        self.assertEqual(c("Warriors beat Suns", "The teams traded baskets late in the fourth.", "Recap"), "other")
        # мнения ведущих ESPN и «по данным источников» — не интервью
        self.assertEqual(c("Stephen A. says the championship window is STILL OPEN for Steph Curry & the Warriors", "", "Media"), "other")
        self.assertEqual(c("Warriors withholding payments to Porzingis, sources say", "", "HeadlineNews"), "other")
        self.assertEqual(c("Kerr on Draymond ejection: 'He crossed the line'"), "interview")
        self.assertEqual(c("Карри: «Мы должны играть лучше в защите»"), "interview")

    def test_merge_dedup(self):
        a = {"title": "Same", "url": "https://x/1", "date": store.iso(store.now_utc()), "text": "", "source": "A"}
        b = dict(a, url="https://x/2")  # тот же заголовок — дубль
        out = news.merge([a], [b])
        self.assertEqual(len(out), 1)
        self.assertIn("id", out[0])


class Store(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_failure_keeps_previous_data(self):
        t0 = datetime(2026, 11, 10, 12, tzinfo=timezone.utc)
        store.save_ok("x", {"v": 1}, {"name": "S"}, data_dir=self.dir, when=t0)
        env = store.save_failure("x", "источник недоступен", data_dir=self.dir)
        self.assertEqual(env["status"], "stale")
        self.assertEqual(env["data"], {"v": 1})
        self.assertEqual(env["fetchedAt"], "2026-11-10T12:00:00Z")
        self.assertEqual(env["error"], "источник недоступен")
        # переживает «перезапуск»: читаем с диска заново
        self.assertEqual(store.load("x", self.dir)["data"], {"v": 1})

    def test_failure_without_data(self):
        env = store.save_failure("y", "нет связи", data_dir=self.dir)
        self.assertEqual(env["status"], "error")
        self.assertIsNone(env["data"])


class RunnerOffline(unittest.TestCase):
    """Все источники «отключены»: сборщик не падает, прошлые данные остаются с их датой."""

    def test_all_sources_down(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            t0 = datetime(2026, 11, 10, 12, tzinfo=timezone.utc)
            store.save_ok("standings", {"entries": [1]}, {"name": "ESPN"}, data_dir=d, when=t0)
            with mock.patch.dict(os.environ, {"GSW_BLOCK_HOSTS": "espn,goldenstateofmind,sport-express"}):
                r = Runner(force=True, data_dir=d, img_dir=d / "img", log=lambda *_: None)
                res = r.run()
            st = store.load("standings", d)
            self.assertEqual(st["status"], "stale")
            self.assertEqual(st["data"], {"entries": [1]})
            self.assertEqual(st["fetchedAt"], "2026-11-10T12:00:00Z")
            self.assertIn("отключён для проверки", st["error"])
            self.assertEqual(store.load("schedule", d)["status"], "error")
            self.assertIsNone(store.load("schedule", d)["data"])
            status = store.load("status", d)["data"]
            self.assertEqual(status["datasets"]["standings"]["status"], "stale")
            self.assertTrue(all(not v.startswith("ok") for k, v in res.items()))


if __name__ == "__main__":
    unittest.main()
