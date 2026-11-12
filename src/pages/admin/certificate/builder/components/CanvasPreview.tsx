import { useEffect } from 'react'
import { Printer, Trash2, X } from 'lucide-react'
import { Button } from '../../../../../components/ui'
import { isDatabaseElement } from '../constants'
import { getDefaultCertificateElements } from '../defaults'
import type { useCertificateBuilder } from '../hooks/useCertificateBuilder'

function getElStyle(el: any) {
  const s = el.style || {}
  return {
    fontFamily: s.fontFamily || 'Poppins',
    fontSize: s.fontSize || 16,
    color: s.color || '#1a202c',
    textAlign: s.textAlign || 'center',
    fontWeight: s.fontWeight || '400',
    fontStyle: s.fontStyle || 'normal',
    backgroundColor: s.backgroundColor || 'transparent',
    borderWidth: s.borderWidth ?? 2,
    borderColor: s.borderColor || '#1e293b',
    borderRadius: s.borderRadius ?? 0,
    lineHeight: s.lineHeight,
  }
}

function getPatternStyle(pattern: string): React.CSSProperties {
  switch(pattern) {
    case 'dots': return {backgroundImage:`radial-gradient(circle, rgba(0,0,0,0.14) 1.6px, transparent 1.6px)`, backgroundSize:'18px 18px', opacity:0.9} as React.CSSProperties;
    case 'lines': return {backgroundImage:`repeating-linear-gradient(0deg, transparent 0 10px, rgba(0,0,0,0.08) 10px 11px)`} as React.CSSProperties;
    case 'grid': return {backgroundImage:`linear-gradient(to right, rgba(0,0,0,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.07) 1px, transparent 1px)`, backgroundSize:'22px 22px'} as React.CSSProperties;
    case 'waves': return {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='20' viewBox='0 0 80 20'%3E%3Cpath d='M0 10 Q20 0 40 10 T80 10' fill='none' stroke='rgba(0,0,0,0.10)' stroke-width='1.4'/%3E%3C/svg%3E")`, backgroundRepeat:'repeat', backgroundSize:'80px 20px'} as React.CSSProperties;
    case 'chevron': return {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='20' viewBox='0 0 40 20'%3E%3Cpath d='M0 20 L20 0 L40 20' fill='none' stroke='rgba(0,0,0,0.09)' stroke-width='1.2'/%3E%3C/svg%3E")`, backgroundSize:'40px 20px'} as React.CSSProperties;
    case 'stripes': return {backgroundImage:`repeating-linear-gradient(45deg, transparent 0 12px, rgba(180,150,30,0.10) 12px 24px)`} as React.CSSProperties;
    case 'crosshatch': return {backgroundImage:`repeating-linear-gradient(45deg, transparent 0 14px, rgba(0,0,0,0.06) 14px 15px), repeating-linear-gradient(-45deg, transparent 0 14px, rgba(0,0,0,0.06) 14px 15px)`} as React.CSSProperties;
    case 'confetti': return {backgroundImage:`radial-gradient(circle at 10% 20%, rgba(120,180,200,0.18) 2px, transparent 2.5px), radial-gradient(circle at 70% 60%, rgba(230,180,60,0.18) 2px, transparent 2.5px), radial-gradient(circle at 40% 80%, rgba(180,120,200,0.15) 1.8px, transparent 2.3px), radial-gradient(circle at 85% 15%, rgba(100,200,120,0.14) 1.8px, transparent 2.3px)`, backgroundSize:'60px 60px'} as React.CSSProperties;
    case 'damask': return {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='none' stroke='rgba(0,0,0,0.07)' stroke-width='1'%3E%3Cpath d='M30 5 C32 12 38 12 30 20 C22 12 28 12 30 5'/%3E%3Cpath d='M30 40 C32 47 38 47 30 55 C22 47 28 47 30 40'/%3E%3C/g%3E%3C/svg%3E")`, backgroundSize:'60px 60px'} as React.CSSProperties;
    case 'stars': return {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'%3E%3Cpath d='M18 4 L19.5 11 H27 L21 15.5 L23 23 L18 18.5 L13 23 L15 15.5 L9 11 H16.5 Z' fill='rgba(0,0,0,0.09)'/%3E%3C/svg%3E")`, backgroundSize:'36px 36px'} as React.CSSProperties;
    case 'marble': return {backgroundImage:`linear-gradient(115deg, transparent 0%, rgba(0,0,0,0.04) 15%, transparent 30%, rgba(0,0,0,0.03) 45%, transparent 60%, rgba(180,160,120,0.05) 75%, transparent 100%), radial-gradient(ellipse at 30% 20%, rgba(0,0,0,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(0,0,0,0.05) 0%, transparent 50%)`} as React.CSSProperties;
    case 'honeycomb': return {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='30' viewBox='0 0 34 30'%3E%3Cpath d='M17 2 L26 7.5 L26 18.5 L17 24 L8 18.5 L8 7.5 Z' fill='none' stroke='rgba(0,0,0,0.08)' stroke-width='1'/%3E%3C/svg%3E")`, backgroundSize:'34px 30px'} as React.CSSProperties;
    case 'herringbone': return {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='30' viewBox='0 0 60 30'%3E%3Cpath d='M0 15 L15 0 L30 15 L15 30 Z M30 15 L45 0 L60 15 L45 30 Z' fill='none' stroke='rgba(0,0,0,0.07)' stroke-width='1'/%3E%3C/svg%3E")`, backgroundSize:'60px 30px'} as React.CSSProperties;
    case 'paisley': return {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 50 50'%3E%3Cpath d='M25 8 C32 8 35 18 25 30 C20 22 14 18 25 8' fill='none' stroke='rgba(0,0,0,0.07)' stroke-width='1'/%3E%3Ccircle cx='25' cy='18' r='3' fill='rgba(0,0,0,0.04)'/%3E%3C/svg%3E")`, backgroundSize:'50px 50px'} as React.CSSProperties;
    case 'floral': return {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cg fill='rgba(0,0,0,0.06)'%3E%3Ccircle cx='24' cy='24' r='1.8'/%3E%3Ccircle cx='24' cy='14' r='3'/%3E%3Ccircle cx='24' cy='34' r='3'/%3E%3Ccircle cx='14' cy='24' r='3'/%3E%3Ccircle cx='34' cy='24' r='3'/%3E%3C/g%3E%3C/svg%3E")`, backgroundSize:'48px 48px'} as React.CSSProperties;
    case 'geometric': return {backgroundImage:`linear-gradient(30deg, rgba(0,0,0,0.06) 12%, transparent 12.5%, transparent 87%, rgba(0,0,0,0.06) 87.5%), linear-gradient(150deg, rgba(0,0,0,0.06) 12%, transparent 12.5%, transparent 87%, rgba(0,0,0,0.06) 87.5%)`, backgroundSize:'28px 50px'} as React.CSSProperties;
    case 'mosaic': return {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Crect x='1' y='1' width='10' height='10' fill='none' stroke='rgba(0,0,0,0.06)' stroke-width='1' rx='1'/%3E%3Crect x='13' y='1' width='10' height='10' fill='none' stroke='rgba(0,0,0,0.05)' stroke-width='1' rx='1'/%3E%3Crect x='1' y='13' width='10' height='10' fill='none' stroke='rgba(0,0,0,0.05)' stroke-width='1' rx='1'/%3E%3Crect x='13' y='13' width='10' height='10' fill='none' stroke='rgba(0,0,0,0.06)' stroke-width='1' rx='1'/%3E%3C/svg%3E")`, backgroundSize:'24px 24px'} as React.CSSProperties;
    case 'linen': return {backgroundImage:`repeating-linear-gradient(90deg, rgba(0,0,0,0.04) 0 1px, transparent 1px 4px), repeating-linear-gradient(0deg, rgba(0,0,0,0.035) 0 1px, transparent 1px 4px)`} as React.CSSProperties;
    case 'parchment': return {backgroundImage:`radial-gradient(ellipse at 20% 30%, rgba(180,160,120,0.10) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(160,140,100,0.08) 0%, transparent 50%), linear-gradient(0deg, rgba(0,0,0,0.02) 1px, transparent 1px)`, backgroundSize:'100% 100%, 100% 100%, 22px 22px'} as React.CSSProperties;
    case 'bubbles': return {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Ccircle cx='10' cy='12' r='5' fill='none' stroke='rgba(0,0,0,0.05)' stroke-width='1'/%3E%3Ccircle cx='28' cy='30' r='7' fill='none' stroke='rgba(0,0,0,0.04)' stroke-width='1'/%3E%3Ccircle cx='32' cy='10' r='3' fill='none' stroke='rgba(0,0,0,0.05)' stroke-width='1'/%3E%3C/svg%3E")`, backgroundSize:'40px 40px'} as React.CSSProperties;
    case 'diagonal': return {backgroundImage:`repeating-linear-gradient(45deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 10px)`} as React.CSSProperties;
    case 'zigzag': return {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='20' viewBox='0 0 40 20'%3E%3Cpath d='M0 10 L10 0 L20 10 L30 0 L40 10' fill='none' stroke='rgba(0,0,0,0.08)' stroke-width='1'/%3E%3C/svg%3E")`, backgroundSize:'40px 20px'} as React.CSSProperties;
    case 'circles': return {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 30 30'%3E%3Ccircle cx='15' cy='15' r='8' fill='none' stroke='rgba(0,0,0,0.06)' stroke-width='1'/%3E%3Ccircle cx='15' cy='15' r='3' fill='none' stroke='rgba(0,0,0,0.04)' stroke-width='1'/%3E%3C/svg%3E")`, backgroundSize:'30px 30px'} as React.CSSProperties;
    case 'hexagons': return {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='32' viewBox='0 0 28 32'%3E%3Cpath d='M14 2 L24 8 L24 20 L14 26 L4 20 L4 8 Z' fill='none' stroke='rgba(0,0,0,0.07)' stroke-width='1'/%3E%3C/svg%3E")`, backgroundSize:'28px 32px'} as React.CSSProperties;
    case 'noise': return {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 50 50'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='50' height='50' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`, backgroundSize:'50px 50px'} as React.CSSProperties;
    case 'vintage-paper': return {backgroundImage:`linear-gradient(180deg, rgba(139,115,85,0.06) 0%, transparent 50%, rgba(139,115,85,0.04) 100%), radial-gradient(ellipse at 15% 20%, rgba(0,0,0,0.04) 0%, transparent 60%)`} as React.CSSProperties;
    default: return {};
  }
}
type Builder = ReturnType<typeof useCertificateBuilder>

export function CanvasPreview({ builder }: { builder: Builder }) {
  const {
    elements, setElements, selectedId, setSelectedId, editingId, setEditingId,
    bgColor, bgImage, bgPattern, borderStyle, showGuides, setShowGuides,
    dragging, resizing, setResizing, handleMouseDown, canvasRef, previewScrollRef,
    previewMaxH, isPanning, setIsPanning, panStart, setPanStart,
    paperSize, orientation, marginFilter, zoomFilter, setZoomFilter,
    getPaperDims, getMargin, getEffectiveScale, fitToScreen, handlePrint,
    addElementAt,
  } = builder as any

  return (
    <div className="flex min-w-0 flex-col gap-3 self-start">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-lime/20 bg-white p-3 shadow-md ring-1 ring-black/5 dark:bg-zinc-800">
        <div className="flex items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-7 rounded-full px-3 text-[11px] font-medium" onClick={() => fitToScreen()}>Fit View</Button>
          <Button type="button" size="sm" variant={showGuides ? 'lime' : 'outline'} className="h-7 rounded-full px-3 text-[11px] font-medium" onClick={() => setShowGuides((v: boolean) => !v)}>{showGuides ? 'Guides On' : 'Guides Off'}</Button>
          <Button type="button" size="sm" variant="outline" className="h-7 rounded-full px-3 text-[11px] font-medium" onClick={handlePrint}><Printer className="mr-1 size-3" />Print</Button>
          <Button type="button" size="sm" variant="outline" className="h-7 rounded-full px-3 text-[11px] font-medium text-rose-600 hover:bg-rose-50" onClick={() => { if (elements.length && confirm(`Clear all ${elements.length} element(s) from canvas?`)) { setElements([]); setSelectedId(null) } }}><Trash2 className="mr-1 size-3" />Clear All</Button>
          <Button type="button" size="sm" variant="outline" className="h-7 rounded-full px-3 text-[11px] font-medium" onClick={() => { const paper = getPaperDims(); const m = getMargin(); setElements(getDefaultCertificateElements(paper.w, paper.h, m.px)) }}>Load Sample</Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-mist">Zoom</span>
          <input type="range" min={50} max={200} value={zoomFilter} onChange={e => setZoomFilter(Number(e.target.value))} className="h-1 w-24 accent-lime-600" />
          <span className="min-w-[3ch] text-[11px] font-bold text-foreground">{zoomFilter}%</span>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border-2 border-lime/20 bg-zinc-900 p-5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.4)] dark:bg-zinc-900">
        <div
          ref={previewScrollRef}
          className={`flex min-h-0 w-full justify-center overflow-auto ${isPanning ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
          style={previewMaxH ? { maxHeight: previewMaxH, minHeight: 420 } : { minHeight: 560 }}
          onMouseDown={e => {
            const target = e.target as HTMLElement
            if (target.closest('[data-element]')) return
            if (dragging || resizing) return
            setIsPanning(true)
            setPanStart({ x: e.clientX, y: e.clientY, scrollLeft: previewScrollRef.current?.scrollLeft || 0, scrollTop: previewScrollRef.current?.scrollTop || 0 })
            e.preventDefault()
          }}
          onMouseMove={e => {
            if (!isPanning || !previewScrollRef.current) return
            const dx = e.clientX - panStart.x
            const dy = e.clientY - panStart.y
            previewScrollRef.current.scrollLeft = panStart.scrollLeft - dx
            previewScrollRef.current.scrollTop = panStart.scrollTop - dy
          }}
          onMouseUp={() => setIsPanning(false)}
          onMouseLeave={() => setIsPanning(false)}
        >
          <div style={{ width: getPaperDims().w * getEffectiveScale(), height: getPaperDims().h * getEffectiveScale(), flexShrink: 0 }} className="relative bg-white shadow-[0_25px_60px_-18px_rgba(0,0,0,0.6),0_0_0_1px_rgba(0,0,0,0.08)] rounded-sm overflow-hidden ring-1 ring-black/10">
            <div style={{ width: getPaperDims().w, height: getPaperDims().h, transform: `scale(${getEffectiveScale()})`, transformOrigin: 'top left', backgroundColor: '#ffffff', padding: getMargin().px }} className="relative overflow-hidden">
              <div
                ref={canvasRef}
                className="relative h-full w-full overflow-hidden rounded-sm"
                style={{ backgroundColor: bgColor, backgroundImage: bgImage ? `url(${bgImage})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', width: '100%', height: '100%' }}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
                onDrop={e => {
                  e.preventDefault()
                  try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'))
                    if (data?.type) addElementAt(data.type, data.content || '', e.clientX, e.clientY, data.group, data.source)
                  } catch {}
                }}
                onClick={() => setSelectedId(null)}
              >
                {borderStyle !== 'none' && (() => {
                  const bs = String(borderStyle)
                  if (bs === 'striped' || bs === 'ornate') {
                    return <div className="pointer-events-none absolute inset-0 z-0 p-2" style={{ background: 'repeating-linear-gradient(45deg, #d69e2e, #d69e2e 10px, #8c5a00 10px, #8c5a00 20px)' }}><div className="h-full w-full" style={{ backgroundColor: bgColor }} /></div>
                  }
                  const styleMap: Record<string, React.CSSProperties> = {
                    solid: { border: '4px solid #d69e2e' },
                    double: { border: '8px double #d69e2e' },
                    dashed: { border: '4px dashed #d69e2e' },
                    dotted: { border: '4px dotted #d69e2e' },
                    thick: { border: '16px solid #d69e2e' },
                    elegant: { border: '2px solid #d69e2e' },
                    gold: { border: '8px solid #d4a017', boxShadow: 'inset 0 0 0 2px #fff, inset 0 0 12px rgba(212,160,23,0.3)' },
                    silver: { border: '8px solid #94a3b8', boxShadow: 'inset 0 0 0 2px #fff, inset 0 0 12px rgba(148,163,184,0.25)' },
                    royal: { border: '6px double #1e40af', boxShadow: 'inset 0 0 0 1px #d4a017' },
                    emerald: { border: '6px double #065f46', boxShadow: 'inset 0 0 0 1px #fbbf24' },
                    burgundy: { border: '6px double #7f1d1d', boxShadow: 'inset 0 0 0 1px #fbbf24' },
                    'navy-gold': { border: '10px solid #1e293b', outline: '2px solid #d4a017', outlineOffset: '-6px' },
                    'art-deco': { border: '6px solid #1a1a1a', boxShadow: 'inset 0 0 0 3px #d4a017, inset 0 0 0 5px #fff' },
                    wavy: { border: '5px solid #d4a017', borderRadius: '14px' },
                    scalloped: { border: '8px solid #d69e2e', borderStyle: 'dashed', borderRadius: '18px' },
                    rope: { border: '10px ridge #b45309', borderRadius: '6px' },
                    laurel: { border: '6px solid #365314', boxShadow: 'inset 0 0 0 2px #fbbf24' },
                    shadow: { border: '4px solid #1e293b', boxShadow: '0 6px 18px rgba(0,0,0,0.22), inset 0 0 0 2px rgba(212,160,23,0.35)' },
                    triple: { border: '12px double #d4a017', outline: '2px solid #78350f', outlineOffset: '-4px' },
                    mosaic: { border: '10px solid transparent', borderImage: 'repeating-linear-gradient(45deg, #d4a017 0 8px, #7c2d12 8px 16px) 10' },
                    inset: { border: '8px inset #d69e2e' },
                    outset: { border: '8px outset #d69e2e' },
                    bevel: { border: '8px groove #d69e2e' },
                    vintage: { border: '6px solid #92400e', boxShadow: 'inset 0 0 0 1px #fde68a, 0 2px 8px rgba(0,0,0,0.18)' },
                    classic: { border: '10px double #78350f', boxShadow: 'inset 0 0 0 2px #fde68a' },
                    modern: { border: '3px solid #0f172a' },
                    floral: { border: '8px solid #d69e2e', borderRadius: '20px', boxShadow: 'inset 0 0 14px rgba(212,160,23,0.15)' },
                    groove: { border: '6px groove #d69e2e' },
                    ridge: { border: '6px ridge #d69e2e' },
                  }
                  const mapped = styleMap[bs]
                  if (mapped) return <div className="pointer-events-none absolute inset-0 z-0" style={mapped as any} />
                  // fallback
                  return <div className="pointer-events-none absolute inset-0 z-0" style={{ border: `4px solid ${bs.includes('gold') || bs.includes('royal') || bs.includes('emerald') ? '#d69e2e' : '#1e293b'}` }} />
                })()}
                {/* Background pattern overlay — sits above bgColor/bgImage but below border and elements */}
                {bgPattern && bgPattern !== 'none' && (
                  <div
                    className="pointer-events-none absolute inset-0 z-0"
                    style={getPatternStyle(bgPattern as string)}
                    aria-hidden
                  />
                )}
                {showGuides && dragging && (() => {
                  const dragged = elements.find((e: any) => e.id === dragging.id)
                  if (!dragged) return null
                  const m = getMargin()
                  const paper = getPaperDims()
                  const innerW = Math.max(100, paper.w - m.px*2)
                  const innerH = Math.max(100, paper.h - m.px*2)
                  const threshold = 6
                  const guides: { type: 'v' | 'h'; pos: number; color: string }[] = []
                  const dLeft = dragged.x, dCenterX = dragged.x + dragged.w/2, dRight = dragged.x + dragged.w, dTop = dragged.y, dCenterY = dragged.y + dragged.h/2, dBottom = dragged.y + dragged.h
                  const cCenterX = innerW/2, cCenterY = innerH/2
                  if (Math.abs(dCenterX - cCenterX) < threshold) guides.push({ type: 'v', pos: cCenterX, color: 'bg-lime-500' })
                  if (Math.abs(dCenterY - cCenterY) < threshold) guides.push({ type: 'h', pos: cCenterY, color: 'bg-lime-500' })
                  if (Math.abs(dLeft - 0) < threshold) guides.push({ type: 'v', pos: 0, color: 'bg-amber-500' })
                  if (Math.abs(dRight - innerW) < threshold) guides.push({ type: 'v', pos: innerW, color: 'bg-amber-500' })
                  if (Math.abs(dTop - 0) < threshold) guides.push({ type: 'h', pos: 0, color: 'bg-amber-500' })
                  if (Math.abs(dBottom - innerH) < threshold) guides.push({ type: 'h', pos: innerH, color: 'bg-amber-500' })
                  elements.forEach((other: any) => {
                    if (other.id === dragged.id) return
                    const oLeft = other.x, oCenterX = other.x + other.w/2, oRight = other.x + other.w, oTop = other.y, oCenterY = other.y + other.h/2, oBottom = other.y + other.h
                    if (Math.abs(dLeft - oLeft) < threshold) guides.push({ type: 'v', pos: oLeft, color: 'bg-sky-500' })
                    if (Math.abs(dCenterX - oCenterX) < threshold) guides.push({ type: 'v', pos: oCenterX, color: 'bg-sky-500' })
                    if (Math.abs(dRight - oRight) < threshold) guides.push({ type: 'v', pos: oRight, color: 'bg-sky-500' })
                    if (Math.abs(dTop - oTop) < threshold) guides.push({ type: 'h', pos: oTop, color: 'bg-sky-500' })
                    if (Math.abs(dCenterY - oCenterY) < threshold) guides.push({ type: 'h', pos: oCenterY, color: 'bg-sky-500' })
                    if (Math.abs(dBottom - oBottom) < threshold) guides.push({ type: 'h', pos: oBottom, color: 'bg-sky-500' })
                  })
                  const uniq = new Map<string, typeof guides[0]>()
                  guides.forEach(g => { const key = `${g.type}-${Math.round(g.pos)}`; if (!uniq.has(key)) uniq.set(key, g) })
                  return (
                    <div className="pointer-events-none absolute inset-0 z-20">
                      {Array.from(uniq.values()).map((g, i) => (
                        g.type === 'v' ? <div key={`v-${i}`} className={`absolute top-0 h-full w-px ${g.color} opacity-80`} style={{ left: g.pos }} /> : <div key={`h-${i}`} className={`absolute left-0 w-full h-px ${g.color} opacity-80`} style={{ top: g.pos }} />
                      ))}
                    </div>
                  )
                })()}
                {elements.map((el: any) => {
                  const isSelected = selectedId === el.id
                  const style = getElStyle(el)
                  return (
                    <div
                      data-element
                      key={el.id}
                      onMouseDown={e => handleMouseDown(e, el)}
                      onClick={e => { e.stopPropagation(); setSelectedId(el.id) }}
                      onDoubleClick={e => { e.stopPropagation(); if (isDatabaseElement(el)) { if (confirm(`Remove "${el.content || el.type}"?\nThis will permanently remove the element from the canvas.`)) { setElements((prev: any[]) => prev.filter(x => x.id !== el.id)); setSelectedId((s: any) => s === el.id ? null : s) } } else if (el.type !== 'logo' && el.type !== 'image' && el.type !== 'badge' && el.type !== 'rectangle' && el.type !== 'square' && el.type !== 'circle' && el.type !== 'border' && el.type !== 'line') setEditingId(el.id) }}
                      className={`group absolute cursor-grab select-none rounded p-1 transition active:cursor-grabbing ${isSelected ? 'z-10 ring-2 ring-lime-500 ring-offset-1' : 'hover:z-10 hover:ring-1 hover:ring-lime-300'}`}
                      style={{ left: el.x, top: el.y, width: el.w, height: el.h, fontFamily: style.fontFamily, fontSize: style.fontSize, color: style.color, textAlign: style.textAlign, fontWeight: style.fontWeight, fontStyle: style.fontStyle, display: 'flex', alignItems: 'center', justifyContent: style.textAlign === 'center' ? 'center' : style.textAlign === 'right' ? 'flex-end' : 'flex-start', overflow: 'visible' }}
                    >
                      {editingId === el.id ? (
                        <textarea autoFocus value={el.content} onChange={e => setElements((prev: any[]) => prev.map(x => x.id === el.id ? { ...x, content: e.target.value } : x))} onBlur={() => setEditingId(null)} className="h-full w-full resize-none rounded border border-lime-500 bg-white p-1 text-xs outline-none" />
                      ) : el.type === 'logo' || el.type === 'image' || el.type === 'badge' ? (
                        el.content ? <img src={el.content} alt="" className="pointer-events-none h-full w-full object-contain" /> : <div className="pointer-events-none flex h-full w-full items-center justify-center border border-dashed border-zinc-300 bg-zinc-50 text-[10px]">{el.type}</div>
                      ) : el.type === 'line' ? (
                        <div className="pointer-events-none w-full self-center" style={{ height: el.h <= 8 ? el.h : 2, backgroundColor: style.backgroundColor && style.backgroundColor !== 'transparent' ? style.backgroundColor as string : (style.color as string) || '#1e293b' }} />
                      ) : el.type === 'rectangle' ? (
                        <div className="pointer-events-none h-full w-full" style={{ backgroundColor: (style.backgroundColor as string) || 'transparent', borderWidth: (style.borderWidth as number) ?? 2, borderColor: (style.borderColor as string) || '#1e293b', borderStyle: 'solid', borderRadius: (style.borderRadius as number) ?? 4 }} />
                      ) : el.type === 'square' ? (
                        <div className="pointer-events-none h-full w-full" style={{ backgroundColor: (style.backgroundColor as string) || 'transparent', borderWidth: (style.borderWidth as number) ?? 2, borderColor: (style.borderColor as string) || '#1e293b', borderStyle: 'solid', borderRadius: (style.borderRadius as number) ?? 4 }} />
                      ) : el.type === 'circle' ? (
                        <div className="pointer-events-none h-full w-full" style={{ backgroundColor: (style.backgroundColor as string) || 'transparent', borderWidth: (style.borderWidth as number) ?? 2, borderColor: (style.borderColor as string) || '#1e293b', borderStyle: 'solid', borderRadius: 9999 }} />
                      ) : el.type === 'border' ? (
                        <div className="pointer-events-none h-full w-full" style={{ borderWidth: (style.borderWidth as number) ?? 4, borderColor: (style.borderColor as string) || '#d69e2e', borderStyle: 'solid', borderRadius: (style.borderRadius as number) ?? 8, backgroundColor: (style.backgroundColor as string) || 'transparent' }} />
                      ) : (
                        <span className="pointer-events-none w-full whitespace-nowrap font-semibold drop-shadow-sm" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.8)' }}>{el.content}</span>
                      )}
                      <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); setElements((prev: any[]) => prev.filter(x => x.id !== el.id)); if (isSelected) setSelectedId(null) }} className={`absolute right-0 top-0 z-30 grid size-6 -translate-y-1/2 translate-x-1/2 place-items-center rounded-full bg-rose-600 text-white shadow ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><X className="size-3" /></button>
                      {isSelected && (
                        <>
                          <div className="pointer-events-none absolute inset-0 rounded border-2 border-lime-500/50" />
                          {(el.type === 'logo' || el.type === 'image' || el.type === 'badge' || el.type === 'rectangle' || el.type === 'square' || el.type === 'circle' || el.type === 'line' || el.type === 'border') && (
                            <>
                              <div onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizing({ id: el.id, handle: 'r', startX: e.clientX, startY: e.clientY, startW: el.w, startH: el.h }) }} className="absolute right-0 top-1/2 z-30 h-6 w-2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize rounded bg-lime-500 shadow ring-1 ring-white hover:bg-lime-600" title="Drag to resize width" />
                              <div onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizing({ id: el.id, handle: 'b', startX: e.clientX, startY: e.clientY, startW: el.w, startH: el.h }) }} className="absolute bottom-0 left-1/2 z-30 h-2 w-6 -translate-x-1/2 translate-y-1/2 cursor-ns-resize rounded bg-lime-500 shadow ring-1 ring-white hover:bg-lime-600" title="Drag to resize height" />
                              <div onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizing({ id: el.id, handle: 'br', startX: e.clientX, startY: e.clientY, startW: el.w, startH: el.h }) }} className="absolute bottom-0 right-0 z-30 size-3 translate-x-1/2 translate-y-1/2 cursor-nwse-resize rounded-sm bg-lime-600 shadow ring-1 ring-white hover:bg-lime-700" title="Drag to resize" />
                              <div onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizing({ id: el.id, handle: 'l', startX: e.clientX, startY: e.clientY, startW: el.w, startH: el.h }) }} className="absolute left-0 top-1/2 z-30 h-6 w-2 -translate-y-1/2 -translate-x-1/2 cursor-ew-resize rounded bg-lime-500 shadow ring-1 ring-white hover:bg-lime-600" title="Drag to resize from left" />
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-lg border-2 border-lime/20 bg-lime/10 px-4 py-2.5 text-[12px] font-bold text-zinc-900 shadow-sm dark:bg-lime/20 dark:text-lime-100">
        <span className="font-bold text-foreground">{elements.length} elements</span> · Paper {paperSize} {orientation} · Margin {marginFilter} · Drag to reposition, double-click text to edit
      </div>
    </div>
  )
}
