"""Локальный просмотр сайта: отдаёт папку site/ без кэширования (после правок видна свежая версия).

Запуск из папки проекта: python3 scripts/dev_server.py [порт]  →  http://localhost:8765
"""
import functools
import http.server
import pathlib
import sys

SITE = pathlib.Path(__file__).resolve().parent.parent / "site"


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    handler = functools.partial(NoCacheHandler, directory=str(SITE))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as srv:
        print(f"Сайт: http://localhost:{port}  (остановить — Ctrl+C)", flush=True)
        srv.serve_forever()


if __name__ == "__main__":
    main()
