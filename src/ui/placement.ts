import { useLayoutEffect, useRef, useState } from 'preact/hooks'
import { PILL_DOCK_GAP_PX } from '@/model'
import type { PillModel, PopoverModel } from './types'

export interface Point {
  left: number
  top: number
}

export interface Size {
  width: number
  height: number
}

type Placer<Model> = (model: Model, size: Size, viewport: Size) => Point

export const VIEWPORT_MARGIN_PX = 8
const PILL_GAP_PX = 6
const POPOVER_GAP_PX = 8
const ORIGIN: Point = { left: 0, top: 0 }

const clampAxis = (value: number, extent: number, limit: number): number =>
  Math.max(VIEWPORT_MARGIN_PX, Math.min(value, limit - extent - VIEWPORT_MARGIN_PX))

export const clampToViewport = (point: Point, size: Size, viewport: Size): Point => ({
  left: clampAxis(point.left, size.width, viewport.width),
  top: clampAxis(point.top, size.height, viewport.height),
})

const fitsViewport = (point: Point, size: Size, viewport: Size): boolean => {
  const clamped = clampToViewport(point, size, viewport)
  return clamped.left === point.left && clamped.top === point.top
}

const placeDocked = (dock: DOMRect, size: Size, viewport: Size): Point => {
  const right = { left: dock.right + PILL_DOCK_GAP_PX, top: dock.top }
  const fallbacks = [
    { left: dock.left - PILL_DOCK_GAP_PX - size.width, top: dock.top },
    { left: dock.left, top: dock.bottom + PILL_DOCK_GAP_PX },
  ]
  const fitting = [right, ...fallbacks].find((origin) => fitsViewport(origin, size, viewport))
  return clampToViewport(fitting ?? right, size, viewport)
}

export const placePill = (model: PillModel, size: Size, viewport: Size): Point => {
  const { anchor, dock } = model
  if (dock !== null) return placeDocked(dock, size, viewport)
  const origin = { left: anchor.left, top: anchor.top - size.height - PILL_GAP_PX }
  return clampToViewport(origin, size, viewport)
}

export const placePopover = (model: PopoverModel, size: Size, viewport: Size): Point => {
  const { anchor } = model
  const below = anchor.bottom + POPOVER_GAP_PX
  const fitsBelow = below + size.height + VIEWPORT_MARGIN_PX <= viewport.height
  const top = fitsBelow ? below : anchor.top - size.height - POPOVER_GAP_PX
  return clampToViewport({ left: anchor.left, top }, size, viewport)
}

export const usePlacement = <Target extends HTMLElement, Model>(
  model: Model,
  place: Placer<Model>,
) => {
  const ref = useRef<Target>(null)
  const [point, setPoint] = useState<Point>(ORIGIN)
  useLayoutEffect(() => {
    if (ref.current === null) return
    const { width, height } = ref.current.getBoundingClientRect()
    setPoint(place(model, { width, height }, { width: innerWidth, height: innerHeight }))
  }, [model, place])
  return { ref, style: { left: point.left, top: point.top } }
}
