"""Headless win-rate simulation tests for AI difficulty tuning.

Each test runs N complete Pong games (AI p2 vs random-paddle p1) entirely
in memory.  time.monotonic is patched to advance TICK_INTERVAL seconds per
call so reaction_delay_ms windows fire at realistic cadences.
"""
import random
from collections.abc import Callable
from unittest.mock import patch

import pytest

from service.ai import DIFFICULTY_PARAMS, update_ai_paddle, AI_PLAYER_ID
from service.game_session import GameSession

GAMES_PER_TEST = 100
MAX_TICKS_PER_GAME = 10_000  # safety cap — no real game reaches this


def _make_monotonic_clock() -> Callable[[], float]:
    """Returns a monotonic-clock mock that advances TICK_INTERVAL per call."""
    state = {"t": 0.0}

    def _clock():
        val = state["t"]
        state["t"] += GameSession.TICK_INTERVAL
        return val

    return _clock


def run_ai_simulations(n: int, difficulty: str, opponent: str = "random_paddle") -> int:
    """Run n complete games; return AI (p2) win rate as percentage."""
    assert difficulty in DIFFICULTY_PARAMS, f"Unknown difficulty: {difficulty}"
    assert opponent == "random_paddle", f"Unknown opponent type: {opponent}"

    params = DIFFICULTY_PARAMS[difficulty]
    win_count = 0
    rng = random.Random(42)

    for _ in range(n):
        session = GameSession(player1_id=1, player2_id=AI_PLAYER_ID)
        ticks = 0

        with patch("time.monotonic", _make_monotonic_clock()):
            while session.is_active and ticks < MAX_TICKS_PER_GAME:
                # AI drives p2
                update_ai_paddle(session, **params)

                # Random opponent drives p1
                session.p1_direction = rng.choice(["up", "down", "stop"])

                session.tick()
                done, _ = session.check_victory()
                if done:
                    session.is_active = False
                ticks += 1

        if session.score.p2 >= GameSession.WIN_SCORE:
            win_count += 1

    return int(round(win_count * 100 / n))


def test_ai_win_rate_easy():
    wins = run_ai_simulations(n=GAMES_PER_TEST, difficulty="easy", opponent="random_paddle")
    assert wins <= 50, f"Easy AI should win <=50%, got {wins}%"


def test_ai_win_rate_medium():
    wins = run_ai_simulations(n=GAMES_PER_TEST, difficulty="medium", opponent="random_paddle")
    assert 40 <= wins <= 80, f"Expected 40-80% win rate, got {wins}%"


def test_ai_win_rate_hard():
    wins = run_ai_simulations(n=GAMES_PER_TEST, difficulty="hard", opponent="random_paddle")
    assert wins >= 60, f"Hard AI should win >=60%, got {wins}%"
