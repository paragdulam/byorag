import subprocess

import pytest

from app.system import service


def test_get_hardware_profile_success(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(service.psutil, "cpu_count", lambda logical=True: 8)
    monkeypatch.setattr(
        service.psutil,
        "virtual_memory",
        lambda: type("Mem", (), {"total": 16 * 1024**3})(),
    )
    monkeypatch.setattr(service.platform, "processor", lambda: "x86_64")
    monkeypatch.setattr(service, "detect_gpu", lambda: (False, None))

    profile = service.get_hardware_profile()

    assert profile.detectionFailed is False
    assert profile.cpuCores == 8
    assert profile.totalMemoryGb == 16.0
    assert profile.processorName == "x86_64"
    assert profile.gpuDetected is False
    assert profile.gpuName is None


def test_get_hardware_profile_detection_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(*args: object, **kwargs: object) -> None:
        raise RuntimeError("psutil exploded")

    monkeypatch.setattr(service.psutil, "cpu_count", boom)
    monkeypatch.setattr(service, "detect_gpu", lambda: (False, None))

    profile = service.get_hardware_profile()

    assert profile.detectionFailed is True
    assert profile.cpuCores is None
    assert profile.totalMemoryGb is None
    assert profile.processorName is None


def test_get_hardware_profile_includes_gpu_when_detection_succeeds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(service.psutil, "cpu_count", lambda logical=True: 16)
    monkeypatch.setattr(
        service.psutil,
        "virtual_memory",
        lambda: type("Mem", (), {"total": 32 * 1024**3})(),
    )
    monkeypatch.setattr(service.platform, "processor", lambda: "arm")
    monkeypatch.setattr(service, "detect_gpu", lambda: (True, "NVIDIA GeForce RTX 4090"))

    profile = service.get_hardware_profile()

    assert profile.gpuDetected is True
    assert profile.gpuName == "NVIDIA GeForce RTX 4090"


def test_detect_gpu_present(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeResult:
        returncode = 0
        stdout = "NVIDIA GeForce RTX 4090\n"

    monkeypatch.setattr(service.subprocess, "run", lambda *a, **k: FakeResult())

    detected, name = service.detect_gpu()

    assert detected is True
    assert name == "NVIDIA GeForce RTX 4090"


def test_detect_gpu_absent_from_path(monkeypatch: pytest.MonkeyPatch) -> None:
    def raise_not_found(*args: object, **kwargs: object) -> None:
        raise FileNotFoundError

    monkeypatch.setattr(service.subprocess, "run", raise_not_found)

    detected, name = service.detect_gpu()

    assert detected is False
    assert name is None


def test_detect_gpu_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    def raise_timeout(*args: object, **kwargs: object) -> None:
        raise subprocess.TimeoutExpired(cmd="nvidia-smi", timeout=2)

    monkeypatch.setattr(service.subprocess, "run", raise_timeout)

    detected, name = service.detect_gpu()

    assert detected is False
    assert name is None


def test_detect_gpu_nonzero_returncode(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeResult:
        returncode = 1
        stdout = ""

    monkeypatch.setattr(service.subprocess, "run", lambda *a, **k: FakeResult())

    detected, name = service.detect_gpu()

    assert detected is False
    assert name is None


def test_detect_gpu_empty_output(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeResult:
        returncode = 0
        stdout = "\n"

    monkeypatch.setattr(service.subprocess, "run", lambda *a, **k: FakeResult())

    detected, name = service.detect_gpu()

    assert detected is False
    assert name is None
