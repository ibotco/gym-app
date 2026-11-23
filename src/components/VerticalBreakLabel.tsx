export function VerticalBreakLabel({ title, fontSize = 12, color = '#111' }: { title: string; fontSize?: number; color?: string }) {
  return (
    <div
      aria-label={title}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          color,
          fontSize,
          fontWeight: 800,
          lineHeight: 1,
          textTransform: 'uppercase',
          transform: 'rotate(-90deg)',
          transformOrigin: 'center center',
        }}
      >
        {title}
      </span>
    </div>
  )
}
