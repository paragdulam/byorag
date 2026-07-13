import { useRef, useState, type DragEvent } from 'react'
import type { UploadRejection } from '../../types/sourceDocument'

export interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void
  maxSizeBytes: number
  acceptedTypes: string[]
  rejections?: UploadRejection[]
}

function formatMaxSizeLabel(maxSizeBytes: number): string {
  return `Max size: ${Math.round(maxSizeBytes / (1024 * 1024))}MB`
}

function formatRejectionMessage(rejection: UploadRejection): string {
  const reasonText =
    rejection.reason === 'invalid-type'
      ? 'is not a PDF file'
      : rejection.reason === 'too-large'
        ? 'exceeds the 50MB limit'
        : 'could not be saved (a server error occurred)'
  return `${rejection.fileName} ${reasonText}`
}

export function UploadDropzone({
  onFilesSelected,
  maxSizeBytes,
  acceptedTypes,
  rejections = [],
}: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) {
      onFilesSelected(files)
    }
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleBrowseChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length > 0) {
      onFilesSelected(files)
    }
    event.target.value = ''
  }

  return (
    <div>
      <div
        data-testid="upload-dropzone"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        className={
          'mt-8 flex cursor-pointer flex-col items-center gap-4 rounded-lg border-2 border-dashed p-16 text-center transition-colors ' +
          (isDragOver
            ? 'border-primary-container bg-surface-container'
            : 'border-outline-variant bg-surface-container-low')
        }
      >
        <input
          ref={inputRef}
          data-testid="upload-browse-input"
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          className="hidden"
          onChange={handleBrowseChange}
        />

        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface-container-high">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 16V4m0 0 4 4m-4-4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-semibold text-on-surface">Upload PDF Documents</h2>
        <p className="text-on-surface-variant">Drag and drop your files here, or click to browse</p>

        <div className="mt-2 flex gap-2 font-mono text-xs text-on-surface-variant">
          <span className="rounded-full border border-outline-variant px-3 py-1">
            {formatMaxSizeLabel(maxSizeBytes)}
          </span>
          <span className="rounded-full border border-outline-variant px-3 py-1">PDF only</span>
        </div>
      </div>

      {rejections.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1" aria-label="Upload errors">
          {rejections.map((rejection, index) => (
            <li
              key={`${rejection.fileName}-${index}`}
              role="alert"
              className="rounded border border-error/40 bg-error-container/10 px-4 py-2 text-sm text-error"
            >
              {formatRejectionMessage(rejection)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
