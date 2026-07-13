from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.chunking.router import router as chunking_router
from app.config import ensure_pdfs_dir
from app.sources.router import router as sources_router
from app.system.router import router as system_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_pdfs_dir()
    yield


app = FastAPI(title="byorag backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sources_router)
app.include_router(system_router)
app.include_router(chunking_router)
