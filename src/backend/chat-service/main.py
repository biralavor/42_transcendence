import sys
sys.path.insert(0, "/app/shared")
sys.path.insert(0, "/app/service")

from fastapi import FastAPI
from ws.router import router as ws_router

app = FastAPI(title="Chat Service")
app.include_router(ws_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "chat-service"}


@app.get("/")
def root():
    return {"message": "Chat Service"}
