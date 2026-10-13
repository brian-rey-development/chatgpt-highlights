import type { RefObject } from 'preact'
import { useCallback, useRef, useState } from 'preact/hooks'
import { JSON_MEDIA_TYPE } from '@/model'
import { Icon, type IconName } from '../Icon'
import type { UiActions } from '../types'
import { useDismiss } from './dismissal'
import type { LibraryGroup } from './library-filter'

interface MenuItem {
  label: string
  icon: IconName
  run: () => void
}

const menuItems = (
  groups: readonly LibraryGroup[],
  actions: UiActions,
  openPicker: () => void,
): readonly MenuItem[] => [
  {
    label: 'Markdown',
    icon: 'download',
    run: () => actions.exportMarkdown(groups.flatMap((group) => group.highlights)),
  },
  { label: 'Back up as JSON', icon: 'download', run: () => actions.exportBackup() },
  { label: 'Restore from backup', icon: 'upload', run: openPicker },
]

interface MenuListProps {
  items: readonly MenuItem[]
  onPick: () => void
}

const MenuList = ({ items, onPick }: MenuListProps) => (
  <div class="hl-menu" role="menu">
    {items.map((item) => (
      <button
        key={item.label}
        type="button"
        role="menuitem"
        class="hl-menu-item"
        onClick={() => {
          onPick()
          item.run()
        }}
      >
        <Icon name={item.icon} size="md" />
        {item.label}
      </button>
    ))}
  </div>
)

interface RestoreInputProps {
  inputRef: RefObject<HTMLInputElement>
  onFile: (file: File) => void
}

const RestoreInput = ({ inputRef, onFile }: RestoreInputProps) => {
  const restore = (event: Event & { currentTarget: HTMLInputElement }) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file) onFile(file)
  }
  return (
    <input
      ref={inputRef}
      type="file"
      accept={`.json,${JSON_MEDIA_TYPE}`}
      hidden
      onChange={restore}
    />
  )
}

interface ExportMenuProps {
  groups: readonly LibraryGroup[]
  actions: UiActions
}

export const ExportMenu = ({ groups, actions }: ExportMenuProps) => {
  const [open, setOpen] = useState(false)
  const area = useRef<HTMLDivElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(area, open, close)
  return (
    <div class="hl-export" ref={area}>
      <button
        type="button"
        class="hl-chip hl-chip--outline"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="download" size="sm" />
        Export
      </button>
      {open && (
        <MenuList
          items={menuItems(groups, actions, () => picker.current?.click())}
          onPick={close}
        />
      )}
      <RestoreInput inputRef={picker} onFile={actions.importBackup} />
    </div>
  )
}
