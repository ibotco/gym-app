import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, AlertTriangle, RefreshCw, X } from 'lucide-react'
import {
  loadNotify,
  saveNotify,
  stackClass,
  isTop,
  type AlertKind,
  type NotifyPrefs,
} from '../lib/notify'

interface Toast {
  id: number
  kind: AlertKind
  title: string
  desc?: string
}

interface ToastCtx {
  prefs: NotifyPrefs
  setPrefs: (p: NotifyPrefs) => void
  push: (t: Omit<Toast, 'id'>) => void
  success: (title: string, desc?: string) => void
  error: (title: string, desc?: string) => void
  warning: (title: string, desc?: string) => void
  info: (title: string, desc?: string) => void
  update: (title: string, desc?: string) => void
}

const Ctx = createContext<ToastCtx | null>(null)

function motionFor(prefs: NotifyPrefs) {
  if (prefs.animation === 'none') {
    return { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 } }
  }
  if (prefs.animation === 'fade') {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    }
  }
  const top = isTop(prefs.position)
  const x = prefs.position.endsWith('left') ? -16 : prefs.position.endsWith('right') ? 16 : 0
  const y = prefs.position.includes('center') ? (top ? -12 : 12) : (x === 0 ? (top ? -12 : 12) : 0)
  return {
    initial: { opacity: 0, x, y: y || (top ? -12 : 12) },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: x ? x / 2 : 0, y: y ? y / 2 : (top ? -8 : 8) },
  }
}

const ICONS: Record<AlertKind, ReactNode> = {
  success: <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-lime" />,
  error: <AlertTriangle className="mt-0.5 size-5 shrink-0 text-ember" />,
  warning: <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" />,
  info: <Info className="mt-0.5 size-5 shrink-0 text-sky-400" />,
  update: <RefreshCw className="mt-0.5 size-5 shrink-0 text-violet-400" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<NotifyPrefs>(() => loadNotify())
  const [items, setItems] = useState<Toast[]>([])

  const setPrefs = useCallback((p: NotifyPrefs) => {
    setPrefsState(p)
    saveNotify(p)
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'fitpro_notify') setPrefsState(loadNotify())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const dismiss = useCallback((id: number) => {
    setItems((s) => s.filter((i) => i.id !== id))
  }, [])

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const current = loadNotify()
    if (!current.enabled) return
    const id = Date.now() + Math.random()
    setItems((s) => [...s.slice(-4), { ...t, id }])
    if (current.duration > 0) {
      window.setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), current.duration)
    }
  }, [])

  const value = useMemo<ToastCtx>(
    () => ({
      prefs,
      setPrefs,
      push,
      success: (title, desc) => push({ kind: 'success', title, desc }),
      error: (title, desc) => push({ kind: 'error', title, desc }),
      warning: (title, desc) => push({ kind: 'warning', title, desc }),
      info: (title, desc) => push({ kind: 'info', title, desc }),
      update: (title, desc) => push({ kind: 'update', title, desc }),
    }),
    [prefs, setPrefs, push],
  )

  const m = motionFor(prefs)
  const listed = isTop(prefs.position) ? items : [...items].reverse()

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        className={`pointer-events-none fixed z-[90] flex w-[min(calc(100vw-1.5rem),360px)] flex-col gap-2 ${stackClass(prefs.position)}`}
        aria-live="polite"
        aria-relevant="additions"
      >
        <AnimatePresence>
          {listed.map((t) => (
            <motion.div
              key={t.id}
              initial={m.initial}
              animate={m.animate}
              exit={m.exit}
              transition={{ duration: prefs.animation === 'none' ? 0 : 0.22 }}
              className={`toast-card pointer-events-auto flex items-start gap-3 p-3 shadow-xl toast-${t.kind}`}
              role="status"
            >
              {ICONS[t.kind]}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.desc && <p className="mt-0.5 text-xs text-mist">{t.desc}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-mist hover:text-inherit" aria-label="Dismiss">
                <X className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast')
  return v
}
