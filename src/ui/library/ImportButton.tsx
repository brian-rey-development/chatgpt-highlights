import { useRef } from 'preact/hooks'
import { JSON_MEDIA_TYPE } from '@/model'
import { Icon } from '../Icon'

interface ImportButtonProps {
  onFile: (file: File) => void
}

export const ImportButton = ({ onFile }: ImportButtonProps) => {
  const picker = useRef<HTMLInputElement>(null)
  const take = (event: Event & { currentTarget: HTMLInputElement }) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file) onFile(file)
  }
  return (
    <>
      <button
        type="button"
        class="hl-chip hl-chip--outline"
        onClick={() => picker.current?.click()}
      >
        <Icon name="upload" size="sm" />
        Import backup
      </button>
      <input ref={picker} type="file" accept={`.json,${JSON_MEDIA_TYPE}`} hidden onChange={take} />
    </>
  )
}
