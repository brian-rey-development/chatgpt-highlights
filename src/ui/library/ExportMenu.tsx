import { useCallback, useRef, useState } from 'preact/hooks'
import { Icon, type IconName } from '../Icon'
import type { LibraryGroup, UiActions } from '../types'
import { useDismiss } from './dismissal'

interface MenuEntry {
  label: string
  icon: IconName
  run: () => void
}

const menuEntries = (groups: readonly LibraryGroup[], actions: UiActions): readonly MenuEntry[] => [
  { label: 'Markdown', icon: 'download', run: () => actions.exportMarkdown(groups) },
  { label: 'Back up as JSON', icon: 'download', run: () => actions.exportBackup() },
]

interface MenuListProps {
  entries: readonly MenuEntry[]
  onPick: () => void
}

const MenuList = ({ entries, onPick }: MenuListProps) => (
  <div class="hl-menu" role="menu">
    {entries.map((entry) => (
      <button
        key={entry.label}
        type="button"
        role="menuitem"
        class="hl-menu-item"
        onClick={() => {
          onPick()
          entry.run()
        }}
      >
        <Icon name={entry.icon} size="md" />
        {entry.label}
      </button>
    ))}
  </div>
)

interface ExportMenuProps {
  groups: readonly LibraryGroup[]
  actions: UiActions
}

export const ExportMenu = ({ groups, actions }: ExportMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const area = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setIsOpen(false), [])
  useDismiss(area, isOpen, close)
  return (
    <div class="hl-export" ref={area}>
      <button
        type="button"
        class="hl-chip hl-chip--outline"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Icon name="download" size="sm" />
        Export
      </button>
      {isOpen && <MenuList entries={menuEntries(groups, actions)} onPick={close} />}
    </div>
  )
}
