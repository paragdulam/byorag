import { useSystemCapacity } from '../../hooks/useSystemCapacity'

export function SystemCapacityWidget() {
  const { status, hardware, estimate } = useSystemCapacity()

  if (status === 'loading') {
    return (
      <div
        className="rounded-lg border border-outline-variant bg-surface-container p-6"
        role="status"
      >
        <div className="font-mono text-xs font-medium tracking-widest text-tertiary">
          SYSTEM CAPACITY
        </div>
        <div className="mt-2 text-sm text-on-surface-variant">Detecting hardware…</div>
      </div>
    )
  }

  if (status === 'fallback' || !hardware) {
    return (
      <div className="rounded-lg border border-outline-variant bg-surface-container p-6">
        <div className="font-mono text-xs font-medium tracking-widest text-tertiary">
          SYSTEM CAPACITY
        </div>
        <div className="mt-2 text-sm text-on-surface-variant">
          Hardware information unavailable
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container p-6">
      <div className="font-mono text-xs font-medium tracking-widest text-tertiary">
        SYSTEM CAPACITY
      </div>

      <dl className="mt-2 space-y-1 text-sm text-on-surface-variant">
        <div>
          <dt className="sr-only">Processor</dt>
          <dd>
            {hardware.processorName ?? 'Unknown processor'}
            {hardware.cpuCores != null ? ` (${hardware.cpuCores} cores)` : ''}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Memory</dt>
          <dd>{hardware.totalMemoryGb != null ? `${hardware.totalMemoryGb} GB RAM` : 'Unknown memory'}</dd>
        </div>
        <div>
          <dt className="sr-only">GPU</dt>
          <dd>{hardware.gpuDetected ? hardware.gpuName : 'No dedicated GPU detected'}</dd>
        </div>
      </dl>

      {estimate && (
        <div className="mt-4 border-t border-outline-variant pt-4 text-sm text-on-surface-variant">
          <div>~{estimate.maxPdfCount} PDFs (estimated)</div>
          <div>~{estimate.maxTotalSizeGb} GB total (estimated)</div>
          <div className="mt-1 text-xs">
            {estimate.basis === 'cpu-only' ? 'CPU-only estimate' : 'GPU-accelerated estimate'}
          </div>
        </div>
      )}
    </div>
  )
}
