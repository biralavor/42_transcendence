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
    INITIAL_BALL_VX = 3.0 
    INITIAL_BALL_VY = 0.0
    MAX_BALL_SPEED = 8.0 
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
                self.paddles.p1 + self.PADDLE_SPEED
            )
        if self.p2_direction == "up":
            self.paddles.p2 = max(0, self.paddles.p2 - self.PADDLE_SPEED)
        elif self.p2_direction == "down":
            self.paddles.p2 = min(
                self.CANVAS_HEIGHT - self.PADDLE_HEIGHT,
                self.paddles.p2 + self.PADDLE_SPEED
            )
    
    def update_ball(self) -> None:
        self.ball.x += self.ball.vx
        self.ball.y += self.ball.vy
    
    def check_collisions(self) -> None:
        if self.ball.y - self.BALL_RADIUS <= 0:
            self.ball.y = self.BALL_RADIUS
            self.ball.vy = abs(self.ball.vy)
        elif self.ball.y + self.BALL_RADIUS >= self.CANVAS_HEIGHT:
            self.ball.y = self.CANVAS_HEIGHT - self.BALL_RADIUS
            self.ball.vy = -abs(self.ball.vy)
        
        if self._check_paddle_collision(
            self.ball.x,
            self.ball.y,
            self.BALL_RADIUS,
            paddle_y=self.paddles.p1,
            paddle_x=0.0,
            paddle_height=self.PADDLE_HEIGHT,
        ):
            self.ball.x = self.PADDLE_WIDTH + self.BALL_RADIUS
            self._reflect_ball_off_paddle(self.paddles.p1)
            self.ball.vx = abs(self.ball.vx)
        
        if self._check_paddle_collision(
            self.ball.x,
            self.ball.y,
            self.BALL_RADIUS,
            paddle_y=self.paddles.p2,
            paddle_x=self.CANVAS_WIDTH - self.PADDLE_WIDTH,
            paddle_height=self.PADDLE_HEIGHT,
        ):
            self.ball.x = self.CANVAS_WIDTH - self.PADDLE_WIDTH - self.BALL_RADIUS
            self._reflect_ball_off_paddle(self.paddles.p2)
            self.ball.vx = -abs(self.ball.vx)
    
    def _check_paddle_collision(
        self,
        ball_x: float,
        ball_y: float,
        ball_radius: float,
        paddle_y: float,
        paddle_x: float,
        paddle_height: float,
    ) -> bool:
        
        closest_x = max(paddle_x, min(ball_x, paddle_x + self.PADDLE_WIDTH))
        closest_y = max(paddle_y, min(ball_y, paddle_y + paddle_height))
        dx = ball_x - closest_x
        dy = ball_y - closest_y
        distance = (dx * dx + dy * dy) ** 0.5
        
        return distance < ball_radius
    
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
        self.update_ball()
        self.check_collisions()
        self.check_scoring()
        self.tick_count += 1
