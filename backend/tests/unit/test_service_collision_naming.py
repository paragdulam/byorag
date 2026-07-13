from app.sources.service import resolve_collision_name


def test_returns_original_name_when_free() -> None:
    assert resolve_collision_name("report.pdf", set()) == "report.pdf"


def test_suffixes_with_one_when_taken() -> None:
    assert resolve_collision_name("report.pdf", {"report.pdf"}) == "report (1).pdf"


def test_increments_suffix_until_free() -> None:
    existing = {"report.pdf", "report (1).pdf", "report (2).pdf"}
    assert resolve_collision_name("report.pdf", existing) == "report (3).pdf"


def test_handles_filenames_without_extension() -> None:
    assert resolve_collision_name("report", {"report"}) == "report (1)"
