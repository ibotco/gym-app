import { Button, Field, Select } from './ui'
import { useToast } from '../context/ToastContext'
import { ANIMATIONS, DURATIONS, POSITIONS, type AlertAnimation, type AlertDuration, type AlertPosition } from '../lib/notify'

export function NotifySettings() {
  const toast = useToast()
  const { prefs, setPrefs } = toast

  return (
    <div className="card max-w-2xl space-y-4 p-5">
      <div>
        <p className="font-semibold">Notification settings</p>
        <p className="mt-1 text-sm text-mist">
          Controls every save, update, warning, and error popup. Default position is Top Right. Preferences stay on this device.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-white/10 p-3">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-[#c8f542]"
          checked={prefs.enabled}
          onChange={(e) => setPrefs({ ...prefs, enabled: e.target.checked })}
        />
        <span>
          <span className="font-semibold">Show popup notifications</span>
          <span className="mt-1 block text-sm text-mist">Turn off to hide all toast alerts. In-app inbox messages are not affected.</span>
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Position">
          <Select
            value={prefs.position}
            onChange={(e) => setPrefs({ ...prefs, position: e.target.value as AlertPosition })}
          >
            {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </Field>
        <Field label="Display duration">
          <Select
            value={String(prefs.duration)}
            onChange={(e) => setPrefs({ ...prefs, duration: Number(e.target.value) as AlertDuration })}
          >
            {DURATIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </Select>
        </Field>
        <Field label="Animation">
          <Select
            value={prefs.animation}
            onChange={(e) => setPrefs({ ...prefs, animation: e.target.value as AlertAnimation })}
          >
            {ANIMATIONS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </Select>
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => toast.success('Settings saved', 'Alerts will use these options.')}>Save & preview success</Button>
        <Button variant="outline" onClick={() => toast.update('Record updated', 'This is an update confirmation.')}>Update</Button>
        <Button variant="outline" onClick={() => toast.warning('Check this', 'This is a warning.')}>Warning</Button>
        <Button variant="outline" onClick={() => toast.info('Heads up', 'This is information.')}>Info</Button>
        <Button variant="danger" onClick={() => toast.error('Something failed', 'This is an error.')}>Error</Button>
      </div>
    </div>
  )
}
