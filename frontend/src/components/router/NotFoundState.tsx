import { Link } from 'react-router'

export interface NotFoundStateProps {
  message: string
  backHref: string
  backLabel: string
}

/**
 * Shared "not found / no access" UI for an unresolvable route segment — an unrecognized path, a
 * corpusId that doesn't belong to the signed-in user, or a deleted/inaccessible entity (032-deep-
 * linking FR-009). Deliberately generic so it can render either as the whole screen (unknown path,
 * bad corpus) or in place of a screen's own content (e.g. a deleted Golden Dataset entry).
 */
export function NotFoundState({ message, backHref, backLabel }: NotFoundStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <p role="alert" className="text-on-surface-variant">
        {message}
      </p>
      <Link to={backHref} className="text-sm font-medium text-primary hover:underline">
        {backLabel}
      </Link>
    </div>
  )
}
