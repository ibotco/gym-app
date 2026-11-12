import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Filter, Save, Clock, CalendarDays } from 'lucide-react'
import { Button, DatePicker, Input, Select } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import { useApp } from '../../../context/AppContext'
import { uid } from '../../../lib/utils'
import type { EduRecords, EduRow } from '../../../lib/eduRecords'
import { useTeacherAccess } from '../../../lib/eduTeacherAccess'

const pad2 = (n: number) => String(n).padStart(2, '0')

function parseTime24(raw: string): { h24: number; m: number } | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const m12 = /^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)$/i.exec(s)
  if (m12) {
    let h = Number(m12[1])
    const min = m12[2] !== undefined ? Number(m12[2]) : 0
    const mer = m12[3].toUpperCase()
    if (h >= 1 && h <= 12 && min >= 0 && min <= 59) {
      if (mer === 'AM') h = h === 12 ? 0 : h
      else h = h === 12 ? 12 : h + 12
      return { h24: h, m: min }
    }
  }
  const m24 = /^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/.exec(s)
  if (m24) {
    const h = Number(m24[1])
    const min = Number(m24[2])
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return { h24: h, m: min }
  }
  return null
}

function format12h(h24: number, m: number) {
  return `${h24 % 12 || 12}:${pad2(m)} ${h24 < 12 ? 'AM' : 'PM'}`
}

function PickerChevron({ dir }: { dir: 'up' | 'down' }) {
  return (
    <svg width="15" height="10" viewBox="0 0 15 10" fill="none" aria-hidden="true" style={{ display: 'block', margin: '0 auto' }}>
      <path
        d={dir === 'up' ? 'M2 7.8L7.5 2.3L13 7.8' : 'M2 2.2L7.5 7.7L13 2.2'}
        stroke="#2b2b2b"
        strokeWidth="2.7"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
    </svg>
  )
}

function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = parseTime24(value) ?? { h24: 4, m: 40 }
  const formatted = format12h(parsed.h24, parsed.m)

  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const hourInputRef = useRef<HTMLInputElement>(null)
  const minInputRef = useRef<HTMLInputElement>(null)
  const merInputRef = useRef<HTMLInputElement>(null)
  const hourJustFocused = useRef(false)
  const minJustFocused = useRef(false)
  const merJustFocused = useRef(false)

  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState(formatted)
  const [hourEdit, setHourEdit] = useState<string | null>(null)
  const [minEdit, setMinEdit] = useState<string | null>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false })

  useEffect(() => {
    if (!focused) setText(formatted)
  }, [formatted, focused])

  const updatePos = () => {
    const el = inputRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const popW = 180
    const popH = 122
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < popH + 12 && rect.top > popH + 12
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - popW - 8))
    const top = openUp ? rect.top - popH - 7 : rect.bottom + 7
    setPos({ top, left, openUp })
  }

  const openPicker = () => {
    updatePos()
    setOpen(true)
  }

  useEffect(() => {
    if (!open) {
      setHourEdit(null)
      setMinEdit(null)
      return
    }
    updatePos()
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [open])

  const commit = (h24: number, m: number, syncTopInput = true) => {
    const nh = ((h24 % 24) + 24) % 24
    const nm = ((m % 60) + 60) % 60
    onChange(`${pad2(nh)}:${pad2(nm)}`)
    if (syncTopInput) setText(format12h(nh, nm))
  }

  const hour12 = parsed.h24 % 12 || 12
  const meridian = parsed.h24 < 12 ? 'AM' : 'PM'

  const commitHour12 = (h12: number) => {
    const nh24 = meridian === 'AM' ? (h12 === 12 ? 0 : h12) : h12 === 12 ? 12 : h12 + 12
    commit(nh24, parsed.m)
  }

  const stepHour = (delta: number) => {
    setHourEdit(null)
    commit(parsed.h24 + delta, parsed.m)
  }
  const stepMinute = (delta: number) => {
    setMinEdit(null)
    commit(parsed.h24, parsed.m + delta)
  }
  const toggleMeridian = () => {
    commit((parsed.h24 + 12) % 24, parsed.m)
  }
  const setMeridianExplicit = (nextMer: 'AM' | 'PM') => {
    const base = parsed.h24 % 12
    commit(nextMer === 'AM' ? base : base + 12, parsed.m)
  }

  const commitTyped = (raw: string) => {
    const p = parseTime24(raw)
    if (p) {
      commit(p.h24, p.m, true)
    } else {
      setText(formatted)
    }
  }

  const active = open || focused

  const spinBtnStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 28,
    padding: 0,
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    cursor: 'pointer',
    userSelect: 'none',
  }

  const valInputStyle: CSSProperties = {
    width: 38,
    height: 28,
    padding: 0,
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    color: '#333333',
    fontSize: 13.5,
    fontWeight: 400,
    textAlign: 'center',
    outline: 'none',
    userSelect: 'text',
    WebkitUserSelect: 'text',
    cursor: 'text',
  }

  return (
    <div ref={wrapRef} style={{ display: 'inline-flex', width: '100%', minWidth: 132, height: 32, alignItems: 'stretch' }}>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Toggle time picker"
        onClick={() => {
          if (open) setOpen(false)
          else {
            openPicker()
            inputRef.current?.focus()
          }
        }}
        className="border border-r-0 border-zinc-300 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        style={{
          width: 32,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          borderTopLeftRadius: 4,
          borderBottomLeftRadius: 4,
          cursor: 'pointer',
        }}
      >
        <Clock className="size-3.5" strokeWidth={2} />
      </button>

      <input
        ref={inputRef}
        type="text"
        value={text}
        onFocus={() => {
          setFocused(true)
          openPicker()
        }}
        onClick={openPicker}
        onChange={(e) => {
          const v = e.target.value
          setText(v)
          const p = parseTime24(v)
          if (p) commit(p.h24, p.m, false)
        }}
        onBlur={() => {
          setFocused(false)
          commitTyped(text)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitTyped(text)
            setOpen(false)
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const delta = e.key === 'ArrowUp' ? 1 : -1
            const caret = e.currentTarget.selectionStart ?? 0
            const colonIdx = text.indexOf(':')
            const spaceIdx = text.indexOf(' ')
            if (colonIdx !== -1 && caret <= colonIdx) stepHour(delta)
            else if (spaceIdx !== -1 && caret > spaceIdx) toggleMeridian()
            else stepMinute(delta)
          }
        }}
        className="border border-zinc-300 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        style={{
          height: 32,
          width: '100%',
          minWidth: 0,
          padding: '0 10px',
          fontSize: 12,
          borderTopRightRadius: 4,
          borderBottomRightRadius: 4,
          outline: 'none',
          ...(active
            ? {
                borderColor: '#66afe9',
                boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.075), 0 0 6px rgba(102,175,233,0.6)',
              }
            : {}),
        }}
      />

      {open &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label="Time picker"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: 180,
              padding: '10px 12px',
              backgroundColor: '#ffffff',
              color: '#333333',
              colorScheme: 'light',
              border: '1px solid #cccccc',
              borderRadius: 4,
              boxShadow: '0 6px 14px rgba(0, 0, 0, 0.175)',
              zIndex: 2147483647,
            }}
          >
            {/* Outer border triangle */}
            <span
              aria-hidden
              style={
                pos.openUp
                  ? {
                      position: 'absolute',
                      bottom: -7,
                      left: 9,
                      width: 0,
                      height: 0,
                      borderLeft: '7px solid transparent',
                      borderRight: '7px solid transparent',
                      borderTop: '7px solid #cccccc',
                      pointerEvents: 'none',
                    }
                  : {
                      position: 'absolute',
                      top: -7,
                      left: 9,
                      width: 0,
                      height: 0,
                      borderLeft: '7px solid transparent',
                      borderRight: '7px solid transparent',
                      borderBottom: '7px solid #cccccc',
                      pointerEvents: 'none',
                    }
              }
            />
            {/* Inner white fill triangle */}
            <span
              aria-hidden
              style={
                pos.openUp
                  ? {
                      position: 'absolute',
                      bottom: -6,
                      left: 10,
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: '6px solid #ffffff',
                      pointerEvents: 'none',
                    }
                  : {
                      position: 'absolute',
                      top: -6,
                      left: 10,
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderBottom: '6px solid #ffffff',
                      pointerEvents: 'none',
                    }
              }
            />

            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 44 }} />
                <col style={{ width: 14 }} />
                <col style={{ width: 44 }} />
                <col style={{ width: 8 }} />
                <col style={{ width: 46 }} />
              </colgroup>
              <tbody>
                {/* Row 1: Up chevrons */}
                <tr>
                  <td style={{ textAlign: 'center', padding: 0 }}>
                    <button
                      type="button"
                      aria-label="Increment hour"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => stepHour(1)}
                      style={spinBtnStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <PickerChevron dir="up" />
                    </button>
                  </td>
                  <td />
                  <td style={{ textAlign: 'center', padding: 0 }}>
                    <button
                      type="button"
                      aria-label="Increment minute"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => stepMinute(1)}
                      style={spinBtnStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <PickerChevron dir="up" />
                    </button>
                  </td>
                  <td />
                  <td style={{ textAlign: 'center', padding: 0 }}>
                    <button
                      type="button"
                      aria-label="Toggle AM/PM"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={toggleMeridian}
                      style={spinBtnStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <PickerChevron dir="up" />
                    </button>
                  </td>
                </tr>

                {/* Row 2: 4 : 40 AM — all editable in-place */}
                <tr>
                  <td style={{ textAlign: 'center', padding: '6px 0' }}>
                    <input
                      ref={hourInputRef}
                      type="text"
                      inputMode="numeric"
                      aria-label="Hour"
                      value={hourEdit ?? String(hour12)}
                      onFocus={(e) => {
                        hourJustFocused.current = true
                        setHourEdit(String(hour12))
                        const el = e.currentTarget
                        requestAnimationFrame(() => el.select())
                      }}
                      onMouseUp={(e) => {
                        if (hourJustFocused.current) {
                          e.preventDefault()
                          hourJustFocused.current = false
                          e.currentTarget.select()
                        }
                      }}
                      onChange={(e) => {
                        const caret = e.target.selectionStart ?? e.target.value.length
                        const typedChar = caret > 0 ? e.target.value[caret - 1] : ''
                        const digits = e.target.value.replace(/\D/g, '')
                        if (!digits) {
                          setHourEdit('')
                          return
                        }
                        const prevLen = (hourEdit ?? String(hour12)).length
                        if (digits.length >= 3 || (prevLen >= 2 && digits.length > 2)) {
                          const d = /\d/.test(typedChar) ? typedChar : digits.slice(-1)
                          const n = Number(d)
                          if (n >= 1 && n <= 9) {
                            setHourEdit(d)
                            commitHour12(n)
                          } else if (d === '0') {
                            setHourEdit('0')
                          }
                          return
                        }
                        if (digits.length === 2) {
                          const n = Number(digits)
                          if (n >= 1 && n <= 12) {
                            setHourEdit(String(n))
                            commitHour12(n)
                          } else {
                            const d = /\d/.test(typedChar) ? typedChar : digits.slice(-1)
                            const dn = Number(d)
                            if (dn >= 1 && dn <= 9) {
                              setHourEdit(d)
                              commitHour12(dn)
                            } else if (d === '0') {
                              setHourEdit('0')
                            }
                          }
                          return
                        }
                        // 1 digit
                        if (digits === '0') {
                          setHourEdit('0')
                        } else {
                          const n = Number(digits)
                          setHourEdit(digits)
                          commitHour12(n)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                          e.preventDefault()
                          stepHour(e.key === 'ArrowUp' ? 1 : -1)
                          requestAnimationFrame(() => hourInputRef.current?.select())
                        } else if (e.key === ':') {
                          e.preventDefault()
                          minInputRef.current?.focus()
                          minInputRef.current?.select()
                        } else if (e.key === 'Enter') {
                          e.preventDefault()
                          setHourEdit(null)
                          setOpen(false)
                        }
                      }}
                      onBlur={() => setHourEdit(null)}
                      onWheel={(e) => {
                        e.preventDefault()
                        stepHour(e.deltaY < 0 ? 1 : -1)
                      }}
                      style={valInputStyle}
                    />
                  </td>
                  <td style={{ textAlign: 'center', padding: '6px 0', color: '#333333', fontSize: 13.5, userSelect: 'none' }}>:</td>
                  <td style={{ textAlign: 'center', padding: '6px 0' }}>
                    <input
                      ref={minInputRef}
                      type="text"
                      inputMode="numeric"
                      aria-label="Minute"
                      value={minEdit ?? pad2(parsed.m)}
                      onFocus={(e) => {
                        minJustFocused.current = true
                        setMinEdit(pad2(parsed.m))
                        const el = e.currentTarget
                        requestAnimationFrame(() => el.select())
                      }}
                      onMouseUp={(e) => {
                        if (minJustFocused.current) {
                          e.preventDefault()
                          minJustFocused.current = false
                          e.currentTarget.select()
                        }
                      }}
                      onChange={(e) => {
                        const caret = e.target.selectionStart ?? e.target.value.length
                        const typedChar = caret > 0 ? e.target.value[caret - 1] : ''
                        const digits = e.target.value.replace(/\D/g, '')
                        if (!digits) {
                          setMinEdit('')
                          return
                        }
                        const prevLen = (minEdit ?? pad2(parsed.m)).length
                        if (digits.length >= 3 || (prevLen >= 2 && digits.length > 2)) {
                          const d = /\d/.test(typedChar) ? typedChar : digits.slice(-1)
                          setMinEdit(d)
                          commit(parsed.h24, Number(d))
                          return
                        }
                        if (digits.length === 2) {
                          const n = Number(digits)
                          if (n >= 0 && n <= 59) {
                            setMinEdit(digits)
                            commit(parsed.h24, n)
                          } else {
                            const d = /\d/.test(typedChar) ? typedChar : digits.slice(-1)
                            setMinEdit(d)
                            commit(parsed.h24, Number(d))
                          }
                          return
                        }
                        // 1 digit ('0'..'9')
                        setMinEdit(digits)
                        commit(parsed.h24, Number(digits))
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                          e.preventDefault()
                          stepMinute(e.key === 'ArrowUp' ? 1 : -1)
                          requestAnimationFrame(() => minInputRef.current?.select())
                        } else if (e.key === 'Enter') {
                          e.preventDefault()
                          setMinEdit(null)
                          setOpen(false)
                        }
                      }}
                      onBlur={() => setMinEdit(null)}
                      onWheel={(e) => {
                        e.preventDefault()
                        stepMinute(e.deltaY < 0 ? 1 : -1)
                      }}
                      style={valInputStyle}
                    />
                  </td>
                  <td />
                  <td style={{ textAlign: 'center', padding: '6px 0' }}>
                    <input
                      ref={merInputRef}
                      type="text"
                      aria-label="Meridian"
                      value={meridian}
                      onFocus={(e) => {
                        merJustFocused.current = true
                        const el = e.currentTarget
                        requestAnimationFrame(() => el.select())
                      }}
                      onMouseUp={(e) => {
                        if (merJustFocused.current) {
                          e.preventDefault()
                          merJustFocused.current = false
                          e.currentTarget.select()
                        }
                      }}
                      onChange={(e) => {
                        const s = e.target.value.toUpperCase()
                        if (s.includes('P')) setMeridianExplicit('PM')
                        else if (s.includes('A')) setMeridianExplicit('AM')
                        requestAnimationFrame(() => merInputRef.current?.select())
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === ' ') {
                          e.preventDefault()
                          toggleMeridian()
                          requestAnimationFrame(() => merInputRef.current?.select())
                        } else if (e.key === 'a' || e.key === 'A') {
                          e.preventDefault()
                          setMeridianExplicit('AM')
                          requestAnimationFrame(() => merInputRef.current?.select())
                        } else if (e.key === 'p' || e.key === 'P') {
                          e.preventDefault()
                          setMeridianExplicit('PM')
                          requestAnimationFrame(() => merInputRef.current?.select())
                        } else if (e.key === 'Enter') {
                          e.preventDefault()
                          setOpen(false)
                        }
                      }}
                      onWheel={(e) => {
                        e.preventDefault()
                        toggleMeridian()
                      }}
                      style={{ ...valInputStyle, width: 42 }}
                    />
                  </td>
                </tr>

                {/* Row 3: Down chevrons */}
                <tr>
                  <td style={{ textAlign: 'center', padding: 0 }}>
                    <button
                      type="button"
                      aria-label="Decrement hour"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => stepHour(-1)}
                      style={spinBtnStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <PickerChevron dir="down" />
                    </button>
                  </td>
                  <td />
                  <td style={{ textAlign: 'center', padding: 0 }}>
                    <button
                      type="button"
                      aria-label="Decrement minute"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => stepMinute(-1)}
                      style={spinBtnStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <PickerChevron dir="down" />
                    </button>
                  </td>
                  <td />
                  <td style={{ textAlign: 'center', padding: 0 }}>
                    <button
                      type="button"
                      aria-label="Toggle AM/PM"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={toggleMeridian}
                      style={spinBtnStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <PickerChevron dir="down" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>,
          document.body,
        )}
    </div>
  )
}

function distKey(name: string) {
  return name.trim().replace(/[^a-zA-Z0-9 ]+/g,'').split(/\s+/).map((w,i)=> i===0 ? w.toLowerCase() : w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join('').replace(/^./, c=> c.toLowerCase())
}

type Draft = {
  date: string; startingTime: string; endingTime: string; hallRoom: string
  marks: Record<string, { full: string; pass: string }>
}
const cleanValues = (v: unknown[]) => [...new Set(v.map(x => String(x ?? '').trim()).filter(Boolean))]
function parseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return cleanValues(raw)
  const s = String(raw ?? '').trim()
  if (!s) return []
  try { const p = JSON.parse(s); if (Array.isArray(p)) return cleanValues(p) } catch {}
  return cleanValues(s.split(/[\\n,;]/).map(x => x.replace(/^\s*[-•]\s*/, '')))
}
function subjectsForClass(assignRows: EduRow[], className: string, section: string): string[] {
  const key = className.trim().toLowerCase()
  const secKey = section.trim().toLowerCase()
  const out: string[] = []
  for (const r of assignRows ?? []) {
    if (String(r.className ?? '').trim().toLowerCase() !== key) continue
    const secs = parseJsonArray((r as any).sections ?? (r as any).section)
    if (section && secs.length && !secs.some(s => s.toLowerCase() === secKey)) continue
    out.push(...parseJsonArray((r as any).subjects))
  }
  return cleanValues(out).sort((a,b)=>a.localeCompare(b))
}

export function ExamScheduleBoard({ records, persist, onSaved }: { records: EduRecords; persist: (next: EduRecords)=>void; leafId?: string; onSaved?: ()=>void }) {
  const { activeBranchId } = useApp() as any
  const toast = useToast()
  const [exam, setExam] = useState('')
  const [klass, setKlass] = useState('')
  const [section, setSection] = useState('')
  const [filtered, setFiltered] = useState(false)
  const [draft, setDraft] = useState<Record<string, Draft>>({})
  const teacherScope = useTeacherAccess(records)

  const examOptions = useMemo(()=> (records.examSetup ?? []).map(r=> String(r.examName ?? r.name ?? r.title ?? '').trim()).filter(Boolean), [records])
  const classOptions = useMemo(()=> {
    const all = cleanValues((records.classList ?? []).map(r=> String(r.name ?? r.className ?? '').trim()))
    if (!teacherScope.isTeacher) return all
    return teacherScope.assignedBaseClasses
  }, [records, teacherScope])
  const sectionOptions = useMemo(()=>{
    const set = new Set<string>()
    for (const r of (records.assignClassSubjects ?? [])) {
      if (klass && String(r.className ?? '').trim().toLowerCase() !== klass.trim().toLowerCase()) continue
      parseJsonArray((r as any).sections ?? (r as any).section).forEach(s=> set.add(s))
    }
    // fallback from classSections leaf if present
    for (const r of ((records as any).classSections ?? [])) {
      if (klass && String(r.className ?? '').trim().toLowerCase() !== klass.trim().toLowerCase()) continue
      const v = String(r.section ?? r.name ?? '').trim()
      if (v) set.add(v)
    }
    const base = [...set].sort()
    if (!teacherScope.isTeacher || !klass) return base
    const teacherSecs = teacherScope.sectionsForBaseClass(klass)
    if (!teacherSecs.length) return base
    const inter = base.filter((s) => teacherSecs.some((ts) => ts.toLowerCase() === s.trim().toLowerCase()))
    return inter.length ? inter : teacherSecs
  }, [records, klass, teacherScope])

  const hallOptions = useMemo(()=> (records.examHall ?? records.halls ?? []).map((r:any)=> String(r.name ?? r.hallName ?? r.room ?? '').trim()).filter(Boolean), [records])

  const subjectList = useMemo(()=> {
    const s = subjectsForClass(records.assignClassSubjects ?? [], klass, section)
    const all = s.length
      ? s
      : cleanValues((records.subjectList ?? []).map((r:any)=> String(r.name ?? r.subject ?? '').trim()))
    if (!teacherScope.isTeacher || !klass) return all
    return teacherScope.subjectsForClassSection(klass, section, all)
  }, [records, klass, section, teacherScope])
  const subjects = subjectList

  // Class Work / Home Work / Exams are driven strictly by the selected Exam's markDistribution — no fallback
  const distColumns = useMemo(()=>{
    const examRow = (records.examSetup ?? []).find((r:any)=> String(r.examName ?? r.name ?? r.title ?? '').trim().toLowerCase() === exam.trim().toLowerCase())
    const rawDist = (examRow as any)?.markDistribution ?? (examRow as any)?.markDistributions ?? (examRow as any)?.distribution
    return parseJsonArray(rawDist)
  }, [records, exam])

  const loadDraft = () => {
    if (!exam) { toast.error('Select Exam first'); return }
    if (!klass) { toast.error('Select Class first'); return }
    if (!section) { toast.error('Select Section first'); return }
    const nd: Record<string, Draft> = {}
    // preload from existing examSchedule
    const existing = (records.examSchedule ?? []) as EduRow[]
    const bySub = new Map<string, EduRow>()
    for (const r of existing) {
      if (String(r.exam ?? '').trim().toLowerCase() !== exam.trim().toLowerCase()) continue
      if (String(r.className ?? '').trim().toLowerCase() !== klass.trim().toLowerCase()) continue
      // section match if present on row
      const rs = String((r as any).section ?? (r as any).sections ?? '').trim().toLowerCase()
      if (rs && rs !== section.trim().toLowerCase()) continue
      bySub.set(String(r.subject ?? '').trim().toLowerCase(), r)
    }
    for (const s of subjects) {
      const r = bySub.get(s.toLowerCase()) as any
      const marks: Record<string, { full: string; pass: string }> = {}
      for (const dist of distColumns) {
        const k = distKey(dist)
        // try direct key, then legacy camel variants
        const full = String(r?.[k] ?? r?.[k.toLowerCase()] ?? r?.[dist] ?? '')
        const pass = String(r?.[k+'Pass'] ?? r?.[k+'pass'] ?? r?.[dist+'Pass'] ?? '')
        marks[dist] = { full: full === 'undefined' ? '' : full, pass: pass === 'undefined' ? '' : pass }
      }
      // backfill legacy if row had old fixed fields but distColumns changed (e.g. Home Work vs Project Work)
      if (!Object.keys(marks).length) {
        for (const dist of distColumns) marks[dist] = { full:'', pass:'' }
      }
      nd[s] = {
        date: r?.date ? String(r.date).slice(0,10) : '',
        startingTime: String(r?.startingTime ?? r?.startTime ?? '04:40'),
        endingTime: String(r?.endingTime ?? r?.endTime ?? '04:40'),
        hallRoom: String(r?.hallRoom ?? r?.hall ?? ''),
        marks,
      }
    }
    // if no subjects, toast
    if (!subjects.length) toast.error('No subjects assigned to this class/section — add in Assign Class Subjects')
    setDraft(nd)
    setFiltered(true)
  }

  const setCell = (subj: string, key: keyof Omit<Draft,'marks'>, val: string) => {
    setDraft(d=> ({ ...d, [subj]: { ...(d[subj] ?? { date:'', startingTime:'04:40', endingTime:'04:40', hallRoom:'', marks: {} } as Draft), [key]: val } as Draft }))
  }
  const setMark = (subj: string, dist: string, field: 'full'|'pass', val: string) => {
    setDraft(d=>{
      const cur = d[subj] ?? { date:'', startingTime:'04:40', endingTime:'04:40', hallRoom:'', marks: {} } as Draft
      return { ...d, [subj]: { ...cur, marks: { ...cur.marks, [dist]: { ...(cur.marks[dist] ?? {full:'',pass:''}), [field]: val } } } as Draft }
    })
  }

  const handleSave = () => {
    if (!filtered) { toast.error('Click Filter first'); return }
    let creates=0, updates=0
    const next = [...(records.examSchedule ?? [])] as EduRow[]
    const idxByKey = new Map<string, number>()
    next.forEach((r,i)=>{
      const k = `${String(r.exam??'').toLowerCase()}|${String(r.className??'').toLowerCase()}|${String((r as any).section??'').toLowerCase()}|${String(r.subject??'').toLowerCase()}`
      idxByKey.set(k,i)
    })
    for (const subj of subjects) {
      const d = draft[subj]
      if (!d) continue
      if (!d.date) continue // require date
      const key = `${exam.toLowerCase()}|${klass.toLowerCase()}|${section.toLowerCase()}|${subj.toLowerCase()}`
      const row: EduRow = {
        id: uid(),
        exam, className: klass, section: section as any, subject: subj,
        date: d.date, startingTime: d.startingTime, endingTime: d.endingTime, hallRoom: d.hallRoom,
        // dynamic distribution marks + legacy aliases for DataTable
        ...Object.fromEntries(distColumns.flatMap(dist=> {
          const k = distKey(dist)
          const v = d.marks[dist] ?? { full:'', pass:'' }
          return [[k, v.full], [k+'Pass', v.pass]]
        })),
        // keep legacy keys so old rows still render
        classWork: d.marks['Class Work']?.full ?? d.marks[distColumns[0]]?.full ?? '',
        classWorkPass: d.marks['Class Work']?.pass ?? d.marks[distColumns[0]]?.pass ?? '',
      } as any
      // keep legacy keys for DataTable compatibility
      const idx = idxByKey.get(key)
      if (idx !== undefined) {
        next[idx] = { ...next[idx], ...row, id: next[idx].id }
        updates++
      } else {
        next.push(row); creates++
      }
    }
    persist({ ...records, examSchedule: next } as EduRecords)
    toast.success('Schedule saved', `${creates} new, ${updates} updated`)
    onSaved?.()
  }

  return (
    <div className="space-y-4">
      {/* Top filter — Branch comes from app Header; Exam/Class/Section + inline Filter */}
      <div className="overflow-hidden rounded-xl border border-line bg-card shadow-sm">
        <div className="border-b-2 border-amber-400 bg-white px-4 py-2.5 text-sm font-bold text-zinc-900 dark:bg-zinc-900 dark:text-white">Select Ground</div>
        <div className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
            <label className="grid gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-200">
              <span>Exam Name <span className="text-red-500">*</span></span>
              <Select value={exam} onChange={e=> { setExam(e.target.value); setFiltered(false) }}>
                <option value="">Select exam…</option>
                {examOptions.map(o=> <option key={o} value={o}>{o}</option>)}
                {!examOptions.length && <option value="End of First Examination (Term 1)">End of First Examination (Term 1)</option>}
              </Select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-200">
              <span>Class <span className="text-red-500">*</span></span>
              <Select value={klass} onChange={e=> { setKlass(e.target.value); setSection(''); setFiltered(false) }}>
                <option value="">Select class…</option>
                {classOptions.map(o=> <option key={o} value={o}>{o}</option>)}
                {!classOptions.length && <option value="JHS 1">JHS 1</option>}
              </Select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-200">
              <span>Section <span className="text-red-500">*</span></span>
              <Select value={section} onChange={e=> setSection(e.target.value)}>
                <option value="">Select section…</option>
                {sectionOptions.map(o=> <option key={o} value={o}>{o}</option>)}
                {!sectionOptions.length && <option value="A">A</option>}
              </Select>
            </label>
            <Button variant="outline" onClick={loadDraft} className="h-9 gap-2 self-end rounded-full px-6 max-sm:w-full lg:mb-[2px]">
              <Filter className="size-4" /> Filter
            </Button>
          </div>
        </div>
      </div>

      {/* Add Schedule — only visible after Filter */}
      {filtered && (
      <div className="overflow-hidden rounded-xl border border-line bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b-2 border-amber-400 bg-white px-4 py-2.5 text-sm font-bold text-zinc-900 dark:bg-zinc-900 dark:text-white">
          <Clock className="size-4" /> Add Schedule
        </div>

        <div className="p-3">
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className={`w-full text-xs ${distColumns.length > 3 ? "min-w-[1300px]" : distColumns.length === 2 ? "min-w-[900px]" : "min-w-[1100px]"}`}>
              <thead>
                <tr className="bg-amber-50 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  <th className="border-b border-r border-line px-3 py-2.5">Subject <span className="text-red-500">*</span></th>
                  <th className="border-b border-r border-line px-3 py-2.5" style={{ minWidth: 162 }}>Date <span className="text-red-500">*</span></th>
                  <th className="border-b border-r border-line px-3 py-2.5">Starting Time <span className="text-red-500">*</span></th>
                  <th className="border-b border-r border-line px-3 py-2.5">Ending Time <span className="text-red-500">*</span></th>
                  <th className="border-b border-r border-line px-3 py-2.5">Hall Room <span className="text-red-500">*</span></th>
                  {distColumns.map((dist, idx)=> (
                    <th key={dist} className={`border-b px-3 py-2.5 ${idx < distColumns.length-1 ? 'border-r border-line' : 'border-line'}`}>{dist} <span className="text-red-500">*</span></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(filtered ? subjects : []).length ? (filtered ? subjects : []).map(subj => {
                  const d = draft[subj] ?? { date:'', startingTime:'04:40', endingTime:'04:40', hallRoom:'', marks: {} }
                  return (
                    <tr key={subj} className="border-b border-line last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                      <td className="border-r border-line px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{subj}</td>
                      <td className="border-r border-line px-3 py-2" style={{ minWidth: 162 }}>
                        <DatePicker value={d.date} onChange={(v) => setCell(subj, 'date', v)} className="h-8" aria-label={`Exam date for ${subj}`} />
                      </td>
                      <td className="border-r border-line px-3 py-2">
                        <TimeField value={d.startingTime} onChange={v=> setCell(subj,'startingTime', v)} />
                      </td>
                      <td className="border-r border-line px-3 py-2">
                        <TimeField value={d.endingTime} onChange={v=> setCell(subj,'endingTime', v)} />
                      </td>
                      <td className="border-r border-line px-3 py-2">
                        <Select value={d.hallRoom} onChange={e=> setCell(subj,'hallRoom', e.target.value)} className="h-8">
                          <option value="">Not Selected</option>
                          <option value="Main Hall">Main Hall</option>
                          {hallOptions.filter(h=> h !== 'Main Hall').map(h=> <option key={h} value={h}>{h}</option>)}
                        </Select>
                      </td>
                      {distColumns.map((dist, idx)=> {
                        const v = d.marks[dist] ?? { full:'', pass:'' }
                        return (
                          <td key={dist} className={`px-3 py-2 ${idx < distColumns.length-1 ? 'border-r border-line' : ''}`}>
                            <div className="flex gap-1.5">
                              <Input value={v.full} onChange={e=> setMark(subj, dist, 'full', e.target.value)} className="h-8 w-[82px] text-center" placeholder="Full Mark" />
                              <Input value={v.pass} onChange={e=> setMark(subj, dist, 'pass', e.target.value)} className="h-8 w-[72px] text-center" placeholder="Pass Mark" />
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={5 + distColumns.length} className="px-4 py-10 text-center text-sm text-zinc-600 dark:text-zinc-300">
                      <div className="mx-auto max-w-md">
                        <CalendarDays className="mx-auto mb-2 size-8 opacity-40" />
                        {filtered ? 'No subjects for this Class/Section.' : 'Select Exam, Class and Section then click Filter to load subjects.'}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end border-t border-line pt-3">
            <Button onClick={handleSave} className="gap-2 rounded-full bg-zinc-900 px-6 text-white hover:bg-zinc-800">
              <Save className="size-4" /> Save
            </Button>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
