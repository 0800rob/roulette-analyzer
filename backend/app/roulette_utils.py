"""Utility functions for roulette analysis."""

# European roulette color mapping
RED_NUMBERS = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
BLACK_NUMBERS = {2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35}


def get_color(number: int) -> str:
    """Get the color of a roulette number."""
    if number == 0:
        return "green"
    elif number in RED_NUMBERS:
        return "red"
    else:
        return "black"


def get_dozen(number: int) -> str:
    """Get which dozen a number belongs to."""
    if number == 0:
        return "zero"
    elif number <= 12:
        return "first"
    elif number <= 24:
        return "second"
    else:
        return "third"


def calculate_longest_streak(spins: list) -> dict:
    """Calculate the longest streak of same color/number/parity."""
    if not spins:
        return {"type": "", "value": "", "length": 0}

    best_streak = {"type": "", "value": "", "length": 0}

    # Check color streaks
    current_color = None
    current_length = 0
    for spin in spins:
        color = get_color(spin.number)
        if color == "green":
            current_color = None
            current_length = 0
            continue
        if color == current_color:
            current_length += 1
        else:
            current_color = color
            current_length = 1
        if current_length > best_streak["length"]:
            best_streak = {"type": "color", "value": current_color, "length": current_length}

    # Check parity streaks
    current_parity = None
    current_length = 0
    for spin in spins:
        if spin.number == 0:
            current_parity = None
            current_length = 0
            continue
        parity = "even" if spin.number % 2 == 0 else "odd"
        if parity == current_parity:
            current_length += 1
        else:
            current_parity = parity
            current_length = 1
        if current_length > best_streak["length"]:
            best_streak = {"type": "parity", "value": current_parity, "length": current_length}

    return best_streak
