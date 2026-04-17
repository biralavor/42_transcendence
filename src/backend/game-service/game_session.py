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
    PADDLE_X_P1 = 64   # = 10 frontend units × (1024/160) — matches local game P1 default
    PADDLE_X_P2 = 928  # = 145 frontend units × (1024/160) — matches local game P2 default
    PADDLE_SPEED = 11.4  # 2 px/tick × (512/90) — matches frontend MAX_PLAYER_VEL in backend coords
    BALL_RADIUS = 8
    INITIAL_BALL_X = CANVAS_WIDTH / 2
    INITIAL_BALL_Y = CANVAS_HEIGHT / 2
    INITIAL_BALL_VX = 25.6  # 4 px/tick × (1024/160) — matches frontend initial ball speed
    INITIAL_BALL_VY = 0.0
    MAX_BALL_SPEED = 51.2  # 8 px/tick × (1024/160) — 2× initial speed cap
    SUBSTEPS = 4           # physics sub-steps per tick to prevent ball tunneling
    WIN_SCORE = 10
    FPS = 30
    TICK_INTERVAL = 1.0 / FPS  # ~33.3 ms
    
    def __init__(self, player1_id: int, player2_id: int, speed_multiplier: float = 1.0):
        self.player1_id = player1_id
        self.player2_id = player2_id
        self.speed_multiplier = max(0.1, speed_multiplier)
        self.max_ball_speed = self.MAX_BALL_SPEED * self.speed_multiplier
        self.ball = BallState(
            x=self.INITIAL_BALL_X,
            y=self.INITIAL_BALL_Y,
            vx=self.INITIAL_BALL_VX * self.speed_multiplier,
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
        
        # AI state — only used when this session was created with ai_params
        self.ai_last_eval_ms: float = 0.0
        self.ai_target_y: float = self.CANVAS_HEIGHT / 2
        self.ai_params: dict | None = None
        self.ai_is_erroring: bool = False
        self.ai_error_direction: str = "stop"
        
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
            paddle_x=self.PADDLE_X_P1,
            paddle_height=self.PADDLE_HEIGHT,
        ):
            self.ball.x = self.PADDLE_X_P1 + self.PADDLE_WIDTH + self.BALL_RADIUS
            self._reflect_ball_off_paddle(self.paddles.p1)
            self.ball.vx = abs(self.ball.vx)

        if self._check_paddle_collision(
            self.ball.x,
            self.ball.y,
            self.BALL_RADIUS,
            paddle_y=self.paddles.p2,
            paddle_x=self.PADDLE_X_P2,
            paddle_height=self.PADDLE_HEIGHT,
        ):
            self.ball.x = self.PADDLE_X_P2 - self.BALL_RADIUS
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
        self.ball.vy = angle_factor * 14.2  # 2.5 × (512/90) — proportional to canvas height
        speed = (self.ball.vx ** 2 + self.ball.vy ** 2) ** 0.5
        if speed > self.max_ball_speed:
            scale = self.max_ball_speed / speed
            self.ball.vx *= scale
            self.ball.vy *= scale
    
    def check_scoring(self) -> None:
        if self.ball.x < 0:
            self.score.p2 += 1
            self._reset_ball(vx_sign=1)   # serve toward p2 (the scorer)
        elif self.ball.x > self.CANVAS_WIDTH:
            self.score.p1 += 1
            self._reset_ball(vx_sign=-1)  # serve toward p1 (the scorer)
    
    def _reset_ball(self, vx_sign: int = 1) -> None:
        self.ball.x = self.INITIAL_BALL_X
        self.ball.y = self.INITIAL_BALL_Y
        self.ball.vx = vx_sign * self.INITIAL_BALL_VX * self.speed_multiplier
        self.ball.vy = self.INITIAL_BALL_VY
    
    def check_victory(self) -> tuple[bool, int | None]:
        if self.score.p1 >= self.WIN_SCORE:
            return True, self.player1_id
        elif self.score.p2 >= self.WIN_SCORE:
            return True, self.player2_id
        return False, None
    
    def tick(self) -> None:
        self.update_paddles()
        frac = 1.0 / self.SUBSTEPS
        for _ in range(self.SUBSTEPS):
            self.ball.x += self.ball.vx * frac
            self.ball.y += self.ball.vy * frac
            self.check_collisions()
        self.check_scoring()
        self.tick_count += 1
