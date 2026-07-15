import os
from pathlib import Path


DEFAULT_DATABASE_URL = "postgresql+psycopg://byorag:byorag@localhost:5432/byorag"


class Settings:
    def __init__(self) -> None:
        self.pdfs_dir = Path(os.environ.get("PDFS_DIR", "./pdfs")).resolve()
        self.database_url = os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)


settings = Settings()


def ensure_pdfs_dir(pdfs_dir: Path | None = None) -> Path:
    """Create the PDFs directory if it does not already exist. Idempotent."""
    target = pdfs_dir if pdfs_dir is not None else settings.pdfs_dir
    target.mkdir(parents=True, exist_ok=True)
    return target
