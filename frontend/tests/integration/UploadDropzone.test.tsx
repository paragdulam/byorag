import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UploadDropzone } from '../../src/components/sources/UploadDropzone'

const MAX_SIZE_BYTES = 50 * 1024 * 1024
const ACCEPTED_TYPES = ['.pdf', 'application/pdf']

function makeFile(name: string, sizeBytes = 1024, type = 'application/pdf'): File {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

describe('UploadDropzone (US1: upload via drag-and-drop, browse, multi-file)', () => {
  it('shows the max size and accepted type constraint chips', () => {
    render(
      <UploadDropzone
        onFilesSelected={vi.fn()}
        maxSizeBytes={MAX_SIZE_BYTES}
        acceptedTypes={ACCEPTED_TYPES}
      />,
    )

    expect(screen.getByText('Max size: 50MB')).toBeInTheDocument()
    expect(screen.getByText('PDF only')).toBeInTheDocument()
  })

  it('calls onFilesSelected when a file is dropped onto the upload area', () => {
    const onFilesSelected = vi.fn()
    render(
      <UploadDropzone
        onFilesSelected={onFilesSelected}
        maxSizeBytes={MAX_SIZE_BYTES}
        acceptedTypes={ACCEPTED_TYPES}
      />,
    )

    const file = makeFile('report.pdf')
    const dropzone = screen.getByTestId('upload-dropzone')

    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    expect(onFilesSelected).toHaveBeenCalledWith([file])
  })

  it('calls onFilesSelected when files are chosen via the browse input', () => {
    const onFilesSelected = vi.fn()
    render(
      <UploadDropzone
        onFilesSelected={onFilesSelected}
        maxSizeBytes={MAX_SIZE_BYTES}
        acceptedTypes={ACCEPTED_TYPES}
      />,
    )

    const file = makeFile('report.pdf')
    const input = screen.getByTestId('upload-browse-input')

    fireEvent.change(input, { target: { files: [file] } })

    expect(onFilesSelected).toHaveBeenCalledWith([file])
  })

  it('calls onFilesSelected with every file when multiple are dropped at once', () => {
    const onFilesSelected = vi.fn()
    render(
      <UploadDropzone
        onFilesSelected={onFilesSelected}
        maxSizeBytes={MAX_SIZE_BYTES}
        acceptedTypes={ACCEPTED_TYPES}
      />,
    )

    const fileA = makeFile('a.pdf')
    const fileB = makeFile('b.pdf')
    const dropzone = screen.getByTestId('upload-dropzone')

    fireEvent.drop(dropzone, { dataTransfer: { files: [fileA, fileB] } })

    expect(onFilesSelected).toHaveBeenCalledWith([fileA, fileB])
  })
})

describe('UploadDropzone (US2: rejection messages)', () => {
  it('displays a message naming the file and reason for an invalid-type rejection', () => {
    render(
      <UploadDropzone
        onFilesSelected={vi.fn()}
        maxSizeBytes={MAX_SIZE_BYTES}
        acceptedTypes={ACCEPTED_TYPES}
        rejections={[{ fileName: 'notes.txt', reason: 'invalid-type' }]}
      />,
    )

    expect(screen.getByText(/notes\.txt/)).toBeInTheDocument()
    expect(screen.getByText(/not a PDF file/i)).toBeInTheDocument()
  })

  it('displays a message naming the file and reason for a too-large rejection', () => {
    render(
      <UploadDropzone
        onFilesSelected={vi.fn()}
        maxSizeBytes={MAX_SIZE_BYTES}
        acceptedTypes={ACCEPTED_TYPES}
        rejections={[{ fileName: 'huge.pdf', reason: 'too-large' }]}
      />,
    )

    expect(screen.getByText(/huge\.pdf/)).toBeInTheDocument()
    expect(screen.getByText(/exceeds the 50MB limit/i)).toBeInTheDocument()
  })

  it('displays a message naming the file for a server-returned save-failed rejection', () => {
    render(
      <UploadDropzone
        onFilesSelected={vi.fn()}
        maxSizeBytes={MAX_SIZE_BYTES}
        acceptedTypes={ACCEPTED_TYPES}
        rejections={[{ fileName: 'report.pdf', reason: 'save-failed' }]}
      />,
    )

    expect(screen.getByText(/report\.pdf/)).toBeInTheDocument()
    expect(screen.getByText(/could not be saved/i)).toBeInTheDocument()
  })

  it('displays one message per rejection for a mixed valid+invalid batch', () => {
    render(
      <UploadDropzone
        onFilesSelected={vi.fn()}
        maxSizeBytes={MAX_SIZE_BYTES}
        acceptedTypes={ACCEPTED_TYPES}
        rejections={[
          { fileName: 'notes.txt', reason: 'invalid-type' },
          { fileName: 'huge.pdf', reason: 'too-large' },
        ]}
      />,
    )

    expect(screen.getByText(/notes\.txt/)).toBeInTheDocument()
    expect(screen.getByText(/huge\.pdf/)).toBeInTheDocument()
  })
})
