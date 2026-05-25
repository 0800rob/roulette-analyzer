"""Live scraper for Evolution roulette tables via casino.org's public API.

We discovered the underlying JSON API used by casinoscores.com:

    https://api-cs.casino.org/svc-evolution-game-events/api/{table}
        ?page=0&size=N&sort=data.settledAt,desc&duration=6

Each item shape (relevant fields):
    {
        "id": "<event_id>",
        "data": {
            "id": "<round_id>",
            "settledAt": "2026-05-23T21:57:36.286Z",
            "result": { "outcome": { "number": 19, "color": "Red" } },
            "table":  { "name": "Auto Roulette" }
        }
    }

This module exposes:
    fetch_recent_spins(table_slug, size) -> list[dict]
A simple httpx GET — no browser needed since the API is plain JSON.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

API_HOST = "https://api-cs.casino.org"

# Slug used in the casino.org URL path (also the API path).
# Add new tables here when the user wants to track more.
SUPPORTED_TABLES: dict[str, dict[str, str]] = {
    "auto-roulette": {
        "slug": "autoroulette",
        "label": "Auto Roulette",
    },
    # Future entries (Lightning Roulette, Immersive, etc.) can be added here.
}

# Window (hours of history) requested from the API.
DEFAULT_DURATION = 6

# Browser-like headers — the API doesn't strictly require them but it's safer.
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Origin": "https://www.casino.org",
    "Referer": "https://www.casino.org/",
}


class ScraperError(RuntimeError):
    """Raised when the upstream API returns an unexpected response."""


def _api_url(slug: str, size: int, duration: int) -> str:
    return (
        f"{API_HOST}/svc-evolution-game-events/api/{slug}"
        f"?page=0&size={size}&sort=data.settledAt,desc&duration={duration}"
    )


def _normalise_event(raw: dict[str, Any]) -> dict[str, Any] | None:
    """Pull the bits we care about out of an API event, or None if malformed."""
    try:
        data = raw["data"]
        outcome = data["result"]["outcome"]
        return {
            "event_id": raw["id"],
            "round_id": data.get("id"),
            "settled_at": data["settledAt"],
            "number": int(outcome["number"]),
            "color": str(outcome.get("color", "")).lower() or None,
        }
    except (KeyError, TypeError, ValueError):
        logger.warning("Malformed event from API: %r", raw)
        return None


def fetch_recent_spins(
    table: str = "auto-roulette",
    size: int = 50,
    duration: int = DEFAULT_DURATION,
    timeout: float = 15.0,
) -> list[dict[str, Any]]:
    """Fetch the most recent settled spins for the given table.

    Args:
        table: key in SUPPORTED_TABLES.
        size: how many spins to request (newest first from the API).
        duration: hours of history window the API should consider.
        timeout: HTTP timeout in seconds.

    Returns:
        A list of dicts (newest first) with keys:
            event_id, round_id, settled_at, number, color
    """
    if table not in SUPPORTED_TABLES:
        raise ValueError(f"Unsupported table: {table!r}")

    slug = SUPPORTED_TABLES[table]["slug"]
    url = _api_url(slug, size=size, duration=duration)

    try:
        resp = httpx.get(url, headers=DEFAULT_HEADERS, timeout=timeout)
    except httpx.HTTPError as e:
        raise ScraperError(f"Network error fetching {url}: {e}") from e

    if resp.status_code != 200:
        raise ScraperError(
            f"Unexpected status {resp.status_code} from {url}: {resp.text[:200]}"
        )

    try:
        payload = resp.json()
    except ValueError as e:
        raise ScraperError(f"Non-JSON response from {url}: {e}") from e

    if not isinstance(payload, list):
        raise ScraperError(f"Expected a JSON array, got {type(payload).__name__}")

    out: list[dict[str, Any]] = []
    for raw in payload:
        normalised = _normalise_event(raw)
        if normalised is not None:
            out.append(normalised)

    return out
