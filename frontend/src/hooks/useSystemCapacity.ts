import { useEffect, useState } from 'react'
import type { PdfCapacityEstimate, SystemHardwareProfile } from '../types/systemCapacity'
import { getSystemCapacity } from '../lib/systemApi'

export type SystemCapacityStatus = 'loading' | 'ready' | 'fallback'

export interface UseSystemCapacity {
  status: SystemCapacityStatus
  hardware: SystemHardwareProfile | null
  estimate: PdfCapacityEstimate | null
}

export function useSystemCapacity(): UseSystemCapacity {
  const [status, setStatus] = useState<SystemCapacityStatus>('loading')
  const [hardware, setHardware] = useState<SystemHardwareProfile | null>(null)
  const [estimate, setEstimate] = useState<PdfCapacityEstimate | null>(null)

  useEffect(() => {
    let cancelled = false

    getSystemCapacity()
      .then((capacity) => {
        if (cancelled) {
          return
        }
        setHardware(capacity.hardware)
        setEstimate(capacity.estimate)
        setStatus(capacity.hardware.detectionFailed ? 'fallback' : 'ready')
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('fallback')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { status, hardware, estimate }
}
