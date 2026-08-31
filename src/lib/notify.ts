export type AlertKind = 'success' | 'error' | 'warning' | 'info' | 'update'
export type AlertPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
export type AlertAnimation = 'slide' | 'fade' | 'none'
export type AlertDuration = 3000 | 5000 | 10000 | 0

export interface NotifyPrefs {
  enabled: boolean
  position: AlertPosition
  duration: AlertDuration
  animation: AlertAnimation
}

export const NOTIFY_KEY = 'fitpro_notify'

export const defaultNotify = (): NotifyPrefs => ({
  enabled: true,
  position: 'top-right',
  duration: 5000,
  animation: 'slide',
})

export const POSITIONS: { id: AlertPosition; label: string }[] = [
  { id: 'top-right', label: 'Top Right' },
  { id: 'top-left', label: 'Top Left' },
  { id: 'bottom-right', label: 'Bottom Right' },
  { id: 'bottom-left', label: 'Bottom Left' },
  { id: 'top-center', label: 'Top Center' },
  { id: 'bottom-center', label: 'Bottom Center' },
]

export const DURATIONS: { id: AlertDuration; label: string }[] = [
  { id: 3000, label: '3 seconds' },
  { id: 5000, label: '5 seconds' },
  { id: 10000, label: '10 seconds' },
  { id: 0, label: 'Until dismissed' },
]

export const ANIMATIONS: { id: AlertAnimation; label: string }[] = [
  { id: 'slide', label: 'Slide' },
  { id: 'fade', label: 'Fade' },
  { id: 'none', label: 'None' },
]

export function loadNotify(): NotifyPrefs {
  try {
    const raw = localStorage.getItem(NOTIFY_KEY)
    if (!raw) return defaultNotify()
    const parsed = JSON.parse(raw) as Partial<NotifyPrefs>
    const base = defaultNotify()
    const position = POSITIONS.some((p) => p.id === parsed.position) ? parsed.position as AlertPosition : base.position
    const duration = DURATIONS.some((d) => d.id === parsed.duration) ? parsed.duration as AlertDuration : base.duration
    const animation = ANIMATIONS.some((a) => a.id === parsed.animation) ? parsed.animation as AlertAnimation : base.animation
    return {
      enabled: parsed.enabled !== false,
      position,
      duration,
      animation,
    }
  } catch {
    return defaultNotify()
  }
}

export function saveNotify(p: NotifyPrefs) {
  localStorage.setItem(NOTIFY_KEY, JSON.stringify(p))
}

export function stackClass(pos: AlertPosition) {
  const map: Record<AlertPosition, string> = {
    'top-right': 'top-4 right-4 items-end pt-[env(safe-area-inset-top)]',
    'top-left': 'top-4 left-4 items-start pt-[env(safe-area-inset-top)]',
    'bottom-right': 'bottom-4 right-4 items-end pb-[env(safe-area-inset-bottom)]',
    'bottom-left': 'bottom-4 left-4 items-start pb-[env(safe-area-inset-bottom)]',
    'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center pt-[env(safe-area-inset-top)]',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center pb-[env(safe-area-inset-bottom)]',
  }
  return map[pos]
}

export function isTop(pos: AlertPosition) {
  return pos.startsWith('top')
}
