from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from app.db.database import init_db
from app.routers import exercises, templates, workouts, agent, auth

app = FastAPI(title="IronLog API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(exercises.router, prefix="/api/v1")
app.include_router(templates.router, prefix="/api/v1")
app.include_router(workouts.router, prefix="/api/v1")
app.include_router(agent.router, prefix="/v1")
app.include_router(auth.router)

@app.on_event("startup")
def startup():
    init_db()

@app.get("/health")
def health():
    return {"status": "ok"}

frontend_path = Path(__file__).parent.parent / "frontend"
if frontend_path.exists():
    app.mount("/app", StaticFiles(directory=str(frontend_path), html=True), name="frontend")

@app.get("/")
def root():
    if (frontend_path / "index.html").exists():
        return FileResponse(str(frontend_path / "index.html"))
    return {"message": "IronLog API", "docs": "/docs"}
