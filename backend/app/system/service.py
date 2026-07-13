import platform
import subprocess

import psutil

from app.system.schemas import HardwareProfile, PdfCapacityEstimate

NVIDIA_SMI_TIMEOUT_SECONDS = 2

# Capacity-estimate formula constants (research.md §4). Reference values are
# a "high-end consumer workstation" ceiling: hardware at or above these
# yields the base PDF count/size; below it, the estimate scales down
# proportionally, weighted by RAM (dominant), then CPU, then GPU.
RAM_REFERENCE_GB = 32
CPU_REFERENCE_CORES = 16
RAM_WEIGHT = 0.6
CPU_WEIGHT = 0.25
GPU_WEIGHT = 0.15
BASE_PDF_COUNT = 300
BASE_SIZE_GB = 6.0
MIN_SCORE = 0.1


def detect_gpu() -> tuple[bool, str | None]:
    """Best-effort dedicated GPU detection via nvidia-smi. False is the
    expected, non-error result when no NVIDIA GPU is present/passed through
    (research.md §3)."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
            capture_output=True,
            text=True,
            timeout=NVIDIA_SMI_TIMEOUT_SECONDS,
        )
    except (OSError, subprocess.TimeoutExpired):
        return False, None

    if result.returncode != 0:
        return False, None

    name = result.stdout.strip().splitlines()[0].strip() if result.stdout.strip() else ""
    if not name:
        return False, None

    return True, name


def get_hardware_profile() -> HardwareProfile:
    gpu_detected, gpu_name = detect_gpu()

    try:
        cpu_cores = psutil.cpu_count(logical=True)
        total_memory_gb = round(psutil.virtual_memory().total / (1024**3), 1)
        processor_name = platform.processor() or platform.machine() or None
    except Exception:
        return HardwareProfile(
            processorName=None,
            cpuCores=None,
            totalMemoryGb=None,
            gpuDetected=gpu_detected,
            gpuName=gpu_name,
            detectionFailed=True,
        )

    return HardwareProfile(
        processorName=processor_name,
        cpuCores=cpu_cores,
        totalMemoryGb=total_memory_gb,
        gpuDetected=gpu_detected,
        gpuName=gpu_name,
        detectionFailed=False,
    )


def compute_capacity_estimate(
    total_memory_gb: float, cpu_cores: int, gpu_detected: bool
) -> PdfCapacityEstimate:
    """Order-of-magnitude PDF processing capacity estimate for the full
    local RAG workflow (chunking, embedding, vector semantic search),
    derived from a weighted RAM/CPU/GPU score (research.md §4)."""
    ram_component = min(total_memory_gb / RAM_REFERENCE_GB, 1.0)
    cpu_component = min(cpu_cores / CPU_REFERENCE_CORES, 1.0)
    gpu_component = 1.0 if gpu_detected else 0.0

    score = (
        RAM_WEIGHT * ram_component + CPU_WEIGHT * cpu_component + GPU_WEIGHT * gpu_component
    )
    effective_score = max(score, MIN_SCORE)

    return PdfCapacityEstimate(
        maxPdfCount=round(BASE_PDF_COUNT * effective_score),
        maxTotalSizeGb=round(BASE_SIZE_GB * effective_score, 1),
        basis="full" if gpu_detected else "cpu-only",
    )
