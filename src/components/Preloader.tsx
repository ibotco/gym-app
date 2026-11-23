import { cn } from '../lib/utils'

/**
 * Full-area page preloader shown while a route chunk is loading.
 * Matches the reference design: a centered blue spinner over the content area.
 */
export function Preloader({ className }: { className?: string }) {
  return (
    <div className={cn('grid min-h-[60vh] place-items-center', className)}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-[#3E88D6]/20" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#3E88D6]" />
        </div>
        <p className="text-sm font-semibold text-mist">Loading…</p>
      </div>
    </div>
  )
}
