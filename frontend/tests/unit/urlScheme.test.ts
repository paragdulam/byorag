import { describe, expect, it } from 'vitest'
import {
  buildChunkingChunkLink,
  buildDocumentLink,
  buildEntryLink,
  buildNewEntryLink,
  buildPath,
  buildTurnLink,
  buildVectorChunkLink,
  parseRoute,
} from '../../src/router/urlScheme'
import { baseRoute } from '../../src/router/types'

describe('urlScheme (032-deep-linking contracts/url-scheme.md, extended for per-screen entity links)', () => {
  describe('parseRoute', () => {
    it('parses screen-only routes with no corpus segment', () => {
      expect(parseRoute('/corpora')).toEqual(baseRoute('corpora', null))
      expect(parseRoute('/profile')).toEqual(baseRoute('profile', null))
    })

    it('parses corpus-scoped routes with no trailing entity', () => {
      for (const screen of [
        'sources',
        'fixed-size-chunking',
        'embeddings',
        'vector-view',
        'golden-dataset',
        'playground',
        'metrics',
      ] as const) {
        expect(parseRoute(`/${screen}/corpus-1`)).toEqual(baseRoute(screen, 'corpus-1'))
      }
    })

    it('parses a Sources document route', () => {
      expect(parseRoute('/sources/corpus-1/doc-9')).toEqual({
        ...baseRoute('sources', 'corpus-1'),
        documentId: 'doc-9',
      })
    })

    it('parses a Fixed Size Chunking document-only route', () => {
      expect(parseRoute('/fixed-size-chunking/corpus-1/doc-9')).toEqual({
        ...baseRoute('fixed-size-chunking', 'corpus-1'),
        documentId: 'doc-9',
      })
    })

    it('parses a Fixed Size Chunking document+chunk-index route', () => {
      expect(parseRoute('/fixed-size-chunking/corpus-1/doc-9/3')).toEqual({
        ...baseRoute('fixed-size-chunking', 'corpus-1'),
        documentId: 'doc-9',
        chunkIndex: 3,
      })
    })

    it('rejects a non-numeric or malformed Fixed Size Chunking chunk index', () => {
      expect(parseRoute('/fixed-size-chunking/corpus-1/doc-9/not-a-number')).toBeNull()
      expect(parseRoute('/fixed-size-chunking/corpus-1/doc-9/-1')).toBeNull()
      expect(parseRoute('/fixed-size-chunking/corpus-1/doc-9/01')).toBeNull()
    })

    it('parses a Vector View chunk route', () => {
      expect(parseRoute('/vector-view/corpus-1/chunk-9')).toEqual({
        ...baseRoute('vector-view', 'corpus-1'),
        chunkId: 'chunk-9',
      })
    })

    it('parses the Golden Dataset entry route', () => {
      expect(parseRoute('/golden-dataset/corpus-1/entry-9')).toEqual({
        ...baseRoute('golden-dataset', 'corpus-1'),
        entryId: 'entry-9',
      })
    })

    it('parses the Golden Dataset "new entry" route', () => {
      expect(parseRoute('/golden-dataset/corpus-1/new')).toEqual({
        ...baseRoute('golden-dataset', 'corpus-1'),
        isCreatingEntry: true,
      })
    })

    it('parses a Playground turn route', () => {
      expect(parseRoute('/playground/corpus-1/turn-9')).toEqual({
        ...baseRoute('playground', 'corpus-1'),
        turnId: 'turn-9',
      })
    })

    it('parses "/" as null (caller redirects to the default screen)', () => {
      expect(parseRoute('/')).toBeNull()
    })

    it('returns null for an unrecognized path', () => {
      expect(parseRoute('/not-a-real-screen')).toBeNull()
      expect(parseRoute('/not-a-real-screen/corpus-1')).toBeNull()
    })

    it('parses a corpus-scoped screen with no corpus segment as corpusId: null (no corpus selected yet — e.g. a brand-new account with no corpora, matching each screen\'s own existing "select or create a corpus" empty state; FR-011)', () => {
      expect(parseRoute('/playground')).toEqual(baseRoute('playground', null))
    })

    it('returns null for a trailing entity segment on screens that never take one', () => {
      expect(parseRoute('/metrics/corpus-1/entry-9')).toBeNull()
      expect(parseRoute('/embeddings/corpus-1/entry-9')).toBeNull()
    })

    it('returns null for extra segments beyond what a screen supports', () => {
      expect(parseRoute('/sources/corpus-1/doc-9/extra')).toBeNull()
      expect(parseRoute('/vector-view/corpus-1/chunk-9/extra')).toBeNull()
      expect(parseRoute('/golden-dataset/corpus-1/entry-9/extra')).toBeNull()
      expect(parseRoute('/playground/corpus-1/turn-9/extra')).toBeNull()
      expect(parseRoute('/fixed-size-chunking/corpus-1/doc-9/3/extra')).toBeNull()
    })
  })

  describe('buildPath', () => {
    it('builds screen-only paths', () => {
      expect(buildPath(baseRoute('corpora', null))).toBe('/corpora')
      expect(buildPath(baseRoute('profile', null))).toBe('/profile')
    })

    it('builds corpus-scoped paths with no entity', () => {
      expect(buildPath(baseRoute('playground', 'corpus-1'))).toBe('/playground/corpus-1')
    })

    it('builds a Sources document path', () => {
      expect(buildPath({ ...baseRoute('sources', 'corpus-1'), documentId: 'doc-9' })).toBe(
        '/sources/corpus-1/doc-9',
      )
    })

    it('builds a Fixed Size Chunking document+chunk-index path', () => {
      expect(
        buildPath({ ...baseRoute('fixed-size-chunking', 'corpus-1'), documentId: 'doc-9', chunkIndex: 3 }),
      ).toBe('/fixed-size-chunking/corpus-1/doc-9/3')
    })

    it('builds a Vector View chunk path', () => {
      expect(buildPath({ ...baseRoute('vector-view', 'corpus-1'), chunkId: 'chunk-9' })).toBe(
        '/vector-view/corpus-1/chunk-9',
      )
    })

    it('builds the Golden Dataset entry and "new entry" paths', () => {
      expect(buildPath({ ...baseRoute('golden-dataset', 'corpus-1'), entryId: 'entry-9' })).toBe(
        '/golden-dataset/corpus-1/entry-9',
      )
      expect(buildPath({ ...baseRoute('golden-dataset', 'corpus-1'), isCreatingEntry: true })).toBe(
        '/golden-dataset/corpus-1/new',
      )
    })

    it('builds a Playground turn path', () => {
      expect(buildPath({ ...baseRoute('playground', 'corpus-1'), turnId: 'turn-9' })).toBe(
        '/playground/corpus-1/turn-9',
      )
    })

    it('round-trips every path through parseRoute', () => {
      const routes: ReturnType<typeof baseRoute>[] = [
        baseRoute('corpora', null),
        baseRoute('profile', null),
        baseRoute('sources', 'corpus-1'),
        baseRoute('playground', null),
        { ...baseRoute('sources', 'corpus-1'), documentId: 'doc-9' },
        { ...baseRoute('fixed-size-chunking', 'corpus-1'), documentId: 'doc-9', chunkIndex: 3 },
        { ...baseRoute('vector-view', 'corpus-1'), chunkId: 'chunk-9' },
        { ...baseRoute('golden-dataset', 'corpus-1'), entryId: 'entry-9' },
        { ...baseRoute('golden-dataset', 'corpus-1'), isCreatingEntry: true },
        { ...baseRoute('playground', 'corpus-1'), turnId: 'turn-9' },
      ]
      for (const route of routes) {
        expect(parseRoute(buildPath(route))).toEqual(route)
      }
    })
  })

  describe('per-entity link builders', () => {
    it('buildEntryLink', () => {
      expect(buildEntryLink('corpus-1', 'entry-9')).toBe('/golden-dataset/corpus-1/entry-9')
    })

    it('buildNewEntryLink', () => {
      expect(buildNewEntryLink('corpus-1')).toBe('/golden-dataset/corpus-1/new')
    })

    it('buildDocumentLink', () => {
      expect(buildDocumentLink('corpus-1', 'doc-9')).toBe('/sources/corpus-1/doc-9')
    })

    it('buildChunkingChunkLink', () => {
      expect(buildChunkingChunkLink('corpus-1', 'doc-9', 3)).toBe(
        '/fixed-size-chunking/corpus-1/doc-9/3',
      )
    })

    it('buildVectorChunkLink', () => {
      expect(buildVectorChunkLink('corpus-1', 'chunk-9')).toBe('/vector-view/corpus-1/chunk-9')
    })

    it('buildTurnLink', () => {
      expect(buildTurnLink('corpus-1', 'turn-9')).toBe('/playground/corpus-1/turn-9')
    })
  })
})
