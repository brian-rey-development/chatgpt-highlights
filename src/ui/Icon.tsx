import { HIGHLIGHTER_ICON } from '@/model'

const GLYPHS = {
  highlighter: (
    <>
      {HIGHLIGHTER_ICON.paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </>
  ),
  note: (
    <>
      <path d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9l-6 7H7a2 2 0 0 1-2-2Z" />
      <path d="M13 21v-5a2 2 0 0 1 2-2h4M9 8h6M9 11.5h4" />
    </>
  ),
  quote: <path d="M5 17h3l2-5V6H4v6h3M14 17h3l2-5V6h-6v6h3" />,
  trash: <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" />
    </>
  ),
  close: <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />,
  open: <path d="M7 17 17 7M8.5 7H17v8.5" />,
  download: (
    <>
      <path d="M12 4v10M8 10l4 4 4-4" />
      <path d="M5 19h14" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V5M8 9l4-4 4 4" />
      <path d="M5 19h14" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
}

export type IconName = keyof typeof GLYPHS

const ICON_SIZES = { sm: 16, md: 18, lg: HIGHLIGHTER_ICON.size } as const
const DEFAULT_SIZE = 'lg'

interface IconProps {
  name: IconName
  size?: keyof typeof ICON_SIZES
}

export const Icon = ({ name, size = DEFAULT_SIZE }: IconProps) => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: aria-hidden comes from the shared frame attributes
  <svg width={ICON_SIZES[size]} height={ICON_SIZES[size]} {...HIGHLIGHTER_ICON.attributes}>
    {GLYPHS[name]}
  </svg>
)
