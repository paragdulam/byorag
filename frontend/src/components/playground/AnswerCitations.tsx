import { type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import type { TurnChunk } from '../../types/playground'

export interface AnswerCitationsProps {
  answer: string
  chunks: TurnChunk[]
  onCiteClick: (chunk: TurnChunk) => void
}

const CITATION_MARKER_PATTERN = /\[(\d+)\]/g

const MARKDOWN_CLASS_NAME =
  'inline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:rounded [&_code]:bg-surface-container-high [&_code]:px-1 [&_p]:inline'

/**
 * Renders `answer` with `[N]` citation markers (contracts/citation-marker-syntax.md) replaced
 * by an info-icon button that opens the cited chunk — everything else still renders through
 * `ReactMarkdown` exactly as before. An out-of-range `N` (no matching `turn.chunks[N-1]`) has
 * its marker text silently dropped rather than showing a broken/dead icon.
 */
export function AnswerCitations({ answer, chunks, onCiteClick }: AnswerCitationsProps) {
  const parts: ReactNode[] = []
  let lastIndex = 0
  let key = 0
  const pattern = new RegExp(CITATION_MARKER_PATTERN)
  let match: RegExpExecArray | null

  while ((match = pattern.exec(answer)) !== null) {
    const position = Number(match[1])
    const start = match.index
    const end = start + match[0].length

    const textBefore = answer.slice(lastIndex, start)
    if (textBefore) {
      parts.push(
        <span key={key++} className={MARKDOWN_CLASS_NAME}>
          <ReactMarkdown>{textBefore}</ReactMarkdown>
        </span>,
      )
    }

    const chunk = chunks[position - 1]
    if (chunk) {
      parts.push(
        <button
          key={key++}
          type="button"
          aria-label={`View source for citation ${position}`}
          onClick={() => onCiteClick(chunk)}
          className="mx-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-container text-[10px] leading-none text-on-primary-container align-middle"
        >
          ⓘ
        </button>,
      )
    }
    // Out-of-range markers: the [N] text itself is simply not re-added below — no icon.

    lastIndex = end
  }

  const remaining = answer.slice(lastIndex)
  if (remaining) {
    parts.push(
      <span key={key++} className={MARKDOWN_CLASS_NAME}>
        <ReactMarkdown>{remaining}</ReactMarkdown>
      </span>,
    )
  }

  return <>{parts}</>
}
