export interface SystemHardwareProfile {
  processorName: string | null
  cpuCores: number | null
  totalMemoryGb: number | null
  gpuDetected: boolean
  gpuName: string | null
  detectionFailed: boolean
}

export type PdfCapacityEstimateBasis = 'full' | 'cpu-only'

export interface PdfCapacityEstimate {
  maxPdfCount: number
  maxTotalSizeGb: number
  basis: PdfCapacityEstimateBasis
}

export interface SystemCapacity {
  hardware: SystemHardwareProfile
  estimate: PdfCapacityEstimate | null
}
