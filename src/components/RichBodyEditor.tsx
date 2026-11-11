import { useEffect, useRef, useState } from 'react'
import { Bold, Eraser, Italic, Link2, List, ListOrdered, Strikethrough, Underline } from 'lucide-react'
import { TEMPLATE_PLACEHOLDERS } from '../lib/messageTemplates'

/** Strip HTML tags, returning the plain-text content (for char counts / table display). */
export const stripHtml = (html: string) => {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || ''
}

/** Normalize a plain-text body (with \n lines) into simple HTML paragraphs; pass-through if already HTML. */
export const plainToHtml = (v: string) =>
  /<[a-z][\s\S]*>/i.test(v)
    ? v
    : v.split('\n').map((line) => `<p>${line || '<br>'}</p>`).join('')

const BLOCKS = [
  { tag: 'p', label: 'Paragraph' },
  { tag: 'h1', label: 'Heading 1' },
  { tag: 'h2', label: 'Heading 2' },
]

function TB({ onClick, title, active, children }: {
  onClick: () => void
  title: string
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded-md p-1.5 transition ${
        active
          ? 'bg-ember/15 text-ember'
          : 'text-mist hover:bg-black/5 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

export function RichBodyEditor({ value, onChange, tall, placeholder }: {
  value: string
  onChange: (html: string) => void
  tall?: boolean
  placeholder?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [block, setBlock] = useState('p')
  const [active, setActive] = useState({ bold: false, italic: false, underline: false, strike: false })

  // Initialize content once per mount (parent unmounts the editor when the modal closes).
  useEffect(() => {
    const el = ref.current
    if (el && el.innerHTML !== plainToHtml(value)) el.innerHTML = plainToHtml(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refresh = () => {
    try {
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
      })
      const cur = String(document.queryCommandValue('formatBlock') || 'p').toLowerCase()
      setBlock(BLOCKS.some((b) => b.tag === cur) ? cur : 'p')
    } catch {
      /* command state unavailable — keep last state */
    }
  }

  useEffect(() => {
    const h = () => {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) refresh()
    }
    document.addEventListener('selectionchange', h)
    return () => document.removeEventListener('selectionchange', h)
  }, [])

  const commit = () => {
    const el = ref.current
    if (!el) return
    if (!(el.textContent || '').trim() && (el.innerHTML === '<br>' || el.innerHTML === '<div><br></div>')) el.innerHTML = ''
    onChange(el.innerHTML)
  }

  const exec = (cmd: string, arg?: string) => {
    const el = ref.current
    if (!el) return
    const sel = window.getSelection()
    const inside = !!sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)
    if (!inside) el.focus()
    document.execCommand(cmd, false, arg)
    commit()
    refresh()
  }

  const addLink = () => {
    const url = window.prompt('Link URL', 'https://')
    if (url && url !== 'https://') exec('createLink', url)
  }

  const insertTag = (tag: string) => {
    const el = ref.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    const inside = !!sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)
    if (!inside) {
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const s = window.getSelection()
      s?.removeAllRanges()
      s?.addRange(range)
    }
    document.execCommand('insertText', false, tag)
    commit()
    refresh()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-xl border border-b-0 border-line bg-zinc-50 p-1 dark:bg-white/5">
        <TB title="Bold (Ctrl+B)" active={active.bold} onClick={() => exec('bold')}><Bold className="size-3.5" /></TB>
        <TB title="Italic (Ctrl+I)" active={active.italic} onClick={() => exec('italic')}><Italic className="size-3.5" /></TB>
        <TB title="Underline (Ctrl+U)" active={active.underline} onClick={() => exec('underline')}><Underline className="size-3.5" /></TB>
        <TB title="Strikethrough" active={active.strike} onClick={() => exec('strikeThrough')}><Strikethrough className="size-3.5" /></TB>
        <span className="mx-1 h-4 w-px bg-line" aria-hidden />
        <select
          value={block}
          onChange={(e) => exec('formatBlock', `<${e.target.value}>`)}
          aria-label="Text style"
          className="h-7 rounded-md border border-line bg-transparent px-1.5 text-xs text-ink outline-none dark:bg-ink-2 dark:text-zinc-100"
        >
          {BLOCKS.map((b) => <option key={b.tag} value={b.tag} className="bg-white text-zinc-900">{b.label}</option>)}
        </select>
        <span className="mx-1 h-4 w-px bg-line" aria-hidden />
        <TB title="Bullet list" onClick={() => exec('insertUnorderedList')}><List className="size-3.5" /></TB>
        <TB title="Numbered list" onClick={() => exec('insertOrderedList')}><ListOrdered className="size-3.5" /></TB>
        <TB title="Insert link" onClick={addLink}><Link2 className="size-3.5" /></TB>
        <TB title="Clear formatting" onClick={() => exec('removeFormat')}><Eraser className="size-3.5" /></TB>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Message body"
        onInput={commit}
        data-placeholder={placeholder}
        className={`rich-editor max-h-72 overflow-y-auto rounded-b-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ember/60 dark:bg-ink dark:text-zinc-100 ${tall ? 'min-h-[150px]' : 'min-h-[90px]'}`}
      />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-mist">Insert tag:</span>
        {TEMPLATE_PLACEHOLDERS.map((p) => (
          <button
            key={p}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertTag(p)}
            className="rounded-full border border-line bg-zinc-50 px-2 py-0.5 font-mono text-[11px] text-mist transition hover:border-ember hover:text-ember dark:bg-white/5"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
