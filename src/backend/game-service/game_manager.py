import asyncio
import time
from typing import Optional, Callable, Any
from dataclasses import asdict
from service.game_session import GameSession


class GameManager:
   
    def __init__(self):
        self._sessions: dict[str, GameSession] = {}
        self._game_loops: dict[str, asyncio.Task] = {}
        self._broadcast_callbacks: dict[str, Callable] = {}
        self._session_lock = asyncio.Lock()
    
    async def create_session(
        self,
        game_id: str,
        player1_id: int,
        player2_id: int,
        broadcast_callback: Callable,
    ) -> GameSession:
        
        async with self._session_lock:
            if game_id in self._sessions:
                raise ValueError(f"Game {game_id} already exists")
            session = GameSession(player1_id, player2_id)
            self._sessions[game_id] = session
            self._broadcast_callbacks[game_id] = broadcast_callback
            task = asyncio.create_task(self._run_game_loop(game_id))
            self._game_loops[game_id] = task
            return session
    
    async def delete_session(self, game_id: str) -> None:
        async with self._session_lock:
            session = self._sessions.pop(game_id, None)
            if session:
                session.is_active = False
            task = self._game_loops.pop(game_id, None)
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
            self._broadcast_callbacks.pop(game_id, None)
    
    def get_session(self, game_id: str) -> Optional[GameSession]:
        return self._sessions.get(game_id)
    
    async def handle_player_input(
        self,
        game_id: str,
        player_id: int,
        message: dict,
    ) -> None:
        session = self.get_session(game_id)
        if not session:
            return
        direction = message.get("direction", "stop")
        client_ts = message.get("client_ts")
        if direction not in ("up", "down", "stop"):
            return
        server_now = int(time.time() * 1000)  # Current server time in ms
        if client_ts is not None and (server_now - client_ts) > 300:
            return 
        if player_id == session.player1_id:
            session.p1_direction = direction
        elif player_id == session.player2_id:
            session.p2_direction = direction
    
    async def _run_game_loop(self, game_id: str) -> None:
        session = self.get_session(game_id)
        if not session:
            return
        broadcast_callback = self._broadcast_callbacks.get(game_id)
        if not broadcast_callback:
            return
        tick_interval = GameSession.TICK_INTERVAL  # ~0.0333 seconds
        try:
            while session.is_active:
                session.tick()
                state_snapshot = session.get_state_snapshot()
                await broadcast_callback(game_id, asdict(state_snapshot))
                
                has_winner, winner_id = session.check_victory()
                if has_winner:
                    # Game over — mark session as inactive
                    # The WebSocket router will handle cleanup
                    session.is_active = False
                    break
                
                await asyncio.sleep(tick_interval)
        
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Game loop error for {game_id}: {e}")
        finally:
            session.is_active = False

game_manager = GameManager()
