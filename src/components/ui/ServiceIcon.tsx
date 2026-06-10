import { useState } from 'react'
import { resolveIconUrl, typeEmoji } from '../../lib/icons'

interface Props {
  name: string
  entryType: string
  customIcon?: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZE = { sm: 'w-5 h-5', md: 'w-7 h-7', lg: 'w-9 h-9' }
const IMG_SIZE = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' }

export function ServiceIcon({ name, entryType, customIcon, size = 'md' }: Props) {
  const [imgError, setImgError] = useState(false)
  const url = customIcon ?? resolveIconUrl(name)

  return (
    <div className={`${SIZE[size]} rounded-md bg-slate-700 flex items-center justify-center shrink-0`}>
      {url && !imgError
        ? <img src={url} className={`${IMG_SIZE[size]} rounded`} alt="" onError={() => setImgError(true)} />
        : <span className="text-base leading-none">{typeEmoji(entryType)}</span>
      }
    </div>
  )
}
