import pytest

from ai import predict_intercept_y
from game_session import GameSession

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
