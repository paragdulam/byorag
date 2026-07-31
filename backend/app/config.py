import os
from pathlib import Path


DEFAULT_DATABASE_URL = "postgresql+psycopg://byorag:byorag@localhost:5432/byorag"

# The only registered GENERATION_PROVIDERS key today (research.md Decision 3) — swapping to a
# different provider later is a config change, not a code change, once a second provider module
# is registered.
DEFAULT_GENERATION_PROVIDER = "anthropic"
DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5"


class Settings:
    def __init__(self) -> None:
        self.pdfs_dir = Path(os.environ.get("PDFS_DIR", "./pdfs")).resolve()
        self.database_url = os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)
        self.generation_provider = os.environ.get("GENERATION_PROVIDER", DEFAULT_GENERATION_PROVIDER)
        self.anthropic_model = os.environ.get("ANTHROPIC_MODEL", DEFAULT_ANTHROPIC_MODEL)
        # Keys a per-user Fernet cipher for encrypting/decrypting each user's personal
        # Anthropic API key at rest (025-user-profile-anthropic-key research.md §1) — any
        # string works, it's hashed into a valid 32-byte Fernet key by app/profile/service.py.
        self.key_encryption_secret = os.environ.get("KEY_ENCRYPTION_SECRET", "")


settings = Settings()


def ensure_pdfs_dir(pdfs_dir: Path | None = None) -> Path:
    """Create the PDFs directory if it does not already exist. Idempotent."""
    target = pdfs_dir if pdfs_dir is not None else settings.pdfs_dir
    target.mkdir(parents=True, exist_ok=True)
    return target
