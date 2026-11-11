import { useCertificateBuilder } from './hooks/useCertificateBuilder'
import { ElementsPanel } from './components/ElementsPanel'
import { CanvasPreview } from './components/CanvasPreview'
import { PropertiesPanel } from './components/PropertiesPanel'
import { AddVariableModal } from './components/AddVariableModal'
import { Button, Modal, Select } from '../../../../components/ui'
import { ColorPicker } from './components/ColorPicker'
import { useCertificateContext } from '../CertificateShared'
import { ErrorBoundary } from './ErrorBoundary'

export function CertificateBuilderModal({ open, onClose, initial, onSave, branchName, branchId, companyName }: { open: boolean; onClose: () => void; initial: any; onSave: (t: any) => void; branchName?: string; branchId?: string; companyName?: string }) {
  const builder = useCertificateBuilder({ initial, open, branchName, branchId, companyName, onSave })
  const { types: certTypes } = useCertificateContext()
  const {
    templateName, setTemplateName,
    holderType, setHolderType,
    certificateType, setCertificateType,
    bgColor, setBgColor,
    bgPattern, setBgPattern,
    borderStyle, setBorderStyle,
    bgImage, setBgImage,
    orientation, setOrientation,
    paperSize, setPaperSize,
    marginFilter, setMarginFilter,
    leftColRef,
    save,
  } = builder as any

  if (!open) return null
  return (
    <ErrorBoundary>
      <Modal open={open} onClose={onClose} title={initial ? 'Edit Certificate Template' : 'New Certificate Template'} size="full">
        <div className="space-y-4 rounded-xl border border-line bg-card p-4 shadow-sm">
          {/* Top Controls */}
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line/60 bg-muted/20 p-3">
            <label className="flex min-w-[200px] flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Template Name *</span><input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Achievement Certificate" /></label>
            <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Holder Type *</span><Select value={holderType} onChange={e => setHolderType(e.target.value as any)}><option value="All">All</option><option value="Student">Student</option><option value="Employee">Employee</option><option value="Member">Member</option></Select></label>
            <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Certificate Type *</span>{(() => { const activeTypes = certTypes.filter((r:any) => String((r as any).status||'Active').toLowerCase()==='active'); const fallback = [{name:'Achievement Certificate'},{name:'Completion Certificate'}] as any[]; const opts = activeTypes.length?activeTypes:fallback; return (<Select value={certificateType} onChange={e => setCertificateType(e.target.value)}><option value="">Select type…</option>{opts.map((r:any)=><option key={String((r as any).name||(r as any).id)} value={String((r as any).name)}>{String((r as any).name)}</option>)}</Select>)})()}</label>
            <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Background</span><ColorPicker value={bgColor} onChange={setBgColor} label="Background" /></label>
            <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Border Style</span><Select value={borderStyle} onChange={e => setBorderStyle(e.target.value as any)}><option value="none">None</option><option value="striped">Striped Gold (as attached)</option><option value="solid">Solid Gold</option><option value="double">Double</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="groove">Groove</option><option value="ridge">Ridge</option><option value="ornate">Ornate Striped</option><option value="vintage">Vintage</option><option value="elegant">Elegant Thin</option><option value="classic">Classic Thick Double</option><option value="modern">Modern Black</option><option value="gold">Gold Frame</option><option value="silver">Silver Frame</option><option value="floral">Floral</option><option value="thick">Thick</option><option value="royal">Royal Blue</option><option value="emerald">Emerald</option><option value="burgundy">Burgundy</option><option value="navy-gold">Navy Gold</option><option value="art-deco">Art Deco</option><option value="wavy">Wavy Gold</option><option value="scalloped">Scalloped</option><option value="rope">Rope</option><option value="laurel">Laurel Wreath</option><option value="shadow">Shadow</option><option value="triple">Triple</option><option value="mosaic">Mosaic</option><option value="inset">Inset</option><option value="outset">Outset</option><option value="bevel">Bevel</option></Select></label>
            <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Pattern</span><Select value={bgPattern} onChange={e => setBgPattern(e.target.value as any)}><option value="none">None</option><option value="dots">Dots</option><option value="lines">Lines</option><option value="grid">Grid</option><option value="waves">Waves</option><option value="chevron">Chevron</option><option value="stripes">Stripes</option><option value="crosshatch">Crosshatch</option><option value="confetti">Confetti</option><option value="damask">Damask</option><option value="stars">Stars</option><option value="marble">Marble</option><option value="honeycomb">Honeycomb</option><option value="herringbone">Herringbone</option><option value="paisley">Paisley</option><option value="floral">Floral</option><option value="geometric">Geometric</option><option value="mosaic">Mosaic</option><option value="linen">Linen</option><option value="parchment">Parchment</option><option value="bubbles">Bubbles</option><option value="diagonal">Diagonal</option><option value="zigzag">Zigzag</option><option value="circles">Circles</option><option value="hexagons">Hexagons</option><option value="noise">Noise</option><option value="vintage-paper">Vintage Paper</option></Select></label>
            <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Background Image</span><div className="flex items-center gap-2"><label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm hover:border-lime"><span className="i-lucide-upload-cloud size-4" />{bgImage ? 'Change' : 'Upload'}<input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setBgImage(String(reader.result || '')); reader.readAsDataURL(file); e.target.value = '' }} /></label>{bgImage && <button type="button" onClick={() => setBgImage('')} className="rounded-lg border border-line px-2 py-1 text-[11px]">Clear</button>}</div></label>
            <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Orientation</span><Select value={orientation} onChange={e => setOrientation(e.target.value as any)}><option value="Portrait">Portrait</option><option value="Landscape">Landscape</option></Select></label>
            <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Paper Size</span><Select value={paperSize} onChange={e => setPaperSize(e.target.value as any)}><option value="A4">A4</option><option value="A3">A3</option><option value="Letter">Letter</option><option value="Legal">Legal</option><option value="Custom">Custom</option></Select></label>
            <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Margin</span><Select value={marginFilter} onChange={e => setMarginFilter(e.target.value as any)}><option value="None">None (0mm)</option><option value="Small">Small (10mm)</option><option value="Medium">Medium (15mm)</option><option value="Large">Large (20mm)</option><option value="Extra Large">Extra Large (25mm)</option></Select></label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div ref={leftColRef} className="lg:col-span-2 w-full self-start">
              <ElementsPanel builder={builder} />
            </div>
            <div className="lg:col-span-8">
              <CanvasPreview builder={builder} />
            </div>
            <div className="lg:col-span-2 w-full self-start">
              <PropertiesPanel builder={builder} />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button type="button" size="sm" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" size="sm" onClick={save}>{initial ? 'Update Certificate' : 'Save Certificate'}</Button>
          </div>
        </div>
      </Modal>
      <AddVariableModal builder={builder} />
    </ErrorBoundary>
  )
}
