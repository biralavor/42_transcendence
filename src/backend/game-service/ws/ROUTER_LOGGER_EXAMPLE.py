"""
INTEGRATION EXAMPLE: game-service/ws/router.py with ws_logger

This file shows how to integrate the ws_logger utility into the WebSocket
handler to track latency and payloads during game waiting room setup.

Key additions:
1. Import ws_logger at top
2. Call ws_logger.connection() when player connects
3. Call ws_logger.receive() when payload received
4. Call ws_logger.broadcast() when sending state
5. Use ws_logger.latency() to measure delays
6. Call ws_logger.export() or ws_logger.summary() to debug
"""

# ADD TO TOP OF FILE:
from shared.logging import ws_logger

# ADD TO game_websocket handler:
@router.websocket("/ws/game/{game_id}")
async def game_websocket(websocket: WebSocket, game_id: str, token: str | None = None) -> None:
    """
    WebSocket handler for in-game communication during a Pong match.
    """
    # ... existing code ...
    
    # AFTER accept():
    await websocket.accept()
    player_id = # ... extract from token ...
    
    # Log connection
    ws_logger.connection(
        game_id=game_id, 
        player_id=player_id, 
        state='open',
        metadata={
            'token_valid': token is not None,
            'timestamp': ws_logger.get_iso_timestamp()
        }
    )
    
    # REPLACE the message handling loop:
    try:
        while True:
            # Start flow timing
            flow_start = ws_logger.flow_start(game_id, 'receive_and_broadcast')
            
            data = await websocket.receive_json()
            receive_time = ws_logger.receive(game_id, player_id, data)
            
            # Calculate latency from send to receive
            ws_logger.latency('client_to_server', receive_time)
            
            # Process the data
            if data.get("type") == "player_ready":
                ws_logger.ready(game_id=game_id, player_id=player_id, payload=data)
                
                # Update session state
                session = await game_manager.get_session(game_id)
                if session:
                    if player_id == session.player1_id:
                        session.p1_ready = True
                    elif player_id == session.player2_id:
                        session.p2_ready = True
                    
                    # Log session state
                    state_snapshot = {
                        'p1_ready': session.p1_ready,
                        'p2_ready': session.p2_ready,
                        'p1_id': session.player1_id,
                        'p2_id': session.player2_id,
                    }
                    ws_logger.session_state(game_id, state_snapshot)
                    
                    # Broadcast updated state if both ready
                    if session.p1_ready and session.p2_ready:
                        broadcast_time = ws_logger.broadcast(
                            game_id=game_id,
                            payload={
                                'type': 'game_start',
                                'players': state_snapshot
                            },
                            client_count=len(manager.connections.get(game_id, []))
                        )
                        
                        # End the flow
                        total_latency = ws_logger.flow_end(
                            game_id, 
                            'ready_to_broadcast', 
                            flow_start
                        )
                        
                        # Log both players ready milestone
                        ws_logger.latency('ready_to_game_start', receive_time)
                        
                        await manager.broadcast(game_id, {
                            'type': 'game_start',
                            'players': state_snapshot
                        })
            
            elif data.get("type") == "input":
                # Log input with latency
                ws_logger.receive(game_id, player_id, data)
                # ... handle input ...
    
    except WebSocketDisconnect:
        ws_logger.connection(
            game_id=game_id,
            player_id=player_id,
            state='close',
            metadata={'reason': 'disconnect'}
        )
        if game_id in manager.connections:
            manager.connections[game_id].discard(websocket)
    
    except Exception as e:
        ws_logger.error(
            game_id=game_id,
            player_id=player_id,
            message=f"WebSocket error: {str(e)}",
            exc=e
        )
        # ... handle error ...


# OPTIONAL: Add debug endpoint to export logs
@router.get("/debug/ws-logs/{game_id}")
async def get_ws_logs(game_id: str):
    """Export current WebSocket logs for debugging"""
    return ws_logger.export()


@router.get("/debug/ws-summary")
async def get_ws_summary():
    """Get summary of WebSocket logging"""
    return ws_logger.summary()


# Usage examples in production/testing:
# 1. View logs in real-time:
#    make logs | grep "\[WS"
#
# 2. Get complete log export via API:
#    curl https://localhost:8443/api/game/debug/ws-logs/game-123
#
# 3. See summary statistics:
#    curl https://localhost:8443/api/game/debug/ws-summary
#
# 4. Expected output pattern:
#    [2026-04-12T14:23:45.123Z] [INFO] [WS Ready] 🔘 Player 5 ready in game-invite-1-2-1234
#    [2026-04-12T14:23:45.124Z] [DEBUG] [WS Send] ↗️  Sent to player 5 in game-invite-1-2-1234
#    [2026-04-12T14:23:45.234Z] [DEBUG] [WS Receive] ↙️  Received from player 2 in game-invite-1-2-1234
#    [2026-04-12T14:23:45.235Z] [INFO] [WS Broadcast] 📡 Broadcasted to 2 clients in game-invite-1-2-1234
#    [2026-04-12T14:23:45.236Z] [INFO] [WS Latency] ⏱️  ready_to_broadcast: 112.45ms
#    [2026-04-12T14:23:45.237Z] [INFO] [WS Flow] ✅ Completed ready_to_broadcast in game-invite-1-2-1234: 112.45ms total
