"""Проверки кода сайта (site/), которые не требуют браузера."""
import pathlib
import re
import unittest

SITE = pathlib.Path(__file__).resolve().parent.parent / "site"
IMPORT_RE = re.compile(r"""(?:from|import)\s+['"]([^'"]+)['"]""")


class SiteCode(unittest.TestCase):
    def js_files(self):
        files = sorted((SITE / "js").rglob("*.js"))
        self.assertTrue(files)
        return files

    def test_imports_are_versioned_and_exist(self):
        # Версия в адресе (?v=__V__, при публикации — номер коммита) не даёт браузеру смешать старый и новый код.
        for f in self.js_files():
            for spec in IMPORT_RE.findall(f.read_text(encoding="utf-8")):
                with self.subTest(file=f.name, spec=spec):
                    self.assertTrue(spec.startswith("."), "только свои модули, без внешних библиотек")
                    self.assertTrue(spec.endswith(".js?v=__V__"), "у импорта нет ?v=__V__")
                    target = (f.parent / spec.split("?")[0]).resolve()
                    self.assertTrue(target.is_file(), f"нет файла {target}")

    def test_page_assets_are_versioned(self):
        html = (SITE / "index.html").read_text(encoding="utf-8")
        self.assertIn('href="css/app.css?v=__V__"', html)
        self.assertIn('src="js/app.js?v=__V__"', html)

    def test_no_innerhtml_for_data(self):
        # Данные вставляются только как текст; innerHTML — лишь в ui.icon() для своих SVG-констант.
        risky = re.compile(r"(?:inner|outer)HTML\s*\+?=|insertAdjacentHTML|document\.write")
        uses = {f.name: len(risky.findall(f.read_text(encoding="utf-8"))) for f in self.js_files()}
        self.assertEqual({k: v for k, v in uses.items() if v}, {"ui.js": 1})


if __name__ == "__main__":
    unittest.main()
