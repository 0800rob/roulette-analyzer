"""Prediction engine for roulette spin analysis.

This module implements a more sophisticated heuristic-based prediction system
combining several statistical signals:

- Bias detection (chi-squared / z-score on individual numbers)
- Markov transition probabilities (order-1 and order-2)
- Gap analysis (overdue numbers)
- Sector bias with statistical significance
- Recent frequency with exponential decay
- Color/parity/dozen pattern matching

Important note: Roulette is fundamentally a game of chance. On a fair RNG-based
table, no algorithm can predict the next number — spins are independent. On a
real mechanical wheel (like Evolution Auto-Roulette), the only theoretically
exploitable edge is wheel bias, and that requires thousands of spins to detect
reliably. These heuristics are NOT a winning strategy — they surface patterns
that may be statistically interesting, nothing more.
"""

from __future__ import annotations

import math
from collections import Counter, defaultdict

# European roulette wheel order (physical sequence on the wheel)
EUROPEAN_WHEEL_ORDER: list[int] = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11,
    30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18,
    29, 7, 28, 12, 35, 3, 26
]

# Red numbers on a European roulette wheel
RED_NUMBERS: set[int] = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}

# Weights for combining heuristic scores
# Note: neighbor analysis was removed because it was just repeating numbers
# adjacent to the last spin — providing no real signal.
HEURISTIC_WEIGHTS: dict[str, float] = {
    "bias":      0.28,  # statistical bias of individual numbers (z-score)
    "markov":    0.20,  # transition probabilities P(next | previous spins)
    "sector":    0.18,  # sector bias with statistical significance
    "gap":       0.14,  # overdue numbers (gap analysis)
    "frequency": 0.12,  # recent frequency with exponential decay
    "pattern":   0.08,  # color/parity/dozen pattern matching
}

# Minimum number of spins required before generating predictions
MIN_SPINS_REQUIRED: int = 10


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_color(number: int) -> str:
    """Return the color of a roulette number."""
    if number == 0:
        return "green"
    return "red" if number in RED_NUMBERS else "black"


def _get_dozen(number: int) -> int | None:
    """Return the dozen group (1, 2, or 3) for a number, or None for 0."""
    if number == 0:
        return None
    if number <= 12:
        return 1
    if number <= 24:
        return 2
    return 3


def _normalize(scores: dict[int, float]) -> dict[int, float]:
    """Normalize a score dict so the maximum value is 1.0 (or all zeros)."""
    max_score = max(scores.values()) if scores else 0.0
    if max_score <= 0:
        return scores
    return {k: v / max_score for k, v in scores.items()}


# ---------------------------------------------------------------------------
# Heuristic 1: Bias detection (chi-squared / z-score)
# ---------------------------------------------------------------------------

def bias_analysis(spins: list[int]) -> dict[int, float]:
    """Detect numbers appearing more often than chance would predict.

    Computes a z-score for each number's hit count vs. the uniform expectation
    (n/37). Only positive z-scores (above-average hits) contribute, since we're
    looking for "hot" numbers that may indicate wheel bias.

    Requires at least 37 spins (one full wheel) for any meaningful signal.
    Returns all zeros for shorter histories.
    """
    scores: dict[int, float] = {n: 0.0 for n in range(37)}
    n = len(spins)
    if n < 37:
        return scores

    counter = Counter(spins)
    expected = n / 37.0
    # Variance for a binomial(n, 1/37) per number
    variance = expected * (1 - 1.0 / 37.0)
    std = math.sqrt(variance) if variance > 0 else 1.0

    for num in range(37):
        observed = counter.get(num, 0)
        z = (observed - expected) / std
        # Only above-average gets a positive score
        scores[num] = max(0.0, z)

    return _normalize(scores)


# ---------------------------------------------------------------------------
# Heuristic 2: Markov transitions
# ---------------------------------------------------------------------------

def markov_analysis(spins: list[int]) -> dict[int, float]:
    """Learn transition probabilities P(next | last 1 or 2 spins).

    Combines order-1 and order-2 Markov chains. The order-2 chain is more
    specific but needs more data, so we blend them.

    Returns all zeros for spins with fewer than 5 entries.
    """
    scores: dict[int, float] = {n: 0.0 for n in range(37)}
    n = len(spins)
    if n < 5:
        return scores

    # Order-1: P(next | last)
    trans_1: dict[int, Counter] = defaultdict(Counter)
    for i in range(n - 1):
        trans_1[spins[i]][spins[i + 1]] += 1

    # Order-2: P(next | last two)
    trans_2: dict[tuple[int, int], Counter] = defaultdict(Counter)
    if n >= 6:
        for i in range(n - 2):
            key = (spins[i], spins[i + 1])
            trans_2[key][spins[i + 2]] += 1

    # Score next number from current state
    last = spins[-1]
    last_two = (spins[-2], spins[-1]) if n >= 2 else None

    # Order-1 contribution
    o1_total = sum(trans_1[last].values())
    o1_scores: dict[int, float] = {}
    if o1_total > 0:
        for num, count in trans_1[last].items():
            o1_scores[num] = count / o1_total

    # Order-2 contribution
    o2_scores: dict[int, float] = {}
    if last_two and trans_2.get(last_two):
        o2_total = sum(trans_2[last_two].values())
        if o2_total > 0:
            for num, count in trans_2[last_two].items():
                o2_scores[num] = count / o2_total

    # Blend: 60% order-1 (more reliable due to more data), 40% order-2
    for num in range(37):
        scores[num] = 0.6 * o1_scores.get(num, 0.0) + 0.4 * o2_scores.get(num, 0.0)

    return _normalize(scores)


# ---------------------------------------------------------------------------
# Heuristic 3: Sector bias with statistical significance
# ---------------------------------------------------------------------------

def sector_analysis(spins: list[int]) -> dict[int, float]:
    """Detect statistically significant hot sectors on the wheel.

    Divides the wheel into 6-7 sectors and computes a z-score for each sector's
    hit count vs. its expected count (n * sector_size / 37). Numbers in hot
    sectors get scored proportionally to that sector's z-score.
    """
    scores: dict[int, float] = {n: 0.0 for n in range(37)}
    n = len(spins)
    if n == 0:
        return scores

    sector_size = 6
    sectors: list[list[int]] = []
    for i in range(0, len(EUROPEAN_WHEEL_ORDER), sector_size):
        sectors.append(EUROPEAN_WHEEL_ORDER[i:i + sector_size])
    num_sectors = len(sectors)

    number_to_sector: dict[int, int] = {}
    for sector_idx, sector in enumerate(sectors):
        for num in sector:
            number_to_sector[num] = sector_idx

    sector_hits = [0] * num_sectors
    for s in spins:
        if s in number_to_sector:
            sector_hits[number_to_sector[s]] += 1

    sector_z_scores: list[float] = []
    for i, sector in enumerate(sectors):
        p = len(sector) / 37.0
        expected = n * p
        variance = n * p * (1 - p)
        std = math.sqrt(variance) if variance > 0 else 1.0
        z = (sector_hits[i] - expected) / std if std > 0 else 0.0
        sector_z_scores.append(max(0.0, z))

    max_z = max(sector_z_scores) if sector_z_scores else 0.0
    if max_z > 0:
        for sector_idx, sector in enumerate(sectors):
            normalized = sector_z_scores[sector_idx] / max_z
            for num in sector:
                scores[num] = normalized

    return scores


# ---------------------------------------------------------------------------
# Heuristic 4: Gap analysis (overdue numbers)
# ---------------------------------------------------------------------------

def gap_analysis(spins: list[int]) -> dict[int, float]:
    """Score numbers based on how overdue they are.

    Expected gap between hits is ~37 spins. Numbers with a current gap larger
    than expected receive a positive score. Numbers never seen at all in the
    history are also scored.
    """
    scores: dict[int, float] = {n: 0.0 for n in range(37)}
    n = len(spins)
    if n < 10:
        return scores

    last_seen: dict[int, int] = {}
    for i, num in enumerate(spins):
        last_seen[num] = i

    expected_gap = 37.0

    for num in range(37):
        if num in last_seen:
            gap = n - 1 - last_seen[num]
        else:
            gap = n  # never seen, treat as full history

        if gap > expected_gap:
            # Linear ramp up to 2x expected gap = score 1.0
            scores[num] = min(1.0, (gap - expected_gap) / expected_gap)

    return scores


# ---------------------------------------------------------------------------
# Heuristic 5: Recent frequency with exponential decay
# ---------------------------------------------------------------------------

def frequency_analysis(spins: list[int]) -> dict[int, float]:
    """Compute frequency scores using exponential decay weighting.

    More recent spins contribute more heavily. Each spin at index i (0=oldest)
    gets weight 0.95^(n-1-i).
    """
    scores: dict[int, float] = {n: 0.0 for n in range(37)}
    n = len(spins)
    if n == 0:
        return scores

    decay = 0.95
    for i, number in enumerate(spins):
        weight = decay ** (n - 1 - i)
        scores[number] += weight

    return _normalize(scores)


# ---------------------------------------------------------------------------
# Heuristic 6: Pattern matching (color/parity/dozen sequences)
# ---------------------------------------------------------------------------

def pattern_analysis(spins: list[int]) -> dict[int, float]:
    """Find numbers that historically followed similar recent contexts.

    Looks at the last 3 spins' color sequence and finds previous occurrences of
    the same color sequence in history, scoring whatever followed.
    """
    scores: dict[int, float] = {n: 0.0 for n in range(37)}
    n = len(spins)
    if n < 8:
        return scores

    # Match on the last 3 colors
    target_colors = [_get_color(s) for s in spins[-3:]]

    for i in range(n - 3):
        window_colors = [_get_color(s) for s in spins[i:i + 3]]
        if window_colors == target_colors and i + 3 < n:
            next_num = spins[i + 3]
            scores[next_num] += 1.0

    return _normalize(scores)


# ---------------------------------------------------------------------------
# Combination & main entry point
# ---------------------------------------------------------------------------

# Reason labels and the heuristics they came from
_REASON_LABELS = {
    "bias": "bias",
    "markov": "markov",
    "sector": "sector",
    "gap": "gap",
    "frequency": "frequency",
    "pattern": "pattern",
}


def combine_scores(
    bias: dict[int, float],
    markov: dict[int, float],
    sector: dict[int, float],
    gap: dict[int, float],
    freq: dict[int, float],
    pattern: dict[int, float],
) -> list[dict]:
    """Combine all heuristic scores using configured weights.

    Returns the top predictions sorted by confidence descending. Includes at
    least 5 predictions, with ties at the boundary kept together.
    """
    w = HEURISTIC_WEIGHTS
    combined: dict[int, float] = {}
    contributions: dict[int, dict[str, float]] = {}

    for n in range(37):
        b = bias.get(n, 0.0)
        m = markov.get(n, 0.0)
        s = sector.get(n, 0.0)
        g = gap.get(n, 0.0)
        f = freq.get(n, 0.0)
        p = pattern.get(n, 0.0)

        combined[n] = (
            b * w["bias"]
            + m * w["markov"]
            + s * w["sector"]
            + g * w["gap"]
            + f * w["frequency"]
            + p * w["pattern"]
        )
        contributions[n] = {
            "bias": b * w["bias"],
            "markov": m * w["markov"],
            "sector": s * w["sector"],
            "gap": g * w["gap"],
            "frequency": f * w["frequency"],
            "pattern": p * w["pattern"],
        }

    # Sort descending
    sorted_numbers = sorted(range(37), key=lambda n: combined[n], reverse=True)

    # Take top 5 (or more if tied at the boundary)
    min_count = 5
    if len(sorted_numbers) <= min_count:
        selected = sorted_numbers
    else:
        cutoff = combined[sorted_numbers[min_count - 1]]
        selected = [n for n in sorted_numbers if combined[n] >= cutoff]

    max_combined = max(combined[n] for n in selected) if selected else 1.0
    if max_combined <= 0:
        max_combined = 1.0

    predictions: list[dict] = []
    for n in selected:
        confidence = combined[n] / max_combined

        # Build reason list — only include heuristics that contributed > 0
        contrib = contributions[n]
        reasons = sorted(
            [r for r, v in contrib.items() if v > 0],
            key=lambda r: contrib[r],
            reverse=True,
        )
        if not reasons:
            reasons = ["bias"]  # fallback so UI doesn't show empty

        predictions.append({
            "number": n,
            "confidence_score": round(confidence, 4),
            "color": _get_color(n),
            "reasons": reasons,
        })

    predictions.sort(key=lambda p: p["confidence_score"], reverse=True)
    return predictions


def compute_predictions(spins: list[int]) -> list[dict]:
    """Main entry point: compute predictions from a spin history.

    Returns an empty list if fewer than MIN_SPINS_REQUIRED spins are provided.
    """
    if len(spins) < MIN_SPINS_REQUIRED:
        return []

    bias = bias_analysis(spins)
    markov = markov_analysis(spins)
    sector = sector_analysis(spins)
    gap = gap_analysis(spins)
    freq = frequency_analysis(spins)
    pattern = pattern_analysis(spins)

    return combine_scores(bias, markov, sector, gap, freq, pattern)


# ---------------------------------------------------------------------------
# Backward-compatible aliases (kept so any old imports / tests don't break)
# ---------------------------------------------------------------------------

def neighbor_analysis(spins: list[int]) -> dict[int, float]:  # pragma: no cover
    """Deprecated. Kept only for backward compatibility — returns all zeros."""
    return {n: 0.0 for n in range(37)}


def trend_analysis(spins: list[int]) -> dict[int, float]:  # pragma: no cover
    """Deprecated alias for pattern_analysis."""
    return pattern_analysis(spins)



# ===========================================================================
# Group strategy (custom user heuristic)
# ===========================================================================
#
# Rules:
#   - Group spins by 4 buckets: 1-9, 10-19, 20-29, 30-36 (zero is ignored)
#   - Reduce each spin to its digital root (1 digit): 19 -> 1+9=10 -> 1+0=1
#     so 10/20/30 = 1/2/3, etc.
#   - Inside the last `window` spins, look for 3 numbers from the SAME group
#     (most recent triple wins if more than one match)
#   - Sum their digital roots. If sum is in [1, 33], the play is:
#       hits = [sum, sum+1, sum+2]
#       neighbours_on_race = 1 neighbour of each `hit` (left + right) in the
#                            European wheel order
#   - If sum > 33, no play is produced.

EUROPEAN_GROUPS = [
    range(1, 10),    # group 0: 1-9
    range(10, 20),   # group 1: 10-19
    range(20, 30),   # group 2: 20-29
    range(30, 37),   # group 3: 30-36
]


def _group_index(n: int) -> int | None:
    """Return the group index (0-3) of a roulette number, or None for 0."""
    for i, g in enumerate(EUROPEAN_GROUPS):
        if n in g:
            return i
    return None


def _digit_sum_once(n: int) -> int:
    """Sum the digits of a number ONCE (no further reduction).

    Examples:
        9   -> 9
        10  -> 1
        19  -> 10        (NOT reduced again to 1)
        27  -> 9
        28  -> 10        (NOT reduced again to 1)
        29  -> 11        (NOT reduced again to 2)
        36  -> 9
    """
    if n < 10:
        return n
    return sum(int(d) for d in str(n))


def _race_neighbours(num: int, count: int = 1) -> list[int]:
    """Return `count` immediate neighbours on each side of `num` on the wheel."""
    if num not in EUROPEAN_WHEEL_ORDER:
        return []
    idx = EUROPEAN_WHEEL_ORDER.index(num)
    n = len(EUROPEAN_WHEEL_ORDER)
    out: list[int] = []
    for k in range(1, count + 1):
        out.append(EUROPEAN_WHEEL_ORDER[(idx - k) % n])
        out.append(EUROPEAN_WHEEL_ORDER[(idx + k) % n])
    return out


def compute_group_strategy(
    spins: list[int],
    window: int = 7,
    neighbours: int = 1,
) -> dict | None:
    """Apply the user's custom group strategy.

    Trigger: a COMPLETED run of 3+ consecutive spins from the same group
    (1-9, 10-19, 20-29, or 30-36). "Completed" means the run was broken by
    a spin from a different group OR by zero. While a run is still ongoing
    (i.e. the latest spin extends it), no play is indicated — we wait for
    the break.

    Args:
        spins: spin history, oldest -> newest.
        window: how many recent spins to consider.
        neighbours: how many race neighbours per hit number.

    Returns:
        A dict describing the play, or None if no trigger fires.
    """
    if not spins:
        return None
    window = max(3, window)
    recent = spins[-window:]
    n = len(recent)

    if n < 4:
        # Need at least 4 spins so a run of 3+ can be followed by a break.
        return None

    # Walk from the END backwards, looking for the most recent BREAK point.
    # A break at index i means: group(recent[i]) != group(recent[i-1])
    # (zero counts as None, which differs from any group, so zero breaks).
    # The run ends at i-1; we then expand it backwards while the group holds.
    run: list[int] | None = None
    run_group: int | None = None

    for i in range(n - 1, 0, -1):
        gi = _group_index(recent[i])
        gi_prev = _group_index(recent[i - 1])

        # If the previous spin is zero, there's no run to extend — skip.
        if gi_prev is None:
            continue
        # No break here? keep walking.
        if gi == gi_prev:
            continue

        # Break detected: run ends at i-1
        end = i - 1
        start = end
        while start > 0 and _group_index(recent[start - 1]) == gi_prev:
            start -= 1
        candidate = recent[start:end + 1]
        if len(candidate) >= 3:
            run = candidate
            run_group = gi_prev
            break  # most recent completed run wins

    if run is None or run_group is None:
        return None

    digital_roots = [_digit_sum_once(s) for s in run]
    total = sum(digital_roots)

    if total < 1 or total > 33:
        return None

    hits = [total, total + 1, total + 2]
    neighbour_map: dict[int, list[int]] = {h: _race_neighbours(h, neighbours) for h in hits}

    all_marked: list[int] = []
    for h in hits:
        all_marked.append(h)
        all_marked.extend(neighbour_map[h])
    seen: set[int] = set()
    deduped: list[int] = []
    for v in all_marked:
        if v not in seen:
            seen.add(v)
            deduped.append(v)

    group_label = ['1-9', '10-19', '20-29', '30-36'][run_group]

    return {
        "triggered": True,
        "group": run_group,
        "group_label": group_label,
        "triple": run,                 # field name kept for backwards compatibility
        "digital_roots": digital_roots,
        "sum": total,
        "hit_numbers": hits,
        "neighbours": neighbour_map,
        "all_marked": deduped,
        "window": window,
    }
