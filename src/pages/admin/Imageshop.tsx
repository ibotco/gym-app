import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Camera, ChevronDown, FolderInput, Pencil, Plus, RotateCcw, RotateCw, Trash2, Upload, X } from 'lucide-react'
import { Modal, Button } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { useApp } from '../../context/AppContext'
import {
  CROPPED_PHOTO_DIR,
  MAIN_FOLDER,
  apiCreateFolder,
  apiDelete,
  apiDeleteFolder,
  apiList,
  apiSave,
  loadFolders,
  loadShots,
  newShotId,
  saveFolders,
  saveShots,
  type Shot,
} from '../../lib/imageshop'

/** Editor stage, and the crop window inside it (a portrait passport frame). */
const STAGE_W = 500
const STAGE_H = 290
const CROP_W = 186
const CROP_H = 250
/** Breathing room kept around the frame so it always reads as a window. */
/** Saved pictures are rendered at twice the crop frame for a crisp thumbnail. */
const EXPORT_SCALE = 2
/** Zoom limits, shared by the slider and the mouse wheel. */
const ZOOM_MIN = 0.2
const ZOOM_MAX = 3
/** One wheel notch changes the zoom by this much (multiplicative, so it feels even). */
const WHEEL_STEP = 1.12
const MAX_BYTES = 5 * 1024 * 1024

/**
 * Imageshop — the picture desk.
 *
 * Pick a photo, frame the face inside the crop window with the zoom slider and
 * the rotate buttons, give it a name and upload it into a folder. Everything
 * filed in the selected folder shows in the gallery on the right; clicking a
 * thumbnail loads it back into the editor.
 */
export function ImageshopPage() {
  const toast = useToast()
  const { members, users } = useApp()

  const [shots, setShots] = useState<Shot[]>(() => loadShots())
  const [folders, setFolders] = useState<string[]>(() => loadFolders())
  /** True once the disk store under public/cropped_photo has answered. */
  const [onDisk, setOnDisk] = useState(false)
  const [folder, setFolder] = useState(MAIN_FOLDER)

  const [name, setName] = useState('')
  const [fileName, setFileName] = useState('')
  const [src, setSrc] = useState('')
  const [zoom, setZoom] = useState(1)
  const [rot, setRot] = useState(0)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  /** Set while a gallery picture is open: Upload then replaces it in place. */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingFolder, setAddingFolder] = useState(false)
  const [newFolder, setNewFolder] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  // Pictures live in public/cropped_photo when the dev server exposes the
  // store; otherwise they fall back to localStorage so the page still works.
  useEffect(() => {
    let alive = true
    apiList().then(async (res) => {
      if (!alive || !res) return
      setOnDisk(true)

      // Anything saved in the browser before the folder store existed is
      // written out to public/cropped_photo once, then cleared, so the folder
      // really is the single home for every cropped picture.
      const stray = loadShots().filter((s) => s.src.startsWith('data:'))
      if (stray.length) {
        for (const old of stray) {
          if (old.folder !== MAIN_FOLDER && !res.folders.includes(old.folder)) await apiCreateFolder(old.folder)
          await apiSave({ name: old.name, folder: old.folder, dataUrl: old.src })
        }
        saveShots([])
        saveFolders([])
        const fresh = await apiList()
        if (alive && fresh) {
          setFolders(fresh.folders)
          setShots(fresh.shots)
          toast.success(
            'Pictures moved to the photo folder',
            `${stray.length} picture${stray.length === 1 ? '' : 's'} saved into ${CROPPED_PHOTO_DIR}.`,
          )
          return
        }
      }

      setFolders(res.folders)
      setShots(res.shots)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { if (!onDisk) saveShots(shots) }, [shots, onDisk])
  useEffect(() => { if (!onDisk) saveFolders(folders) }, [folders, onDisk])

  /**
   * Rolling the mouse over the stage zooms the picture. Registered by hand so
   * the listener can be non-passive: without that the browser refuses the
   * preventDefault and the page scrolls away under the cursor instead.
   */
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!src) return
      e.preventDefault()
      setZoom((z) => {
        const next = e.deltaY < 0 ? z * WHEEL_STEP : z / WHEEL_STEP
        return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(next.toFixed(3))))
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [src])

  /** Member names offered as suggestions for the caption. */
  const suggestions = useMemo(
    () =>
      members
        .map((m) => users.find((u) => u.id === m.userId)?.name)
        .filter((n): n is string => !!n)
        .sort((a, b) => a.localeCompare(b)),
    [members, users],
  )

  /** Gallery search — matches the picture name inside the open folder. */
  const [gallerySearch, setGallerySearch] = useState('')
  const inFolder = useMemo(() => {
    const q = gallerySearch.trim().toLowerCase()
    return shots.filter((s) => s.folder === folder && (!q || s.name.toLowerCase().includes(q)))
  }, [shots, folder, gallerySearch])
  const folderCount = useMemo(() => shots.filter((s) => s.folder === folder).length, [shots, folder])

  /** Scale that makes the picture cover the crop window before the user zooms. */
  const baseScale = useMemo(() => {
    if (!natural.w || !natural.h) return 1
    const swapped = rot % 180 !== 0
    const w = swapped ? natural.h : natural.w
    const h = swapped ? natural.w : natural.h
    return Math.max(CROP_W / w, CROP_H / h)
  }, [natural, rot])

  const clearForm = () => {
    setName('')
    setFileName('')
    setSrc('')
    setZoom(1)
    setRot(0)
    setOff({ x: 0, y: 0 })
    setNatural({ w: 0, h: 0 })
    setEditingId(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onPick = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Not an image', 'Choose a JPG, PNG or WebP file.')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('Image too large', 'Pictures must be 5 MB or smaller.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setSrc(String(reader.result))
      setFileName(file.name)
      setZoom(1)
      setRot(0)
      setOff({ x: 0, y: 0 })
    }
    reader.onerror = () => toast.error('Upload failed', 'That file could not be read. Try another image.')
    reader.readAsDataURL(file)
  }

  const addFolder = async () => {
    const n = newFolder.trim()
    if (!n) return
    if (folders.some((f) => f.toLowerCase() === n.toLowerCase())) {
      toast.error('Folder exists', `“${n}” is already on the list.`)
      return
    }
    // Always offer the folder to the store: if the dev server was down when
    // this page loaded but is back now, this is what reconnects us to disk.
    const made = await apiCreateFolder(n)
    if (made) setOnDisk(true)
    else if (onDisk) {
      toast.error('Folder not created', `${n} could not be created in ${CROPPED_PHOTO_DIR}.`)
      return
    }
    setFolders((f) => [...f, n])
    setFolder(n)
    setNewFolder('')
    setAddingFolder(false)
    toast.success('Folder added', `Pictures will now file into “${n}”.`)
  }

  /**
   * Redraw the framed picture at export size. Mirrors the CSS transform on the
   * stage exactly: pan, then rotate, then zoom, all about the crop centre.
   */
  const renderCrop = (): string => {
    const img = imgRef.current
    if (!img) return src
    try {
      const canvas = document.createElement('canvas')
      canvas.width = CROP_W * EXPORT_SCALE
      canvas.height = CROP_H * EXPORT_SCALE
      const ctx = canvas.getContext('2d')
      if (!ctx) return src
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.scale(EXPORT_SCALE, EXPORT_SCALE)
      ctx.translate(off.x, off.y)
      ctx.rotate((rot * Math.PI) / 180)
      const s = baseScale * zoom
      ctx.scale(s, s)
      ctx.drawImage(img, -natural.w / 2, -natural.h / 2, natural.w, natural.h)
      return canvas.toDataURL('image/jpeg', 0.9)
    } catch {
      // jsdom (and browsers with a tainted canvas) cannot rasterise — keep the original.
      return src
    }
  }

  const upload = async () => {
    if (!src) {
      toast.error('No photo chosen', 'Browse for a picture first.')
      return
    }
    if (!name.trim()) {
      toast.error('Name required', 'Give the picture a name before uploading.')
      return
    }
    const framed = renderCrop()

    // A picture opened from the gallery is EDITED in place — same entry, new
    // crop/name/folder — so re-framing someone does not leave a duplicate.
    const editing = editingId && shots.some((s) => s.id === editingId) ? editingId : null

    // Try the folder store on every upload, not just when it answered at load
    // time — a page opened while the server was restarting must still be able
    // to write into public/cropped_photo once it comes back.
    if (!onDisk && folder !== MAIN_FOLDER) await apiCreateFolder(folder)
    const saved = await apiSave({ name: name.trim(), folder, dataUrl: framed, from: editing || undefined })
    if (!saved && onDisk) {
      toast.error('Save failed', `The picture could not be written to ${CROPPED_PHOTO_DIR}.`)
      return
    }
    if (saved) {
      setOnDisk(true)
      setShots((rows) => [saved.shot, ...rows.filter((r) => r.id !== editing && r.id !== saved.shot.id)])
      clearForm()
      toast.success(
        editing ? 'Picture updated' : 'Picture uploaded',
        `Saved to public${CROPPED_PHOTO_DIR}/${saved.shot.id}`,
      )
      return
    }

    if (editing) {
      setShots((rows) =>
        rows.map((r) =>
          r.id === editing
            ? { ...r, name: name.trim(), folder, src: framed, updatedAt: new Date().toISOString() }
            : r,
        ),
      )
      clearForm()
      toast.warning('Held in the browser', `${CROPPED_PHOTO_DIR} is not reachable — the change is kept here for now.`)
      return
    }

    const shot: Shot = {
      id: newShotId(),
      name: name.trim(),
      folder,
      src: framed,
      createdAt: new Date().toISOString(),
    }
    setShots((s) => [shot, ...s])
    clearForm()
    toast.warning(
      'Held in the browser',
      `${CROPPED_PHOTO_DIR} is not reachable, so ${shot.name} is kept here and will be written into ${folder} as soon as it is.`,
    )
  }

  const openShot = (s: Shot) => {
    setEditingId(s.id)
    setName(s.name)
    setSrc(s.src)
    setFolder(s.folder)
    setFileName(`${s.name}.jpg`)
    setZoom(1)
    setRot(0)
    setOff({ x: 0, y: 0 })
  }

  /** Rename a folder (Main Folder keeps its name) — pictures follow the name. */
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null)
  const applyRename = async () => {
    if (!renaming) return
    const to = renaming.to.trim()
    if (!to) { toast.error('Enter a folder name.'); return }
    if (to === renaming.from) { setRenaming(null); return }
    if (folders.some((f) => f.toLowerCase() === to.toLowerCase())) {
      toast.error('Folder exists', `“${to}” is already on the list.`)
      return
    }
    if (onDisk) {
      const made = await apiCreateFolder(to)
      if (!made) { toast.error('Folder not created', `${to} could not be created in ${CROPPED_PHOTO_DIR}.`); return }
    }
    setFolders((f) => f.map((x) => (x === renaming.from ? to : x)))
    setShots((rows) => rows.map((r) => (r.folder === renaming.from ? { ...r, folder: to } : r)))
    if (folder === renaming.from) setFolder(to)
    setRenaming(null)
    toast.success('Folder renamed', `${renaming.from} is now ${to}.`)
  }

  /** Move one picture into another folder. */
  const [moving, setMoving] = useState<{ shot: Shot; to: string } | null>(null)
  const applyMove = () => {
    if (!moving) return
    const { shot, to } = moving
    if (to === shot.folder) { setMoving(null); return }
    setShots((rows) => rows.map((r) => (r.id === shot.id ? { ...r, folder: to } : r)))
    setMoving(null)
    toast.success('Picture moved', `${shot.name} is now in ${to}.`)
  }

  /**
   * Folders other than the built-in Main Folder can be removed. Pictures in a
   * deleted folder are never thrown away silently — they move to Main Folder.
   */
  const [pendingFolder, setPendingFolder] = useState<string | null>(null)
  const [deletingFolder, setDeletingFolder] = useState(false)

  const removeFolder = async (name: string) => {
    if (name === MAIN_FOLDER) return
    setDeletingFolder(true)
    try {
      if (onDisk) await apiDeleteFolder(name)
      const moved = shots.filter((s2) => s2.folder === name).length
      setShots((rows) => rows.map((r) => (r.folder === name ? { ...r, folder: MAIN_FOLDER } : r)))
      setFolders((f) => f.filter((x) => x !== name))
      if (folder === name) setFolder(MAIN_FOLDER)
      setPendingFolder(null)
      toast.success(
        'Folder deleted',
        moved ? `${name} was removed and ${moved} picture(s) moved to ${MAIN_FOLDER}.` : `${name} was removed.`,
      )
    } catch (err) {
      toast.error('Could not delete the folder', err instanceof Error ? err.message : `${name} is still there.`)
    } finally {
      setDeletingFolder(false)
    }
  }

  /**
   * Deleting a picture is permanent (it also removes the file from the photo
   * folder), so it is confirmed first — the dialog shows exactly which picture,
   * where it lives, and whether it is the one open in the editor.
   */
  const [pendingDelete, setPendingDelete] = useState<Shot | null>(null)
  const [deleting, setDeleting] = useState(false)

  const removeShot = async (s: Shot) => {
    setDeleting(true)
    try {
      if (onDisk) await apiDelete(s.id)
      setShots((rows) => rows.filter((r) => r.id !== s.id))
      // Clear the editor when the picture being edited is the one deleted.
      if (editingId === s.id) {
        setEditingId(null)
        setSrc('')
        setName('')
        setFileName('')
      }
      setPendingDelete(null)
      toast.success('Picture deleted', `${s.name} was removed from ${s.folder}.`)
    } catch (err) {
      toast.error('Could not delete the picture', err instanceof Error ? err.message : `${s.name} is still in ${s.folder}.`)
    } finally {
      setDeleting(false)
    }
  }

  // --- toolbar styling, matching the mock: navy caps, flat square controls ---
  const capCls =
    'flex h-11 shrink-0 items-center gap-1.5 rounded-l-md bg-[#1f3864] px-4 text-sm font-bold text-white'
  const boxCls = 'flex h-11 items-center rounded-r-md border border-line bg-white dark:bg-zinc-900'

  return (
    <div>
      <div className="card mb-4 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Camera className="size-5" />
          <h1 className="font-display text-lg font-semibold tracking-tight">Imageshop</h1>
          <span
            className={`ml-auto truncate rounded-md px-2 py-1 text-xs font-semibold ${onDisk ? 'bg-black/5 text-mist dark:bg-white/5' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'}`}
            title={onDisk ? 'Cropped pictures are written here' : 'The photo folder is unreachable — pictures are held in the browser until it is back'}
          >
            {onDisk
              ? `public${folder === MAIN_FOLDER ? CROPPED_PHOTO_DIR : `${CROPPED_PHOTO_DIR}/${folder}`}`
              : 'Photo folder unreachable — saving in the browser'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex min-w-[260px] flex-1 items-stretch">
            <span className={capCls}>Name</span>
            <div className={`${boxCls} flex-1`}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                list="imageshop-names"
                aria-label="Name"
                placeholder="Picture name"
                className="h-full w-full bg-transparent px-3 text-sm outline-none"
              />
              <datalist id="imageshop-names">
                {suggestions.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="flex min-w-[280px] flex-1 items-stretch">
            <span className={capCls}>Photo</span>
            <div className={`${boxCls} flex-1 overflow-hidden`}>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-full cursor-pointer border-r border-line bg-black/5 px-3 text-sm font-semibold transition hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                Browse…
              </button>
              <span className="truncate px-3 text-sm text-mist">{fileName || 'No file selected'}</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                aria-label="Photo file"
                className="hidden"
                onChange={(e) => {
                  onPick(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </div>
          </div>

          <div className="flex items-stretch">
            <button
              type="button"
              onClick={() => setAddingFolder((v) => !v)}
              aria-label="Add folder"
              className={`${capCls} cursor-pointer transition hover:brightness-125`}
            >
              <Plus className="size-4" />
              Folder
            </button>
            <div className={`${boxCls} relative`}>
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                aria-label="Folder"
                className="h-full cursor-pointer appearance-none bg-transparent pl-3 pr-9 text-sm outline-none"
              >
                {folders.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 size-4 text-mist" />
            </div>
            <button
              type="button"
              onClick={() => setRenaming({ from: folder, to: folder })}
              disabled={folder === MAIN_FOLDER}
              aria-label={`Rename folder ${folder}`}
              title={folder === MAIN_FOLDER ? `${MAIN_FOLDER} cannot be renamed` : `Rename folder ${folder}`}
              className="ml-1 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-md border border-line text-mist transition hover:border-[#2e4a86] hover:text-[#2e4a86] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-mist"
            >
              <Pencil className="size-4" />
            </button>
            {/* Main Folder is built in and cannot be removed. */}
            <button
              type="button"
              onClick={() => setPendingFolder(folder)}
              disabled={folder === MAIN_FOLDER}
              aria-label={`Delete folder ${folder}`}
              title={folder === MAIN_FOLDER ? `${MAIN_FOLDER} cannot be deleted` : `Delete folder ${folder}`}
              className="ml-1 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-md border border-line text-mist transition hover:border-rose-400 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-mist"
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={clearForm}
            className="h-11 cursor-pointer rounded-md bg-[#1f3864] px-5 text-sm font-bold text-white transition hover:brightness-125"
          >
            Empty
          </button>
        </div>

        {addingFolder && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
            <input
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addFolder()}
              aria-label="New folder name"
              placeholder="New folder name"
              className="h-10 w-64 rounded-md border border-line bg-transparent px-3 text-sm outline-none"
            />
            <button
              type="button"
              onClick={addFolder}
              className="h-10 cursor-pointer rounded-md bg-[#1f7a3d] px-4 text-sm font-bold text-white transition hover:brightness-110"
            >
              Add folder
            </button>
            <button
              type="button"
              onClick={() => { setAddingFolder(false); setNewFolder('') }}
              className="h-10 cursor-pointer px-2 text-sm font-semibold text-mist hover:text-inherit"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------------- Editor ---------------- */}
        <div className="card p-6">
          <div
            className="relative mx-auto select-none overflow-hidden bg-[#808080]"
            style={{ width: STAGE_W, height: STAGE_H, maxWidth: '100%', cursor: src ? 'grab' : 'default' }}
            ref={stageRef}
            data-testid="imageshop-stage"
            title={src ? 'Drag to move · roll the mouse wheel to zoom' : undefined}
            onPointerDown={(e) => {
              if (!src) return
              drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }
              ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
            }}
            onPointerMove={(e) => {
              const d = drag.current
              if (!d) return
              setOff({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) })
            }}
            onPointerUp={() => { drag.current = null }}
            onPointerLeave={() => { drag.current = null }}
          >
            {src ? (
              <img
                ref={imgRef}
                src={src}
                alt={name || 'Selected picture'}
                draggable={false}
                onLoad={(e) => {
                  const el = e.currentTarget
                  setNatural({ w: el.naturalWidth || CROP_W, h: el.naturalHeight || CROP_H })
                }}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: natural.w || undefined,
                  height: natural.h || undefined,
                  maxWidth: 'none',
                  transform: `translate(-50%, -50%) translate(${off.x}px, ${off.y}px) rotate(${rot}deg) scale(${baseScale * zoom})`,
                  transformOrigin: 'center',
                }}
              />
            ) : (
              <div className="grid h-full place-items-center text-sm font-semibold text-white/80">
                Browse for a photo to start
              </div>
            )}

            {/* One white frame whose huge outer shadow greys everything outside it. */}
            <div
              className="pointer-events-none absolute border-2 border-white"
              style={{
                width: CROP_W,
                height: CROP_H,
                // Centred off the stage itself, not off its nominal pixel width:
                // the stage shrinks on narrow screens and fixed offsets would
                // leave the frame sitting off to one side.
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 0 0 9999px rgba(128,128,128,0.6)',
              }}
              data-testid="imageshop-crop"
            />
          </div>

          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            disabled={!src}
            className="mx-auto mt-6 block w-full max-w-[380px] cursor-pointer accent-[#1f3864] disabled:opacity-40"
          />
          <p className="mt-2 text-center text-xs text-mist">Roll the mouse wheel over the photo to zoom · drag to move</p>

          {editingId && (
            <p className="mt-3 text-center text-xs font-semibold text-[#2e4a86] dark:text-sky-300">
              Editing “{name || 'this picture'}” — Update replaces it. Press Empty to start a new one instead.
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setRot((r) => (r + 270) % 360)}
              disabled={!src}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-[#1f7a3d] px-4 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
            >
              <RotateCcw className="size-4" />
              Rotate Left
            </button>
            <button
              type="button"
              onClick={() => setRot((r) => (r + 90) % 360)}
              disabled={!src}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-[#1f7a3d] px-4 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
            >
              <RotateCw className="size-4" />
              Rotate Right
            </button>
            <button
              type="button"
              onClick={upload}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-[#2e4a86] px-4 text-sm font-bold text-white transition hover:brightness-125"
            >
              <Upload className="size-4" />
              {editingId ? 'Update' : 'Upload'}
            </button>
          </div>
        </div>

        {/* ---------------- Gallery ---------------- */}
        <div className="card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-ink dark:text-white">{folder}</h2>
            <span className="rounded-md bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-mist dark:bg-white/5">
              {folderCount} picture{folderCount === 1 ? '' : 's'}
            </span>
            <input
              value={gallerySearch}
              onChange={(e) => setGallerySearch(e.target.value)}
              aria-label="Search pictures"
              placeholder="Search pictures…"
              className="ml-auto h-9 w-48 rounded-md border border-line bg-transparent px-3 text-sm outline-none"
            />
          </div>
          {inFolder.length === 0 ? (
            <div className="grid h-full min-h-[220px] place-items-center text-center">
              <div>
                <p className="text-sm font-semibold">
                  {gallerySearch.trim() ? `No picture matches “${gallerySearch.trim()}”` : `No pictures in ${folder}`}
                </p>
                <p className="mt-1 text-xs text-mist">
                  Frame a photo on the left and press Upload to file it into{' '}
                  {folder === MAIN_FOLDER ? CROPPED_PHOTO_DIR : `${CROPPED_PHOTO_DIR}/${folder}`}.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {inFolder.map((s) => (
                <figure
                  key={s.id}
                  className={`group relative overflow-hidden rounded-md border ${s.id === editingId ? 'border-[#2e4a86] ring-2 ring-[#2e4a86]' : 'border-line'}`}
                >
                  <button
                    type="button"
                    onClick={() => openShot(s)}
                    className="block w-full cursor-pointer"
                    title={onDisk ? `public${CROPPED_PHOTO_DIR}/${s.id}` : `Open ${s.name}`}
                  >
                    <img src={s.src} alt={s.name} className="aspect-[3/4] w-full object-cover" />
                    <figcaption className="truncate border-t border-line px-1 py-1 text-center text-xs font-semibold text-[#1a56b0] dark:text-sky-300">
                      {s.name}
                    </figcaption>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoving({ shot: s, to: folders.find((f) => f !== s.folder) || s.folder })}
                    aria-label={`Move ${s.name} to another folder`}
                    title={`Move ${s.name} to another folder`}
                    className="absolute left-1 top-1 cursor-pointer rounded-full bg-black/55 p-1 text-white opacity-70 transition hover:bg-[#2e4a86] hover:opacity-100 focus-visible:opacity-100"
                  >
                    <FolderInput className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(s)}
                    aria-label={`Delete ${s.name}`}
                    title={`Delete ${s.name}`}
                    /* Always visible (touch devices never hover), brighter on hover. */
                    className="absolute right-1 top-1 cursor-pointer rounded-full bg-black/55 p-1 text-white opacity-70 transition hover:bg-rose-600 hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- rename folder ---------------- */}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Rename folder">
        {renaming && (
          <div className="grid gap-3">
            <p className="text-xs text-mist">Pictures stay where they are — they simply follow the new folder name.</p>
            <label className="text-sm font-semibold">
              Folder name
              <input
                value={renaming.to}
                onChange={(e) => setRenaming({ ...renaming, to: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && void applyRename()}
                className="mt-1 h-10 w-full rounded-md border border-line bg-transparent px-3 text-sm outline-none"
                autoFocus
              />
            </label>
            <div className="flex gap-2">
              <Button onClick={() => void applyRename()}>Rename folder</Button>
              <Button variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- move a picture ---------------- */}
      <Modal open={!!moving} onClose={() => setMoving(null)} title="Move picture">
        {moving && (
          <div className="grid gap-3">
            <div className="flex items-start gap-3">
              <img src={moving.shot.src} alt={moving.shot.name} className="h-24 w-16 shrink-0 rounded-md border border-line object-cover" />
              <div className="text-sm">
                <div className="font-bold text-ink dark:text-white">{moving.shot.name}</div>
                <div className="mt-0.5 text-xs text-mist">Currently in {moving.shot.folder}</div>
              </div>
            </div>
            <label className="text-sm font-semibold">
              Move to
              <select
                value={moving.to}
                onChange={(e) => setMoving({ ...moving, to: e.target.value })}
                className="mt-1 h-10 w-full cursor-pointer rounded-md border border-line bg-transparent px-3 text-sm outline-none"
              >
                {folders.filter((f) => f !== moving.shot.folder).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <Button onClick={applyMove} disabled={folders.length < 2}>
                <FolderInput className="size-4" /> Move picture
              </Button>
              <Button variant="ghost" onClick={() => setMoving(null)}>Cancel</Button>
            </div>
            {folders.length < 2 && <p className="text-xs text-mist">Create another folder first.</p>}
          </div>
        )}
      </Modal>

      {/* ---------------- folder delete confirmation ---------------- */}
      <Modal
        open={!!pendingFolder}
        onClose={() => (deletingFolder ? undefined : setPendingFolder(null))}
        title="Delete this folder?"
      >
        {pendingFolder && (
          <div className="grid gap-3">
            <div className="text-sm">
              <div className="font-bold text-ink dark:text-white">{pendingFolder}</div>
              <div className="mt-0.5 text-xs text-mist">
                {shots.filter((s2) => s2.folder === pendingFolder).length} picture(s) in this folder
              </div>
            </div>
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {shots.some((s2) => s2.folder === pendingFolder)
                ? `The folder is removed and its pictures are moved to ${MAIN_FOLDER} — no picture is deleted.`
                : 'The folder is empty, so nothing else changes.'}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setPendingFolder(null)} disabled={deletingFolder}>Cancel</Button>
              <Button variant="danger" onClick={() => void removeFolder(pendingFolder)} disabled={deletingFolder}>
                <Trash2 className="size-4" /> {deletingFolder ? 'Deleting…' : 'Delete folder'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- delete confirmation ---------------- */}
      <Modal open={!!pendingDelete} onClose={() => (deleting ? undefined : setPendingDelete(null))} title="Delete this picture?">
        {pendingDelete && (
          <div className="grid gap-3">
            <div className="flex items-start gap-3">
              <img
                src={pendingDelete.src}
                alt={pendingDelete.name}
                className="h-28 w-20 shrink-0 rounded-md border border-line object-cover"
              />
              <div className="min-w-0 text-sm">
                <div className="font-bold text-ink dark:text-white">{pendingDelete.name}</div>
                <div className="mt-0.5 text-xs text-mist">Folder: {pendingDelete.folder}</div>
                <div className="mt-0.5 break-all text-xs text-mist">
                  {onDisk ? `public${CROPPED_PHOTO_DIR}/${pendingDelete.id}` : 'Held in this browser (photo folder unreachable)'}
                </div>
                {editingId === pendingDelete.id && (
                  <div className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    This picture is open in the editor — deleting it will clear the editor.
                  </div>
                )}
              </div>
            </div>

            <p className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {onDisk
                ? 'The file is removed from the photo folder as well. This cannot be undone — any record still using it will lose its picture.'
                : 'The picture is removed from this browser. This cannot be undone.'}
            </p>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleting}>Cancel</Button>
              <Button variant="danger" onClick={() => void removeShot(pendingDelete)} disabled={deleting}>
                <Trash2 className="size-4" /> {deleting ? 'Deleting…' : 'Delete picture'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default ImageshopPage
