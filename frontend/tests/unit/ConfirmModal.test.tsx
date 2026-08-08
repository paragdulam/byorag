import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmModal } from '../../src/components/shared/ConfirmModal'

describe('ConfirmModal', () => {
  it('renders the given title and message', () => {
    render(
      <ConfirmModal
        title="Delete document"
        message='Delete "report.pdf"? This cannot be undone.'
        confirmLabel="Delete"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Delete document' })).toBeInTheDocument()
    expect(screen.getByText('Delete "report.pdf"? This cannot be undone.')).toBeInTheDocument()
  })

  it('is an aria-modal dialog', () => {
    render(
      <ConfirmModal
        title="Delete document"
        message="Are you sure?"
        confirmLabel="Delete"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmModal
        title="Delete document"
        message="Are you sure?"
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmModal
        title="Delete document"
        message="Are you sure?"
        confirmLabel="Delete"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel when the backdrop is clicked, matching ComparisonModal', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmModal
        title="Delete document"
        message="Are you sure?"
        confirmLabel="Delete"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByTestId('confirm-modal-backdrop'))

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does not call onCancel when the dialog panel itself is clicked', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmModal
        title="Delete document"
        message="Are you sure?"
        confirmLabel="Delete"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByRole('dialog'))

    expect(onCancel).not.toHaveBeenCalled()
  })

  it('uses a custom cancelLabel when provided', () => {
    render(
      <ConfirmModal
        title="Delete document"
        message="Are you sure?"
        confirmLabel="Delete"
        cancelLabel="Never mind"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Never mind' })).toBeInTheDocument()
  })
})
