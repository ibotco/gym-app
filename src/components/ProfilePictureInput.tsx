import { useRef, useState } from 'react'
import { ImagePlus, Trash2, UserRound } from 'lucide-react'
import { Button } from './ui'
import { cn } from '../lib/utils'
import { AVATAR_ACCEPT, fileToAvatarDataUrl, validateAvatarFile } from '../lib/image'

/**
 * Square profile-picture picker (150×150) for the registration forms.
 * `value` is a data URL (or existing avatar path when editing); `onChange`
 * receives the new data URL, or `undefined` when the photo is removed.
 */
export function ProfilePictureInput({
  value,
  onChange,
  label = 'Profile picture',
}: {
  value?: string
  onChange: (dataUrl: string | undefined) => void
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  const pick = () => {
    setLocalError('')
    inputRef.current?.click()
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const err = validateAvatarFile(file)
    if (err) {
      setLocalError(err)
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setBusy(true)
    setLocalError('')
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      onChange(dataUrl)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Could not process the image.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = () => {
    onChange(undefined)
    setLocalError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
      <div className="flex flex-col items-center gap-2">
        <div
          className={cn(
            'grid size-[150px] shrink-0 place-items-center overflow-hidden rounded-2xl border bg-ink-2 dark:bg-ink-3',
            value ? 'border-line' : 'border-dashed border-line',
          )}
        >
          {value ? (
            <img src={value} alt="Profile preview" className="size-full object-cover" />
          ) : (
            <UserRound className="size-16 text-mist/50" strokeWidth={1.25} aria-hidden />
          )}
        </div>
        <p className={cn('text-sm', value ? 'text-lime' : 'text-mist')}>
          {value ? 'Photo selected' : 'No Photo Selected'}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-mist">JPG, JPEG, or PNG · up to 5 MB</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="soft"
            size="sm"
            onClick={pick}
            disabled={busy}
          >
            <ImagePlus className="size-4" />
            {busy ? 'Processing…' : 'Upload Photo'}
          </Button>
          {value && (
            <Button type="button" variant="outline" size="sm" onClick={remove} disabled={busy}>
              <Trash2 className="size-4" />
              Remove Photo
            </Button>
          )}
        </div>
        {localError && <p className="text-xs text-ember">{localError}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_ACCEPT}
        className="hidden"
        aria-label="Upload profile photo"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  )
}
