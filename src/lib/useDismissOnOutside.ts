import { useEffect, useRef, type RefObject } from 'react'

/**
 * Closes a popover when the user interacts anywhere outside of `ref`, or presses Escape.
 *
 * Anything inside `ref` is ignored — so the trigger button (which must live inside the
 * same wrapper) keeps working as a plain toggle: clicking it again closes the menu
 * instead of the outside handler closing it and the click re-opening it.
 */
export function useDismissOnOutside(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return

    const onPointer = (event: MouseEvent | TouchEvent) => {
      const el = ref.current
      if (!el) return
      const target = event.target as Node | null
      if (target && el.contains(target)) return
      closeRef.current()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
    }

    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, ref])
}
