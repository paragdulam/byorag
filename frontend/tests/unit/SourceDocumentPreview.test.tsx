import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SourceDocumentPreview } from '../../src/components/sources/SourceDocumentPreview'

interface MockDocumentProps {
  file: { url: string; httpHeaders?: Record<string, string> }
  onLoadSuccess?: (result: { numPages: number }) => void
  onLoadError?: () => void
  children?: React.ReactNode
}

let latestDocumentProps: MockDocumentProps | null = null
let pageRenders: { pageNumber: number; scale?: number }[] = []

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: (props: MockDocumentProps) => {
    latestDocumentProps = props
    return <div data-testid="mock-pdf-document">{props.children}</div>
  },
  Page: ({ pageNumber, scale }: { pageNumber: number; scale?: number }) => {
    pageRenders.push({ pageNumber, scale })
    return <div data-testid="mock-pdf-page">Page {pageNumber}</div>
  },
}))

beforeEach(() => {
  latestDocumentProps = null
  pageRenders = []
})

interface CapturedObserver {
  callback: IntersectionObserverCallback
  observedElements: Element[]
}

function installIntersectionObserverMock(): { getLatest: () => CapturedObserver | null } {
  let latest: CapturedObserver | null = null

  class MockIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      latest = { callback, observedElements: [] }
    }
    observe(el: Element) {
      latest?.observedElements.push(el)
    }
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  return { getLatest: () => latest }
}

function fireIntersection(observer: CapturedObserver, ratios: Record<number, number>) {
  const entries = observer.observedElements.map(
    (el) =>
      ({
        target: el,
        intersectionRatio: ratios[Number((el as HTMLElement).dataset.previewPage)] ?? 0,
      }) as IntersectionObserverEntry,
  )
  act(() => {
    observer.callback(entries, {} as IntersectionObserver)
  })
}

describe('SourceDocumentPreview (021-sources-chunking-embeddings-refresh US2)', () => {
  it('shows an empty placeholder when no document is selected', () => {
    render(
      <SourceDocumentPreview documentId={null} isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    expect(screen.getByTestId('source-preview-empty')).toBeInTheDocument()
  })

  it('renders the PDF document pointed at the file endpoint for the selected document', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    expect(latestDocumentProps?.file.url).toBe('/api/sources/doc-1/file')
  })

  it('renders one Page per numPages reported by onLoadSuccess', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    act(() => {
      latestDocumentProps?.onLoadSuccess?.({ numPages: 3 })
    })

    expect(screen.getAllByTestId('mock-pdf-page')).toHaveLength(3)
  })

  it('shows a "preview unavailable" message when the document fails to load', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    act(() => {
      latestDocumentProps?.onLoadError?.()
    })

    expect(screen.getByTestId('source-preview-unavailable')).toBeInTheDocument()
  })
})

describe('SourceDocumentPreview — fullscreen toggle (023-pdf-fullscreen-chunk-view US1)', () => {
  it('does not show a "Chunked Preview" or "Back to PDF" button', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    expect(screen.queryByRole('button', { name: /chunked preview/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /back to pdf/i })).not.toBeInTheDocument()
  })

  it('shows a "Fullscreen" button when not in fullscreen', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    const toggle = screen.getByTestId('source-preview-fullscreen-toggle')
    expect(toggle).toHaveTextContent(/fullscreen/i)
    expect(toggle).not.toHaveTextContent(/restore/i)
  })

  it('shows a "Restore" button when in fullscreen', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={true} onToggleFullscreen={vi.fn()} />,
    )

    const toggle = screen.getByTestId('source-preview-fullscreen-toggle')
    expect(toggle).toHaveTextContent(/restore/i)
  })

  it('calls onToggleFullscreen when the toggle button is clicked', async () => {
    const onToggleFullscreen = vi.fn()
    render(
      <SourceDocumentPreview
        documentId="doc-1"
        isFullscreen={false}
        onToggleFullscreen={onToggleFullscreen}
      />,
    )

    await userEvent.click(screen.getByTestId('source-preview-fullscreen-toggle'))

    expect(onToggleFullscreen).toHaveBeenCalledTimes(1)
  })

  it('renders every page continuously regardless of fullscreen state', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={true} onToggleFullscreen={vi.fn()} />,
    )

    act(() => {
      latestDocumentProps?.onLoadSuccess?.({ numPages: 3 })
    })

    expect(screen.getAllByTestId('mock-pdf-page')).toHaveLength(3)
  })
})

describe('SourceDocumentPreview — zoom in (026-pdf-preview-zoom-pan US1)', () => {
  it('shows a zoom level of 100% by default', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    expect(screen.getByTestId('source-preview-zoom-level')).toHaveTextContent('100%')
  })

  it('increases the zoom level and the scale passed to Page when zoom-in is clicked', async () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )
    act(() => {
      latestDocumentProps?.onLoadSuccess?.({ numPages: 1 })
    })

    await userEvent.click(screen.getByTestId('source-preview-zoom-in'))

    expect(screen.getByTestId('source-preview-zoom-level')).toHaveTextContent('125%')
    expect(pageRenders.at(-1)?.scale).toBe(1.25)
  })

  it('disables zoom-in once the maximum zoom level (400%) is reached', async () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )
    const zoomInButton = screen.getByTestId('source-preview-zoom-in')

    for (let i = 0; i < 20; i++) {
      await userEvent.click(zoomInButton)
    }

    expect(screen.getByTestId('source-preview-zoom-level')).toHaveTextContent('400%')
    expect(zoomInButton).toBeDisabled()
  })
})

describe('SourceDocumentPreview — pan while zoomed (026-pdf-preview-zoom-pan US2)', () => {
  function setScrollable(element: HTMLElement) {
    Object.defineProperty(element, 'scrollLeft', { value: 0, writable: true })
    Object.defineProperty(element, 'scrollTop', { value: 0, writable: true })
  }

  it('pans the scroll container via pointer drag once zoomed in', async () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )
    await userEvent.click(screen.getByTestId('source-preview-zoom-in'))

    const scrollArea = screen.getByTestId('source-preview-scroll-area')
    setScrollable(scrollArea)

    fireEvent.pointerDown(scrollArea, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(scrollArea, { clientX: 60, clientY: 70, pointerId: 1 })
    fireEvent.pointerUp(scrollArea, { pointerId: 1 })

    expect(scrollArea.scrollLeft).toBe(40)
    expect(scrollArea.scrollTop).toBe(30)
  })

  it('does not pan on drag while at the default (unzoomed) level', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    const scrollArea = screen.getByTestId('source-preview-scroll-area')
    setScrollable(scrollArea)

    fireEvent.pointerDown(scrollArea, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(scrollArea, { clientX: 60, clientY: 70, pointerId: 1 })
    fireEvent.pointerUp(scrollArea, { pointerId: 1 })

    expect(scrollArea.scrollLeft).toBe(0)
    expect(scrollArea.scrollTop).toBe(0)
  })

  it('disables pointer events on the page content — pan wins over text selection — once zoomed in', async () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    const pageContent = screen.getByTestId('source-preview-page-content')
    expect(pageContent).not.toHaveStyle({ pointerEvents: 'none' })

    await userEvent.click(screen.getByTestId('source-preview-zoom-in'))

    expect(pageContent).toHaveStyle({ pointerEvents: 'none' })
  })
})

describe('SourceDocumentPreview — return to default view (026-pdf-preview-zoom-pan US3)', () => {
  it('decreases the zoom level when zoom-out is clicked and stops at 100%', async () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    await userEvent.click(screen.getByTestId('source-preview-zoom-in'))
    await userEvent.click(screen.getByTestId('source-preview-zoom-in'))
    expect(screen.getByTestId('source-preview-zoom-level')).toHaveTextContent('150%')

    const zoomOutButton = screen.getByTestId('source-preview-zoom-out')
    await userEvent.click(zoomOutButton)
    expect(screen.getByTestId('source-preview-zoom-level')).toHaveTextContent('125%')

    await userEvent.click(zoomOutButton)
    expect(screen.getByTestId('source-preview-zoom-level')).toHaveTextContent('100%')
    expect(zoomOutButton).toBeDisabled()
  })

  it('disables zoom-out at the default (100%) zoom level', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    expect(screen.getByTestId('source-preview-zoom-out')).toBeDisabled()
  })

  it('resets to exactly 100% in one click from any zoom level', async () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    const zoomInButton = screen.getByTestId('source-preview-zoom-in')
    await userEvent.click(zoomInButton)
    await userEvent.click(zoomInButton)
    await userEvent.click(zoomInButton)
    expect(screen.getByTestId('source-preview-zoom-level')).toHaveTextContent('175%')

    await userEvent.click(screen.getByTestId('source-preview-zoom-reset'))

    expect(screen.getByTestId('source-preview-zoom-level')).toHaveTextContent('100%')
  })
})

describe('SourceDocumentPreview — fixed-width viewport while zoomed (028-golden-dataset-split-view US2)', () => {
  it('marks the root container and the scroll area min-width: 0, so they can shrink below their zoomed content instead of growing (research.md §1)', () => {
    const { container } = render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    const root = container.firstElementChild as HTMLElement
    expect(root.className).toMatch(/\bmin-w-0\b/)
    expect(screen.getByTestId('source-preview-scroll-area').className).toMatch(/\bmin-w-0\b/)
  })
})

describe('SourceDocumentPreview — page indicator (029-pdf-preview-page-count US1)', () => {
  it('shows "Page 1 of N" once the document finishes loading, before any scroll', () => {
    const { getLatest } = installIntersectionObserverMock()
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    act(() => {
      latestDocumentProps?.onLoadSuccess?.({ numPages: 3 })
    })

    expect(screen.getByTestId('source-preview-page-indicator')).toHaveTextContent('Page 1 of 3')
    expect(getLatest()).not.toBeNull()
  })

  it('updates the current page when a later page becomes predominantly visible', () => {
    const { getLatest } = installIntersectionObserverMock()
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )
    act(() => {
      latestDocumentProps?.onLoadSuccess?.({ numPages: 3 })
    })

    const observer = getLatest()
    if (!observer) throw new Error('observer not captured')
    fireIntersection(observer, { 1: 0.1, 2: 0.9, 3: 0 })

    expect(screen.getByTestId('source-preview-page-indicator')).toHaveTextContent('Page 2 of 3')
  })

  it('updates back to an earlier page when it becomes predominantly visible again', () => {
    const { getLatest } = installIntersectionObserverMock()
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )
    act(() => {
      latestDocumentProps?.onLoadSuccess?.({ numPages: 3 })
    })

    const observer = getLatest()
    if (!observer) throw new Error('observer not captured')
    fireIntersection(observer, { 1: 0, 2: 0.9, 3: 0.1 })
    fireIntersection(observer, { 1: 0.9, 2: 0.1, 3: 0 })

    expect(screen.getByTestId('source-preview-page-indicator')).toHaveTextContent('Page 1 of 3')
  })
})

describe('SourceDocumentPreview — page indicator stays correct while zooming (029-pdf-preview-page-count US2)', () => {
  it('does not change the indicator by itself when zoom-in or zoom-out is clicked', async () => {
    const { getLatest } = installIntersectionObserverMock()
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )
    act(() => {
      latestDocumentProps?.onLoadSuccess?.({ numPages: 3 })
    })

    const observer = getLatest()
    if (!observer) throw new Error('observer not captured')
    fireIntersection(observer, { 1: 0, 2: 0.9, 3: 0.1 })
    expect(screen.getByTestId('source-preview-page-indicator')).toHaveTextContent('Page 2 of 3')

    await userEvent.click(screen.getByTestId('source-preview-zoom-in'))
    expect(screen.getByTestId('source-preview-page-indicator')).toHaveTextContent('Page 2 of 3')

    await userEvent.click(screen.getByTestId('source-preview-zoom-out'))
    expect(screen.getByTestId('source-preview-page-indicator')).toHaveTextContent('Page 2 of 3')
  })
})

describe('SourceDocumentPreview — page indicator loading/error/empty/switch states (029-pdf-preview-page-count US3)', () => {
  it('shows no indicator when no document is selected', () => {
    render(
      <SourceDocumentPreview documentId={null} isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    expect(screen.queryByTestId('source-preview-page-indicator')).not.toBeInTheDocument()
  })

  it('shows no indicator before the document has finished loading', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    expect(screen.queryByTestId('source-preview-page-indicator')).not.toBeInTheDocument()
  })

  it('shows no indicator when the document fails to load', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    act(() => {
      latestDocumentProps?.onLoadError?.()
    })

    expect(screen.queryByTestId('source-preview-page-indicator')).not.toBeInTheDocument()
  })

  it('resets to the newly selected document\'s own page count on documentId change, never showing the previous document\'s values', () => {
    const { rerender } = render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )
    act(() => {
      latestDocumentProps?.onLoadSuccess?.({ numPages: 3 })
    })
    expect(screen.getByTestId('source-preview-page-indicator')).toHaveTextContent('Page 1 of 3')

    rerender(
      <SourceDocumentPreview documentId="doc-2" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )
    expect(screen.queryByTestId('source-preview-page-indicator')).not.toBeInTheDocument()

    act(() => {
      latestDocumentProps?.onLoadSuccess?.({ numPages: 5 })
    })
    expect(screen.getByTestId('source-preview-page-indicator')).toHaveTextContent('Page 1 of 5')
  })
})

describe('SourceDocumentPreview — zoom persists across pages (026-pdf-preview-zoom-pan US2, FR-009)', () => {
  it('applies the same scale to every rendered page', async () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )
    act(() => {
      latestDocumentProps?.onLoadSuccess?.({ numPages: 3 })
    })

    await userEvent.click(screen.getByTestId('source-preview-zoom-in'))

    const lastScalePerPage = new Map<number, number | undefined>()
    for (const pageRender of pageRenders) {
      lastScalePerPage.set(pageRender.pageNumber, pageRender.scale)
    }

    expect(lastScalePerPage.get(1)).toBe(1.25)
    expect(lastScalePerPage.get(2)).toBe(1.25)
    expect(lastScalePerPage.get(3)).toBe(1.25)
  })
})
