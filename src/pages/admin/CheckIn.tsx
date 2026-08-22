import { useEffect, useRef, useState } from 'react'
import { Camera, ScanLine, CheckCircle2, XCircle, Clock, ImagePlus, RefreshCw, ShieldAlert } from 'lucide-react'
import { PageHeader, Button, Input, Select, Badge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { BrowserMultiFormatReader, BarcodeFormat, type IScannerControls } from '@zxing/browser'
import { DecodeHintType } from '@zxing/library'

type CheckinOutcome =
  | { ok: true; name: string; plan: string; code: string }
  | { ok: false; error: string }

const SCAN_FORMATS = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
]

export function CheckInDesk() {
  const { members, users, branches, memberships, plans, attendance, checkIn, log } = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [branchId, setBranchId] = useState('br_airport')
  const [outcome, setOutcome] = useState<CheckinOutcome | null>(null)
  const [scanning, setScanning] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const today = new Date().toISOString().slice(0, 10)
  const todaysCheckins = attendance.filter((a) => a.type === 'checkin' && a.date === today)

  const resolve = (raw: string): CheckinOutcome => {
    const clean = raw.trim()
    const member = members.find((x) => x.qrCode.toLowerCase() === clean.toLowerCase())
    if (!member) return { ok: false, error: `No member matches "${clean}".` }
    const u = users.find((x) => x.id === member.userId)
    const ms = memberships.find((x) => x.id === member.membershipId)
    const plan = plans.find((p) => p.id === (ms?.planId || member.planId))

    if (u?.status === 'suspended') return { ok: false, error: `${u.name} is suspended.` }
    if (ms && ms.status !== 'active') return { ok: false, error: `${u?.name}'s membership is ${ms.status}.` }
    const already = todaysCheckins.some((a) => a.memberId === member.id)
    if (already) return { ok: false, error: `${u?.name} already checked in today.` }

    return { ok: true, name: u?.name || member.id, plan: plan?.name || 'Member', code: member.qrCode }
  }

  const doCheckIn = (raw: string, source: string) => {
    const r = resolve(raw)
    if (!r.ok) {
      setOutcome(r)
      toast.error('Check-in blocked', r.error)
      return
    }
    const member = members.find((x) => x.qrCode.toLowerCase() === raw.trim().toLowerCase())!
    checkIn(member.id, branchId)
    log(user?.id || 'desk', 'CHECKIN', 'Attendance', `${r.name} (${r.code}) @ ${branchId} · ${source}`)
    setOutcome(r)
    setCode('')
    toast.success('Checked in', r.name)
  }

  // Scan an uploaded image (screenshot or photo of the code) — no camera needed.
  const scanImage = async (file: File | undefined) => {
    if (!file) return
    setImageBusy(true)
    setImageError('')
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(fr.result as string)
        fr.onerror = () => rej(new Error('Could not read the file.'))
        fr.readAsDataURL(file)
      })
      const hints = new Map()
      hints.set(DecodeHintType.TRY_HARDER, true)
      const reader = new BrowserMultiFormatReader(hints)
      reader.possibleFormats = SCAN_FORMATS
      const result = await reader.decodeFromImageUrl(dataUrl)
      doCheckIn(result.getText(), 'image scan')
    } catch {
      setImageError('No code found in that image. Try a clearer, well-lit photo or a screenshot of the card.')
    } finally {
      setImageBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <PageHeader
        title="QR / barcode check-in"
        desc="Scan a member's card with the camera, upload a photo, or type their code."
        actions={
          <div className="flex items-center gap-3">
            <Badge tone="lime">{todaysCheckins.length} today</Badge>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Scan with camera</h3>
              <span className={`chip ${scanning ? 'bg-lime/15 text-lime' : 'bg-white/5'}`}>
                {scanning ? 'Scanning…' : 'Idle'}
              </span>
            </div>
            <CameraScanner
              active={scanning}
              onDetect={(v) => doCheckIn(v, 'camera scan')}
              onDenied={() => {
                setScanning(false)
                toast.warning('Camera blocked', 'Allow camera access, or use image upload / manual entry.')
              }}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => setScanning((s) => !s)} variant={scanning ? 'outline' : 'soft'}>
                <Camera className="size-4" /> {scanning ? 'Stop camera' : 'Start camera'}
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={imageBusy}>
                <ImagePlus className="size-4" /> {imageBusy ? 'Scanning image…' : 'Upload image to scan'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label="Upload image to scan"
                onChange={(e) => void scanImage(e.target.files?.[0])}
              />
            </div>
            {imageError && <p className="mt-2 text-xs text-ember">{imageError}</p>}
            <p className="mt-3 text-xs text-mist">
              No camera? Upload a screenshot or photo of the member&apos;s card code and it will be read automatically.
            </p>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold">Manual entry</h3>
            <Select className="mt-3" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <Input
              className="mt-3 font-mono uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="FITPRO-…"
              onKeyDown={(e) => { if (e.key === 'Enter' && code.trim()) doCheckIn(code, 'typed') }}
            />
            <Button className="mt-3 w-full" size="lg" disabled={!code.trim()} onClick={() => doCheckIn(code, 'typed')}>
              <ScanLine className="size-4" /> Check in
            </Button>
            <div className="mt-4 flex flex-wrap gap-2">
              {members.slice(0, 6).map((m) => (
                <button key={m.id} onClick={() => setCode(m.qrCode)} className="chip bg-white/5 hover:bg-white/10">
                  {m.qrCode}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {outcome && (
            <div className={`card p-4 ${outcome.ok ? 'ring-1 ring-lime/50' : 'ring-1 ring-ember/50'}`}>
              {outcome.ok ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-lime" />
                  <div className="min-w-0">
                    <p className="font-display text-lg">{outcome.name}</p>
                    <p className="text-sm text-mist">{outcome.plan} · {outcome.code}</p>
                    <p className="mt-1 text-xs text-lime">Checked in · {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <XCircle className="mt-0.5 size-6 shrink-0 text-ember" />
                  <div>
                    <p className="font-display text-lg">Check-in blocked</p>
                    <p className="text-sm text-mist">{outcome.error}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="card p-5">
            <h3 className="flex items-center gap-2 font-semibold"><Clock className="size-4 text-lime" /> Today's check-ins</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {todaysCheckins.slice(0, 14).map((a) => {
                const m = members.find((x) => x.id === a.memberId)
                const u = users.find((x) => x.id === m?.userId)
                return (
                  <li key={a.id} className="flex items-center justify-between border-b border-white/5 py-2">
                    <span className="font-medium">{u?.name}</span>
                    <span className="text-mist">{a.time} · {branches.find((b) => b.id === a.branchId)?.name}</span>
                  </li>
                )
              })}
              {!todaysCheckins.length && <li className="text-mist">No check-ins yet today.</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Live camera scanner using ZXing (@zxing/browser) — works in every browser. */
function CameraScanner({
  active,
  onDetect,
  onDenied,
}: {
  active: boolean
  onDetect: (value: string) => void
  onDenied?: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)

  const onDetectRef = useRef(onDetect)
  useEffect(() => { onDetectRef.current = onDetect }, [onDetect])
  const onDeniedRef = useRef(onDenied)
  useEffect(() => { onDeniedRef.current = onDenied }, [onDenied])

  useEffect(() => {
    let cancelled = false

    const stop = () => {
      try { controlsRef.current?.stop() } catch { /* ignore */ }
      controlsRef.current = null
    }

    if (!active) {
      stop()
      setError('')
      return
    }

    const video = videoRef.current
    if (!video) return

    // (Re)starting the camera clears a previous denial.
    setDenied(false)

    const reader = new BrowserMultiFormatReader()
    reader.possibleFormats = SCAN_FORMATS

    let detected = false

    // decodeFromVideoDevice prefers the rear (environment) camera when no
    // device id is given, and falls back to any available camera.
    reader
      .decodeFromVideoDevice(undefined, video, (result, _err, controls) => {
        if (cancelled || detected) return
        controlsRef.current = controls
        if (result) {
          detected = true
          const text = result.getText()
          stop()
          onDetectRef.current(text)
        }
        // _err is expected between frames (no code detected yet) — ignore it.
      })
      .then((controls) => {
        if (cancelled) { try { controls.stop() } catch { /* ignore */ } }
        else controlsRef.current = controls
      })
      .catch((e) => {
        if (cancelled) return
        const name = (e as { name?: string })?.name
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
          setDenied(true)
          onDeniedRef.current?.()
          return
        }
        setError(e instanceof Error ? e.message : 'Could not access the camera.')
      })

    return () => {
      cancelled = true
      stop()
    }
  }, [active])

  return (
    <div className="mt-3 overflow-hidden rounded-xl bg-black">
      <video ref={videoRef} muted playsInline className="mx-auto aspect-video w-full object-cover" />
      {!active && !error && !denied && (
        <div className="grid aspect-video place-items-center text-mist">
          <div className="text-center">
            <Camera className="mx-auto size-8 text-mist/40" />
            <p className="mt-2 text-xs">Camera is off. Tap “Start camera” to scan.</p>
          </div>
        </div>
      )}
      {denied && (
        <div className="grid aspect-video place-items-center p-5">
          <div className="max-w-sm text-center text-sm text-zinc-300">
            <ShieldAlert className="mx-auto size-8 text-amber-400" />
            <p className="mt-2 font-semibold text-white">Camera access is blocked</p>
            <p className="mt-1 text-xs text-mist">Your browser is blocking the camera. To fix it:</p>
            <ul className="mx-auto mt-2 max-w-xs space-y-1 text-left text-xs text-zinc-400">
              <li>· Chrome / Edge: click the camera icon in the address bar → <span className="text-zinc-200">Allow</span>.</li>
              <li>· Firefox: click the shield/padlock → <span className="text-zinc-200">Permissions</span> → allow camera.</li>
              <li>· Safari: Settings → Websites → Camera → <span className="text-zinc-200">Allow</span>.</li>
            </ul>
            <p className="mt-3 text-xs text-mist">
              Or skip the camera entirely — use <span className="text-zinc-200">“Upload image to scan”</span> or type the code below.
            </p>
            <Button
              size="sm"
              variant="soft"
              className="mt-3"
              onClick={() => onDeniedRef.current && onDeniedRef.current()}
            >
              <RefreshCw className="size-4" /> Got it
            </Button>
          </div>
        </div>
      )}
      {error && !denied && (
        <div className="grid aspect-video place-items-center p-4 text-center text-xs text-ember">{error}</div>
      )}
    </div>
  )
}
