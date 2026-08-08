import { useEffect, type RefObject } from 'react'

/**
 * Calls `onOutside` when a mousedown/click happens outside the referenced element — used to
 * dismiss the Playground turn's Actions popover (033-ui-ux-polish FR-016).
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutside: () => void,
): void {
  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      const element = ref.current
      if (element && !element.contains(event.target as Node)) {
        onOutside()
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [ref, onOutside])
}
