import pytest
import time
from unittest.mock import patch

from service.ai import (
    AI_PLAYER_ID,
    DIFFICULTY_PARAMS,
    predict_intercept_y,
    update_ai_paddle,
)
from service.game_session import GameSession

H = GameSession.CANVAS_HEIGHT  # 512
R = GameSession.BALL_RADIUS    # 8
AI_X = GameSession.CANVAS_WIDTH - GameSession.PADDLE_WIDTH  # 1004
TOL = 2.0


def assert_close(actual: float, expected: float, tol: float = TOL) -> None:
    assert abs(actual - expected) <= tol, f"{actual} vs {expected} (tol={tol})"


def test_straight_shot_returns_ball_y():
    y = predict_intercept_y(ball_x=512, ball_y=256, ball_vx=3.0,
                            ball_vy=0.0, ai_paddle_x=AI_X)
    assert_close(y, 256)


def test_diagonal_no_bounce():
    # dx = 492, vx = 3 -> t = 164; dy = 1*164 = 164; result = 256+164 = 420
    # 420 is < H - R (504), so no bounce.
    y = predict_intercept_y(ball_x=512, ball_y=256, ball_vx=3.0,
                            ball_vy=1.0, ai_paddle_x=AI_X)
    assert_close(y, 420)


def test_single_top_wall_bounce():
    # ball at (504, 100), v=(5, -2), target AI_X=1004
    # t = 500/5 = 100; raw y' = (100-8) + (-2)*100 = -108
    # H' = 512 - 16 = 496; period = 992
    # m = -108 % 992 = 884; m > H' -> 992 - 884 = 108 -> y = 116
    y = predict_intercept_y(ball_x=504, ball_y=100, ball_vx=5.0,
                            ball_vy=-2.0, ai_paddle_x=AI_X)
    assert_close(y, 116)


def test_single_bottom_wall_bounce():
    # ball at (504, 400), v=(5, 2), target AI_X=1004
    # t = 100; raw y' = 392 + 200 = 592; H' = 496; period = 992
    # m = 592; m > 496 -> 992 - 592 = 400 -> y = 408
    y = predict_intercept_y(ball_x=504, ball_y=400, ball_vx=5.0,
                            ball_vy=2.0, ai_paddle_x=AI_X)
    assert_close(y, 408)


def test_multiple_bounces():
    # ball at (4, 256), v=(2, 7), target AI_X=1004
    # t = 500; raw y' = 248 + 3500 = 3748; H' = 496; period = 992
    # m = 3748 % 992 = 3748 - 3*992 = 3748 - 2976 = 772
    # m > 496 -> 992 - 772 = 220 -> y = 228
    y = predict_intercept_y(ball_x=4, ball_y=256, ball_vx=2.0,
                            ball_vy=7.0, ai_paddle_x=AI_X)
    assert_close(y, 228)
    assert R <= y <= H - R


def test_ball_moving_away_returns_current_y():
    y = predict_intercept_y(ball_x=900, ball_y=300, ball_vx=-3.0,
                            ball_vy=2.0, ai_paddle_x=AI_X)
    assert_close(y, 300)


def test_zero_vx_returns_clamped_current_y():
    y = predict_intercept_y(ball_x=500, ball_y=256, ball_vx=0.0,
                            ball_vy=5.0, ai_paddle_x=AI_X)
    assert_close(y, 256)


def test_clamp_when_current_y_outside_range():
    y_low = predict_intercept_y(ball_x=900, ball_y=2, ball_vx=-3.0,
                                ball_vy=0.0, ai_paddle_x=AI_X)
    assert y_low == R
    y_high = predict_intercept_y(ball_x=900, ball_y=H - 1, ball_vx=-3.0,
                                 ball_vy=0.0, ai_paddle_x=AI_X)
    assert y_high == H - R


@pytest.mark.parametrize("ball_y,vy", [(50, -3), (300, 4), (256, 9), (10, 6)])
def test_result_always_within_valid_range(ball_y, vy):
    y = predict_intercept_y(ball_x=100, ball_y=ball_y, ball_vx=4.0,
                            ball_vy=vy, ai_paddle_x=AI_X)
    assert R <= y <= H - R


def _make_session(ball_vx=3.0, ball_y=256.0, p2_y=None):
    s = GameSession(player1_id=1, player2_id=AI_PLAYER_ID)
    s.ball.x = 512.0
    s.ball.y = ball_y
    s.ball.vx = ball_vx
    s.ball.vy = 0.0
    if p2_y is not None:
        s.paddles.p2 = p2_y
    return s


# ── constants ──────────────────────────────────────────────────────────────

def test_ai_player_id_is_zero():
    assert AI_PLAYER_ID == 0


def test_difficulty_params_has_three_levels():
    assert set(DIFFICULTY_PARAMS) == {"easy", "medium", "hard"}


def test_difficulty_params_values():
    assert DIFFICULTY_PARAMS["easy"]   == {"error_rate": 0.35, "reaction_delay_ms": 200}
    assert DIFFICULTY_PARAMS["medium"] == {"error_rate": 0.15, "reaction_delay_ms": 100}
    assert DIFFICULTY_PARAMS["hard"]   == {"error_rate": 0.05, "reaction_delay_ms":  30}


# ── update_ai_paddle behaviour ─────────────────────────────────────────────

def test_ai_evaluates_intercept_when_delay_elapsed():
    s = _make_session()
    s.ai_last_eval_ms = 0.0  # ensures delay has elapsed
    with patch("service.ai.random.random", return_value=1.0):  # no error
        update_ai_paddle(s, error_rate=0.0, reaction_delay_ms=0)
    # After first evaluation, ai_target_y should match the predicted intercept
    # Ball moving straight right (vy=0), so intercept = ball_y = 256
    assert abs(s.ai_target_y - 256.0) < 2.0


def test_ai_does_not_re_evaluate_before_delay():
    s = _make_session()
    s.ai_target_y = 100.0  # stale target
    s.ai_last_eval_ms = time.monotonic() * 1000  # evaluated "just now"
    with patch("service.ai.random.random", return_value=1.0):
        update_ai_paddle(s, error_rate=0.0, reaction_delay_ms=9999)
    assert s.ai_target_y == 100.0  # target unchanged — delay not elapsed


def test_ai_holds_position_on_error():
    s = _make_session()
    s.ai_last_eval_ms = 0.0
    s.ai_target_y = 400.0  # paddle should chase 400
    s.paddles.p2 = 0.0      # paddle top at 0, center at 50
    with patch("service.ai.random.random", return_value=0.0):  # always error
        update_ai_paddle(s, error_rate=1.0, reaction_delay_ms=0)
    assert s.p2_direction == "stop"


def test_ai_moves_down_when_target_below_paddle():
    s = _make_session()
    s.ai_last_eval_ms = 0.0
    s.ai_target_y = GameSession.CANVAS_HEIGHT - 50.0  # target near bottom
    s.paddles.p2 = 0.0  # paddle near top
    with patch("service.ai.random.random", return_value=1.0):  # no error
        update_ai_paddle(s, error_rate=0.0, reaction_delay_ms=0)
    assert s.p2_direction == "down"


def test_ai_moves_up_when_target_above_paddle():
    s = _make_session()
    s.ai_last_eval_ms = 0.0
    s.ai_target_y = 50.0   # target near top
    s.paddles.p2 = GameSession.CANVAS_HEIGHT - GameSession.PADDLE_HEIGHT - 10.0
    with patch("service.ai.random.random", return_value=1.0):  # no error
        update_ai_paddle(s, error_rate=0.0, reaction_delay_ms=0)
    assert s.p2_direction == "up"


def test_ai_stops_when_on_target():
    s = _make_session()
    s.ai_last_eval_ms = 0.0
    target = GameSession.CANVAS_HEIGHT / 2
    s.ai_target_y = target
    # Place paddle center exactly on target
    s.paddles.p2 = target - GameSession.PADDLE_HEIGHT / 2
    with patch("service.ai.random.random", return_value=1.0):  # no error
        update_ai_paddle(s, error_rate=0.0, reaction_delay_ms=0)
    assert s.p2_direction == "stop"


def test_ai_updates_last_eval_ms_after_evaluation():
    s = _make_session()
    s.ai_last_eval_ms = 0.0
    before = time.monotonic() * 1000
    with patch("service.ai.random.random", return_value=1.0):
        update_ai_paddle(s, error_rate=0.0, reaction_delay_ms=0)
    assert s.ai_last_eval_ms >= before
