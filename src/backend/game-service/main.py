from fastapi import FastAPI
from service.ws.router import router as ws_router

app = FastAPI(title="Game Service")
app.include_router(ws_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "game-service"}


@app.get("/")
def root():
    return {"message": "Game Service"}
