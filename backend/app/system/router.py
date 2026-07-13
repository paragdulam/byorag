from fastapi import APIRouter

from app.system import service
from app.system.schemas import SystemCapacityResponse

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/capacity", response_model=SystemCapacityResponse)
def get_capacity() -> SystemCapacityResponse:
    hardware = service.get_hardware_profile()

    estimate = None
    if not hardware.detectionFailed:
        estimate = service.compute_capacity_estimate(
            total_memory_gb=hardware.totalMemoryGb,
            cpu_cores=hardware.cpuCores,
            gpu_detected=hardware.gpuDetected,
        )

    return SystemCapacityResponse(hardware=hardware, estimate=estimate)
