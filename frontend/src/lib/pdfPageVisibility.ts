export interface PageVisibilityEntry {
  pageNumber: number
  intersectionRatio: number
}

/**
 * Picks the page occupying the most of the visible viewport, given the latest
 * IntersectionObserver-reported ratios for every currently-observed page. Ties resolve to the
 * lowest page number for a deterministic result (029-pdf-preview-page-count).
 */
export function mostVisiblePage(entries: PageVisibilityEntry[]): number | null {
  if (entries.length === 0) return null

  return entries.reduce((best, entry) => {
    if (entry.intersectionRatio > best.intersectionRatio) return entry
    if (entry.intersectionRatio === best.intersectionRatio && entry.pageNumber < best.pageNumber) {
      return entry
    }
    return best
  }).pageNumber
}
