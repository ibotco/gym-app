import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, Bus, Crosshair, History, MapPin, Navigation, Radio, ShieldCheck, Siren, TriangleAlert,
} from 'lucide-react'
// Leaflet CSS — loaded dynamically so the rest of Education Management (e.g. Marksheet Template)
// can render even if leaflet isn't installed locally.
if (typeof document !== 'undefined') {
  import('leaflet/dist/leaflet.css').catch(() => {})
}
import { DataTable, type Column } from '../../../components/DataTable'
import {
  Badge, Button, DatePicker, Empty, Field, Input, Modal, PageHeader, SearchInput, Select, StatCard, Switch, Textarea,
} from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useI18n } from '../../../context/I18nContext'
import { useToast } from '../../../context/ToastContext'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'
import { uid } from '../../../lib/utils'
import {
  DEFAULT_GPS_SETTINGS, DEFAULT_MAP_CENTER, GPS_ALERT_TYPES, MAP_STYLES, MAP_TILE_LAYERS, activeGeofences,
  activeVehicleAssignments, alertSeverityTone, distanceToPathMeters, evaluateFleetAlerts, formatMinutes,
  geofenceCenter, geofenceColors, geofenceRadius, geofencesContaining, haversineKm, readGpsSettings, routePathFor,
  simulateFleet, summarizeTrips, type GpsSettings, type MapStyle, type VehicleLiveState,
} from '../../../lib/eduGps'

type LeafletModule = typeof import('leaflet')
type Tab = 'live' | 'geofences' | 'alerts' | 'history' | 'parents'

const TABS: { id: Tab; label: string }[] = [
  { id: 'live', label: 'Live Map' },
  { id: 'geofences', label: 'Geofences' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'history', label: 'Travel History' },
  { id: 'parents', label: 'Parent Access' },
]

const GEOFENCE_TYPES = ['School', 'Stop', 'Depot', 'Hazard', 'Custom']
const VISIBILITY_OPTIONS = ['Live location + ETA', 'ETA only', 'No tracking']
const MAX_PINGS = 600

/**
 * A vehicle may be assigned to several routes (it can finish one and join
 * another the same day), so lists and selections key on vehicle + route.
 */
const vehicleKey = (vehicle: { vehicleNo: string; routeName: string }) =>
  `${vehicle.vehicleNo}::${vehicle.routeName}`
const vehicleNoOf = (key: string) => key.split('::')[0]

const todayISO = () => new Date().toISOString().slice(0, 10)
const nowTime = () => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}
const round2 = (value: number) => Math.round(value * 10000) / 10000

/* ------------------------------------------------------------------ map ------------------------------------------------------------------ */

function FleetMap({
  vehicles,
  stops,
  geofences,
  selected,
  onSelect,
  style,
  onTileError,
}: {
  vehicles: VehicleLiveState[]
  stops: { name: string; lat: number; lng: number }[]
  geofences: { id: string; name: string; type: string; lat: number; lng: number; radius: number }[]
  selected: string
  onSelect: (vehicleNo: string) => void
  style: MapStyle
  onTileError: (failed: boolean) => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [L, setL] = useState<LeafletModule | null>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const layerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const fittedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let map: import('leaflet').Map | null = null
    import('leaflet').then((module) => {
      if (cancelled || !hostRef.current) return
      setL(module.default)
      map = module.default.map(hostRef.current, { zoomControl: true, attributionControl: true })
        .setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], 13)
      mapRef.current = map
      layerRef.current = module.default.layerGroup().addTo(map)
    }).catch(() => {
      // Leaflet not installed — map will stay in fallback state
      if (!cancelled) setL(null)
    })
    return () => {
      cancelled = true
      map?.remove()
      mapRef.current = null
      layerRef.current = null
      fittedRef.current = false
    }
  }, [])

  // Basemap: a key-free provider, swapped whenever the style setting changes.
  useEffect(() => {
    if (!L || !mapRef.current) return
    const provider = MAP_TILE_LAYERS[style] ?? MAP_TILE_LAYERS.Street
    const tiles = L.tileLayer(provider.url, {
      subdomains: provider.subdomains,
      maxZoom: provider.maxZoom,
      attribution: provider.attribution,
    })
    let reported = false
    tiles.on('tileerror', () => {
      if (reported) return
      reported = true
      onTileError(true)
    })
    tiles.on('tileload', () => onTileError(false))
    tiles.addTo(mapRef.current)
    return () => { tiles.remove() }
  }, [L, style, onTileError])

  useEffect(() => {
    if (!L || !mapRef.current || !layerRef.current) return
    const layer = layerRef.current
    layer.clearLayers()

    if (stops.length > 1) {
      L.polyline(stops.map((stop) => [stop.lat, stop.lng] as [number, number]), {
        color: '#84cc16', weight: 4, opacity: 0.75,
      }).addTo(layer)
    }
    for (const stop of stops) {
      L.circleMarker([stop.lat, stop.lng], {
        radius: 6, color: '#0f172a', weight: 2, fillColor: '#38bdf8', fillOpacity: 1,
      }).addTo(layer).bindTooltip(stop.name, { direction: 'top' })
    }
    for (const fence of geofences) {
      L.circle([fence.lat, fence.lng], {
        radius: fence.radius,
        color: geofenceColors[fence.type] ?? '#a855f7',
        weight: 2,
        fillOpacity: 0.08,
      }).addTo(layer).bindTooltip(`${fence.name} · ${fence.type} · ${fence.radius} m`, { direction: 'top' })
    }
    for (const vehicle of vehicles) {
      const moving = vehicle.tripStatus === 'En route'
      const color = vehicle.tripStatus === 'Completed' ? '#64748b'
        : vehicle.tripStatus === 'At stop' ? '#f59e0b'
          : vehicle.tripStatus === 'Not started' ? '#64748b' : '#16a34a'
      const isSelected = vehicle.vehicleNo === selected
      const icon = L.divIcon({
        className: '',
        iconSize: [isSelected ? 40 : 32, isSelected ? 40 : 32],
        iconAnchor: [isSelected ? 20 : 16, isSelected ? 20 : 16],
        html: `<div style="display:grid;place-items:center;width:${isSelected ? 40 : 32}px;height:${isSelected ? 40 : 32}px;border-radius:9999px;background:${color};color:#fff;border:${isSelected ? 3 : 2}px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);font-size:${isSelected ? 16 : 14}px">${moving ? '🚌' : '🅿️'}</div>`,
      })
      L.marker([vehicle.latitude, vehicle.longitude], { icon })
        .addTo(layer)
        .bindTooltip(`${vehicle.vehicleNo} · ${vehicle.speedKmh.toFixed(0)} km/h · ${vehicle.progressPct}%`, { direction: 'top' })
        .on('click', () => onSelect(vehicleKey(vehicle)))
    }

    if (!fittedRef.current && (stops.length || vehicles.length)) {
      const bounds = L.latLngBounds([
        ...stops.map((stop) => [stop.lat, stop.lng] as [number, number]),
        ...vehicles.map((vehicle) => [vehicle.latitude, vehicle.longitude] as [number, number]),
      ])
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds.pad(0.25))
        fittedRef.current = true
      }
    }
  }, [L, vehicles, stops, geofences, selected, onSelect])

  // Only re-centre when the followed vehicle changes — never fight the operator's own panning.
  const vehiclesRef = useRef(vehicles)
  vehiclesRef.current = vehicles
  useEffect(() => {
    if (!selected || !L || !mapRef.current) return
    const target = vehiclesRef.current.find((vehicle) => vehicleKey(vehicle) === selected)
    if (target) mapRef.current.panTo([target.latitude, target.longitude], { animate: true })
  }, [selected, L])

  return (
    <div
      ref={hostRef}
      className="h-[380px] w-full overflow-hidden rounded-xl border border-line bg-black/5 sm:h-[460px] dark:bg-white/5"
      role="application"
      aria-label="Live vehicle map"
    />
  )
}

/* ------------------------------------------------------------------ page ------------------------------------------------------------------ */

export function EduGpsTrackingPage() {
  const { activeBranchId, sessionUser } = useApp()
  const { t } = useI18n()
  const toast = useToast()
  const [records, setRecords] = useState<EduRecords>(() => loadEduRecords(activeBranchId))
  const [tab, setTab] = useState<Tab>('live')
  const [now, setNow] = useState(() => new Date())
  const [selectedVehicle, setSelectedVehicle] = useState('')
  const [openAlerts, setOpenAlerts] = useState(0)

  const settings = useMemo(() => readGpsSettings(records), [records])
  const fleet = useMemo(() => simulateFleet(records, now), [records, now])

  const patch = (next: Record<string, EduRow[]>) => {
    setRecords((current) => {
      const merged = { ...current, ...next }
      saveEduRecords(activeBranchId, merged)
      return merged
    })
  }

  /* Live tick: recompute positions, record pings and raise alerts. */
  useEffect(() => {
    const intervalMs = Math.max(5, settings.pollSeconds) * 1000
    const timer = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(timer)
  }, [settings.pollSeconds])

  useEffect(() => {
    if (tab !== 'live' || !settings.demoMode || !fleet.length) return
    const today = todayISO()
    if (settings.recordPings) {
      const pings: EduRow[] = fleet.map((vehicle) => ({
        id: uid('gpslog'),
        date: today,
        time: nowTime(),
        vehicleNo: vehicle.vehicleNo,
        routeName: vehicle.routeName,
        trip: 'Auto',
        event: vehicle.tripStatus,
        latitude: String(round2(vehicle.latitude)),
        longitude: String(round2(vehicle.longitude)),
        speedKmh: String(vehicle.speedKmh),
        stopName: vehicle.currentStop || vehicle.nextStop,
        progressPct: String(vehicle.progressPct),
        etaMinutes: String(vehicle.nextEtaMinutes),
        geofences: JSON.stringify(geofencesContaining(records, { lat: vehicle.latitude, lng: vehicle.longitude })),
        source: 'Simulated',
        remarks: '',
      }))
      const trimmed = [...pings, ...(records.transportGpsLogs ?? [])].slice(0, MAX_PINGS)
      patch({ transportGpsLogs: trimmed })
    }
    const drafts = evaluateFleetAlerts(records, settings, now)
    if (drafts.length) {
      const rows: EduRow[] = drafts.map((draft) => ({
        id: uid('gpsalert'),
        date: today,
        time: nowTime(),
        type: draft.type,
        severity: draft.severity,
        vehicleNo: draft.vehicleNo,
        routeName: draft.routeName,
        message: draft.message,
        latitude: draft.latitude === undefined || draft.latitude === null ? '' : String(round2(draft.latitude)),
        longitude: draft.longitude === undefined || draft.longitude === null ? '' : String(round2(draft.longitude)),
        status: 'Open',
        acknowledgedBy: '',
        remarks: '',
      }))
      patch({ transportGpsAlerts: [...rows, ...(records.transportGpsAlerts ?? [])] })
      toast.error(`${drafts.length} transport alert${drafts.length === 1 ? '' : 's'} raised`, drafts[0].message)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, now])

  useEffect(() => {
    setOpenAlerts((records.transportGpsAlerts ?? []).filter((row) => String(row.status ?? 'Open').trim() === 'Open').length)
  }, [records.transportGpsAlerts])

  useEffect(() => {
    if (!selectedVehicle && fleet.length) setSelectedVehicle(vehicleKey(fleet[0]))
    if (selectedVehicle && !fleet.some((vehicle) => vehicleKey(vehicle) === selectedVehicle)) {
      setSelectedVehicle(fleet[0]?.vehicleNo ?? '')
    }
  }, [fleet, selectedVehicle])

  const selected = fleet.find((vehicle) => vehicleKey(vehicle) === selectedVehicle) ?? null
  const selectedPath = selected ? routePathFor(records, selected.routeName) : null
  const mapStops = selectedPath
    ? selectedPath.stops.map((stop) => ({ name: stop.name, lat: stop.lat, lng: stop.lng }))
    : []
  const mapGeofences = activeGeofences(records).flatMap((fence) => {
    const center = geofenceCenter(fence)
    if (!center) return []
    return [{
      id: String(fence.id ?? ''),
      name: String(fence.name ?? '').trim(),
      type: String(fence.type ?? 'Custom').trim(),
      lat: center.lat,
      lng: center.lng,
      radius: geofenceRadius(fence),
    }]
  })

  const deviationMeters = selected && selectedPath
    ? Math.round(distanceToPathMeters({ lat: selected.latitude, lng: selected.longitude }, selectedPath.stops))
    : 0

  const raiseManualAlert = (type: string, message: string, severity: 'Info' | 'Warning' | 'Critical') => {
    if (!selected) return
    const row: EduRow = {
      id: uid('gpsalert'),
      date: todayISO(),
      time: nowTime(),
      type,
      severity,
      vehicleNo: selected.vehicleNo,
      routeName: selected.routeName,
      message,
      latitude: String(round2(selected.latitude)),
      longitude: String(round2(selected.longitude)),
      status: 'Open',
      acknowledgedBy: '',
      remarks: '',
    }
    patch({ transportGpsAlerts: [row, ...(records.transportGpsAlerts ?? [])] })
    toast.success(`${type} reported`, message)
  }

  return (
    <div>
      <PageHeader
        title="GPS Tracking"
        desc="Live vehicle monitoring, geofences, alerts, travel history and parent visibility — Education Management"
      />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === item.id
              ? 'bg-lime text-lime-ink'
              : 'border border-line text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10'}`}
          >
            {item.label}
            {item.id === 'alerts' && openAlerts ? ` (${openAlerts})` : ''}
          </button>
        ))}
      </div>

      {tab === 'live' && (
        <LiveTab
          records={records}
          settings={settings}
          fleet={fleet}
          selected={selected}
          selectedVehicle={selectedVehicle}
          setSelectedVehicle={setSelectedVehicle}
          mapStops={mapStops}
          mapGeofences={mapGeofences}
          deviationMeters={deviationMeters}
          patch={patch}
          raiseManualAlert={raiseManualAlert}
          onRefresh={() => setNow(new Date())}
        />
      )}
      {tab === 'geofences' && <GeofencesTab records={records} patch={patch} />}
      {tab === 'alerts' && <AlertsTab records={records} patch={patch} actor={String(sessionUser?.name ?? '').trim()} />}
      {tab === 'history' && <HistoryTab records={records} />}
      {tab === 'parents' && (
        <ParentsTab
          records={records}
          fleet={fleet}
          settings={settings}
          patch={patch}
          viewerName={String(sessionUser?.name ?? '').trim()}
        />
      )}
      <p className="mt-3 text-[11px] text-mist">
        {t('nav.eduTransport')} · GPS Tracking — positions are simulated from each Route timetable unless a position is reported manually.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------- live tab ------------------------------------------------------------- */

function LiveTab({
  records, settings, fleet, selected, selectedVehicle, setSelectedVehicle, mapStops, mapGeofences,
  deviationMeters, patch, raiseManualAlert, onRefresh,
}: {
  records: EduRecords
  settings: GpsSettings
  fleet: VehicleLiveState[]
  selected: VehicleLiveState | null
  selectedVehicle: string
  setSelectedVehicle: (vehicleNo: string) => void
  mapStops: { name: string; lat: number; lng: number }[]
  mapGeofences: { id: string; name: string; type: string; lat: number; lng: number; radius: number }[]
  deviationMeters: number
  patch: (next: Record<string, EduRow[]>) => void
  raiseManualAlert: (type: string, message: string, severity: 'Info' | 'Warning' | 'Critical') => void
  onRefresh: () => void
}) {
  const toast = useToast()
  const [draft, setDraft] = useState<Partial<GpsSettings>>({})
  const [tilesFailed, setTilesFailed] = useState(false)
  const [position, setPosition] = useState({ vehicleNo: '', latitude: '', longitude: '', speedKmh: '', remarks: '' })

  const current = { ...settings, ...draft }
  const dirty = JSON.stringify(current) !== JSON.stringify(settings)
  const statusTone = (status: string) => status === 'En route' ? 'lime' : status === 'At stop' ? 'amber' : 'zinc'

  const saveSettings = () => {
    patch({
      transportGpsSettings: [{
        id: (records.transportGpsSettings ?? [])[0]?.id ?? uid('gpsset'),
        demoMode: current.demoMode ? 'Yes' : 'No',
        recordPings: current.recordPings ? 'Yes' : 'No',
        mapStyle: current.mapStyle,
        pollSeconds: String(current.pollSeconds),
        speedLimitKmh: String(current.speedLimitKmh),
        deviationMeters: String(current.deviationMeters),
        geofenceRadiusMeters: String(current.geofenceRadiusMeters),
        shareLiveLocation: current.shareLiveLocation ? 'Yes' : 'No',
        shareEta: current.shareEta ? 'Yes' : 'No',
        notifyParentsOnDelay: current.notifyParentsOnDelay ? 'Yes' : 'No',
        delayThresholdMinutes: String(current.delayThresholdMinutes),
      }],
    })
    setDraft({})
    toast.success('Tracking settings saved')
  }

  const reportPosition = () => {
    const vehicleNo = position.vehicleNo || vehicleNoOf(selectedVehicle)
    const lat = Number(position.latitude)
    const lng = Number(position.longitude)
    if (!vehicleNo) { toast.error('Select a vehicle'); return }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { toast.error('Enter a valid latitude and longitude'); return }
    const path = routePathFor(records, fleet.find((vehicle) => vehicle.vehicleNo === vehicleNo)?.routeName ?? '')
    const deviation = Math.round(distanceToPathMeters({ lat, lng }, path.stops))
    const row: EduRow = {
      id: uid('gpslog'),
      date: todayISO(),
      time: nowTime(),
      vehicleNo,
      routeName: fleet.find((vehicle) => vehicle.vehicleNo === vehicleNo)?.routeName ?? '',
      trip: 'Manual',
      event: 'Manual report',
      latitude: String(round2(lat)),
      longitude: String(round2(lng)),
      speedKmh: String(Number(position.speedKmh) || 0),
      stopName: '',
      progressPct: '',
      etaMinutes: '',
      geofences: JSON.stringify(geofencesContaining(records, { lat, lng })),
      source: 'Manual',
      remarks: position.remarks.trim(),
    }
    patch({ transportGpsLogs: [row, ...(records.transportGpsLogs ?? [])] })
    if (deviation > current.deviationMeters) {
      raiseManualAlert(
        'Route Deviation',
        `${vehicleNo} reported ${deviation} m away from ${row.routeName || 'its route'}.`,
        'Warning',
      )
    }
    setPosition((currentPosition) => ({ ...currentPosition, latitude: '', longitude: '', speedKmh: '', remarks: '' }))
    toast.success('Position recorded', `${vehicleNo} at ${round2(lat)}, ${round2(lng)}`)
  }

  const useMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('This device cannot share a location')
      return
    }
    navigator.geolocation.getCurrentPosition((pos) => {
      setPosition((currentPosition) => ({
        ...currentPosition,
        latitude: String(round2(pos.coords.latitude)),
        longitude: String(round2(pos.coords.longitude)),
        speedKmh: pos.coords.speed ? String(Math.round(pos.coords.speed * 3.6)) : '',
      }))
      toast.success('Location captured from this device')
    }, () => toast.error('Location permission denied'))
  }

  return (
    <div className="mt-3 grid gap-3">
      {!fleet.length ? (
        <div className="card p-6">
          <Empty
            title="No vehicles to track"
            desc="Assign an active vehicle to an active Route under Transport → Assign Vehicle, then the fleet appears here."
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
            <StatCard label="Vehicles tracked" value={String(fleet.length)} icon={<Bus className="size-4" />} />
            <StatCard label="En route" value={String(fleet.filter((vehicle) => vehicle.tripStatus === 'En route').length)} />
            <StatCard label="At stop" value={String(fleet.filter((vehicle) => vehicle.tripStatus === 'At stop').length)} />
            <StatCard
              label="Avg speed"
              value={`${fleet.length ? (fleet.reduce((sum, vehicle) => sum + vehicle.speedKmh, 0) / fleet.length).toFixed(0) : 0} km/h`}
            />
            <StatCard
              label="Route progress"
              value={`${fleet.length ? Math.round(fleet.reduce((sum, vehicle) => sum + vehicle.progressPct, 0) / fleet.length) : 0}%`}
            />
            <StatCard
              label="Delayed"
              value={String(fleet.filter((vehicle) => vehicle.latenessMinutes >= current.delayThresholdMinutes).length)}
              hint={`>${current.delayThresholdMinutes} min late`}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="card overflow-hidden p-2">
              <FleetMap
                vehicles={fleet}
                stops={mapStops}
                geofences={mapGeofences}
                selected={selectedVehicle}
                onSelect={setSelectedVehicle}
                style={current.mapStyle}
                onTileError={setTilesFailed}
              />
              {tilesFailed && (
                <p className="mt-1 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                  Basemap tiles could not be loaded on this network. Vehicles, routes and geofences are still plotted —
                  try the Map style option below, or allow external map tiles on your connection.
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2">
                <p className="text-[11px] text-mist">
                  Click a bus to follow it. Green = moving, amber = at a stop, grey = idle/completed.
                </p>
                <Button size="sm" variant="outline" onClick={onRefresh}><Radio className="size-4" /> Refresh now</Button>
              </div>
            </div>

            <div className="card flex max-h-[520px] flex-col overflow-hidden">
              <p className="border-b border-line px-3 py-2 text-xs font-bold uppercase tracking-wide text-mist">Fleet</p>
              <div className="flex-1 divide-y divide-line overflow-y-auto">
                {fleet.map((vehicle) => (
                  <button
                    key={vehicleKey(vehicle)}
                    type="button"
                    onClick={() => setSelectedVehicle(vehicleKey(vehicle))}
                    className={`block w-full px-3 py-2.5 text-left transition hover:bg-black/5 dark:hover:bg-white/5 ${vehicleKey(vehicle) === selectedVehicle ? 'bg-lime/10' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{vehicle.vehicleNo}</p>
                      <Badge tone={statusTone(vehicle.tripStatus)}>{vehicle.tripStatus}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-mist">{vehicle.routeName}</p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                      <div className="h-full rounded-full bg-lime" style={{ width: `${vehicle.progressPct}%` }} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-mist">
                      <span>{vehicle.speedKmh.toFixed(0)} km/h</span>
                      <span>{vehicle.progressPct}% done</span>
                      <span>{vehicle.distanceCoveredKm.toFixed(1)}/{vehicle.totalKm.toFixed(1)} km</span>
                    </div>
                    <p className="mt-1 text-[11px]">
                      {vehicle.nextStop
                        ? <>Next: <span className="font-semibold">{vehicle.nextStop}</span> · ETA {vehicle.nextEtaMinutes} min</>
                        : 'Trip complete'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {selected && (
        <div className="card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">{selected.vehicleNo} · {selected.routeName}</h3>
              <p className="text-[11px] text-mist">
                {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)} · {selected.tripStatus}
                {selected.currentStop ? ` · dwelling at ${selected.currentStop} for ${formatMinutes(selected.dwellSeconds / 60)}` : ''}
                {deviationMeters > current.deviationMeters ? ` · ${deviationMeters} m off route` : ` · ${deviationMeters} m from route`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => raiseManualAlert('Breakdown', `${selected.vehicleNo} reported a breakdown on ${selected.routeName}.`, 'Critical')}>
                <Siren className="size-4" /> Report breakdown
              </Button>
              <Button size="sm" variant="outline" onClick={() => raiseManualAlert('SOS', `SOS raised from ${selected.vehicleNo} on ${selected.routeName}.`, 'Critical')}>
                <TriangleAlert className="size-4" /> SOS
              </Button>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[26rem] text-xs">
              <thead>
                <tr className="border-b border-line text-left text-[10px] font-bold uppercase tracking-wide text-mist">
                  <th className="py-1.5 pr-2">Stoppage</th>
                  <th className="py-1.5 pr-2">Scheduled</th>
                  <th className="py-1.5 pr-2">ETA</th>
                  <th className="py-1.5 pr-2">Status</th>
                  <th className="py-1.5">Dwell</th>
                </tr>
              </thead>
              <tbody>
                {selected.stopEtas.map((stop) => (
                  <tr key={`${stop.name}-${stop.scheduledTime}`} className="border-b border-line/60 last:border-0">
                    <td className="py-1.5 pr-2">{stop.name}</td>
                    <td className="py-1.5 pr-2">{stop.scheduledTime || '—'}</td>
                    <td className="py-1.5 pr-2">{stop.state === 'Done' ? '—' : `${stop.etaMinutes} min`}</td>
                    <td className="py-1.5 pr-2">
                      <Badge tone={stop.state === 'Done' ? 'zinc' : stop.state === 'Current' ? 'amber' : stop.state === 'Next' ? 'lime' : 'sky'}>
                        {stop.state}
                      </Badge>
                    </td>
                    <td className="py-1.5">
                      {stop.state === 'Current' ? formatMinutes(selected.dwellSeconds / 60) : stop.state === 'Done' ? '—' : '—'}
                    </td>
                  </tr>
                ))}
                {!selected.stopEtas.length && (
                  <tr><td colSpan={5} className="py-2 text-mist">No stoppages on this route yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card p-3">
          <h3 className="text-sm font-semibold">Report a position</h3>
          <p className="mt-0.5 text-[11px] text-mist">
            Manual entry for a driver/attendant call-in or a device without a feed. Off-route reports raise a Route Deviation alert automatically.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Field label="Vehicle">
              <Select value={position.vehicleNo || vehicleNoOf(selectedVehicle)} onChange={(event) => setPosition((currentPosition) => ({ ...currentPosition, vehicleNo: event.target.value }))}>
                {fleet.map((vehicle) => (
                  <option key={vehicleKey(vehicle)} value={vehicle.vehicleNo}>
                    {vehicle.vehicleNo}{fleet.filter((item) => item.vehicleNo === vehicle.vehicleNo).length > 1 ? ` — ${vehicle.routeName}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Speed (km/h)">
              <Input value={position.speedKmh} onChange={(event) => setPosition((currentPosition) => ({ ...currentPosition, speedKmh: event.target.value }))} placeholder="0" inputMode="decimal" />
            </Field>
            <Field label="Latitude">
              <Input value={position.latitude} onChange={(event) => setPosition((currentPosition) => ({ ...currentPosition, latitude: event.target.value }))} placeholder="5.6037" inputMode="decimal" />
            </Field>
            <Field label="Longitude">
              <Input value={position.longitude} onChange={(event) => setPosition((currentPosition) => ({ ...currentPosition, longitude: event.target.value }))} placeholder="-0.1870" inputMode="decimal" />
            </Field>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={useMyLocation}><Crosshair className="size-4" /> Use my location</Button>
            <Button size="sm" onClick={reportPosition}><MapPin className="size-4" /> Record position</Button>
          </div>
        </div>

        <div className="card p-3">
          <h3 className="text-sm font-semibold">Tracking settings</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-2 text-xs">
              <span>Demo simulation</span>
              <Switch checked={current.demoMode} onChange={(value) => setDraft((currentDraft) => ({ ...currentDraft, demoMode: value }))} />
            </label>
            <label className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-2 text-xs">
              <span>Record tracking pings</span>
              <Switch checked={current.recordPings} onChange={(value) => setDraft((currentDraft) => ({ ...currentDraft, recordPings: value }))} />
            </label>
            <Field label="Map style">
              <Select value={current.mapStyle} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, mapStyle: event.target.value as MapStyle }))}>
                {MAP_STYLES.map((option) => (<option key={option} value={option}>{option}</option>))}
              </Select>
            </Field>
            <Field label="Refresh interval (seconds)">
              <Input value={String(current.pollSeconds)} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, pollSeconds: Number(event.target.value) || DEFAULT_GPS_SETTINGS.pollSeconds }))} inputMode="numeric" />
            </Field>
            <Field label="Speed limit (km/h)">
              <Input value={String(current.speedLimitKmh)} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, speedLimitKmh: Number(event.target.value) || 0 }))} inputMode="numeric" />
            </Field>
            <Field label="Route deviation threshold (m)">
              <Input value={String(current.deviationMeters)} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, deviationMeters: Number(event.target.value) || 0 }))} inputMode="numeric" />
            </Field>
            <Field label="Delay alert threshold (min)">
              <Input value={String(current.delayThresholdMinutes)} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, delayThresholdMinutes: Number(event.target.value) || 0 }))} inputMode="numeric" />
            </Field>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft({})} disabled={!dirty}>Reset</Button>
            <Button size="sm" onClick={saveSettings} disabled={!dirty}>Save settings</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------- geofences tab --------------------------------------------------------- */

function GeofencesTab({ records, patch }: { records: EduRecords; patch: (next: Record<string, EduRow[]>) => void }) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<EduRow | null>(null)
  const [pickRoute, setPickRoute] = useState('')
  const fences = records.transportGeofences ?? []

  const routeNames = [...new Set((records.transportRoutes ?? []).map((row) => String(row.routeName ?? '').trim()).filter(Boolean))].sort()
  const stopOptions = pickRoute
    ? routePathFor(records, pickRoute).stops.map((stop) => ({ name: stop.name, lat: stop.lat, lng: stop.lng }))
    : []

  const filtered = fences.filter((row) => !query.trim()
    || `${row.name ?? ''} ${row.type ?? ''} ${row.routeName ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))

  const columns: Column<EduRow>[] = [
    { key: 'name', header: 'Name', sortValue: (row) => String(row.name ?? ''), render: (row) => <span className="font-semibold">{String(row.name ?? '—')}</span> },
    { key: 'type', header: 'Type', sortValue: (row) => String(row.type ?? ''), render: (row) => <Badge tone="sky">{String(row.type ?? 'Custom')}</Badge> },
    { key: 'routeName', header: 'Route', sortValue: (row) => String(row.routeName ?? ''), render: (row) => String(row.routeName ?? '—') },
    { key: 'coords', header: 'Coordinates', render: (row) => <span className="font-mono text-[11px]">{String(row.latitude ?? '')}, {String(row.longitude ?? '')}</span> },
    { key: 'radiusMeters', header: 'Radius', align: 'right', sortValue: (row) => Number(row.radiusMeters ?? 0), render: (row) => `${String(row.radiusMeters ?? '150')} m` },
    {
      key: 'active',
      header: 'Active',
      render: (row) => <Badge tone={String(row.active ?? 'Yes').trim().toLocaleLowerCase() === 'no' ? 'zinc' : 'lime'}>{String(row.active ?? 'Yes')}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <button className="rounded-md p-1.5 text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10" title="Edit" onClick={() => { setPickRoute(''); setDraft({ ...row }) }}>
            <Navigation className="size-3.5" />
          </button>
          <button
            className="rounded-md p-1.5 text-mist hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
            title="Delete"
            onClick={() => patch({ transportGeofences: fences.filter((item) => item.id !== row.id) })}
          >
            <AlertTriangle className="size-3.5" />
          </button>
        </div>
      ),
    },
  ]

  const save = () => {
    if (!draft) return
    const lat = Number(draft.latitude)
    const lng = Number(draft.longitude)
    if (!String(draft.name ?? '').trim()) { toast.error('Name is required'); return }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { toast.error('Enter a valid latitude and longitude'); return }
    const row: EduRow = { ...draft, latitude: String(round2(lat)), longitude: String(round2(lng)) }
    const exists = fences.some((item) => item.id === row.id)
    patch({ transportGeofences: exists ? fences.map((item) => (item.id === row.id ? row : item)) : [...fences, row] })
    toast.success(exists ? 'Geofence updated' : 'Geofence added', String(row.name ?? ''))
    setDraft(null)
  }

  return (
    <div className="mt-3 card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search geofences…" />
        <Button
          size="sm"
          onClick={() => {
            setPickRoute(routeNames[0] ?? '')
            setDraft({
              id: uid('geofence'),
              name: '',
              type: 'Stop',
              routeName: routeNames[0] ?? '',
              latitude: '',
              longitude: '',
              radiusMeters: String(readGpsSettings(records).geofenceRadiusMeters),
              active: 'Yes',
            })
          }}
        >
          <ShieldCheck className="size-4" /> Add geofence
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(row) => row.id}
        pageSize={10}
        emptyTitle="No geofences yet"
        emptyDesc="Create a geofence around the school, a stoppage, the depot or a hazard zone to get entry and exit alerts."
      />

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft && fences.some((row) => row.id === draft.id) ? 'Edit geofence' : 'Add geofence'}>
        {draft && (
          <div className="grid gap-3">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Field label="Name" required>
                <Input value={String(draft.name ?? '')} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="School campus" />
              </Field>
              <Field label="Type">
                <Select value={String(draft.type ?? 'Stop')} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>
                  {GEOFENCE_TYPES.map((type) => (<option key={type} value={type}>{type}</option>))}
                </Select>
              </Field>
              <Field label="Route (optional)">
                <Select value={String(draft.routeName ?? '')} onChange={(event) => setDraft({ ...draft, routeName: event.target.value })}>
                  <option value="">No specific route</option>
                  {routeNames.map((route) => (<option key={route} value={route}>{route}</option>))}
                </Select>
              </Field>
              <Field label="Radius (metres)">
                <Input value={String(draft.radiusMeters ?? '')} onChange={(event) => setDraft({ ...draft, radiusMeters: event.target.value })} inputMode="numeric" />
              </Field>
              <Field label="Latitude" required>
                <Input value={String(draft.latitude ?? '')} onChange={(event) => setDraft({ ...draft, latitude: event.target.value })} placeholder="5.6037" inputMode="decimal" />
              </Field>
              <Field label="Longitude" required>
                <Input value={String(draft.longitude ?? '')} onChange={(event) => setDraft({ ...draft, longitude: event.target.value })} placeholder="-0.1870" inputMode="decimal" />
              </Field>
            </div>
            <div className="rounded-xl border border-line p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-mist">Copy coordinates from a route stoppage</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <Field label="Route">
                  <Select value={pickRoute} onChange={(event) => setPickRoute(event.target.value)}>
                    <option value="">Select a route…</option>
                    {routeNames.map((route) => (<option key={route} value={route}>{route}</option>))}
                  </Select>
                </Field>
                <div className="flex flex-wrap gap-2">
                  {stopOptions.map((stop) => (
                    <Button
                      key={stop.name}
                      size="sm"
                      variant="outline"
                      onClick={() => setDraft({ ...draft, name: draft.name || stop.name, latitude: String(round2(stop.lat)), longitude: String(round2(stop.lng)) })}
                    >
                      {stop.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <label className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-2 text-xs">
              <span>Active</span>
              <Switch checked={String(draft.active ?? 'Yes').trim().toLocaleLowerCase() !== 'no'} onChange={(value) => setDraft({ ...draft, active: value ? 'Yes' : 'No' })} />
            </label>
            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------ alerts tab ------------------------------------------------------------ */

function AlertsTab({ records, patch, actor }: { records: EduRecords; patch: (next: Record<string, EduRow[]>) => void; actor: string }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('Open')
  const [typeFilter, setTypeFilter] = useState('')
  const rows = records.transportGpsAlerts ?? []

  const filtered = rows
    .filter((row) => !statusFilter || String(row.status ?? 'Open').trim() === statusFilter)
    .filter((row) => !typeFilter || String(row.type ?? '').trim() === typeFilter)
    .filter((row) => !query.trim()
      || `${row.vehicleNo ?? ''} ${row.message ?? ''} ${row.routeName ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))

  const setStatus = (row: EduRow, status: string) => patch({
    transportGpsAlerts: rows.map((item) => (item.id === row.id
      ? { ...item, status, acknowledgedBy: status === 'Open' ? '' : (actor || 'Operator') }
      : item)),
  })

  const columns: Column<EduRow>[] = [
    { key: 'date', header: 'Date', sortValue: (row) => String(row.date ?? ''), render: (row) => String(row.date ?? '—') },
    { key: 'time', header: 'Time', sortValue: (row) => String(row.time ?? ''), render: (row) => String(row.time ?? '—') },
    { key: 'type', header: 'Type', sortValue: (row) => String(row.type ?? ''), render: (row) => <span className="font-semibold">{String(row.type ?? '—')}</span> },
    {
      key: 'severity',
      header: 'Severity',
      sortValue: (row) => String(row.severity ?? ''),
      render: (row) => <Badge tone={alertSeverityTone(String(row.severity ?? ''))}>{String(row.severity ?? 'Info')}</Badge>,
    },
    { key: 'vehicleNo', header: 'Vehicle', sortValue: (row) => String(row.vehicleNo ?? ''), render: (row) => String(row.vehicleNo ?? '—') },
    { key: 'routeName', header: 'Route', sortValue: (row) => String(row.routeName ?? ''), render: (row) => String(row.routeName ?? '—') },
    { key: 'message', header: 'Message', render: (row) => <span className="text-mist">{String(row.message ?? '')}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const status = String(row.status ?? 'Open')
        return <Badge tone={status === 'Resolved' ? 'lime' : status === 'Acknowledged' ? 'amber' : 'rose'}>{status}</Badge>
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          {String(row.status ?? 'Open') === 'Open' && (
            <Button size="sm" variant="outline" onClick={() => setStatus(row, 'Acknowledged')}>Acknowledge</Button>
          )}
          {String(row.status ?? 'Open') !== 'Resolved' && (
            <Button size="sm" onClick={() => setStatus(row, 'Resolved')}>Resolve</Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="mt-3 card">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search alerts…" />
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-40" aria-label="Status">
          <option value="">All statuses</option>
          <option value="Open">Open</option>
          <option value="Acknowledged">Acknowledged</option>
          <option value="Resolved">Resolved</option>
        </Select>
        <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="w-44" aria-label="Type">
          <option value="">All types</option>
          {[...GPS_ALERT_TYPES, 'Delayed'].map((type) => (<option key={type} value={type}>{type}</option>))}
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(row) => row.id}
        pageSize={10}
        emptyTitle="No alerts"
        emptyDesc="Deviation, overspeed, geofence, breakdown and delay alerts appear here as they are detected."
      />
    </div>
  )
}

/* ------------------------------------------------------------ history tab ------------------------------------------------------------ */

function HistoryTab({ records }: { records: EduRecords }) {
  const [date, setDate] = useState(todayISO())
  const [vehicle, setVehicle] = useState('')
  const [query, setQuery] = useState('')
  const trips = summarizeTrips(records)
  const logs = records.transportGpsLogs ?? []

  const filteredTrips = trips
    .filter((trip) => !date || trip.date === date)
    .filter((trip) => !vehicle || trip.vehicleNo === vehicle)
  const filteredLogs = logs
    .filter((row) => !date || String(row.date ?? '') === date)
    .filter((row) => !vehicle || String(row.vehicleNo ?? '') === vehicle)
    .filter((row) => !query.trim()
      || `${row.vehicleNo ?? ''} ${row.stopName ?? ''} ${row.event ?? ''} ${row.remarks ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => `${String(b.date ?? '')}${String(b.time ?? '')}`.localeCompare(`${String(a.date ?? '')}${String(a.time ?? '')}`))

  const vehicleOptions = [...new Set(logs.map((row) => String(row.vehicleNo ?? '').trim()).filter(Boolean))].sort()

  const exportCsv = () => {
    const header = 'date,time,vehicle,route,trip,event,latitude,longitude,speed_kmh,stop,progress_pct,eta_minutes,geofences,source,remarks'
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const lines = filteredLogs.map((row) => [
      row.date, row.time, row.vehicleNo, row.routeName, row.trip, row.event, row.latitude, row.longitude,
      row.speedKmh, row.stopName, row.progressPct, row.etaMinutes, row.geofences, row.source, row.remarks,
    ].map(escape).join(','))
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `transport-gps-log-${date || 'all'}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const tripColumns: Column<typeof trips[number]>[] = [
    { key: 'date', header: 'Date', sortValue: (row) => row.date, render: (row) => row.date },
    { key: 'vehicleNo', header: 'Vehicle', sortValue: (row) => row.vehicleNo, render: (row) => <span className="font-semibold">{row.vehicleNo}</span> },
    { key: 'routeName', header: 'Route', sortValue: (row) => row.routeName, render: (row) => row.routeName },
    { key: 'trip', header: 'Trip', render: (row) => row.trip || '—' },
    { key: 'startTime', header: 'Start', render: (row) => row.startTime || '—' },
    { key: 'endTime', header: 'End', render: (row) => row.endTime || '—' },
    { key: 'durationMinutes', header: 'Duration', align: 'right', sortValue: (row) => row.durationMinutes, render: (row) => `${row.durationMinutes} min` },
    { key: 'distanceKm', header: 'Distance', align: 'right', sortValue: (row) => row.distanceKm, render: (row) => `${row.distanceKm.toFixed(2)} km` },
    { key: 'avgSpeedKmh', header: 'Avg speed', align: 'right', sortValue: (row) => row.avgSpeedKmh, render: (row) => `${row.avgSpeedKmh.toFixed(1)} km/h` },
    { key: 'maxSpeedKmh', header: 'Max speed', align: 'right', sortValue: (row) => row.maxSpeedKmh, render: (row) => `${row.maxSpeedKmh.toFixed(1)} km/h` },
    { key: 'stopsCompleted', header: 'Stops', align: 'right', sortValue: (row) => row.stopsCompleted, render: (row) => String(row.stopsCompleted) },
    { key: 'pings', header: 'Pings', align: 'right', sortValue: (row) => row.pings, render: (row) => String(row.pings) },
  ]

  const logColumns: Column<EduRow>[] = [
    { key: 'time', header: 'Time', sortValue: (row) => String(row.time ?? ''), render: (row) => String(row.time ?? '—') },
    { key: 'vehicleNo', header: 'Vehicle', sortValue: (row) => String(row.vehicleNo ?? ''), render: (row) => <span className="font-semibold">{String(row.vehicleNo ?? '—')}</span> },
    { key: 'event', header: 'Event', sortValue: (row) => String(row.event ?? ''), render: (row) => <Badge tone="zinc">{String(row.event ?? 'Ping')}</Badge> },
    { key: 'stopName', header: 'Stop', sortValue: (row) => String(row.stopName ?? ''), render: (row) => String(row.stopName ?? '—') },
    { key: 'coords', header: 'Coordinates', render: (row) => <span className="font-mono text-[11px]">{String(row.latitude ?? '')}, {String(row.longitude ?? '')}</span> },
    { key: 'speedKmh', header: 'Speed', align: 'right', sortValue: (row) => Number(row.speedKmh ?? 0), render: (row) => `${String(row.speedKmh ?? '0')} km/h` },
    { key: 'progressPct', header: 'Progress', align: 'right', render: (row) => (String(row.progressPct ?? '') ? `${String(row.progressPct)}%` : '—') },
    { key: 'etaMinutes', header: 'ETA', align: 'right', render: (row) => (String(row.etaMinutes ?? '') ? `${String(row.etaMinutes)} min` : '—') },
    { key: 'source', header: 'Source', render: (row) => <Badge tone={String(row.source ?? '') === 'Manual' ? 'sky' : 'zinc'}>{String(row.source ?? 'Simulated')}</Badge> },
    { key: 'remarks', header: 'Remarks', render: (row) => <span className="text-mist">{String(row.remarks ?? '')}</span> },
  ]

  return (
    <div className="mt-3 grid gap-3">
      <div className="card p-3">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Date">
            <DatePicker value={date} onChange={setDate} aria-label="History date" className="w-44" />
          </Field>
          <Field label="Vehicle">
            <Select value={vehicle} onChange={(event) => setVehicle(event.target.value)} className="w-48" aria-label="Vehicle">
              <option value="">All vehicles</option>
              {vehicleOptions.map((option) => (<option key={option} value={option}>{option}</option>))}
            </Select>
          </Field>
          <Button size="sm" variant="outline" onClick={exportCsv}><History className="size-4" /> Export CSV</Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Trips" value={String(filteredTrips.length)} />
          <StatCard label="Distance" value={`${filteredTrips.reduce((sum, trip) => sum + trip.distanceKm, 0).toFixed(1)} km`} />
          <StatCard label="Pings logged" value={String(filteredLogs.length)} hint="Audit trail" />
          <StatCard
            label="Top speed"
            value={`${filteredTrips.reduce((max, trip) => Math.max(max, trip.maxSpeedKmh), 0).toFixed(0)} km/h`}
          />
        </div>
      </div>

      <div className="card">
        <div className="border-b border-line p-3">
          <h3 className="text-sm font-semibold">Trips</h3>
          <p className="text-[11px] text-mist">Derived from tracking pings — start, end, distance, speeds and stops covered.</p>
        </div>
        <DataTable
          columns={tripColumns}
          data={filteredTrips}
          rowKey={(row) => row.key}
          pageSize={10}
          emptyTitle="No trips recorded"
          emptyDesc="Tracking pings are recorded while the Live Map tab is open with “Record tracking pings” enabled."
        />
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
          <div>
            <h3 className="text-sm font-semibold">Tracking log</h3>
            <p className="text-[11px] text-mist">Raw pings and events kept for audits (most recent {MAX_PINGS} entries).</p>
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder="Search log…" />
        </div>
        <DataTable
          columns={logColumns}
          data={filteredLogs}
          rowKey={(row) => row.id}
          pageSize={25}
          emptyTitle="No tracking log entries"
          emptyDesc="Positions are logged automatically while tracking, or manually with Report a position."
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ parents tab ------------------------------------------------------------ */

function ParentsTab({
  records, fleet, settings, patch, viewerName,
}: {
  records: EduRecords
  fleet: VehicleLiveState[]
  settings: GpsSettings
  patch: (next: Record<string, EduRow[]>) => void
  viewerName: string
}) {
  const [query, setQuery] = useState('')
  const [previewStudent, setPreviewStudent] = useState('')
  const access = records.transportGpsParentAccess ?? []
  const assignments = (records.studentTransportAssignments ?? []).filter((row) => String(row.status ?? 'Active').trim().toLocaleLowerCase() !== 'inactive')

  const students = useMemo(() => {
    const seen = new Set<string>()
    const rows: { studentId: string; name: string; className: string; routeName: string; vehicleNo: string; guardian: string }[] = []
    for (const assignment of assignments) {
      const studentId = String(assignment.studentId ?? '').trim()
      const name = String(assignment.student ?? '').trim()
      if (!name || seen.has(studentId || name)) continue
      seen.add(studentId || name)
      const student = (records.studentList ?? []).find((row) => String(row.id ?? '').trim() === studentId)
      rows.push({
        studentId,
        name,
        className: String(assignment.className ?? student?.className ?? '').trim(),
        routeName: String(assignment.routeName ?? '').trim(),
        vehicleNo: String(assignment.vehicleNo ?? '').trim(),
        guardian: String(student?.guardian ?? '').trim(),
      })
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [assignments, records.studentList])

  const parentMatch = (records.parents ?? []).find((row) => String(row.name ?? '').trim().toLocaleLowerCase() === viewerName.toLocaleLowerCase())
  const myChildren = parentMatch
    ? students.filter((student) => String(parentMatch.student ?? '').trim().toLocaleLowerCase() === student.name.toLocaleLowerCase())
    : []

  const filtered = students.filter((student) => !query.trim()
    || `${student.name} ${student.className} ${student.routeName}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))

  const visibilityFor = (student: { studentId: string; name: string }) => {
    const row = access.find((item) => String(item.studentId ?? '').trim() === student.studentId
      || String(item.student ?? '').trim().toLocaleLowerCase() === student.name.toLocaleLowerCase())
    return String(row?.visibility ?? (settings.shareLiveLocation ? VISIBILITY_OPTIONS[0] : VISIBILITY_OPTIONS[2])).trim()
  }
  const setVisibility = (student: { studentId: string; name: string; className: string; routeName: string }, visibility: string) => {
    const existing = access.find((item) => String(item.studentId ?? '').trim() === student.studentId
      || String(item.student ?? '').trim().toLocaleLowerCase() === student.name.toLocaleLowerCase())
    const row: EduRow = existing
      ? { ...existing, visibility }
      : {
        id: uid('gpsaccess'),
        student: student.name,
        studentId: student.studentId,
        className: student.className,
        routeName: student.routeName,
        visibility,
        notifyOnDelay: settings.notifyParentsOnDelay ? 'Yes' : 'No',
      }
    patch({ transportGpsParentAccess: existing ? access.map((item) => (item.id === row.id ? row : item)) : [...access, row] })
  }
  const toggleNotify = (student: { studentId: string; name: string; className: string; routeName: string }) => {
    const existing = access.find((item) => String(item.studentId ?? '').trim() === student.studentId
      || String(item.student ?? '').trim().toLocaleLowerCase() === student.name.toLocaleLowerCase())
    const row: EduRow = {
      id: existing?.id ?? uid('gpsaccess'),
      student: student.name,
      studentId: student.studentId,
      className: student.className,
      routeName: student.routeName,
      visibility: String(existing?.visibility ?? VISIBILITY_OPTIONS[0]),
      notifyOnDelay: String(existing?.notifyOnDelay ?? 'Yes').trim().toLocaleLowerCase() === 'no' ? 'Yes' : 'No',
    }
    patch({ transportGpsParentAccess: existing ? access.map((item) => (item.id === row.id ? row : item)) : [...access, row] })
  }
  const notifyFor = (student: { studentId: string; name: string }) => {
    const row = access.find((item) => String(item.studentId ?? '').trim() === student.studentId
      || String(item.student ?? '').trim().toLocaleLowerCase() === student.name.toLocaleLowerCase())
    return String(row?.notifyOnDelay ?? (settings.notifyParentsOnDelay ? 'Yes' : 'No')).trim()
  }

  const previewName = previewStudent || myChildren[0]?.name || filtered[0]?.name || ''
  const previewStudentRow = students.find((student) => student.name === previewName)
  const previewVehicle = previewStudentRow ? fleet.find((vehicle) => vehicle.vehicleNo === previewStudentRow.vehicleNo) : undefined
  const previewVisibility = previewStudentRow ? visibilityFor(previewStudentRow) : VISIBILITY_OPTIONS[2]
  const showLocation = previewVisibility === VISIBILITY_OPTIONS[0]
  const showEta = previewVisibility !== VISIBILITY_OPTIONS[2]

  const columns: Column<typeof students[number]>[] = [
    { key: 'student', header: 'Student', sortValue: (row) => row.name, render: (row) => <span className="font-semibold">{row.name}</span> },
    { key: 'className', header: 'Class', sortValue: (row) => row.className, render: (row) => row.className || '—' },
    { key: 'routeName', header: 'Route', sortValue: (row) => row.routeName, render: (row) => row.routeName || '—' },
    { key: 'vehicleNo', header: 'Vehicle', sortValue: (row) => row.vehicleNo, render: (row) => row.vehicleNo || '—' },
    { key: 'guardian', header: 'Guardian', sortValue: (row) => row.guardian, render: (row) => row.guardian || '—' },
    {
      key: 'visibility',
      header: 'Parent sees',
      render: (row) => (
        <Select
          value={visibilityFor(row)}
          onChange={(event) => setVisibility(row, event.target.value)}
          className="w-52"
          aria-label={`Visibility for ${row.name}`}
        >
          {VISIBILITY_OPTIONS.map((option) => (<option key={option} value={option}>{option}</option>))}
        </Select>
      ),
    },
    {
      key: 'notify',
      header: 'Delay alerts',
      align: 'center',
      render: (row) => (
        <Button size="sm" variant={notifyFor(row).toLocaleLowerCase() === 'no' ? 'ghost' : 'outline'} onClick={() => toggleNotify(row)}>
          {notifyFor(row).toLocaleLowerCase() === 'no' ? 'Off' : 'On'}
        </Button>
      ),
    },
  ]

  return (
    <div className="mt-3 grid gap-3">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
          <div>
            <h3 className="text-sm font-semibold">Parent visibility</h3>
            <p className="text-[11px] text-mist">
              Control what each family can see, and whether they are alerted when the bus runs late.
              {myChildren.length ? ` Signed in as ${viewerName || 'parent'} — showing your children.` : ''}
            </p>
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder="Search students…" />
        </div>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(row) => row.studentId || row.name}
          pageSize={10}
          emptyTitle="No students on transport"
          emptyDesc="Assign students to a route under Transport → Student Assignments."
        />
      </div>

      <div className="card p-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Parent view preview</h3>
            <p className="text-[11px] text-mist">Exactly what the family sees for the selected student.</p>
          </div>
          <Field label="Preview as student">
            <Select value={previewName} onChange={(event) => setPreviewStudent(event.target.value)} className="w-56" aria-label="Preview student">
              {students.map((student) => (<option key={student.studentId || student.name} value={student.name}>{student.name}</option>))}
            </Select>
          </Field>
        </div>

        {!previewStudentRow ? (
          <p className="mt-3 text-xs text-mist">No student selected.</p>
        ) : (
          <div className="mt-3 rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{previewStudentRow.name}</p>
                <p className="text-[11px] text-mist">
                  {[previewStudentRow.className, previewStudentRow.routeName, previewStudentRow.vehicleNo].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Badge tone={previewVisibility === VISIBILITY_OPTIONS[2] ? 'zinc' : 'lime'}>{previewVisibility}</Badge>
            </div>
            {previewVisibility === VISIBILITY_OPTIONS[2] ? (
              <p className="mt-3 text-xs text-mist">Location sharing is switched off for this student.</p>
            ) : !previewVehicle ? (
              <p className="mt-3 text-xs text-mist">No live vehicle is assigned to this student's route right now.</p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-line p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-mist">Vehicle</p>
                  <p className="text-sm font-semibold">{previewVehicle.vehicleNo}</p>
                  <p className="text-[11px] text-mist">{previewVehicle.tripStatus}</p>
                </div>
                <div className="rounded-lg border border-line p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-mist">ETA to pickup</p>
                  <p className="text-sm font-semibold">{showEta ? `${previewVehicle.nextEtaMinutes} min` : 'Hidden'}</p>
                  <p className="text-[11px] text-mist">{previewVehicle.nextStop || 'Trip complete'}</p>
                </div>
                <div className="rounded-lg border border-line p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-mist">Route progress</p>
                  <p className="text-sm font-semibold">{previewVehicle.progressPct}%</p>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div className="h-full rounded-full bg-lime" style={{ width: `${previewVehicle.progressPct}%` }} />
                  </div>
                </div>
                <div className="rounded-lg border border-line p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-mist">Last known position</p>
                  <p className="text-sm font-semibold">
                    {showLocation ? `${previewVehicle.latitude.toFixed(4)}, ${previewVehicle.longitude.toFixed(4)}` : 'Hidden'}
                  </p>
                  <p className="text-[11px] text-mist">
                    {previewVehicle.latenessMinutes > 0 ? `${previewVehicle.latenessMinutes} min behind schedule` : 'On schedule'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
