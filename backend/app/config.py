import os
from pathlib import Path


class Settings:
    def __init__(self) -> None:
        self.pdfs_dir = Path(os.environ.get("PDFS_DIR", "./pdfs")).resolve()


settings = Settings()


def ensure_pdfs_dir(pdfs_dir: Path | None = None) -> Path:
    """Create the PDFs directory if it does not already exist. Idempotent."""
    target = pdfs_dir if pdfs_dir is not None else settings.pdfs_dir
    target.mkdir(parents=True, exist_ok=True)
    return target
