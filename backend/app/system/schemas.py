from typing import Literal

from pydantic import BaseModel

PdfCapacityEstimateBasis = Literal["full", "cpu-only"]


class HardwareProfile(BaseModel):
    processorName: str | None
    cpuCores: int | None
    totalMemoryGb: float | None
    gpuDetected: bool
    gpuName: str | None
    detectionFailed: bool


class PdfCapacityEstimate(BaseModel):
    maxPdfCount: int
    maxTotalSizeGb: float
    basis: PdfCapacityEstimateBasis


class SystemCapacityResponse(BaseModel):
    hardware: HardwareProfile
    estimate: PdfCapacityEstimate | None
