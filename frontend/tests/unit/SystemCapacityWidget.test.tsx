import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SystemCapacityWidget } from '../../src/components/sources/SystemCapacityWidget'
import { useSystemCapacity } from '../../src/hooks/useSystemCapacity'
import type { UseSystemCapacity } from '../../src/hooks/useSystemCapacity'

vi.mock('../../src/hooks/useSystemCapacity')

const mockedUseSystemCapacity = vi.mocked(useSystemCapacity)

function mockState(state: UseSystemCapacity) {
  mockedUseSystemCapacity.mockReturnValue(state)
}

describe('SystemCapacityWidget', () => {
  it('shows a loading state before data arrives', () => {
    mockState({ status: 'loading', hardware: null, estimate: null })

    render(<SystemCapacityWidget />)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows processor info and the detected GPU name when a GPU is present', () => {
    mockState({
      status: 'ready',
      hardware: {
        processorName: 'Apple M2 Pro',
        cpuCores: 12,
        totalMemoryGb: 32.0,
        gpuDetected: true,
        gpuName: 'NVIDIA GeForce RTX 4090',
        detectionFailed: false,
      },
      estimate: { maxPdfCount: 300, maxTotalSizeGb: 6.0, basis: 'full' },
    })

    render(<SystemCapacityWidget />)

    expect(screen.getByText(/Apple M2 Pro/)).toBeInTheDocument()
    expect(screen.getByText(/12/)).toBeInTheDocument()
    expect(screen.getByText(/NVIDIA GeForce RTX 4090/)).toBeInTheDocument()
  })

  it('shows both estimate figures, each labeled as an approximation', () => {
    mockState({
      status: 'ready',
      hardware: {
        processorName: 'Apple M2 Pro',
        cpuCores: 12,
        totalMemoryGb: 32.0,
        gpuDetected: true,
        gpuName: 'NVIDIA GeForce RTX 4090',
        detectionFailed: false,
      },
      estimate: { maxPdfCount: 300, maxTotalSizeGb: 6.0, basis: 'full' },
    })

    render(<SystemCapacityWidget />)

    const pdfCountText = screen.getByText(/300 PDFs/)
    const sizeText = screen.getByText(/6 GB total/)

    expect(pdfCountText).toBeInTheDocument()
    expect(pdfCountText.textContent).toMatch(/(~|estimated)/i)
    expect(sizeText).toBeInTheDocument()
    expect(sizeText.textContent).toMatch(/(~|estimated)/i)
  })

  it('shows an explicit "no dedicated GPU" state when none is detected', () => {
    mockState({
      status: 'ready',
      hardware: {
        processorName: 'x86_64',
        cpuCores: 4,
        totalMemoryGb: 8.0,
        gpuDetected: false,
        gpuName: null,
        detectionFailed: false,
      },
      estimate: { maxPdfCount: 64, maxTotalSizeGb: 1.3, basis: 'cpu-only' },
    })

    render(<SystemCapacityWidget />)

    expect(screen.getByText(/no dedicated gpu/i)).toBeInTheDocument()
  })

  it('shows a fallback message when hardware detection failed', () => {
    mockState({
      status: 'fallback',
      hardware: null,
      estimate: null,
    })

    render(<SystemCapacityWidget />)

    expect(screen.getByText(/hardware information unavailable/i)).toBeInTheDocument()
  })
})
