export const DEFAULT_SCALE = 1.0
export const MIN_SCALE = 1.0
export const MAX_SCALE = 4.0

const ZOOM_STEP = 0.25

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

export function zoomIn(scale: number): number {
  return clampScale(scale + ZOOM_STEP)
}

export function zoomOut(scale: number): number {
  return clampScale(scale - ZOOM_STEP)
}
