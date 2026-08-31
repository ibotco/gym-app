import { useEffect, useRef, useState } from 'react'
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Link as LinkIcon } from 'lucide-react'

const BTN = 'grid size-8 place-items-center rounded-lg text-mist transition hover:bg-black/5 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white'

/**
 * Lightweight rich-text editor (contentEditable) with a toolbar for bold,
 * italic, underline, alignment, lists and links. Emits the resulting HTML.
 */
export function RichTextEditor({ value, onChange, placeholder }: { value: string; onChange: (html: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (ref.current && !ready) {
      ref.current.innerHTML = value || ''
      setReady(true)
    }
  }, [value, ready])

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, arg)
    onChange(ref.current?.innerHTML || '')
  }

  const addLink = () => {
    const url = window.prompt('Enter link URL', 'https://')
    if (url) exec('createLink', url)
  }

  const tools: { icon: typeof Bold; cmd: string; title: string }[] = [
    { icon: Bold, cmd: 'bold', title: 'Bold' },
    { icon: Italic, cmd: 'italic', title: 'Italic' },
    { icon: Underline, cmd: 'underline', title: 'Underline' },
    { icon: AlignLeft, cmd: 'justifyLeft', title: 'Align left' },
    { icon: AlignCenter, cmd: 'justifyCenter', title: 'Align center' },
    { icon: AlignRight, cmd: 'justifyRight', title: 'Align right' },
    { icon: List, cmd: 'insertUnorderedList', title: 'Bullet list' },
    { icon: ListOrdered, cmd: 'insertOrderedList', title: 'Numbered list' },
  ]

  return (
    <div className="rounded-xl border border-line focus-within:border-lime/50">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1.5">
        {tools.map((t) => (
          <button key={t.cmd} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec(t.cmd)} title={t.title} className={BTN}>
            <t.icon className="size-4" />
          </button>
        ))}
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={addLink} title="Insert link" className={BTN}>
          <LinkIcon className="size-4" />
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        className="min-h-28 w-full px-3 py-2.5 text-sm leading-relaxed outline-none empty:before:text-mist empty:before:content-[attr(data-placeholder)]"
      />
    </div>
  )
}
