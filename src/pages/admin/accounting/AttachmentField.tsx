import { useRef } from 'react'
import { FileText, Image as ImageIcon, Paperclip, X } from 'lucide-react'
import { Button } from '../../../components/ui'
import type { AttachmentFile } from '../../../types'

/** Read a file into a data URL for image previews. Non-image files stay without a preview. */
function fileToAttachment(f: File): Promise<AttachmentFile> {
  return new Promise((resolve) => {
    const base: AttachmentFile = { name: f.name, type: f.type, size: f.size }
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => resolve({ ...base, dataUrl: String(reader.result || '') })
      reader.onerror = () => resolve(base)
      reader.readAsDataURL(f)
    } else {
      resolve(base)
    }
  })
}

function extIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const isImg = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)
  if (isImg) return <ImageIcon className="size-4 shrink-0 text-mist" />
  return <FileText className="size-4 shrink-0 text-mist" />
}

export function AttachmentChips({
  files,
  onRemove,
  readOnly = false,
}: {
  files: AttachmentFile[]
  onRemove?: (idx: number) => void
  readOnly?: boolean
}) {
  if (!files.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((f, i) => (
        <div
          key={`${f.name}-${i}`}
          className="flex items-center gap-2 rounded-xl border border-line bg-white px-2.5 py-1.5 text-sm shadow-sm"
        >
          {f.dataUrl ? (
            <img src={f.dataUrl} alt="" className="size-8 rounded-md object-cover" />
          ) : extIcon(f.name)}
          <span className="max-w-[220px] truncate font-medium">{f.name}</span>
          {!readOnly && onRemove && (
            <button
              type="button"
              aria-label={`Remove ${f.name}`}
              className="grid size-6 shrink-0 place-items-center rounded-full text-mist transition hover:bg-black/5 hover:text-ember dark:hover:bg-white/10"
              onClick={() => onRemove(i)}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Multi-file attachment picker. Renders selected files as rounded chips with
 * thumbnail previews for images and a generic document icon otherwise, each
 * with an X to remove. The paperclip button opens the native file picker.
 */
export function AttachmentField({
  files,
  onChange,
}: {
  files: AttachmentFile[]
  onChange: (next: AttachmentFile[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const onPick = async (list: FileList | null) => {
    if (!list || !list.length) return
    const picked = await Promise.all(Array.from(list).map(fileToAttachment))
    // de-dupe by name (keep latest) while preserving order
    const byName = new Map<string, AttachmentFile>()
    ;[...files, ...picked].forEach((f) => byName.set(f.name, f))
    onChange(Array.from(byName.values()))
    if (inputRef.current) inputRef.current.value = ''
  }

  const remove = (idx: number) => onChange(files.filter((_, i) => i !== idx))

  return (
    <div className="space-y-2">
      <AttachmentChips files={files} onRemove={remove} />
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="size-4" /> Attach file{files.length ? 's' : ''}
        </Button>
        {files.length > 0 && (
          <button
            type="button"
            className="text-xs font-semibold text-mist hover:text-ember"
            onClick={() => onChange([])}
          >
            Clear all
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => onPick(e.target.files)}
        />
      </div>
    </div>
  )
}

/** Normalise legacy single-attachment vouchers into the new array form. */
export function normaliseAttachments(opts: {
  attachments?: AttachmentFile[]
  attachmentName?: string
}): AttachmentFile[] {
  if (opts.attachments?.length) return opts.attachments
  if (opts.attachmentName) return [{ name: opts.attachmentName }]
  return []
}
