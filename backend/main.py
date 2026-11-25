import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, SessionLocal, engine
from migrate import run_migrations
from routes import ai, approvals, auth, documents, templates, users, workspace
from seed import seed_templates

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

Base.metadata.create_all(bind=engine)
run_migrations(engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        seed_templates(db)
    finally:
        db.close()
    yield


app = FastAPI(title="DAMS API", version="0.2.0", description="Document Automation Management System API", lifespan=lifespan)
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"],
                   allow_headers=["*"], expose_headers=["Content-Disposition"])
for module in (auth, users, templates, documents, approvals, ai, workspace):
    app.include_router(module.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "DAMS API", "version": app.version}
