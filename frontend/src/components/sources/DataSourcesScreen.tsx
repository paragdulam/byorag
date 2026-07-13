import { AppShell } from '../layout/AppShell'
import type { ScreenId } from '../layout/SidebarNav'
import { SystemCapacityWidget } from './SystemCapacityWidget'
import { UploadDropzone } from './UploadDropzone'
import { DocumentList } from './DocumentList'
import { useSourceDocuments } from '../../hooks/useSourceDocuments'
import { MAX_UPLOAD_SIZE_BYTES, ACCEPTED_UPLOAD_TYPES } from '../../lib/uploadConstraints'
import { exportCsv } from '../../lib/exportCsv'

function formatDeletionErrorMessage(result: { id: string; reason: string | null }): string {
  return `${result.id}: ${result.reason ?? 'Could not be deleted'}`
}

export interface DataSourcesScreenProps {
  onNavigate: (screen: ScreenId) => void
}

export function DataSourcesScreen({ onNavigate }: DataSourcesScreenProps) {
  const { documents, rejections, deletionErrors, isLoading, addFiles, deleteDocuments } =
    useSourceDocuments()

  return (
    <AppShell activeScreen="sources" onNavigate={onNavigate}>
      <div className="flex items-start justify-between gap-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">Data Sources</h1>
          <p className="mt-2 text-on-surface-variant">Manage ingestion pipelines.</p>
        </div>
        <SystemCapacityWidget />
      </div>

      <UploadDropzone
        onFilesSelected={addFiles}
        maxSizeBytes={MAX_UPLOAD_SIZE_BYTES}
        acceptedTypes={ACCEPTED_UPLOAD_TYPES}
        rejections={rejections}
      />

      {isLoading ? (
        <p className="mt-8 text-on-surface-variant" role="status">
          Loading documents…
        </p>
      ) : (
        <DocumentList
          documents={documents}
          onExportCsv={() => exportCsv(documents)}
          onDeleteDocuments={deleteDocuments}
        />
      )}

      {deletionErrors.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1" aria-label="Deletion errors">
          {deletionErrors.map((result, index) => (
            <li
              key={`${result.id}-${index}`}
              role="alert"
              className="rounded border border-error/40 bg-error-container/10 px-4 py-2 text-sm text-error"
            >
              {formatDeletionErrorMessage(result)}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}
