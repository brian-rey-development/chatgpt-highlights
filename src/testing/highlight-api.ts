import { vi } from 'vitest'
import type { Painter } from '@/painter'

class FakeHighlight extends Set<AbstractRange> {
  priority = 0
  type: HighlightType = 'highlight'
}

export const installFakeHighlightApi = (): HighlightRegistry => {
  vi.stubGlobal('Highlight', FakeHighlight)
  return new Map<string, Highlight>()
}

export const countPaintedRanges = (registry: HighlightRegistry): number =>
  [...registry.values()].reduce((total, layer) => total + layer.size, 0)

export const paintedTexts = (painter: Painter): string[] =>
  [...painter.painted.values()].map((target) => target.range.toString())
