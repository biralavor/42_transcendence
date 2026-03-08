import sys
sys.path.insert(0, "/app/shared")

from fastapi import FastAPI

app = FastAPI(title="Game Service")


@app.get("/health")
def health():
    return {"status": "ok", "service": "game-service"}


@app.get("/")
def root():
    return {"message": "Game Service"}
