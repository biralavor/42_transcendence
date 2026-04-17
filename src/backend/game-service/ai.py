"""Pure AI helpers for the Pong game-service.

These functions are intentionally stateless and decoupled from
``GameSession`` so they are trivial to unit-test. The first piece is
:func:`predict_intercept_y`, which forecasts where the ball will reach
a given X coordinate after reflecting off the top/bottom walls.
"""

import random
import time

from service.game_session import GameSession

AI_PLAYER_ID = 0  # sentinel: real user IDs are always > 0

DIFFICULTY_PARAMS: dict[str, dict] = {
    "easy":   {"error_rate": 0.35, "reaction_delay_ms": 200},
    "medium": {"error_rate": 0.15, "reaction_delay_ms": 100},
    "hard":   {"error_rate": 0.05, "reaction_delay_ms":  30},
}


def predict_intercept_y(
    ball_x: float,
    ball_y: float,
    ball_vx: float,
    ball_vy: float,
    ai_paddle_x: float,
    canvas_height: float = GameSession.CANVAS_HEIGHT,
    ball_radius: float = GameSession.BALL_RADIUS,
) -> float:
    """Compute the Y where the ball will reach ``ai_paddle_x``.

    Mirrors the wall reflection in :meth:`GameSession.check_collisions`:
    the ball center is constrained to ``[ball_radius, canvas_height -
    ball_radius]`` and ``vy`` flips on contact. Closed-form (O(1)) using
    a triangle-wave reflection — handles any number of bounces.

    If the ball is not moving toward ``ai_paddle_x`` (``vx == 0`` or
    moving away), returns ``ball_y`` clamped into the valid range.
    """
    r = ball_radius
    low = r
    high = canvas_height - r

    def clamp(y: float) -> float:
        return max(low, min(high, y))

    dx = ai_paddle_x - ball_x
    if ball_vx == 0 or (dx * ball_vx) < 0:
        return clamp(ball_y)

    t = dx / ball_vx
    y_raw = (ball_y - r) + ball_vy * t

    h_prime = canvas_height - 2 * r
    if h_prime <= 0:
        return clamp(ball_y)

    period = 2 * h_prime
    m = y_raw % period  # Python modulo: result has sign of divisor (>=0)
    y_unfolded = m if m <= h_prime else period - m

    return y_unfolded + r


def update_ai_paddle(
    session: GameSession,
    error_rate: float = 0.15,
    reaction_delay_ms: int = 100,
) -> None:
    """Drive the AI paddle (p2) for one tick.

    Two imperfection parameters:
    - error_rate: probability [0, 1] per tick that the AI freezes (holds
      position), simulating a missed reaction.
    - reaction_delay_ms: minimum milliseconds between intercept
      re-evaluations, simulating human reaction time lag.

    State is stored on ``session``:
    - session.ai_last_eval_ms  — monotonic timestamp of last re-evaluation
    - session.ai_target_y      — last computed intercept Y
    """
    now_ms = time.monotonic() * 1000

    # Re-evaluate intercept when the delay window has elapsed
    if now_ms - session.ai_last_eval_ms >= reaction_delay_ms:
        session.ai_target_y = predict_intercept_y(
            ball_x=session.ball.x,
            ball_y=session.ball.y,
            ball_vx=session.ball.vx,
            ball_vy=session.ball.vy,
            ai_paddle_x=session.CANVAS_WIDTH - session.PADDLE_WIDTH,
        )
        session.ai_last_eval_ms = now_ms

    # Randomly ignore the intercept this tick (simulates missed reaction)
    if random.random() < error_rate:
        session.p2_direction = "stop"
        return

    # Move paddle center toward ai_target_y
    paddle_center = session.paddles.p2 + session.PADDLE_HEIGHT / 2
    if paddle_center < session.ai_target_y - session.PADDLE_SPEED:
        session.p2_direction = "down"
    elif paddle_center > session.ai_target_y + session.PADDLE_SPEED:
        session.p2_direction = "up"
    else:
        session.p2_direction = "stop"
