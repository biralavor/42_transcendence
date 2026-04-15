import time
from dataclasses import dataclass, asdict


@dataclass
class BallState:
    x: float
    y: float
    vx: float
    vy: float


@dataclass
class PaddleState:
    p1: float  # Player 1 paddle Y position
    p2: float  # Player 2 paddle Y position


@dataclass
class ScoreState:
    p1: int
    p2: int


@dataclass
class GameStateSnapshot:
    ball: dict
    paddles: dict
    score: dict


class GameSession:
    CANVAS_WIDTH = 1024
    CANVAS_HEIGHT = 512
    PADDLE_WIDTH = 20
    PADDLE_HEIGHT = 100
    PADDLE_SPEED = 5.0
    BALL_RADIUS = 8
    INITIAL_BALL_X = CANVAS_WIDTH / 2
    INITIAL_BALL_Y = CANVAS_HEIGHT / 2
    INITIAL_BALL_VX = 24.0
    INITIAL_BALL_VY = 0.0
    MAX_BALL_SPEED = 38.0
    WIN_SCORE = 10
    FPS = 30
    TICK_INTERVAL = 1.0 / FPS  # ~33.3 ms

    def __init__(self, player1_id: int, player2_id: int):
        self.player1_id = player1_id
        self.player2_id = player2_id
        self.ball = BallState(
            x=self.INITIAL_BALL_X,
            y=self.INITIAL_BALL_Y,
            vx=self.INITIAL_BALL_VX,
            vy=self.INITIAL_BALL_VY,
        )
        self.paddles = PaddleState(
            p1=self.CANVAS_HEIGHT / 2 - self.PADDLE_HEIGHT / 2,
            p2=self.CANVAS_HEIGHT / 2 - self.PADDLE_HEIGHT / 2,
        )
        self.score = ScoreState(p1=0, p2=0)
        self.p1_direction = "stop"  # "up", "down", or "stop"
        self.p2_direction = "stop"
        self.is_active = True
        self.started_at = time.time()
        self.tick_count = 0

    def get_state_snapshot(self) -> GameStateSnapshot:
        return GameStateSnapshot(
            ball=asdict(self.ball),
            paddles=asdict(self.paddles),
            score=asdict(self.score),
        )

    def update_paddles(self) -> None:
        if self.p1_direction == "up":
            self.paddles.p1 = max(0, self.paddles.p1 - self.PADDLE_SPEED)
        elif self.p1_direction == "down":
            self.paddles.p1 = min(
                self.CANVAS_HEIGHT - self.PADDLE_HEIGHT,
                self.paddles.p1 + self.PADDLE_SPEED,
            )

        if self.p2_direction == "up":
            self.paddles.p2 = max(0, self.paddles.p2 - self.PADDLE_SPEED)
        elif self.p2_direction == "down":
            self.paddles.p2 = min(
                self.CANVAS_HEIGHT - self.PADDLE_HEIGHT,
                self.paddles.p2 + self.PADDLE_SPEED,
            )

    def update_ball(self) -> None:
        self.ball.x += self.ball.vx
        self.ball.y += self.ball.vy

    def _ball_overlaps_paddle_y(self, paddle_y: float) -> bool:
        ball_top = self.ball.y - self.BALL_RADIUS
        ball_bottom = self.ball.y + self.BALL_RADIUS
        paddle_top = paddle_y
        paddle_bottom = paddle_y + self.PADDLE_HEIGHT
        return ball_bottom >= paddle_top and ball_top <= paddle_bottom

    def check_collisions(self, prev_x: float, prev_y: float) -> None:
        """
        Handle ball collisions with the top/bottom walls and paddles.

        The previous implementation attempted to detect collisions only when the
        ball's leading edge crossed the front face of a paddle using the
        previous and current ball positions. This could miss collisions when the
        ball moved very quickly or when it was already overlapping a paddle at
        the start of a tick, causing the ball to pass through the paddle. To
        ensure robust collision handling regardless of velocity or overlap,
        collisions are now detected based solely on the ball's current
        position relative to the paddles and its direction of travel. If the
        ball is moving toward a paddle and its bounding circle overlaps the
        paddle's rectangle, we reflect the ball and reposition it just outside
        the paddle.

        Args:
            prev_x: The ball's x position at the start of the tick. Unused in
                the new implementation but retained for compatibility.
            prev_y: The ball's y position at the start of the tick. Unused in
                the new implementation but retained for compatibility.
        """
        # Top / bottom wall collision
        if self.ball.y - self.BALL_RADIUS <= 0:
            # Collide with the top wall
            self.ball.y = self.BALL_RADIUS
            self.ball.vy = abs(self.ball.vy)
        elif self.ball.y + self.BALL_RADIUS >= self.CANVAS_HEIGHT:
            # Collide with the bottom wall
            self.ball.y = self.CANVAS_HEIGHT - self.BALL_RADIUS
            self.ball.vy = -abs(self.ball.vy)

        # Left paddle collision
        if self.ball.vx < 0:
            # Only consider collision when the ball is moving towards the left paddle
            # Check if the ball's circle overlaps the vertical region of the paddle
            if (
                self.ball.x - self.BALL_RADIUS <= self.PADDLE_WIDTH
                and self._ball_overlaps_paddle_y(self.paddles.p1)
            ):
                # Place the ball just outside the paddle
                self.ball.x = self.PADDLE_WIDTH + self.BALL_RADIUS
                # Reflect velocity based on hit position
                self._reflect_ball_off_paddle(self.paddles.p1)
                # Ensure horizontal velocity points to the right
                self.ball.vx = abs(self.ball.vx)
                return

        # Right paddle collision
        if self.ball.vx > 0:
            # Only consider collision when the ball is moving towards the right paddle
            right_face = self.CANVAS_WIDTH - self.PADDLE_WIDTH
            if (
                self.ball.x + self.BALL_RADIUS >= right_face
                and self._ball_overlaps_paddle_y(self.paddles.p2)
            ):
                # Place the ball just outside the right paddle
                self.ball.x = right_face - self.BALL_RADIUS
                # Reflect velocity based on hit position
                self._reflect_ball_off_paddle(self.paddles.p2)
                # Ensure horizontal velocity points to the left
                self.ball.vx = -abs(self.ball.vx)
                return

    def _reflect_ball_off_paddle(self, paddle_y: float) -> None:
        hit_position = (self.ball.y - paddle_y) / self.PADDLE_HEIGHT
        hit_position = max(0.0, min(1.0, hit_position))  # Clamp to [0, 1]
        angle_factor = (hit_position - 0.5) * 2.0  # [-1, 1]
        self.ball.vy = angle_factor * 2.5

        speed = (self.ball.vx ** 2 + self.ball.vy ** 2) ** 0.5
        if speed > self.MAX_BALL_SPEED:
            scale = self.MAX_BALL_SPEED / speed
            self.ball.vx *= scale
            self.ball.vy *= scale

    def check_scoring(self) -> None:
        if self.ball.x < 0:
            self.score.p2 += 1
            self._reset_ball()
        elif self.ball.x > self.CANVAS_WIDTH:
            self.score.p1 += 1
            self._reset_ball()

    def _reset_ball(self) -> None:
        self.ball.x = self.INITIAL_BALL_X
        self.ball.y = self.INITIAL_BALL_Y
        self.ball.vx = self.INITIAL_BALL_VX
        self.ball.vy = self.INITIAL_BALL_VY

    def check_victory(self) -> tuple[bool, int | None]:
        if self.score.p1 >= self.WIN_SCORE:
            return True, self.player1_id
        elif self.score.p2 >= self.WIN_SCORE:
            return True, self.player2_id
        return False, None

    def tick(self) -> None:
        self.update_paddles()

        prev_x = self.ball.x
        prev_y = self.ball.y

        self.update_ball()
        self.check_collisions(prev_x, prev_y)
        self.check_scoring()
        self.tick_count += 1