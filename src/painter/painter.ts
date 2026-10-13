import { AppFailure } from '@/errors'
import { HIGHLIGHT_COLORS, type HighlightColor } from '@/model'
import { FLASH_LAYER, layerName } from './highlight-styles'

export interface PaintTarget {
  id: string
  range: Range
  color: HighlightColor
  hasNote: boolean
}

export interface Painter {
  readonly painted: ReadonlyMap<string, PaintTarget>
}

interface ClientPoint {
  x: number
  y: number
}

interface PainterState {
  registry: HighlightRegistry
  painted: Map<string, PaintTarget>
  flashTimers: Map<string, ReturnType<typeof setTimeout>>
}

export const FLASH_MS = 1400
const FLASH_PRIORITY = 1

const states = new WeakMap<Painter, PainterState>()

const stateOf = (painter: Painter): PainterState => {
  const state = states.get(painter)
  if (!state) throw new AppFailure('unexpected', 'painter was not created by createPainter')
  return state
}

const LAYER_NAMES: readonly string[] = [
  ...HIGHLIGHT_COLORS.flatMap((color) => [layerName(color, false), layerName(color, true)]),
  FLASH_LAYER,
]

const registerLayer = (registry: HighlightRegistry, name: string): void => {
  const layer = new Highlight()
  layer.priority = name === FLASH_LAYER ? FLASH_PRIORITY : 0
  registry.set(name, layer)
}

export const createPainter = (registry: HighlightRegistry = CSS.highlights): Painter => {
  for (const name of LAYER_NAMES) registerLayer(registry, name)
  const painted = new Map<string, PaintTarget>()
  const painter: Painter = { painted }
  states.set(painter, { registry, painted, flashTimers: new Map() })
  return painter
}

export const unpaint = (painter: Painter, id: string): void => {
  const { registry, painted, flashTimers } = stateOf(painter)
  const target = painted.get(id)
  if (!target) return
  registry.get(layerName(target.color, target.hasNote))?.delete(target.range)
  registry.get(FLASH_LAYER)?.delete(target.range)
  clearTimeout(flashTimers.get(id))
  flashTimers.delete(id)
  painted.delete(id)
}

export const unpaintAll = (painter: Painter): void => {
  for (const id of [...painter.painted.keys()]) unpaint(painter, id)
}

export const paint = (painter: Painter, target: PaintTarget): void => {
  unpaint(painter, target.id)
  const { registry, painted } = stateOf(painter)
  registry.get(layerName(target.color, target.hasNote))?.add(target.range)
  painted.set(target.id, target)
}

const hasLostBoundary = ({ range }: PaintTarget): boolean => {
  const { startContainer, endContainer } = range
  return !(
    startContainer instanceof Text &&
    endContainer instanceof Text &&
    startContainer.isConnected
  )
}

export const prune = (painter: Painter): string[] => {
  const detached = [...painter.painted.values()].filter(hasLostBoundary)
  for (const target of detached) unpaint(painter, target.id)
  return detached.map((target) => target.id)
}

const containsPoint = (rect: DOMRect, point: ClientPoint): boolean =>
  rect.left <= point.x && point.x <= rect.right && rect.top <= point.y && point.y <= rect.bottom

const isHit = (target: PaintTarget, caret: CaretPosition, point: ClientPoint): boolean =>
  target.range.isPointInRange(caret.offsetNode, caret.offset) &&
  Array.from(target.range.getClientRects()).some((rect) => containsPoint(rect, point))

export const hitTest = (painter: Painter, doc: Document, point: ClientPoint): string | null => {
  const caret = doc.caretPositionFromPoint(point.x, point.y)
  if (!caret) return null
  const hit = [...painter.painted.values()].reverse().find((target) => isHit(target, caret, point))
  return hit?.id ?? null
}

// Ranges that only touch do not overlap
const overlaps = (a: Range, b: Range): boolean =>
  a.compareBoundaryPoints(Range.END_TO_START, b) < 0 &&
  a.compareBoundaryPoints(Range.START_TO_END, b) > 0

export const overlapsPainted = (painter: Painter, range: Range): boolean =>
  [...painter.painted.values()].some((target) => overlaps(range, target.range))

export const flash = (painter: Painter, id: string): void => {
  const { registry, painted, flashTimers } = stateOf(painter)
  const target = painted.get(id)
  if (!target) return
  const layer = registry.get(FLASH_LAYER)
  clearTimeout(flashTimers.get(id))
  layer?.add(target.range)
  flashTimers.set(
    id,
    setTimeout(() => {
      layer?.delete(target.range)
      flashTimers.delete(id)
    }, FLASH_MS),
  )
}

export const dispose = (painter: Painter): void => {
  const { registry, painted, flashTimers } = stateOf(painter)
  for (const timer of flashTimers.values()) clearTimeout(timer)
  flashTimers.clear()
  painted.clear()
  for (const name of LAYER_NAMES) registry.delete(name)
}
