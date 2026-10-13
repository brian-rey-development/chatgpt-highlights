import { HIGHLIGHT_COLORS, type HighlightColor } from '@/model'

export const COLOR_LABELS: Readonly<Record<HighlightColor, string>> = {
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  pink: 'Pink',
  purple: 'Purple',
}

interface ColorDotsProps {
  current: HighlightColor | null
  size: 'sm' | 'md'
  labelFor: (color: HighlightColor) => string
  onPick: (color: HighlightColor) => void
}

export const ColorDots = ({ current, size, labelFor, onPick }: ColorDotsProps) => (
  <div class={`hl-dots hl-dots--${size}`}>
    {HIGHLIGHT_COLORS.map((color) => (
      <button
        key={color}
        type="button"
        class="hl-dots__button"
        data-color={color}
        title={labelFor(color)}
        aria-label={labelFor(color)}
        aria-pressed={current === null ? undefined : current === color}
        onClick={() => onPick(color)}
      >
        <span class="hl-dot" />
      </button>
    ))}
  </div>
)
