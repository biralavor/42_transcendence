"""Pure AI helpers for the Pong game-service.

These functions are intentionally stateless and decoupled from
``GameSession`` so they are trivial to unit-test. The first piece is
:func:`predict_intercept_y`, which forecasts where the ball will reach
a given X coordinate after reflecting off the top/bottom walls.
"""

from game_session import GameSession


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
