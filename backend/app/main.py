from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.chunking.router import router as chunking_router
from app.config import ensure_pdfs_dir, settings
from app.corpora.router import router as corpora_router
from app.db.base import Base, SessionLocal, check_database_connection, engine, ensure_vector_extension
from app.db.legacy_migration import migrate_legacy_pdfs
from app.db.schema_migrations import ensure_schema_migrations
from app.embeddings.router import router as embeddings_router
from app.metrics.router import router as metrics_router
from app.playground.router import router as playground_router
from app.profile.router import router as profile_router
from app.sources.router import router as sources_router
from app.system.router import router as system_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_pdfs_dir()

    check_database_connection(engine)
    ensure_vector_extension(engine)
    Base.metadata.create_all(engine)
    ensure_schema_migrations(engine)

    with SessionLocal() as db:
        migrate_legacy_pdfs(db, settings.pdfs_dir)

    yield


app = FastAPI(title="byorag backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(corpora_router)
app.include_router(sources_router)
app.include_router(system_router)
app.include_router(chunking_router)
app.include_router(embeddings_router)
app.include_router(playground_router)
app.include_router(metrics_router)
app.include_router(profile_router)
