import { useEffect, useRef, useState } from 'react'
import { uid } from '../../../../../lib/utils'
import type { CertElement, CertElementType, CertPaletteGroup } from '../types'
import { getDefaultCertificateElements } from '../defaults'

export function useCertificateBuilder({
  initial,
  open,
  branchName,
  branchId,
  companyName,
  onSave,
}: {
  initial?: any
  open?: boolean
  branchName?: string
  branchId?: string
  companyName?: string
  onSave?: (t: any) => void
}) {
  const [elements, setElements] = useState<CertElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [holderType, setHolderType] = useState<'Student' | 'Employee' | 'Member' | 'All'>('All')
  const [certificateType, setCertificateType] = useState('Achievement')
  const [bgColor, setBgColor] = useState('#FFFEF0')
  const [bgImage, setBgImage] = useState('')
  const [bgPattern, setBgPattern] = useState<'none' | 'dots' | 'lines' | 'grid' | 'waves' | 'chevron' | 'stripes' | 'crosshatch' | 'confetti' | 'damask' | 'stars' | 'marble' | 'honeycomb' | 'herringbone' | 'paisley' | 'floral' | 'geometric' | 'mosaic' | 'linen' | 'parchment' | 'bubbles' | 'diagonal' | 'zigzag' | 'circles' | 'hexagons' | 'noise' | 'vintage-paper'>('none')
  const [borderStyle, setBorderStyle] = useState<'none' | 'solid' | 'double' | 'dashed' | 'dotted' | 'groove' | 'ridge' | 'ornate' | 'vintage' | 'elegant' | 'classic' | 'modern' | 'gold' | 'silver' | 'floral' | 'thick' | 'striped' | 'royal' | 'emerald' | 'burgundy' | 'navy-gold' | 'art-deco' | 'wavy' | 'scalloped' | 'rope' | 'laurel' | 'shadow' | 'triple' | 'mosaic' | 'inset' | 'outset' | 'bevel'>('striped')
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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ database: true, textbase: true, media: true, shapes: true })
  const [customDbVars, setCustomDbVars] = useState<{ id: string; label: string; key: string; defaultContent: string; source: string }[]>(() => {
    try { const raw = localStorage.getItem('cert_custom_db_vars'); return raw ? JSON.parse(raw) : [] } catch { return [] }
  })
  const [hiddenBaseDbLabels, setHiddenBaseDbLabels] = useState<string[]>(() => {
    try { const raw = localStorage.getItem('cert_hidden_db_base'); return raw ? JSON.parse(raw) : [] } catch { return [] }
  })
  const clickTimerRef = useRef<any>(null)
  const [showAddDbVar, setShowAddDbVar] = useState(false)
  const [newVarSource, setNewVarSource] = useState<string>('Student List')
  const [newVarLabel, setNewVarLabel] = useState('')
  const [newVarKey, setNewVarKey] = useState('')
  const [newVarDefault, setNewVarDefault] = useState('')
  const selected = elements.find(e => e.id === selectedId) || null
  useEffect(() => { try { localStorage.setItem('cert_custom_db_vars', JSON.stringify(customDbVars)) } catch {} }, [customDbVars])
  useEffect(() => { try { localStorage.setItem('cert_hidden_db_base', JSON.stringify(hiddenBaseDbLabels)) } catch {} }, [hiddenBaseDbLabels])
  const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const handleAddDbVar = () => {
    const source = newVarSource || 'Student List'
    const label = newVarLabel.trim()
    if (!label) { alert('Variable name required'); return }
    let rawKey = newVarKey.trim()
    if (!rawKey) rawKey = slugify(label)
    // allow {key} with braces - strip them for storage
    rawKey = rawKey.replace(/^\{+/, '').replace(/\}+$/, '').trim()
    rawKey = slugify(rawKey)
    if (!rawKey) { alert('Variable key required'); return }
    if (customDbVars.some(v => v.key === rawKey)) { alert('Variable key already exists'); return }
    const def = newVarDefault.trim() || `{{${rawKey}}}`
    const newVar = { id: 'cvar_' + Math.random().toString(36).slice(2,9), label, key: rawKey, defaultContent: def, source }
    setCustomDbVars(prev => [...prev, newVar])
    setNewVarLabel(''); setNewVarKey(''); setNewVarDefault(''); setShowAddDbVar(false)
  }
  const handleRemoveDbVar = (id: string) => { if (confirm('Remove this custom variable? This will hide it from the Elements card.')) setCustomDbVars(prev => prev.filter(v => v.id !== id)) }
  const handleRemoveBaseDbItem = (label: string) => { setHiddenBaseDbLabels(prev => [...prev, label]) }
  useEffect(() => {
    console.log('[CERT BUILDER] useEffect triggered', { initial: initial ? { id: initial.id, name: initial.templateName || initial.name, hasCertData: !!(initial as any).certificateData } : null, open })
    if (initial && (initial as any).certificateData) {
      try {
        const data = JSON.parse(String((initial as any).certificateData))
        console.log('[CERT BUILDER] parsed certificateData, elements:', data.elements?.length, 'first element:', JSON.stringify(data.elements?.[0]).slice(0, 200))
        setElements((data.elements || []).map((el: any, i: number) => ({ id: el.id || ('el_' + i + '_' + Math.random().toString(36).slice(2,7)), type: el.type || 'text', content: el.content || '', group: el.group || 'default', source: el.source || 'default', x: el.x ?? 0, y: el.y ?? 0, w: el.w ?? 200, h: el.h ?? 32, style: { fontFamily: el.style?.fontFamily || el.fontFamily || 'Poppins', fontSize: el.style?.fontSize || el.fontSize || 16, color: el.style?.color || el.color || '#1a202c', textAlign: el.style?.textAlign || el.textAlign || 'center', fontWeight: el.style?.fontWeight || el.fontWeight || '400', fontStyle: el.style?.fontStyle || 'normal', backgroundColor: el.style?.backgroundColor || 'transparent', borderWidth: el.style?.borderWidth ?? el.borderWidth ?? 2, borderColor: el.style?.borderColor || el.borderColor || '#1e293b', borderRadius: el.style?.borderRadius ?? el.borderRadius ?? 0, lineHeight: el.style?.lineHeight || el.lineHeight } })))
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
      } catch (err) {
        console.error('[CERT BUILDER] Error parsing certificateData:', err)
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
        if (d.elements) setElements(d.elements.map((el: any, i: number) => ({ id: el.id || ('el_' + i + '_' + Math.random().toString(36).slice(2,7)), type: el.type || 'text', content: el.content || '', group: el.group || 'default', source: el.source || 'default', x: el.x ?? 0, y: el.y ?? 0, w: el.w ?? 200, h: el.h ?? 32, style: { fontFamily: el.style?.fontFamily || el.fontFamily || 'Poppins', fontSize: el.style?.fontSize || el.fontSize || 16, color: el.style?.color || el.color || '#1a202c', textAlign: el.style?.textAlign || el.textAlign || 'center', fontWeight: el.style?.fontWeight || el.fontWeight || '400', fontStyle: el.style?.fontStyle || 'normal', backgroundColor: el.style?.backgroundColor || 'transparent', borderWidth: el.style?.borderWidth ?? el.borderWidth ?? 2, borderColor: el.style?.borderColor || el.borderColor || '#1e293b', borderRadius: el.style?.borderRadius ?? el.borderRadius ?? 0, lineHeight: el.style?.lineHeight || el.lineHeight } })))
      } catch (err) {
        console.error('[CERT BUILDER] Error parsing certificateData in else branch:', err)
      }
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
    try {
      const m = getMargin()
      const paper = getPaperDims()
      const innerW = Math.max(100, paper.w - m.px*2)
      setElements(prev => prev.map(el => ({
        ...el,
        x: innerW/2 - el.w/2,
        style: { ...(el.style || {}), textAlign: 'center' as const }
      })))
    } catch {}
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
  // Delete selected element with keyboard Delete/Backspace (when preview is active and not editing text/inputs)
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (editingId) return
      if (!selectedId) return
      const target = e.target as HTMLElement
      const tag = target?.tagName
      const isFormField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable
      if (isFormField) return
      e.preventDefault()
      setElements(prev => prev.filter(el => el.id !== selectedId))
      setSelectedId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, selectedId, editingId])

  // Delete selected element with keyboard Delete/Backspace (when preview is active and not editing text/inputs)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (editingId) return
      if (!selectedId) return
      const target = e.target as HTMLElement
      const tag = target?.tagName
      const isFormField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable
      if (isFormField) return
      e.preventDefault()
      setElements(prev => prev.filter(el => el.id !== selectedId))
      setSelectedId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, editingId])

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
  const shapeDefaults = (type: CertElementType) => {
    if (type === 'line') return { w: 300, h: 3, bg: '#1e293b', borderW: 0, borderC: '#1e293b' }
    if (type === 'rectangle') return { w: 220, h: 120, bg: 'transparent', borderW: 2, borderC: '#1e293b' }
    if (type === 'square') return { w: 120, h: 120, bg: 'transparent', borderW: 2, borderC: '#1e293b' }
    if (type === 'circle') return { w: 120, h: 120, bg: 'transparent', borderW: 2, borderC: '#1e293b' }
    if (type === 'border') return { w: 500, h: 320, bg: 'transparent', borderW: 4, borderC: '#d69e2e' }
    if (type === 'logo' || type === 'image' || type === 'badge') return { w: 80, h: 80, bg: 'transparent', borderW: 0, borderC: '#ccc' }
    if (type === 'signature_line') return { w: 180, h: 36, bg: 'transparent', borderW: 2, borderC: '#333' }
    if (type === 'seal') return { w: 100, h: 100, bg: 'transparent', borderW: 4, borderC: '#b7791f' }
    if (type === 'subject_table') return { w: 400, h: 180, bg: 'transparent', borderW: 0, borderC: '#ddd' }
    return { w: 200, h: 32, bg: 'transparent', borderW: 0, borderC: '#ccc' }
  }

  const addElement = (type: CertElement['type'], defaultContent?: string, group?: CertPaletteGroup, source?: string) => {
    const paper = getPaperDims()
    const def = shapeDefaults(type)
    const newEl: CertElement = {
      id: uid(), type, content: defaultContent || '', group, source,
      x: paper.w/2 - def.w/2, y: paper.h/2 - def.h/2 + elements.length*6,
      w: def.w, h: def.h,
      style: { fontFamily: 'Poppins', fontSize: 16, color: '#1a202c', textAlign: 'center', fontWeight: '400', fontStyle: 'normal', backgroundColor: def.bg as string, borderWidth: def.borderW, borderColor: def.borderC, borderRadius: type === 'circle' ? 999 : 0 }
    }
    setElements(prev => [...prev, newEl]); setSelectedId(newEl.id)
  }
  const addElementAt = (type: CertElement['type'], content: string, clientX: number, clientY: number, group?: CertPaletteGroup, source?: string) => {
    if (!canvasRef.current) { addElement(type, content, group, source); return }
    const rect = canvasRef.current.getBoundingClientRect()
    const scale = getEffectiveScale()
    const x = (clientX - rect.left) / scale
    const y = (clientY - rect.top) / scale
    const def = shapeDefaults(type)
    const newEl: CertElement = {
      id: uid(), type, content: content || '', group, source,
      x: x - def.w/2, y: y - def.h/2,
      w: def.w, h: def.h,
      style: { fontFamily: 'Poppins', fontSize: 16, color: '#1a202c', textAlign: 'center', fontWeight: '400', fontStyle: 'normal', backgroundColor: def.bg as string, borderWidth: def.borderW, borderColor: def.borderC, borderRadius: type === 'circle' ? 999 : 0 }
    }
    setElements(prev => [...prev, newEl]); setSelectedId(newEl.id)
  }
  const updateSelected = (patch: any) => {
    if (!selected) return
    setElements(prev => prev.map(el => {
      if (el.id !== selected.id) return el
      if (patch.style) return { ...el, style: { ...(el.style || {}), ...patch.style } }
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
    onSave?.({
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
  return {
    elements, setElements,
    selectedId, setSelectedId,
    templateName, setTemplateName,
    holderType, setHolderType,
    certificateType, setCertificateType,
    bgColor, setBgColor,
    bgImage, setBgImage,
    bgPattern, setBgPattern,
    borderStyle, setBorderStyle,
    orientation, setOrientation,
    paperSize, setPaperSize,
    marginFilter, setMarginFilter,
    zoomFilter, setZoomFilter,
    showGuides, setShowGuides,
    dragging, setDragging,
    resizing, setResizing,
    editingId, setEditingId,
    canvasRef, leftColRef, previewMaxH, setPreviewMaxH,
    isPanning, setIsPanning,
    panStart, setPanStart,
    previewScrollRef,
    elementSearch, setElementSearch,
    expandedGroups, setExpandedGroups,
    customDbVars, setCustomDbVars,
    hiddenBaseDbLabels, setHiddenBaseDbLabels,
    clickTimerRef,
    showAddDbVar, setShowAddDbVar,
    newVarSource, setNewVarSource,
    newVarLabel, setNewVarLabel,
    newVarKey, setNewVarKey,
    newVarDefault, setNewVarDefault,
    selected,
    slugify, handleAddDbVar, handleRemoveDbVar, handleRemoveBaseDbItem,
    getPaperDims, getMargin, getEffectiveScale, fitToScreen, shapeDefaults,
    addElement, addElementAt, updateSelected, deleteSelected, handleMouseDown,
    save, handlePrint,
    uid, open, initial, branchName, branchId, companyName, onSave,
  }
}
