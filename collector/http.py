"""Сетевые запросы к источникам: таймауты, повторы, понятные ошибки."""
from __future__ import annotations

import json
import os
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request

from . import config


class SourceError(Exception):
    """Источник не ответил или ответил не тем. Текст — для человека (по-русски)."""


def _ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    # Python с python.org на macOS не видит системные сертификаты — подключаем их.
    if ctx.cert_store_stats().get("x509_ca", 0) == 0:
        for path in ("/etc/ssl/cert.pem", "/etc/ssl/certs/ca-certificates.crt"):
            if os.path.exists(path):
                ctx.load_verify_locations(path)
                break
    return ctx


_CTX = _ssl_context()

# Запросы за проход — чтобы видеть нагрузку на источники и их сбои:
# (адрес, код ответа или название ошибки, секунд).
REQUEST_LOG: list[tuple[str, int | str, float]] = []


def problems(slow: float = 5.0) -> list[str]:
    """Неудачные и медленные запросы из REQUEST_LOG — для журнала дежурства."""
    return [f"{urllib.parse.urlsplit(url).hostname} {status} {secs:.1f} с"
            for url, status, secs in REQUEST_LOG if status != 200 or secs >= slow]


def _blocked(url: str) -> bool:
    """Для проверки сбоев: GSW_BLOCK_HOSTS="espn.com,goldenstateofmind" отключает эти источники."""
    blocked = [h.strip() for h in os.environ.get("GSW_BLOCK_HOSTS", "").split(",") if h.strip()]
    return any(h in url for h in blocked)


def fetch_bytes(url: str, headers: dict | None = None, timeout: int | None = None) -> bytes:
    if _blocked(url):
        REQUEST_LOG.append((url, "blocked", 0.0))
        raise SourceError("источник недоступен (отключён для проверки)")
    hdrs = {"User-Agent": config.USER_AGENT, "Accept-Encoding": "identity"}
    if headers:
        hdrs.update(headers)
    last_err: Exception | None = None
    for attempt in range(config.HTTP_RETRIES + 1):
        req = urllib.request.Request(url, headers=hdrs)
        t0 = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=timeout or config.HTTP_TIMEOUT, context=_CTX) as resp:
                body = resp.read()
                REQUEST_LOG.append((url, resp.status, time.monotonic() - t0))
                return body
        except urllib.error.HTTPError as e:
            REQUEST_LOG.append((url, e.code, time.monotonic() - t0))
            last_err = e
            # 4xx (кроме 429) повторять бессмысленно
            if 400 <= e.code < 500 and e.code != 429:
                break
        except Exception as e:  # сеть, таймаут, SSL
            REQUEST_LOG.append((url, type(e).__name__, time.monotonic() - t0))
            last_err = e
        if attempt < config.HTTP_RETRIES:
            time.sleep(2 * (attempt + 1))
    raise SourceError(_describe(last_err))


def fetch_json(url: str, headers: dict | None = None) -> dict:
    body = fetch_bytes(url, headers)
    try:
        return json.loads(body)
    except ValueError:
        raise SourceError("источник прислал повреждённые данные (не JSON)")


def fetch_text(url: str, headers: dict | None = None) -> str:
    return fetch_bytes(url, headers).decode("utf-8", errors="replace")


def _describe(err: Exception | None) -> str:
    if isinstance(err, urllib.error.HTTPError):
        if err.code in (401, 403):
            return f"источник отказал в доступе (код {err.code})"
        if err.code == 404:
            return "источник не нашёл адрес (код 404) — возможно, он изменился"
        if err.code == 429:
            return "превышен лимит запросов к источнику (код 429)"
        return f"источник ответил ошибкой (код {err.code})"
    if isinstance(err, urllib.error.URLError):
        return f"источник недоступен ({err.reason})"
    if isinstance(err, TimeoutError):
        return "источник не ответил вовремя (таймаут)"
    return f"источник недоступен ({type(err).__name__ if err else 'неизвестно'})"
