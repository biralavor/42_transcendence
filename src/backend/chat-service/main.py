import sys
sys.path.insert(0, "/app/shared")

from fastapi import FastAPI

app = FastAPI(title="Chat Service")


@app.get("/health")
def health():
    return {"status": "ok", "service": "chat-service"}


@app.get("/")
def root():
    return {"message": "Chat Service"}
