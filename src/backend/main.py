from fastapi import FastAPI

app = FastAPI(title="Transcendence API")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Transcendence API stub"}
