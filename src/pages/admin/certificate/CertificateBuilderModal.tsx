// Certificate Management — drag & drop certificate template builder.
// Owned by pages/admin/certificate so the Certificate menu carries its own files.
// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Printer, Trash2, UploadCloud } from 'lucide-react'
import { Button, Modal, Select } from '../../../components/ui'
import { Badge } from '../../../components/ui'
import { uid } from '../../../lib/utils'
import {
  CERT_PALETTE,
  getDefaultCertificateElements,
  type CertElement,
  type CertElementType,
} from './CertificateShared'

export function CertificateBuilderModal({ open, onClose, initial, onSave, branchName, branchId, companyName }: { open: boolean; onClose: () => void; initial: any; onSave: (t: any) => void; branchName?: string; branchId?: string; companyName?: string }) {
  const [elements, setElements] = useState<CertElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [holderType, setHolderType] = useState<'Student' | 'Employee' | 'Member' | 'All'>('All')
  const [certificateType, setCertificateType] = useState('Achievement')
  const [bgColor, setBgColor] = useState('#FFFEF0')
  const [bgImage, setBgImage] = useState('')
  const [bgPattern, setBgPattern] = useState<'none' | 'dots' | 'lines' | 'grid' | 'waves' | 'chevron' | 'stripes' | 'crosshatch' | 'confetti' | 'damask' | 'stars' | 'marble'>('none')
  const [borderStyle, setBorderStyle] = useState<'none' | 'solid' | 'double' | 'dashed' | 'dotted' | 'groove' | 'ridge' | 'ornate' | 'vintage' | 'elegant' | 'classic' | 'modern' | 'gold' | 'silver' | 'floral' | 'thick' | 'striped'>('striped')
  const [orientation, setOrientation] = useState<'Landscape' | 'Portrait'>('Portrait')
  const [paperSize, setPaperSize] = useState<'A4' | 'A3' | 'Letter' | 'Legal' | 'Custom'>('A4')
  const [marginFilter, setMarginFilter] = useState<'None' | 'Small' | 'Medium' | 'Large' | 'Extra Large'>('Medium')
  const [zoomFilter, setZoomFilter] = useState(100)
  const [showGuides, setShowGuides] = useState(true)
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [resizing, setResizing] = useState<{ id: string; handle: 'br' | 'r' | 'b' | 'l'; startX: number; startY: number; startW: number; startH: number } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const leftColRef = useRef<HTMLDivElement | null>(null)
  const [previewMaxH, setPreviewMaxH] = useState<number | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })
  const previewScrollRef = useRef<HTMLDivElement | null>(null)
  const [elementSearch, setElementSearch] = useState('')
  const selected = elements.find(e => e.id === selectedId) || null
  useEffect(() => {
    if (initial && (initial as any).certificateData) {
      try {
        const data = JSON.parse(String((initial as any).certificateData))
        setElements(data.elements || [])
        setBgColor(data.bgColor || '#FFFEF0')
        setBgImage(data.bgImage || '')
        setBgPattern(data.bgPattern || 'none')
        setBorderStyle(data.borderStyle || 'ornate')
        setOrientation(data.orientation || (initial as any).orientation || (initial as any).pageLayout || 'Portrait')
        setPaperSize(data.paperSize || (initial as any).paperSize || 'A4')
        setMarginFilter(data.marginFilter || (initial as any).marginFilter || 'Medium')
        setTemplateName((initial as any).name || (initial as any).templateName || '')
        setHolderType((initial as any).holderType || 'All')
        setCertificateType((initial as any).certificateType || 'Achievement')
      } catch {
        setTemplateName((initial as any).name || (initial as any).templateName || '')
        setHolderType((initial as any).holderType || 'All')
        setCertificateType((initial as any).certificateType || 'Achievement')
      }
    } else if (initial) {
      setTemplateName((initial as any).name || (initial as any).templateName || '')
      setHolderType((initial as any).holderType || 'All')
      setCertificateType((initial as any).certificateType || 'Achievement')
      setOrientation((initial as any).orientation || (initial as any).pageLayout || 'Portrait')
      setPaperSize((initial as any).paperSize || 'A4')
      setMarginFilter((initial as any).marginFilter || 'Medium')
      try {
        const d = JSON.parse(String((initial as any).certificateData || '{}'))
        if (d.elements) setElements(d.elements)
      } catch {}
    } else {
      // Default preview with elements as seen in attached reference
      const paper = getPaperDims()
      const m = getMargin()
      setElements(getDefaultCertificateElements(paper.w, paper.h, m.px))
      setBgColor('#FFFEF0')
      setBorderStyle('striped')
      setBgPattern('none')
      setMarginFilter('Medium')
      setHolderType('All')
      setCertificateType('Achievement')
    }
    if (open) {
      setTimeout(() => {
        if (leftColRef.current) {
          const h = leftColRef.current.offsetHeight
          setPreviewMaxH(h > 0 ? h : null)
        }
      }, 100)
    }
  }, [initial, open])
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging) {
        const el = elements.find(x => x.id === dragging.id)
        if (!el || !canvasRef.current) return
        const rect = canvasRef.current.getBoundingClientRect()
        const scale = getEffectiveScale()
        const x = (e.clientX - rect.left) / scale - dragging.offsetX
        const y = (e.clientY - rect.top) / scale - dragging.offsetY
        setElements(prev => prev.map(it => it.id === dragging.id ? { ...it, x, y } : it))
      }
      if (resizing) {
        const deltaX = e.clientX - resizing.startX
        const deltaY = e.clientY - resizing.startY
        const scale = getEffectiveScale()
        setElements(prev => prev.map(it => {
          if (it.id !== resizing.id) return it
          let newW = resizing.startW
          let newH = resizing.startH
          if (resizing.handle === 'r' || resizing.handle === 'br' || resizing.handle === 'l') {
            newW = Math.max(40, resizing.startW + (resizing.handle === 'l' ? -deltaX : deltaX) / scale)
          }
          if (resizing.handle === 'b' || resizing.handle === 'br') {
            newH = Math.max(20, resizing.startH + deltaY / scale)
          }
          if (resizing.handle === 'l') {
            const newX = it.x + (resizing.startW - newW)
            return { ...it, w: newW, h: newH, x: newX }
          }
          return { ...it, w: newW, h: newH }
        }))
      }
    }
    const onUp = () => { setDragging(null); setResizing(null) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging, resizing, elements])

  // Auto-center elements when margin changes (white space around border)
  useEffect(() => {
    const m = getMargin()
    const paper = getPaperDims()
    const innerW = Math.max(100, paper.w - m.px*2)
    setElements(prev => prev.map(el => ({
      ...el,
      x: innerW/2 - el.w/2,
      style: { ...el.style, textAlign: 'center' as const }
    })))
  }, [marginFilter, paperSize, orientation])

  // Auto-fit preview to show fully screen with board and content on tablet/computer
  useEffect(() => {
    // Delay to ensure container is rendered
    const t = setTimeout(() => fitToScreen(), 150)
    return () => clearTimeout(t)
  }, [paperSize, orientation, marginFilter, previewMaxH])

  // Also fit on initial mount for default preview
  useEffect(() => {
    const t = setTimeout(() => fitToScreen(), 300)
    return () => clearTimeout(t)
  }, [])
  const uid = () => Math.random().toString(36).slice(2,9)
  const getPaperDims = () => {
    const sizes: Record<string, { w: number; h: number }> = { A4: { w: 794, h: 1123 }, A3: { w: 1123, h: 1587 }, Letter: { w: 816, h: 1056 }, Legal: { w: 816, h: 1344 }, Custom: { w: 800, h: 600 } }
    const base = sizes[paperSize] || sizes.A4
    return orientation === 'Portrait' ? base : { w: base.h, h: base.w }
  }
  const getMargin = () => {
    const map: Record<string, { mm: number; px: number }> = { None: { mm: 0, px: 0 }, Small: { mm: 10, px: 38 }, Medium: { mm: 15, px: 57 }, Large: { mm: 20, px: 76 }, 'Extra Large': { mm: 25, px: 95 } }
    return map[marginFilter] || map.Medium
  }
  const getEffectiveScale = () => zoomFilter / 100
  const fitToScreen = () => {
    const paper = getPaperDims()
    const container = previewScrollRef.current
    if (!container) {
      setZoomFilter(100)
      return
    }
    // Available space inside the gray preview area (minus padding)
    const availableW = container.clientWidth - 48
    const availableH = (previewMaxH ? Math.min(previewMaxH, 700) : 600) - 32
    const scaleW = availableW / paper.w
    const scaleH = availableH / paper.h
    // Fit fully with some breathing room, clamp 30-100 for default fit (allow up to 200 via slider)
    const fitScale = Math.min(scaleW, scaleH) * 0.92
    const zoom = Math.max(30, Math.min(100, Math.round(fitScale * 100)))
    setZoomFilter(zoom)
  }
  const addElement = (type: CertElement['type'], defaultContent?: string) => {
    const paper = getPaperDims()
    const newEl: CertElement = {
      id: uid(), type, content: defaultContent || type,
      x: paper.w/2 - 100, y: paper.h/2 - 20 + elements.length*24,
      w: type === 'logo' || type === 'image' || type === 'badge' ? 80 : 200,
      h: type === 'logo' || type === 'image' || type === 'badge' ? 80 : 32,
      style: { fontFamily: 'Poppins', fontSize: 16, color: '#1a202c', textAlign: 'center', fontWeight: '400', fontStyle: 'normal' }
    }
    setElements(prev => [...prev, newEl]); setSelectedId(newEl.id)
  }
  const addElementAt = (type: CertElement['type'], content: string, clientX: number, clientY: number) => {
    if (!canvasRef.current) { addElement(type, content); return }
    const rect = canvasRef.current.getBoundingClientRect()
    const scale = getEffectiveScale()
    const x = (clientX - rect.left) / scale
    const y = (clientY - rect.top) / scale
    const newEl: CertElement = {
      id: uid(), type, content: content || type,
      x: x - 50, y: y - 16,
      w: type === 'logo' || type === 'image' || type === 'badge' ? 80 : 200,
      h: type === 'logo' || type === 'image' || type === 'badge' ? 80 : 32,
      style: { fontFamily: 'Poppins', fontSize: 16, color: '#1a202c', textAlign: 'center', fontWeight: '400', fontStyle: 'normal' }
    }
    setElements(prev => [...prev, newEl]); setSelectedId(newEl.id)
  }
  const updateSelected = (patch: any) => {
    if (!selected) return
    setElements(prev => prev.map(el => {
      if (el.id !== selected.id) return el
      if (patch.style) return { ...el, style: { ...el.style, ...patch.style } }
      if (patch.content !== undefined) return { ...el, content: patch.content }
      return { ...el, ...patch }
    }))
  }
  const deleteSelected = (id: string) => { setElements(prev => prev.filter(e => e.id !== id)); setSelectedId(null) }
  const handleMouseDown = (e: React.MouseEvent, el: CertElement) => {
    e.preventDefault(); e.stopPropagation(); setSelectedId(el.id)
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    if (!canvasRect) return
    const scale = getEffectiveScale()
    setDragging({ id: el.id, offsetX: (e.clientX - canvasRect.left)/scale - el.x, offsetY: (e.clientY - canvasRect.top)/scale - el.y })
  }
  const save = () => {
    if (!templateName.trim()) { alert('Template name required'); return }
    const data = { elements, bgColor, bgImage, bgPattern, borderStyle, orientation, paperSize, marginFilter, holderType, certificateType }
    onSave({
      id: (initial as any)?.id || uid(),
      name: templateName,
      templateName,
      holderType,
      certificateType,
      pageLayout: orientation,
      orientation,
      paperSize,
      marginFilter,
      borderStyle,
      pattern: bgPattern,
      backgroundColor: bgColor,
      backgroundImage: bgImage,
      bgColor,
      bgImage,
      bgPattern,
      branch: branchName || (initial as any)?.branch || '',
      branchId: branchId || (initial as any)?.branchId || '',
      company: companyName || (initial as any)?.company || '',
      schoolName: companyName || (initial as any)?.schoolName || '',
      certificateData: JSON.stringify(data),
      createdAt: (initial as any)?.createdAt || new Date().toISOString().slice(0,10)
    })
  }
  const handlePrint = () => { window.print() }
  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Certificate Template' : 'New Certificate Template'} size="full">
      <div className="space-y-4 rounded-xl border border-line bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line/60 bg-muted/20 p-3">
          <label className="flex min-w-[200px] flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Template Name *</span><input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Achievement Certificate" className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm" /></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Holder Type *</span><select value={holderType} onChange={e => setHolderType(e.target.value as any)} className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm"><option value="All">All</option><option value="Student">Student</option><option value="Employee">Employee</option><option value="Member">Member</option></select></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Certificate Type *</span><input value={certificateType} onChange={e => setCertificateType(e.target.value)} placeholder="Achievement" className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm" /></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Background</span><input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="h-9 w-16 rounded border border-line shadow-sm" /></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Border Style</span><select value={borderStyle} onChange={e => setBorderStyle(e.target.value as any)} className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm"><option value="none">None</option><option value="striped">Striped Gold (as attached)</option><option value="solid">Solid Gold</option><option value="double">Double</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="groove">Groove</option><option value="ridge">Ridge</option><option value="ornate">Ornate Striped</option><option value="vintage">Vintage</option><option value="elegant">Elegant Thin</option><option value="classic">Classic Thick Double</option><option value="modern">Modern Black</option><option value="gold">Gold Frame</option><option value="silver">Silver Frame</option><option value="floral">Floral</option><option value="thick">Thick</option></select></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Pattern</span><select value={bgPattern} onChange={e => setBgPattern(e.target.value as any)} className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm"><option value="none">None</option><option value="dots">Dots</option><option value="lines">Lines</option><option value="grid">Grid</option><option value="waves">Waves</option><option value="chevron">Chevron</option><option value="stripes">Stripes</option><option value="crosshatch">Crosshatch</option><option value="confetti">Confetti</option><option value="damask">Damask</option><option value="stars">Stars</option><option value="marble">Marble</option></select></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Background Image</span><div className="flex items-center gap-2"><label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm hover:border-lime"><UploadCloud className="size-4" /><span>{bgImage ? 'Change' : 'Upload'}</span><input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setBgImage(String(reader.result || '')); reader.readAsDataURL(file); e.target.value = '' }} /></label>{bgImage && <button type="button" onClick={() => setBgImage('')} className="rounded-lg border border-line px-2 py-1 text-[11px]">Clear</button>}</div></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Orientation</span><select value={orientation} onChange={e => setOrientation(e.target.value as any)} className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm"><option value="Portrait">Portrait</option><option value="Landscape">Landscape</option></select></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Paper Size</span><select value={paperSize} onChange={e => setPaperSize(e.target.value as any)} className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm"><option value="A4">A4</option><option value="A3">A3</option><option value="Letter">Letter</option><option value="Legal">Legal</option><option value="Custom">Custom</option></select></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Margin</span><select value={marginFilter} onChange={e => setMarginFilter(e.target.value as any)} className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm"><option value="None">None (0mm)</option><option value="Small">Small (10mm)</option><option value="Medium">Medium (15mm)</option><option value="Large">Large (20mm)</option><option value="Extra Large">Extra Large (25mm)</option></select></label>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    <div ref={leftColRef} className="lg:col-span-2 w-full self-start">
            <div className="rounded-lg border border-line bg-card p-3 shadow-sm">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-mist">Elements</p>
              <p className="mb-2 text-[11px] text-mist">Drag to certificate or click to add</p>
              <div className="mb-3">
                <input
                  value={elementSearch}
                  onChange={e => setElementSearch(e.target.value)}
                  placeholder="Search elements..."
                  className="w-full rounded-lg border border-line bg-card px-3 py-1.5 text-xs shadow-sm focus:border-lime focus:ring-1 focus:ring-lime"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                {CERT_PALETTE.filter(item => item.label.toLowerCase().includes(elementSearch.toLowerCase())).map(item => (
                  <button
                    key={item.type+item.label}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('text/plain', JSON.stringify({ type: item.type, content: item.defaultContent }))
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => addElement(item.type, item.defaultContent)}
                    className="flex cursor-grab items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-sm shadow-sm transition hover:border-lime hover:bg-lime/5 active:cursor-grabbing dark:bg-white/[0.04] dark:border-white/10"
                  >
                    <span className="text-[12px] leading-none opacity-40">⋮⋮</span>
                    <span className="flex-1">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 flex min-w-0 flex-col gap-3 self-start">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card p-2.5 shadow-sm">
              <div className="flex items-center gap-1.5">
                <Button type="button" size="sm" variant="outline" className="h-7 rounded-full px-3 text-[11px] font-medium" onClick={() => fitToScreen()}>Fit View</Button>
                <Button type="button" size="sm" variant={showGuides ? 'default' : 'outline'} className="h-7 rounded-full px-3 text-[11px] font-medium" onClick={() => setShowGuides(v => !v)}>{showGuides ? 'Guides On' : 'Guides Off'}</Button>
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
            <div className="overflow-hidden rounded-xl border border-line bg-zinc-100 p-4 shadow-inner dark:bg-zinc-900/50">
              <div
                ref={previewScrollRef}
                className={`flex min-h-0 w-full justify-center overflow-auto ${isPanning ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
                style={previewMaxH ? { maxHeight: previewMaxH, minHeight: 420 } : { minHeight: 560 }}
                onMouseDown={e => {
                  // Only start panning if clicking on the scroll container background, not on an element
                  const target = e.target as HTMLElement
                  if (target.closest('[data-element]')) return
                  if (dragging || resizing) return
                  setIsPanning(true)
                  setPanStart({
                    x: e.clientX,
                    y: e.clientY,
                    scrollLeft: previewScrollRef.current?.scrollLeft || 0,
                    scrollTop: previewScrollRef.current?.scrollTop || 0,
                  })
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
                <div style={{ width: getPaperDims().w * getEffectiveScale(), height: getPaperDims().h * getEffectiveScale(), flexShrink: 0 }} className="relative bg-white shadow-2xl rounded-sm overflow-hidden">
                  <div
                    style={{
                      width: getPaperDims().w,
                      height: getPaperDims().h,
                      transform: `scale(${getEffectiveScale()})`,
                      transformOrigin: 'top left',
                      backgroundColor: '#ffffff',
                      padding: getMargin().px,
                    }}
                    className="relative overflow-hidden"
                  >
                    <div
                      ref={canvasRef}
                      className="relative h-full w-full overflow-hidden rounded-sm"
                      style={{
                        backgroundColor: bgColor,
                        backgroundImage: bgImage ? `url(${bgImage})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        width: '100%',
                        height: '100%',
                      }}
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
                    onDrop={e => {
                      e.preventDefault()
                      try {
                        const data = JSON.parse(e.dataTransfer.getData('text/plain'))
                        if (data?.type) addElementAt(data.type, data.content || '', e.clientX, e.clientY)
                      } catch {}
                    }}
                    onClick={() => setSelectedId(null)}
                  >
                    {borderStyle !== 'none' && (
                      borderStyle === 'striped' || borderStyle === 'ornate' ? (
                        <div className="pointer-events-none absolute inset-0 z-0 p-2" style={{ background: 'repeating-linear-gradient(45deg, #d69e2e, #d69e2e 10px, #8c5a00 10px, #8c5a00 20px)' }}>
                          <div className="h-full w-full" style={{ backgroundColor: bgColor }} />
                        </div>
                      ) : (
                        <div className="pointer-events-none absolute inset-0 z-0" style={{ border: borderStyle==='solid' ? '4px solid #d69e2e' : borderStyle==='double' ? '8px double #d69e2e' : borderStyle==='dashed' ? '4px dashed #d69e2e' : borderStyle==='dotted' ? '4px dotted #d69e2e' : borderStyle==='thick' ? '16px solid #d69e2e' : borderStyle==='elegant' ? '2px solid #d69e2e' : '4px solid #d69e2e' }} />
                      )
                    )}
                    {/* Guidelines - show when Guides On and dragging */}
                    {showGuides && dragging && (() => {
                      const dragged = elements.find(e => e.id === dragging.id)
                      if (!dragged) return null
                      const m = getMargin()
                      const paper = getPaperDims()
                      const innerW = Math.max(100, paper.w - m.px*2)
                      const innerH = Math.max(100, paper.h - m.px*2)
                      const threshold = 6
                      const guides: { type: 'v' | 'h'; pos: number; color: string }[] = []
                      const dLeft = dragged.x
                      const dCenterX = dragged.x + dragged.w/2
                      const dRight = dragged.x + dragged.w
                      const dTop = dragged.y
                      const dCenterY = dragged.y + dragged.h/2
                      const dBottom = dragged.y + dragged.h

                      const cCenterX = innerW/2
                      const cCenterY = innerH/2
                      if (Math.abs(dCenterX - cCenterX) < threshold) guides.push({ type: 'v', pos: cCenterX, color: 'bg-lime-500' })
                      if (Math.abs(dCenterY - cCenterY) < threshold) guides.push({ type: 'h', pos: cCenterY, color: 'bg-lime-500' })
                      if (Math.abs(dLeft - 0) < threshold) guides.push({ type: 'v', pos: 0, color: 'bg-amber-500' })
                      if (Math.abs(dRight - innerW) < threshold) guides.push({ type: 'v', pos: innerW, color: 'bg-amber-500' })
                      if (Math.abs(dTop - 0) < threshold) guides.push({ type: 'h', pos: 0, color: 'bg-amber-500' })
                      if (Math.abs(dBottom - innerH) < threshold) guides.push({ type: 'h', pos: innerH, color: 'bg-amber-500' })

                      elements.forEach(other => {
                        if (other.id === dragged.id) return
                        const oLeft = other.x
                        const oCenterX = other.x + other.w/2
                        const oRight = other.x + other.w
                        const oTop = other.y
                        const oCenterY = other.y + other.h/2
                        const oBottom = other.y + other.h
                        if (Math.abs(dLeft - oLeft) < threshold) guides.push({ type: 'v', pos: oLeft, color: 'bg-sky-500' })
                        if (Math.abs(dCenterX - oCenterX) < threshold) guides.push({ type: 'v', pos: oCenterX, color: 'bg-sky-500' })
                        if (Math.abs(dRight - oRight) < threshold) guides.push({ type: 'v', pos: oRight, color: 'bg-sky-500' })
                        if (Math.abs(dTop - oTop) < threshold) guides.push({ type: 'h', pos: oTop, color: 'bg-sky-500' })
                        if (Math.abs(dCenterY - oCenterY) < threshold) guides.push({ type: 'h', pos: oCenterY, color: 'bg-sky-500' })
                        if (Math.abs(dBottom - oBottom) < threshold) guides.push({ type: 'h', pos: oBottom, color: 'bg-sky-500' })
                      })

                      const uniq = new Map<string, typeof guides[0]>()
                      guides.forEach(g => {
                        const key = `${g.type}-${Math.round(g.pos)}`
                        if (!uniq.has(key)) uniq.set(key, g)
                      })

                      return (
                        <div className="pointer-events-none absolute inset-0 z-20">
                          {Array.from(uniq.values()).map((g, i) => (
                            g.type === 'v' ? (
                              <div key={`v-${i}`} className={`absolute top-0 h-full w-px ${g.color} opacity-80`} style={{ left: g.pos }} />
                            ) : (
                              <div key={`h-${i}`} className={`absolute left-0 w-full h-px ${g.color} opacity-80`} style={{ top: g.pos }} />
                            )
                          ))}
                        </div>
                      )
                    })()}

                    {elements.map(el => {
                      const isSelected = selectedId === el.id
                      return (
                        <div
                          data-element
                          key={el.id}
                          onMouseDown={e => handleMouseDown(e, el)}
                          onClick={e => { e.stopPropagation(); setSelectedId(el.id) }}
                          onDoubleClick={e => { e.stopPropagation(); if (el.type !== 'logo' && el.type !== 'image' && el.type !== 'badge' && el.type !== 'rectangle' && el.type !== 'circle' && el.type !== 'border' && el.type !== 'line') setEditingId(el.id) }}
                          className={`group absolute cursor-grab select-none rounded p-1 transition active:cursor-grabbing ${isSelected ? 'z-10 ring-2 ring-lime-500 ring-offset-1' : 'hover:z-10 hover:ring-1 hover:ring-lime-300'}`}
                          style={{
                            left: el.x,
                            top: el.y,
                            width: el.w,
                            height: el.h,
                            fontFamily: el.style.fontFamily,
                            fontSize: el.style.fontSize,
                            color: el.style.color,
                            textAlign: el.style.textAlign,
                            fontWeight: el.style.fontWeight,
                            fontStyle: el.style.fontStyle,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: el.style.textAlign === 'center' ? 'center' : el.style.textAlign === 'right' ? 'flex-end' : 'flex-start',
                            overflow: 'visible',
                          }}
                        >
                          {editingId === el.id ? <textarea autoFocus value={el.content} onChange={e => setElements(prev => prev.map(x => x.id === el.id ? { ...x, content: e.target.value } : x))} onBlur={() => setEditingId(null)} className="h-full w-full resize-none rounded border border-lime-500 bg-white p-1 text-xs outline-none" /> : el.type === 'logo' || el.type === 'image' || el.type === 'badge' ? (el.content ? <img src={el.content} alt="" className="pointer-events-none h-full w-full object-contain" /> : <div className="pointer-events-none flex h-full w-full items-center justify-center border border-dashed border-zinc-300 bg-zinc-50 text-[10px]"> {el.type} </div>) : <span className="pointer-events-none w-full whitespace-nowrap font-semibold drop-shadow-sm" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.8)' }}>{el.content}</span>}
                          <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); setElements(prev => prev.filter(x => x.id !== el.id)); if (isSelected) setSelectedId(null) }} className={`absolute right-0 top-0 z-30 grid size-6 -translate-y-1/2 translate-x-1/2 place-items-center rounded-full bg-rose-600 text-white shadow ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><X className="size-3" /></button>
                          {isSelected && (
                            <>
                              <div className="pointer-events-none absolute inset-0 rounded border-2 border-lime-500/50" />
                              {(el.type === 'logo' || el.type === 'image' || el.type === 'badge' || el.type === 'rectangle' || el.type === 'circle' || el.type === 'line') && (
                                <>
                                  <div
                                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizing({ id: el.id, handle: 'r', startX: e.clientX, startY: e.clientY, startW: el.w, startH: el.h }) }}
                                    className="absolute right-0 top-1/2 z-30 h-6 w-2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize rounded bg-lime-500 shadow ring-1 ring-white hover:bg-lime-600"
                                    title="Drag to resize width"
                                  />
                                  <div
                                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizing({ id: el.id, handle: 'b', startX: e.clientX, startY: e.clientY, startW: el.w, startH: el.h }) }}
                                    className="absolute bottom-0 left-1/2 z-30 h-2 w-6 -translate-x-1/2 translate-y-1/2 cursor-ns-resize rounded bg-lime-500 shadow ring-1 ring-white hover:bg-lime-600"
                                    title="Drag to resize height"
                                  />
                                  <div
                                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizing({ id: el.id, handle: 'br', startX: e.clientX, startY: e.clientY, startW: el.w, startH: el.h }) }}
                                    className="absolute bottom-0 right-0 z-30 size-3 translate-x-1/2 translate-y-1/2 cursor-nwse-resize rounded-sm bg-lime-600 shadow ring-1 ring-white hover:bg-lime-700"
                                    title="Drag to resize"
                                  />
                                  <div
                                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizing({ id: el.id, handle: 'l', startX: e.clientX, startY: e.clientY, startW: el.w, startH: el.h }) }}
                                    className="absolute left-0 top-1/2 z-30 h-6 w-2 -translate-y-1/2 -translate-x-1/2 cursor-ew-resize rounded bg-lime-500 shadow ring-1 ring-white hover:bg-lime-600"
                                    title="Drag to resize from left"
                                  />
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
            <div className="rounded-lg border border-line/60 bg-muted/20 px-3 py-2 text-[11px] text-mist">
              <span className="font-bold text-foreground">{elements.length} elements</span> · Paper {paperSize} {orientation} · Margin {marginFilter} · Drag to reposition, double-click text to edit
            </div>
          </div>

          <div className="lg:col-span-2 w-full self-start">
            <div className="rounded-xl border border-line bg-card shadow-sm overflow-hidden sticky top-4">
              <div className="flex items-center justify-between border-b border-line bg-muted/30 px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-foreground">Properties</p>
                {selected ? <span className="rounded-full bg-lime/15 px-2 py-0.5 text-[9px] font-bold uppercase text-lime-800">{selected.type}</span> : <span className="text-[10px] text-mist">No selection</span>}
              </div>
              <div className="p-3">
                {selected ? (
                  <div className="space-y-3">
                    <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-mist">Content</span><textarea value={selected.content} onChange={e => updateSelected({ content: e.target.value })} rows={2} className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm focus:border-lime focus:ring-1 focus:ring-lime" /></label>
                    <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-mist">Font Family</span><select value={selected.style.fontFamily} onChange={e => updateSelected({ style: { fontFamily: e.target.value } })} className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm">{GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}</select></label>
                    <div className="grid grid-cols-2 gap-2"><label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-mist">Font Size</span><input type="number" value={selected.style.fontSize} onChange={e => updateSelected({ style: { fontSize: Number(e.target.value) } })} className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm" /></label><label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-mist">Color</span><input type="color" value={selected.style.color} onChange={e => updateSelected({ style: { color: e.target.value } })} className="h-9 w-full rounded-lg border border-line shadow-sm" /></label></div>
                    <div className="flex gap-1.5">{(['left','center','right'] as const).map(a => <button key={a} onClick={() => updateSelected({ style: { textAlign: a } })} className={`flex flex-1 items-center justify-center rounded-lg border px-2 py-2 text-[11px] font-medium transition ${selected.style.textAlign === a ? 'border-lime bg-lime text-lime-ink shadow-sm' : 'border-line bg-card text-mist hover:border-lime/50 hover:text-foreground'}`}>{a}</button>)}</div>
                    <div className="flex gap-2 pt-1"><Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => selected && deleteSelected(selected.id)}><Trash2 className="size-3" /> Delete</Button><Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => { const copy = { ...selected, id: uid(), x: selected.x+20, y: selected.y+20 }; setElements(prev => [...prev, copy]); setSelectedId(copy.id) }}>Duplicate</Button></div>
                  </div>
                ) : <div className="rounded-xl border border-dashed border-line bg-muted/20 p-6 text-center"><div className="mx-auto mb-2 grid size-10 place-items-center rounded-full bg-muted"><span className="text-lg">⚙️</span></div><p className="text-[11px] font-medium leading-snug text-foreground">No element selected</p><p className="mt-1 text-[11px] leading-snug text-mist">Select an element on the canvas to edit its text, font, size, color, and alignment. Drag elements to reposition.</p></div>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-3">
<Button type="button" size="sm" variant="outline" onClick={onClose}>Cancel</Button><Button type="button" size="sm" onClick={save}>{initial ? 'Update Certificate' : 'Save Certificate'}</Button></div>
      </div>
    </Modal>
  )
}
