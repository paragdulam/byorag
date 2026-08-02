import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EvidenceChunkPicker } from '../../src/components/golden-dataset/EvidenceChunkPicker'
import type { GoldenCandidate } from '../../src/types/goldenDataset'

const candidates: GoldenCandidate[] = [
  {
    chunkId: 'chunk-both',
    documentId: 'doc-1',
    chunkIndex: 0,
    content: 'Either party may terminate with 30 days notice.',
    matchedQuestion: true,
    matchedAnswer: true,
  },
  {
    chunkId: 'chunk-question-only',
    documentId: 'doc-1',
    chunkIndex: 1,
    content: 'This agreement is governed by the laws of Delaware.',
    matchedQuestion: true,
    matchedAnswer: false,
  },
  {
    chunkId: 'chunk-answer-only',
    documentId: 'doc-1',
    chunkIndex: 2,
    content: 'Notice must be delivered in writing.',
    matchedQuestion: false,
    matchedAnswer: true,
  },
]

describe('EvidenceChunkPicker (026-golden-dataset US1)', () => {
  it('renders each candidate as a checkbox with a match-source badge', () => {
    render(
      <EvidenceChunkPicker
        candidates={candidates}
        selectedChunkIds={new Set()}
        onToggle={vi.fn()}
        onManualSearch={vi.fn()}
      />,
    )

    expect(screen.getByRole('checkbox', { name: /30 days notice/i })).toBeInTheDocument()
    expect(screen.getByText(/matched both/i)).toBeInTheDocument()
    expect(screen.getByText(/matched question/i)).toBeInTheDocument()
    expect(screen.getByText(/matched answer/i)).toBeInTheDocument()
  })

  it('pre-checks candidates that matched both searches by default via selectedChunkIds', () => {
    render(
      <EvidenceChunkPicker
        candidates={candidates}
        selectedChunkIds={new Set(['chunk-both'])}
        onToggle={vi.fn()}
        onManualSearch={vi.fn()}
      />,
    )

    expect(screen.getByRole('checkbox', { name: /30 days notice/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /governed by the laws/i })).not.toBeChecked()
  })

  it('calls onToggle with the chunk id when a checkbox is clicked', async () => {
    const onToggle = vi.fn()
    render(
      <EvidenceChunkPicker
        candidates={candidates}
        selectedChunkIds={new Set()}
        onToggle={onToggle}
        onManualSearch={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('checkbox', { name: /30 days notice/i }))

    expect(onToggle).toHaveBeenCalledWith('chunk-both', candidates[0])
  })

  it('lets the user manually search for and surface chunks beyond the candidate list', async () => {
    const onManualSearch = vi.fn()
    render(
      <EvidenceChunkPicker
        candidates={candidates}
        selectedChunkIds={new Set()}
        onToggle={vi.fn()}
        onManualSearch={onManualSearch}
      />,
    )

    await userEvent.type(screen.getByLabelText(/search for more chunks/i), 'termination clause')
    await userEvent.click(screen.getByRole('button', { name: /search/i }))

    expect(onManualSearch).toHaveBeenCalledWith('termination clause')
  })
})
