import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Upload, Home, Folder, FolderOpen, Plus, EllipsisVertical, HardDrive, Search,
  Grid3x3, List, Image as ImageIcon, Calendar, Pencil, Trash2, X, Copy, Eye, Download,
} from 'lucide-react'

type MediaFile = {
  id: string
  name: string
  ext: string
  sizeKb: number
  date: string // ISO yyyy-mm-dd
  folder: string
  hue: number
  glyph: string
  dataUrl?: string
}

type FolderDef = { id: string; name: string }

const IMG_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']

const SEED: MediaFile[] = [
  { id: 'm01', name: 'football_image', ext: 'png', sizeKb: 276.83, date: '2026-02-19', folder: 'products', hue: 16, glyph: '⚽' },
  { id: 'm02', name: 'watch_image', ext: 'png', sizeKb: 256.83, date: '2026-02-19', folder: 'products', hue: 210, glyph: '⌚' },
  { id: 'm03', name: 'smartphone_image', ext: 'png', sizeKb: 167.9, date: '2026-02-19', folder: 'products', hue: 260, glyph: '📱' },
  { id: 'm04', name: 'shampoo_image', ext: 'png', sizeKb: 165.59, date: '2026-02-19', folder: 'products', hue: 140, glyph: '🧴' },
  { id: 'm05', name: 'notebook_images_2', ext: 'png', sizeKb: 232.84, date: '2026-02-19', folder: 'products', hue: 150, glyph: '📓' },
  { id: 'm06', name: 'light_bulb_image', ext: 'png', sizeKb: 179.03, date: '2026-02-19', folder: 'products', hue: 48, glyph: '💡' },
  { id: 'm07', name: 'laptop_images_3', ext: 'png', sizeKb: 171.07, date: '2026-02-19', folder: 'products', hue: 220, glyph: '💻' },
  { id: 'm08', name: 'laptop_battery_image', ext: 'png', sizeKb: 145.01, date: '2026-02-19', folder: 'products', hue: 0, glyph: '🔋' },
  { id: 'm09', name: 'ink_cartridge_image', ext: 'png', sizeKb: 194.61, date: '2026-02-19', folder: 'products', hue: 330, glyph: '🖨️' },
  { id: 'm10', name: 'cordless_drill_machine_image', ext: 'png', sizeKb: 212.31, date: '2026-02-19', folder: 'products', hue: 45, glyph: '🛠️' },
  { id: 'm11', name: 'water_bottle_image', ext: 'png', sizeKb: 240.5, date: '2026-02-18', folder: 'products', hue: 195, glyph: '🍶' },
  { id: 'm12', name: 'backpack_image', ext: 'png', sizeKb: 215.2, date: '2026-02-18', folder: 'products', hue: 20, glyph: '🎒' },
  { id: 'm13', name: 'headphones_image', ext: 'png', sizeKb: 198.75, date: '2026-02-18', folder: 'products', hue: 280, glyph: '🎧' },
  { id: 'm14', name: 'camera_image', ext: 'png', sizeKb: 232.1, date: '2026-02-17', folder: 'products', hue: 240, glyph: '📷' },
  { id: 'm15', name: 'mouse_image', ext: 'png', sizeKb: 205.4, date: '2026-02-17', folder: 'products', hue: 200, glyph: '🖱️' },
  { id: 'm16', name: 'keyboard_image', ext: 'png', sizeKb: 210.9, date: '2026-02-16', folder: 'products', hue: 180, glyph: '⌨️' },
  { id: 'm17', name: 'monitor_image', ext: 'png', sizeKb: 207.47, date: '2026-02-16', folder: 'products', hue: 230, glyph: '🖥️' },
  { id: 'a01', name: 'logo_primary', ext: 'png', sizeKb: 75.6, date: '2026-01-12', folder: 'assets', hue: 160, glyph: '🏷️' },
  { id: 'a02', name: 'banner_home', ext: 'png', sizeKb: 75.62, date: '2026-01-12', folder: 'assets', hue: 170, glyph: '🖼️' },
  { id: 'a03', name: 'team_photo_1', ext: 'png', sizeKb: 75.62, date: '2026-01-15', folder: 'assets', hue: 30, glyph: '🧑🤝‍🧑' },
  { id: 'a04', name: 'team_photo_2', ext: 'png', sizeKb: 75.62, date: '2026-01-15', folder: 'assets', hue: 40, glyph: '🤝' },
  { id: 'a05', name: 'gym_floor_plan', ext: 'png', sizeKb: 75.62, date: '2026-01-20', folder: 'assets', hue: 90, glyph: '🗺️' },
  { id: 'a06', name: 'membership_card_front', ext: 'png', sizeKb: 75.62, date: '2026-01-22', folder: 'assets', hue: 250, glyph: '💳' },
  { id: 'a07', name: 'membership_card_back', ext: 'png', sizeKb: 75.62, date: '2026-01-22', folder: 'assets', hue: 255, glyph: '💳' },
  { id: 'a08', name: 'poster_summer_promo', ext: 'png', sizeKb: 75.62, date: '2026-02-01', folder: 'assets', hue: 15, glyph: '📢' },
  { id: 'a09', name: 'poster_new_year', ext: 'png', sizeKb: 75.62, date: '2026-02-01', folder: 'assets', hue: 350, glyph: '🎉' },
  { id: 'a10', name: 'icon_set_main', ext: 'png', sizeKb: 75.62, date: '2026-02-05', folder: 'assets', hue: 120, glyph: '✨' },
  { id: 'a11', name: 'receipt_template', ext: 'png', sizeKb: 75.62, date: '2026-02-08', folder: 'assets', hue: 60, glyph: '🧾' },
  { id: 'a12', name: 'invoice_header', ext: 'png', sizeKb: 75.62, date: '2026-02-08', folder: 'assets', hue: 70, glyph: '📄' },
  { id: 'a13', name: 'favicon_pack', ext: 'png', sizeKb: 75.62, date: '2026-02-10', folder: 'assets', hue: 300, glyph: '⭐' },
]

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const mb = (kb: number) => `${(kb / 1024).toFixed(2)} MB`

function Thumb({ f }: { f: MediaFile }) {
  if (f.dataUrl) return <img src={f.dataUrl} alt={f.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
  return (
    <div
      className="flex w-full h-full items-center justify-center transition-transform duration-500 group-hover:scale-105"
      style={{ background: `linear-gradient(135deg, hsl(${f.hue} 70% 92%), hsl(${(f.hue + 40) % 360} 65% 78%))` }}
    >
      <span className="text-4xl drop-shadow-sm">{f.glyph}</span>
    </div>
  )
}

// Page size always matches a full rectangle of the responsive grid
// (same breakpoints as grid-cols-2/md:3/lg:4/xl:5, three rows), so a page
// is only ever "done" when it is completely filled.
function usePerPage() {
  const calc = () => {
    const w = window.innerWidth
    const cols = w >= 1280 ? 5 : w >= 1024 ? 4 : w >= 768 ? 3 : 2
    return cols * 3
  }
  const [per, setPer] = useState(() => calc())
  useEffect(() => {
    const onResize = () => setPer(calc())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return per
}

export function MediaLibraryPage() {
  const [files, setFiles] = useState<MediaFile[]>(SEED)
  const [folders, setFolders] = useState<FolderDef[]>([
    { id: 'products', name: 'Products' },
    { id: 'assets', name: 'Assets' },
    { id: 'documents', name: 'Documents' },
  ])
  const [sel, setSel] = useState<string>('products')
  const [q, setQ] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [sortDesc, setSortDesc] = useState(true)
  const [page, setPage] = useState(1)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [detail, setDetail] = useState<MediaFile | null>(null)
  const [viewer, setViewer] = useState<MediaFile | null>(null)

  useEffect(() => {
    if (!viewer) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setViewer(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewer])

  const fileName = (f: MediaFile) => `${f.name}.${f.ext}`
  const fileUrl = (f: MediaFile) => f.dataUrl ?? `/storage/media/${f.id}.${f.ext}`
  const copyUrl = async (f: MediaFile) => {
    try { await navigator.clipboard.writeText(fileUrl(f)) } catch { /* clipboard may be unavailable in the sandbox */ }
  }
  const download = (f: MediaFile) => {
    const a = document.createElement('a')
    if (f.dataUrl) {
      a.href = f.dataUrl
    } else {
      // Offline seed files: render the placeholder tile to a canvas and download it.
      const c = document.createElement('canvas')
      c.width = 640
      c.height = 576
      const ctx = c.getContext('2d')
      if (ctx) {
        const g = ctx.createLinearGradient(0, 0, 640, 576)
        g.addColorStop(0, `hsl(${f.hue} 70% 92%)`)
        g.addColorStop(1, `hsl(${(f.hue + 40) % 360} 65% 78%)`)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, 640, 576)
        ctx.font = '160px serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(f.glyph, 320, 288)
      }
      a.href = c.toDataURL('image/png')
    }
    a.download = fileName(f)
    a.click()
  }
  const removeFile = (f: MediaFile) => {
    if (!window.confirm(`Delete “${fileName(f)}”? This cannot be undone.`)) return
    setFiles((p) => p.filter((x) => x.id !== f.id))
    setDetail(null)
  }

  const countOf = (id: string) => files.filter((f) => f.folder === id).length
  const usedKb = files.reduce((s, f) => s + f.sizeKb, 0)

  const scoped = sel === 'all' ? files : files.filter((f) => f.folder === sel)
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = t ? scoped.filter((f) => f.name.toLowerCase().includes(t)) : scoped
    return [...list].sort((a, b) => (sortDesc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)))
  }, [scoped, q, sortDesc])

  const perPage = usePerPage()
  const pages = Math.max(1, Math.ceil(filtered.length / perPage))
  const cur = Math.min(page, pages)
  const slice = filtered.slice((cur - 1) * perPage, cur * perPage)
  const scopedKb = scoped.reduce((s, f) => s + f.sizeKb, 0)
  const imgCount = scoped.filter((f) => IMG_EXT.includes(f.ext)).length

  const pick = (id: string) => { setSel(id); setPage(1) }

  const onUpload = (list: FileList | null) => {
    if (!list) return
    const target = sel === 'all' ? 'products' : sel
    Array.from(list).forEach((file, i) => {
      const reader = new FileReader()
      reader.onload = () => {
        const ext = (file.name.split('.').pop() ?? '').toLowerCase()
        setFiles((prev) => [
          {
            id: `up-${Date.now()}-${i}`,
            name: file.name.replace(/\.[^.]+$/, ''),
            ext,
            sizeKb: Math.round((file.size / 1024) * 100) / 100,
            date: new Date().toISOString().slice(0, 10),
            folder: target,
            hue: Math.floor(Math.random() * 360),
            glyph: '📁',
            dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
          },
          ...prev,
        ])
      }
      reader.readAsDataURL(file)
    })
  }

  const addFolder = () => {
    const name = newName.trim()
    if (!name) return
    setFolders((p) => [...p, { id: `f-${Date.now()}`, name }])
    setNewName('')
    setAdding(false)
  }

  const renameFolder = (id: string) => {
    const name = renameVal.trim()
    if (name) setFolders((p) => p.map((f) => (f.id === id ? { ...f, name } : f)))
    setRenaming(null)
  }

  const deleteFolder = (id: string) => {
    setFolders((p) => p.filter((f) => f.id !== id))
    setFiles((p) => p.filter((f) => f.folder !== id))
    if (sel === id) setSel('all')
    setMenuFor(null)
  }

  const statChip = (icon: React.ReactNode, label: string) => (
    <div className="flex items-center gap-2">
      <div className="rounded-md bg-emerald-500/10 p-1.5">{icon}</div>
      <span className="text-sm font-semibold">{label}</span>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Manage Media Library</h1>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-600"
        >
          <Upload className="h-4 w-4" /> Upload Files
        </button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { onUpload(e.target.files); e.target.value = '' }} />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Left sidebar */}
        <div className="w-full lg:w-72 xl:w-80 lg:flex-shrink-0">
          <div className="card flex h-full flex-col overflow-hidden">
            <div className="border-b border-line p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-mist">Quick Access</h3>
              <button
                type="button"
                onClick={() => pick('all')}
                className={`flex h-9 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium transition ${sel === 'all' ? 'bg-black/[0.05] dark:bg-white/10' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'}`}
              >
                <Home className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                <span className="flex-1 truncate text-left">All Files</span>
                <span className="ml-2 min-w-[2rem] justify-center rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{files.length}</span>
              </button>
            </div>

            <div className="flex-1 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-mist">Folders</h3>
                <button
                  type="button"
                  aria-label="Add folder"
                  onClick={() => setAdding((v) => !v)}
                  className="h-6 w-6 cursor-pointer rounded-full transition hover:bg-emerald-500/10 hover:text-emerald-500"
                >
                  <Plus className="mx-auto h-3 w-3" />
                </button>
              </div>
              {adding && (
                <div className="mb-2 flex items-center gap-1">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addFolder()}
                    placeholder="Folder name…"
                    className="h-8 w-full rounded-md border border-line bg-transparent px-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <button type="button" onClick={addFolder} className="h-8 cursor-pointer rounded-md bg-emerald-500 px-2 text-xs font-semibold text-white">Add</button>
                </div>
              )}
              <div className="space-y-1">
                {folders.map((fo) => (
                  <div key={fo.id} className="group flex items-center gap-1">
                    {renaming === fo.id ? (
                      <div className="flex flex-1 items-center gap-1">
                        <input
                          autoFocus
                          value={renameVal}
                          onChange={(e) => setRenameVal(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && renameFolder(fo.id)}
                          className="h-8 w-full rounded-md border border-line bg-transparent px-2 text-sm focus:border-emerald-500 focus:outline-none"
                        />
                        <button type="button" onClick={() => renameFolder(fo.id)} className="h-8 cursor-pointer rounded-md bg-emerald-500 px-2 text-xs font-semibold text-white">Save</button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => pick(fo.id)}
                          className={`flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium transition ${sel === fo.id ? 'bg-black/[0.05] dark:bg-white/10' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'}`}
                        >
                          {sel === fo.id
                            ? <FolderOpen className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                            : <Folder className="h-4 w-4 flex-shrink-0 text-mist" />}
                          <span className="flex-1 truncate text-left">{fo.name}</span>
                          <span className="ml-2 min-w-[1.5rem] justify-center rounded-full bg-black/[0.05] px-2.5 py-0.5 text-xs font-semibold dark:bg-white/10">{countOf(fo.id)}</span>
                        </button>
                        <div className="relative">
                          <button
                            type="button"
                            aria-label={`Options for ${fo.name}`}
                            onClick={() => setMenuFor(menuFor === fo.id ? null : fo.id)}
                            className="h-8 w-8 cursor-pointer rounded-md transition hover:bg-black/[0.05] dark:hover:bg-white/10"
                          >
                            <EllipsisVertical className="mx-auto h-4 w-4 text-mist" />
                          </button>
                          {menuFor === fo.id && (
                            <div className="card absolute right-0 z-10 mt-1 w-32 overflow-hidden py-1 text-sm shadow-lg">
                              <button
                                type="button"
                                onClick={() => { setRenaming(fo.id); setRenameVal(fo.name); setMenuFor(null) }}
                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Rename
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteFolder(fo.id)}
                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-ember hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-line bg-black/[0.02] p-4 dark:bg-white/[0.03]">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-mist">Storage Usage</h3>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 rounded-lg bg-emerald-500/10 p-2.5"><HardDrive className="h-5 w-5 text-emerald-500" /></div>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <p className="text-sm font-medium">Used Space</p>
                  <p className="text-sm font-bold">{mb(usedKb)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right content */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="card p-4">
            <div className="flex flex-col items-center gap-4 lg:flex-row">
              <div className="w-full flex-1 lg:max-w-sm">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
                  <input
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setPage(1) }}
                    placeholder="Search media files..."
                    className="h-10 w-full rounded-md border border-line bg-transparent pl-10 pr-3 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  <button
                    type="button"
                    aria-label="Grid view"
                    onClick={() => setView('grid')}
                    className={`h-8 cursor-pointer rounded-l-md border border-line px-3 transition ${view === 'grid' ? 'border-r-0 bg-emerald-500 text-white' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}
                  >
                    <Grid3x3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="List view"
                    onClick={() => setView('list')}
                    className={`h-8 cursor-pointer rounded-r-md border border-line px-3 transition ${view === 'list' ? 'bg-emerald-500 text-white' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSortDesc((v) => !v)}
                  className="h-8 cursor-pointer rounded-md border border-line px-3 text-sm font-medium transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                >
                  Date {sortDesc ? '↓' : '↑'}
                </button>
              </div>
              <div className="flex items-center gap-6">
                {statChip(<ImageIcon className="h-4 w-4 text-emerald-500" />, `${scoped.length} Files`)}
                {statChip(<HardDrive className="h-4 w-4 text-emerald-500" />, mb(scopedKb))}
                {statChip(<ImageIcon className="h-4 w-4 text-emerald-500" />, `${imgCount} Images`)}
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden rounded-xl bg-emerald-500/5 dark:bg-transparent">
            {view === 'grid' ? (
              <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {slice.map((f) => (
                  <div key={f.id} className="card group flex flex-col overflow-hidden rounded-xl transition-all duration-300 hover:shadow-xl">
                    <div className="relative aspect-[10/9] cursor-pointer overflow-hidden bg-black/[0.03] dark:bg-white/[0.04]" onClick={() => setDetail(f)}>
                      <Thumb f={f} />
                      <div className="absolute left-2 top-2">
                        <span className="rounded-md bg-gray-100/95 px-2.5 py-0.5 text-[10px] font-bold uppercase text-gray-700 shadow-sm dark:bg-gray-800/95 dark:text-gray-300">{f.ext}</span>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col border-t border-line/50 p-3">
                      <h4 className="mb-2 truncate text-sm font-semibold" title={f.name}>{f.name}</h4>
                      <div className="mt-auto flex items-center justify-between text-xs font-medium text-mist">
                        <span className="flex items-center"><HardDrive className="mr-1.5 h-3 w-3 opacity-60" />{f.sizeKb} KB</span>
                        <span className="flex items-center"><Calendar className="mr-1.5 h-3 w-3 opacity-60" />{dmy(f.date)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4">
                <div className="card overflow-hidden">
                  {slice.map((f, i) => (
                    <div key={f.id} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 === 1 ? 'bg-black/[0.02] dark:bg-white/[0.03]' : ''}`}>
                      <div className="h-10 w-10 flex-shrink-0 cursor-pointer overflow-hidden rounded-md border border-line" onClick={() => setDetail(f)}>
                        <Thumb f={f} />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={f.name}>{f.name}</span>
                      <span className="w-12 text-xs font-bold uppercase text-mist">{f.ext}</span>
                      <span className="w-24 text-right text-xs font-medium text-mist">{f.sizeKb} KB</span>
                      <span className="w-24 text-right text-xs font-medium text-mist">{dmy(f.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {slice.length === 0 && (
              <div className="p-10 text-center text-sm text-mist">No media files found{q ? ` for “${q}”` : ''}.</div>
            )}

            <div className="mt-auto flex items-center justify-between px-4 pb-4 pt-6">
              <p className="text-sm text-mist">
                Showing {filtered.length === 0 ? 0 : (cur - 1) * perPage + 1} to {Math.min(cur * perPage, filtered.length)} of {filtered.length} files
              </p>
              <nav className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={cur === 1}
                  onClick={() => setPage(cur - 1)}
                  className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-sm transition enabled:hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50 dark:enabled:hover:bg-white/[0.06]"
                >
                  Previous
                </button>
                {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`h-8 w-8 cursor-pointer rounded-md text-sm font-medium transition ${p === cur ? 'bg-emerald-500 text-white' : 'border border-line hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={cur === pages}
                  onClick={() => setPage(cur + 1)}
                  className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-sm transition enabled:hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50 dark:enabled:hover:bg-white/[0.06]"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setDetail(null)}>
          <div className="card max-h-[92vh] w-full overflow-y-auto rounded-t-2xl p-4 sm:max-w-5xl sm:rounded-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-base font-bold sm:text-lg"><ImageIcon className="h-5 w-5" /> Media Details</h2>
                <p className="mt-1 text-sm text-mist">View detailed information about this media</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setDetail(null)} className="-mr-1 cursor-pointer rounded-md p-1.5 transition hover:bg-black/[0.05] dark:hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid gap-5 sm:mt-5 sm:gap-6 lg:grid-cols-[1fr_360px]">
              <div className="rounded-xl border border-line bg-black/[0.02] p-3 sm:p-4 dark:bg-white/[0.03]">
                <div className="group mx-auto aspect-square w-full max-w-[220px] overflow-hidden rounded-md sm:max-w-none">
                  <Thumb f={detail} />
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold sm:text-lg">File Information</h3>
                <div className="mt-3 space-y-3.5 text-sm sm:mt-4 sm:space-y-4">
                  <div>
                    <p className="text-mist">File Name</p>
                    <p className="mt-1 break-all font-medium">{fileName(detail)}</p>
                  </div>
                  <div>
                    <p className="text-mist">Display Name</p>
                    <p className="mt-1 font-medium">{detail.name}</p>
                  </div>
                  <div>
                    <p className="text-mist">File Type</p>
                    <p className="mt-1"><span className="rounded-md bg-black/[0.05] px-2.5 py-1 text-xs font-semibold dark:bg-white/10">image/{detail.ext}</span></p>
                  </div>
                  <div>
                    <p className="text-mist">File Size</p>
                    <p className="mt-1 font-medium">{detail.sizeKb} KB</p>
                  </div>
                  <div>
                    <p className="text-mist">Upload Date</p>
                    <p className="mt-1 font-medium">{dmy(detail.date)}</p>
                  </div>
                  <div>
                    <p className="text-mist">File URL</p>
                    <div className="mt-1 flex items-start gap-2 rounded-md border border-line bg-black/[0.02] p-3 dark:bg-white/[0.04]">
                      <span className="min-w-0 flex-1 break-all text-xs text-mist">{fileUrl(detail)}</span>
                      <button type="button" aria-label="Copy URL" onClick={() => copyUrl(detail)} className="cursor-pointer rounded p-1 text-mist transition hover:text-inherit">
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <h3 className="mt-5 text-base font-bold sm:mt-6 sm:text-lg">Actions</h3>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                  <button type="button" onClick={() => setViewer(detail)} className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-line px-2 py-2.5 text-sm font-medium transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06] sm:justify-start sm:gap-2 sm:px-4 sm:py-2">
                    <Eye className="h-4 w-4 text-sky-500" /> View
                  </button>
                  <button type="button" onClick={() => download(detail)} className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-line px-2 py-2.5 text-sm font-medium transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06] sm:justify-start sm:gap-2 sm:px-4 sm:py-2">
                    <Download className="h-4 w-4 text-emerald-500" /> Download
                  </button>
                  <button type="button" onClick={() => removeFile(detail)} className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-line px-2 py-2.5 text-sm font-medium transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06] sm:justify-start sm:gap-2 sm:px-4 sm:py-2">
                    <Trash2 className="h-4 w-4 text-ember" /> Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewer && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/85 p-4" onClick={() => setViewer(null)}>
          <div className="flex items-center justify-between gap-3 text-white">
            <div className="min-w-0">
              <p className="truncate font-semibold">{fileName(viewer)}</p>
              <p className="text-sm text-white/60">image/{viewer.ext} · {viewer.sizeKb} KB · {dmy(viewer.date)}</p>
            </div>
            <button type="button" aria-label="Close viewer" onClick={() => setViewer(null)} className="cursor-pointer rounded-md p-2 transition hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 flex min-h-0 flex-1 items-center justify-center">
            {viewer.dataUrl ? (
              <img src={viewer.dataUrl} alt={viewer.name} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
            ) : (
              <div
                className="flex h-[min(60vh,60vw)] w-[min(60vh,60vw)] items-center justify-center rounded-lg shadow-2xl"
                style={{ background: `linear-gradient(135deg, hsl(${viewer.hue} 70% 92%), hsl(${(viewer.hue + 40) % 360} 65% 78%))` }}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-9xl drop-shadow">{viewer.glyph}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
