import { renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useClickOutside } from '../../src/hooks/useClickOutside'

function renderWithRef(onOutside: () => void) {
  return renderHook(() => {
    const ref = useRef<HTMLDivElement>(null)
    useClickOutside(ref, onOutside)
    return ref
  })
}

describe('useClickOutside', () => {
  it('calls onOutside on a mousedown outside the referenced element', () => {
    const onOutside = vi.fn()
    const { result } = renderWithRef(onOutside)
    const inside = document.createElement('div')
    result.current.current = inside
    document.body.appendChild(inside)
    const outside = document.createElement('div')
    document.body.appendChild(outside)

    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))

    expect(onOutside).toHaveBeenCalledOnce()

    document.body.removeChild(inside)
    document.body.removeChild(outside)
  })

  it('does not call onOutside on a mousedown inside the referenced element', () => {
    const onOutside = vi.fn()
    const { result } = renderWithRef(onOutside)
    const inside = document.createElement('div')
    const child = document.createElement('span')
    inside.appendChild(child)
    result.current.current = inside
    document.body.appendChild(inside)

    child.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))

    expect(onOutside).not.toHaveBeenCalled()

    document.body.removeChild(inside)
  })

  it('does nothing once unmounted', () => {
    const onOutside = vi.fn()
    const { result, unmount } = renderWithRef(onOutside)
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    void result

    unmount()
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))

    expect(onOutside).not.toHaveBeenCalled()

    document.body.removeChild(outside)
  })
})
