/**
 * Transport GPS tracking engine.
 *
 * There is no live telematics feed in the app, so vehicle positions are *simulated*
 * deterministically from each Route's stoppages and timetable: a vehicle departs the first
 * stop at its scheduled time, dwells at every stop, and interpolates between them. The same
 * maths works for positions reported manually (or by a real feed later), so switching the
 * data source never changes the map, alerts or reporting.
 */

import type { EduRecords, EduRow } from './eduRecords'

export type GeoPoint = { lat: number; lng: number }

export type RouteStopPoint = {
  name: string
  time: string
  latitude: number | null
  longitude: number | null
  distance: string
  routeFare: string
}

export type RoutePath = {
  routeName: string
  stops: (RouteStopPoint & GeoPoint)[]
  totalKm: number
}

/** Accra city centre — the fallback anchor when a Route has no stored coordinates. */
export const DEFAULT_MAP_CENTER: GeoPoint = { lat: 5.6037, lng: -0.187 }

const EARTH_RADIUS_KM = 6371
const toRad = (value: number) => (value * Math.PI) / 180

export const haversineKm = (a: GeoPoint, b: GeoPoint): number => {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Stable 0→1 hash so a route/stop always lands in the same place on the fallback map. */
const hashUnit = (value: string): number => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 10000) / 10000
}

export const parseStopTime = (value: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? '').trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

export const formatMinutes = (minutes: number): string => {
  const total = Math.max(0, Math.round(minutes))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Reads the Route → routeStops rows, including the optional latitude / longitude columns. */
export const parseRouteStops = (value: unknown): RouteStopPoint[] => {
  const raw = String(value ?? '').trim()
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item): RouteStopPoint[] => {
      if (!item || typeof item !== 'object') return []
      const row = item as Record<string, unknown>
      const latitude = Number(row.latitude ?? row.lat ?? NaN)
      const longitude = Number(row.longitude ?? row.lng ?? NaN)
      return [{
        name: String(row.stoppageName ?? row.name ?? '').trim(),
        time: String(row.stopTime ?? row.pickupTime ?? '').trim(),
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        distance: String(row.distance ?? '').trim(),
        routeFare: String(row.routeFare ?? row.fare ?? '').trim(),
      }]
    })
  } catch {
    return []
  }
}

/** Coordinates for a stop: stored value, else a deterministic point around the city anchor. */
export const stopPointFor = (
  routeName: string,
  stopName: string,
  index: number,
  total: number,
  stored: { latitude: number | null; longitude: number | null },
): GeoPoint => {
  if (stored.latitude !== null && stored.longitude !== null) {
    return { lat: stored.latitude, lng: stored.longitude }
  }
  const seed = hashUnit(`${routeName}|${stopName}|${index}`)
  const spread = 0.010 + total * 0.0022
  const angle = (index / Math.max(1, total - 1)) * Math.PI * 1.5 + (seed - 0.5) * 0.5
  const radius = spread * (0.65 + seed * 0.5)
  return {
    lat: DEFAULT_MAP_CENTER.lat + Math.sin(angle) * radius,
    lng: DEFAULT_MAP_CENTER.lng + Math.cos(angle) * radius * 1.25,
  }
}

/** Full geometry for a route: ordered stops with coordinates plus total length. */
export const routePathFor = (records: EduRecords, routeName: string): RoutePath => {
  const route = (records.transportRoutes ?? []).find((row) => String(row.routeName ?? '').trim() === routeName.trim())
  const stops = parseRouteStops(route?.routeStops).filter((stop) => stop.name)
  const fallbackNames = String(route?.pickupPoints ?? '')
    .split(/[\n,]+/).map((part) => part.trim()).filter(Boolean)
  const source = stops.length
    ? stops
    : fallbackNames.map((name) => ({ name, time: '', latitude: null, longitude: null, distance: '', routeFare: '' }))
  const points = source.map((stop, index) => ({
    ...stop,
    ...stopPointFor(routeName, stop.name, index, source.length, { latitude: stop.latitude, longitude: stop.longitude }),
  }))
  let totalKm = 0
  for (let i = 1; i < points.length; i++) totalKm += haversineKm(points[i - 1], points[i])
  return { routeName, stops: points, totalKm }
}

/** Shortest distance (metres) from a point to the route polyline — used for deviation alerts. */
export const distanceToPathMeters = (point: GeoPoint, path: GeoPoint[]): number => {
  if (!path.length) return 0
  if (path.length === 1) return haversineKm(point, path[0]) * 1000
  let best = Number.POSITIVE_INFINITY
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    const abLat = b.lat - a.lat
    const abLng = b.lng - a.lng
    const lengthSq = abLat * abLat + abLng * abLng
    let t = lengthSq === 0 ? 0 : ((point.lat - a.lat) * abLat + (point.lng - a.lng) * abLng) / lengthSq
    t = Math.max(0, Math.min(1, t))
    const projected: GeoPoint = { lat: a.lat + t * abLat, lng: a.lng + t * abLng }
    best = Math.min(best, haversineKm(point, projected) * 1000)
  }
  return best
}

export type StopEta = {
  name: string
  scheduledTime: string
  etaMinutes: number
  state: 'Done' | 'Current' | 'Next' | 'Upcoming'
}

export type VehicleLiveState = {
  vehicleNo: string
  routeName: string
  tripStatus: 'Not started' | 'At stop' | 'En route' | 'Completed' | 'Idle'
  latitude: number
  longitude: number
  speedKmh: number
  progressPct: number
  nextStop: string
  nextEtaMinutes: number
  currentStop: string
  dwellSeconds: number
  distanceCoveredKm: number
  totalKm: number
  deviationMeters: number
  offRoute: boolean
  latenessMinutes: number
  stopEtas: StopEta[]
  lastUpdate: string
}

const DWELL_BASE_SECONDS = 75
const dwellSecondsFor = (vehicleNo: string, stopName: string) =>
  DWELL_BASE_SECONDS + Math.round(hashUnit(`${vehicleNo}|${stopName}|dwell`) * 90)

/**
 * Where a vehicle is right now. Pure function of (route timetable, wall clock) so every
 * viewer sees the same thing and the value can be recomputed after a refresh.
 */
export const simulateVehicule = (
  records: EduRecords,
  vehicleNo: string,
  routeName: string,
  now: Date,
): VehicleLiveState => {
  const path = routePathFor(records, routeName)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const secondsIntoDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  const base: VehicleLiveState = {
    vehicleNo,
    routeName,
    tripStatus: 'Idle',
    latitude: path.stops[0]?.lat ?? DEFAULT_MAP_CENTER.lat,
    longitude: path.stops[0]?.lng ?? DEFAULT_MAP_CENTER.lng,
    speedKmh: 0,
    progressPct: 0,
    nextStop: path.stops[0]?.name ?? '',
    nextEtaMinutes: 0,
    currentStop: '',
    dwellSeconds: 0,
    distanceCoveredKm: 0,
    totalKm: path.totalKm,
    deviationMeters: 0,
    offRoute: false,
    latenessMinutes: 0,
    stopEtas: [],
    lastUpdate: now.toISOString(),
  }
  if (path.stops.length === 0) return base

  // Scheduled arrival at each stop: its own timetable time, or spaced out from the first stop.
  const schedule = path.stops.map((stop, index) => {
    const parsed = parseStopTime(stop.time)
    if (parsed !== null) return parsed
    const first = parseStopTime(path.stops[0]?.time ?? '')
    return (first ?? 6 * 60) + index * 12
  })
  const dwell = path.stops.map((stop) => dwellSecondsFor(vehicleNo, stop.name))
  const departure = schedule.map((time, index) => time + dwell[index] / 60)

  const stopEtas: StopEta[] = path.stops.map((stop, index) => {
    const delta = schedule[index] - nowMinutes
    return {
      name: stop.name,
      scheduledTime: stop.time || formatMinutes(schedule[index]),
      etaMinutes: Math.max(0, delta),
      state: nowMinutes > departure[index] ? 'Done' : index === 0 && nowMinutes < schedule[0] ? 'Upcoming' : 'Upcoming',
    }
  })

  if (nowMinutes < schedule[0]) {
    const waitMinutes = schedule[0] - nowMinutes
    return {
      ...base,
      tripStatus: 'Not started',
      nextStop: path.stops[0]?.name ?? '',
      nextEtaMinutes: waitMinutes,
      stopEtas: stopEtas.map((eta) => ({ ...eta, state: 'Upcoming' })),
    }
  }
  const lastIndex = path.stops.length - 1
  if (nowMinutes > departure[lastIndex]) {
    return {
      ...base,
      tripStatus: 'Completed',
      latitude: path.stops[lastIndex].lat,
      longitude: path.stops[lastIndex].lng,
      progressPct: 100,
      distanceCoveredKm: path.totalKm,
      currentStop: path.stops[lastIndex].name,
      nextStop: '',
      stopEtas: stopEtas.map((eta) => ({ ...eta, state: 'Done' })),
    }
  }

  // Locate the segment: dwelling at a stop, or driving between two stops.
  let index = 0
  for (let i = 0; i < path.stops.length; i++) {
    if (secondsIntoDay >= schedule[i] * 60 && secondsIntoDay <= departure[i] * 60) { index = i; break }
    if (i < lastIndex && secondsIntoDay > departure[i] * 60 && secondsIntoDay < schedule[i + 1] * 60) { index = i; break }
    if (secondsIntoDay > departure[i] * 60) index = i
  }
  const atStop = secondsIntoDay >= schedule[index] * 60 && secondsIntoDay <= departure[index] * 60
  const coveredBefore = path.stops.slice(1, index + 1).reduce((sum, stop, i) => sum + haversineKm(path.stops[i], stop), 0)

  let lat = path.stops[index].lat
  let lng = path.stops[index].lng
  let speedKmh = 0
  let coveredKm = coveredBefore
  let dwellSeconds = 0

  if (atStop) {
    dwellSeconds = Math.round(secondsIntoDay - schedule[index] * 60)
  } else if (index < lastIndex) {
    const startSeconds = departure[index] * 60
    const endSeconds = schedule[index + 1] * 60
    const span = Math.max(60, endSeconds - startSeconds)
    const ratio = Math.max(0, Math.min(1, (secondsIntoDay - startSeconds) / span))
    const from = path.stops[index]
    const to = path.stops[index + 1]
    // Small deterministic lateral wobble so the vehicle never looks pinned to the line.
    const wobble = (hashUnit(`${vehicleNo}|${index}|${Math.floor(nowMinutes / 5)}`) - 0.5) * 0.0008
    lat = from.lat + (to.lat - from.lat) * ratio + wobble
    lng = from.lng + (to.lng - from.lng) * ratio - wobble
    const legKm = haversineKm(from, to)
    coveredKm = coveredBefore + legKm * ratio
    speedKmh = Math.round(((legKm / (span / 3600)) * (0.85 + hashUnit(`${vehicleNo}|speed|${index}`) * 0.3)) * 10) / 10
  }

  const nextIndex = index < lastIndex ? index + 1 : lastIndex
  const nextEtaMinutes = Math.max(0, Math.round(schedule[nextIndex] - nowMinutes))
  const progressPct = path.totalKm > 0 ? Math.min(100, Math.round((coveredKm / path.totalKm) * 100)) : 0
  const scheduledNow = atStop ? schedule[index] : schedule[nextIndex]
  const latenessMinutes = Math.max(0, Math.round(nowMinutes - scheduledNow))

  const resolvedEtas = stopEtas.map((eta, i) => ({
    ...eta,
    state: (i < index || (i === index && atStop && dwellSeconds > 30) ? 'Done'
      : i === index && atStop ? 'Current'
        : i === nextIndex ? 'Next'
          : 'Upcoming') as StopEta['state'],
  }))

  return {
    ...base,
    tripStatus: atStop ? 'At stop' : 'En route',
    latitude: lat,
    longitude: lng,
    speedKmh,
    progressPct,
    currentStop: atStop ? path.stops[index].name : '',
    nextStop: index < lastIndex ? path.stops[nextIndex].name : path.stops[lastIndex].name,
    nextEtaMinutes,
    dwellSeconds,
    distanceCoveredKm: Math.round(coveredKm * 100) / 100,
    latenessMinutes,
    stopEtas: resolvedEtas,
  }
}

/** Every active Route → Vehicle assignment (the fleet the map tracks). */
export const activeVehicleAssignments = (records: EduRecords): { vehicleNo: string; routeName: string }[] => {
  const activeRoutes = new Set((records.transportRoutes ?? [])
    .filter((row) => String(row.status ?? 'Active').trim().toLocaleLowerCase() !== 'inactive')
    .map((row) => String(row.routeName ?? '').trim()))
  const activeVehicles = new Set((records.transportVehicles ?? [])
    .filter((row) => String(row.status ?? 'Active').trim().toLocaleLowerCase() === 'active')
    .map((row) => String(row.vehicleNo ?? '').trim()))
  const seen = new Set<string>()
  const rows: { vehicleNo: string; routeName: string }[] = []
  for (const row of records.transportVehicleAssignments ?? []) {
    if (String(row.status ?? 'Active').trim().toLocaleLowerCase() === 'inactive') continue
    const vehicleNo = String(row.vehicleNo ?? '').trim()
    const routeName = String(row.routeName ?? '').trim()
    if (!vehicleNo || !routeName) continue
    if (!activeVehicles.has(vehicleNo) || !activeRoutes.has(routeName)) continue
    const key = `${vehicleNo}|${routeName}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ vehicleNo, routeName })
  }
  return rows
}

export const simulateFleet = (records: EduRecords, now: Date): VehicleLiveState[] =>
  activeVehicleAssignments(records).map(({ vehicleNo, routeName }) => simulateVehicule(records, vehicleNo, routeName, now))

/* ---------------------------------- geofences ---------------------------------- */

export type GeofenceRow = EduRow & {
  name: string
  type: string
  latitude: string
  longitude: string
  radiusMeters: string
  routeName: string
  active: string
}

export const geofenceCenter = (fence: EduRow): GeoPoint | null => {
  const lat = Number(fence.latitude)
  const lng = Number(fence.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

export const geofenceRadius = (fence: EduRow): number => {
  const radius = Number(fence.radiusMeters)
  return Number.isFinite(radius) && radius > 0 ? radius : 150
}

export const activeGeofences = (records: EduRecords): EduRow[] =>
  (records.transportGeofences ?? []).filter((row) => String(row.active ?? 'Yes').trim().toLocaleLowerCase() !== 'no')

export const geofencesContaining = (records: EduRecords, point: GeoPoint): string[] =>
  activeGeofences(records).flatMap((fence) => {
    if (String(fence.active ?? 'Yes').trim().toLocaleLowerCase() === 'no') return []
    const center = geofenceCenter(fence)
    if (!center) return []
    return haversineKm(center, point) * 1000 <= geofenceRadius(fence) ? [String(fence.name ?? '').trim()] : []
  })

export const geofenceColors: Record<string, string> = {
  School: '#22c55e',
  Stop: '#0ea5e9',
  Depot: '#f59e0b',
  Hazard: '#ef4444',
  Custom: '#a855f7',
}

/* ---------------------------------- settings ---------------------------------- */

export type MapStyle = 'Street' | 'Light' | 'Satellite'

/** Basemap providers that serve browser apps without an API key (OSM's own tiles return 403). */
export const MAP_TILE_LAYERS: Record<MapStyle, { url: string; subdomains: string; attribution: string; maxZoom: number }> = {
  Street: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 20,
  },
  Light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 20,
  },
  Satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    subdomains: 'abcd',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
}

export const MAP_STYLES: MapStyle[] = ['Street', 'Light', 'Satellite']

export type GpsSettings = {
  demoMode: boolean
  recordPings: boolean
  mapStyle: MapStyle
  pollSeconds: number
  speedLimitKmh: number
  deviationMeters: number
  geofenceRadiusMeters: number
  shareLiveLocation: boolean
  shareEta: boolean
  notifyParentsOnDelay: boolean
  delayThresholdMinutes: number
}

export const DEFAULT_GPS_SETTINGS: GpsSettings = {
  demoMode: true,
  recordPings: true,
  mapStyle: 'Street',
  pollSeconds: 15,
  speedLimitKmh: 60,
  deviationMeters: 250,
  geofenceRadiusMeters: 150,
  shareLiveLocation: true,
  shareEta: true,
  notifyParentsOnDelay: true,
  delayThresholdMinutes: 10,
}

export const readGpsSettings = (records: EduRecords): GpsSettings => {
  const row = (records.transportGpsSettings ?? [])[0]
  if (!row) return { ...DEFAULT_GPS_SETTINGS }
  const number = (value: unknown, fallback: number) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }
  const flag = (value: unknown, fallback: boolean) => {
    const text = String(value ?? '').trim().toLocaleLowerCase()
    if (!text) return fallback
    return text === 'yes' || text === 'on' || text === 'true'
  }
  const style = String(row.mapStyle ?? '').trim() as MapStyle
  return {
    demoMode: flag(row.demoMode, DEFAULT_GPS_SETTINGS.demoMode),
    recordPings: flag(row.recordPings, DEFAULT_GPS_SETTINGS.recordPings),
    mapStyle: MAP_STYLES.includes(style) ? style : DEFAULT_GPS_SETTINGS.mapStyle,
    pollSeconds: number(row.pollSeconds, DEFAULT_GPS_SETTINGS.pollSeconds),
    speedLimitKmh: number(row.speedLimitKmh, DEFAULT_GPS_SETTINGS.speedLimitKmh),
    deviationMeters: number(row.deviationMeters, DEFAULT_GPS_SETTINGS.deviationMeters),
    geofenceRadiusMeters: number(row.geofenceRadiusMeters, DEFAULT_GPS_SETTINGS.geofenceRadiusMeters),
    shareLiveLocation: flag(row.shareLiveLocation, DEFAULT_GPS_SETTINGS.shareLiveLocation),
    shareEta: flag(row.shareEta, DEFAULT_GPS_SETTINGS.shareEta),
    notifyParentsOnDelay: flag(row.notifyParentsOnDelay, DEFAULT_GPS_SETTINGS.notifyParentsOnDelay),
    delayThresholdMinutes: number(row.delayThresholdMinutes, DEFAULT_GPS_SETTINGS.delayThresholdMinutes),
  }
}

/* ---------------------------------- alerts ---------------------------------- */

export const GPS_ALERT_TYPES = [
  'Route Deviation',
  'Overspeed',
  'Breakdown',
  'Geofence Entry',
  'Geofence Exit',
  'Long Stoppage',
  'Device Offline',
  'SOS',
] as const

export type GpsAlertDraft = {
  type: string
  severity: 'Info' | 'Warning' | 'Critical'
  vehicleNo: string
  routeName: string
  message: string
  latitude?: number | null
  longitude?: number | null
}

export const alertSeverityTone = (severity: string): 'rose' | 'amber' | 'sky' => {
  const value = severity.trim().toLocaleLowerCase()
  if (value === 'critical') return 'rose'
  if (value === 'warning') return 'amber'
  return 'sky'
}

/** Evaluate the fleet and return only alerts that are not already open for today. */
export const evaluateFleetAlerts = (
  records: EduRecords,
  settings: GpsSettings,
  now: Date,
): GpsAlertDraft[] => {
  const today = now.toISOString().slice(0, 10)
  const existing = new Set((records.transportGpsAlerts ?? [])
    .filter((row) => String(row.date ?? '').trim() === today)
    .map((row) => `${String(row.vehicleNo ?? '').trim()}|${String(row.type ?? '').trim()}`))
  const drafts: GpsAlertDraft[] = []
  for (const state of simulateFleet(records, now)) {
    const path = routePathFor(records, state.routeName)
    const deviation = distanceToPathMeters({ lat: state.latitude, lng: state.longitude }, path.stops)
    if (deviation > settings.deviationMeters && !existing.has(`${state.vehicleNo}|Route Deviation`)) {
      drafts.push({
        type: 'Route Deviation',
        severity: 'Warning',
        vehicleNo: state.vehicleNo,
        routeName: state.routeName,
        latitude: state.latitude,
        longitude: state.longitude,
        message: `${state.vehicleNo} is about ${Math.round(deviation)} m off the ${state.routeName} path.`,
      })
    }
    if (state.speedKmh > settings.speedLimitKmh && !existing.has(`${state.vehicleNo}|Overspeed`)) {
      drafts.push({
        type: 'Overspeed',
        severity: 'Warning',
        vehicleNo: state.vehicleNo,
        routeName: state.routeName,
        latitude: state.latitude,
        longitude: state.longitude,
        message: `${state.vehicleNo} reached ${state.speedKmh.toFixed(0)} km/h (limit ${settings.speedLimitKmh} km/h).`,
      })
    }
    if (state.dwellSeconds > 300 && !existing.has(`${state.vehicleNo}|Long Stoppage`)) {
      drafts.push({
        type: 'Long Stoppage',
        severity: 'Info',
        vehicleNo: state.vehicleNo,
        routeName: state.routeName,
        latitude: state.latitude,
        longitude: state.longitude,
        message: `${state.vehicleNo} has been stopped at ${state.currentStop || 'a stop'} for ${Math.round(state.dwellSeconds / 60)} minutes.`,
      })
    }
    if (settings.notifyParentsOnDelay && state.latenessMinutes >= settings.delayThresholdMinutes
      && !existing.has(`${state.vehicleNo}|Delayed`)) {
      drafts.push({
        type: 'Delayed',
        severity: 'Info',
        vehicleNo: state.vehicleNo,
        routeName: state.routeName,
        message: `${state.vehicleNo} is running about ${state.latenessMinutes} minutes late on ${state.routeName}.`,
      })
    }
  }
  return drafts
}

/* ---------------------------------- history ---------------------------------- */

export type GpsTripSummary = {
  key: string
  date: string
  vehicleNo: string
  routeName: string
  trip: string
  startTime: string
  endTime: string
  durationMinutes: number
  distanceKm: number
  avgSpeedKmh: number
  maxSpeedKmh: number
  stopsCompleted: number
  pings: number
}

/** Groups tracking pings into one trip per vehicle / route / trip / day for reporting. */
export const summarizeTrips = (records: EduRecords): GpsTripSummary[] => {
  const groups = new Map<string, EduRow[]>()
  for (const row of records.transportGpsLogs ?? []) {
    const key = [
      String(row.date ?? '').trim(),
      String(row.vehicleNo ?? '').trim(),
      String(row.routeName ?? '').trim(),
      String(row.trip ?? '').trim(),
    ].join('|')
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  const summaries: GpsTripSummary[] = []
  for (const [key, rows] of groups) {
    const ordered = [...rows].sort((a, b) => String(a.time ?? '').localeCompare(String(b.time ?? '')))
    const points = ordered.flatMap((row): GeoPoint[] => {
      const lat = Number(row.latitude)
      const lng = Number(row.longitude)
      return Number.isFinite(lat) && Number.isFinite(lng) ? [{ lat, lng }] : []
    })
    let distanceKm = 0
    for (let i = 1; i < points.length; i++) distanceKm += haversineKm(points[i - 1], points[i])
    const speeds = ordered.map((row) => Number(row.speedKmh ?? 0)).filter((value) => Number.isFinite(value))
    const startMinutes = parseStopTime(String(ordered[0]?.time ?? '')) ?? 0
    const endMinutes = parseStopTime(String(ordered[ordered.length - 1]?.time ?? '')) ?? startMinutes
    const [date, vehicleNo, routeName, trip] = key.split('|')
    summaries.push({
      key,
      date,
      vehicleNo,
      routeName,
      trip,
      startTime: String(ordered[0]?.time ?? '').trim(),
      endTime: String(ordered[ordered.length - 1]?.time ?? '').trim(),
      durationMinutes: Math.max(0, endMinutes - startMinutes),
      distanceKm: Math.round(distanceKm * 100) / 100,
      avgSpeedKmh: speeds.length ? Math.round((speeds.reduce((a, b) => a + b, 0) / speeds.length) * 10) / 10 : 0,
      maxSpeedKmh: speeds.length ? Math.round(Math.max(...speeds) * 10) / 10 : 0,
      stopsCompleted: new Set(ordered.map((row) => String(row.stopName ?? '').trim()).filter(Boolean)).size,
      pings: ordered.length,
    })
  }
  return summaries.sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`))
}
