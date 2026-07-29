import type { BlockColorSpan, PreviewBlock } from '../../lib/chunkStructure'

export interface ColoredBlockGroupsProps {
  blocks: PreviewBlock[]
  spansByBlock: BlockColorSpan[][]
}

interface RenderGroup {
  kind: 'single'
  key: number
  block: PreviewBlock
  spans: BlockColorSpan[]
}

interface ListRenderGroup {
  kind: 'list'
  key: number
  items: { block: PreviewBlock; spans: BlockColorSpan[] }[]
}

function groupForRendering(
  blocks: PreviewBlock[],
  spansByBlock: BlockColorSpan[][],
): (RenderGroup | ListRenderGroup)[] {
  const groups: (RenderGroup | ListRenderGroup)[] = []
  let index = 0

  while (index < blocks.length) {
    const block = blocks[index]
    if (block.kind === 'list-item') {
      const groupId = block.listGroupId
      const items: { block: PreviewBlock; spans: BlockColorSpan[] }[] = []
      while (index < blocks.length && blocks[index].kind === 'list-item' && blocks[index].listGroupId === groupId) {
        items.push({ block: blocks[index], spans: spansByBlock[index] })
        index += 1
      }
      groups.push({ kind: 'list', key: index, items })
    } else {
      groups.push({ kind: 'single', key: index, block, spans: spansByBlock[index] })
      index += 1
    }
  }

  return groups
}

function ColoredSpans({ spans }: { spans: BlockColorSpan[] }) {
  return (
    <>
      {spans.map((span, index) => (
        <span key={index} style={{ backgroundColor: span.backgroundColor, color: span.textColor }}>
          {span.text}
        </span>
      ))}
    </>
  )
}

/**
 * Renders classified blocks (heading/paragraph/list-item) with their per-block colored spans as
 * one continuous flow — headings as `<h3>`, list items grouped into `<ul>`, everything else as
 * `<p>`, each with inline colored `<span>` children. Pure/presentational: no data fetching, no
 * document/chunk awareness. Extracted from the original `ChunkedMarkdownView`
 * (022-chunk-preview-ui-fixes) so both the whole-document Sources view and the new page-scoped
 * in-context chunk preview (023-pdf-fullscreen-chunk-view) share identical rendering
 * (research.md §7).
 */
export function ColoredBlockGroups({ blocks, spansByBlock }: ColoredBlockGroupsProps) {
  const groups = groupForRendering(blocks, spansByBlock)

  return (
    <>
      {groups.map((group) => {
        if (group.kind === 'list') {
          return (
            <ul key={group.key} className="list-disc pl-6" data-testid="chunked-preview-list">
              {group.items.map(({ spans }, itemIndex) => (
                <li key={itemIndex}>
                  <ColoredSpans spans={spans} />
                </li>
              ))}
            </ul>
          )
        }

        if (group.block.kind === 'heading') {
          return (
            <h3
              key={group.key}
              data-testid="chunked-preview-heading"
              className="text-lg font-semibold text-on-surface"
            >
              <ColoredSpans spans={group.spans} />
            </h3>
          )
        }

        return (
          <p key={group.key} data-testid="chunked-preview-paragraph" className="text-on-surface">
            <ColoredSpans spans={group.spans} />
          </p>
        )
      })}
    </>
  )
}
