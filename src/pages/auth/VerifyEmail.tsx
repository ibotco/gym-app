import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { useAuth, roleHome } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useI18n } from '../../context/I18nContext'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { sendVerificationEmail } from '../../lib/mail'

const KEY = 'fitpro_pending_verify'
const BOXES = 6

type Pending = { email?: string; code?: string; live?: boolean }

function readPending(): Pending {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Pending
  } catch {
    return {}
  }
}

function writePending(p: Pending) {
  sessionStorage.setItem(KEY, JSON.stringify(p))
}

export function VerifyEmail() {
  const [params] = useSearchParams()
  const pending = readPending()
  const email = (params.get('email') || pending.email || '').trim()
  const { verifyEmail, resendVerification, user } = useAuth()
  const toast = useToast()
  const { t } = useI18n()
  const nav = useNavigate()

  const [digits, setDigits] = useState<string[]>(() => Array(BOXES).fill(''))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(false)
  const [wait, setWait] = useState(0)
  const [demoCode, setDemoCode] = useState(pending.code || '')
  const refs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    refs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (wait <= 0) return
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000)
    return () => window.clearTimeout(id)
  }, [wait])

  const code = digits.join('')
  const ready = code.length === BOXES && !busy && !ok

  const put = (next: string[], focusAt: number) => {
    setDigits(next)
    setErr('')
    const i = Math.max(0, Math.min(BOXES - 1, focusAt))
    queueMicrotask(() => refs.current[i]?.focus())
  }

  const fillFrom = (start: number, raw: string) => {
    const chars = raw.replace(/\D/g, '').slice(0, BOXES - start).split('')
    if (!chars.length) return
    const next = [...digits]
    chars.forEach((c, i) => { next[start + i] = c })
    put(next, start + chars.length >= BOXES ? BOXES - 1 : start + chars.length)
  }

  const submit = (value = code) => {
    if (value.length !== BOXES || busy) return
    if (!email) {
      setErr(t('verify.missing'))
      return
    }
    setBusy(true)
    const r = verifyEmail(value, email)
    setBusy(false)
    if (!r.ok) {
      setErr(r.error || t('verify.bad'))
      setDigits(Array(BOXES).fill(''))
      queueMicrotask(() => refs.current[0]?.focus())
      return
    }
    setOk(true)
    sessionStorage.removeItem(KEY)
    toast.success(t('verify.ok'))
    window.setTimeout(() => nav(user ? roleHome(user.role) : '/app'), 700)
  }

  const resend = async () => {
    if (!email || wait > 0) return
    const r = resendVerification(email)
    if (!r.ok || !r.code) {
      toast.error(r.error || t('verify.bad'))
      return
    }
    const mail = await sendVerificationEmail({ to: email, name: '', code: r.code })
    writePending({ email, code: mail.ok ? undefined : r.code, live: mail.ok })
    setDemoCode(mail.ok ? '' : r.code)
    setDigits(Array(BOXES).fill(''))
    setErr(mail.ok ? '' : (mail.error || ''))
    setWait(30)
    if (mail.ok) toast.success(t('verify.resent'))
    else toast.error('Email was not sent', mail.error)
    queueMicrotask(() => refs.current[0]?.focus())
  }

  return (
    <div className="verify-page">
      <div className="absolute right-4 top-4"><LanguageSwitcher compact /></div>
      <div className="verify-wrap">
        <div className="verify-icon" aria-hidden>
          <Mail className="size-7 text-white" strokeWidth={1.75} />
        </div>
        <h1 className="verify-title">{t('verify.title')}</h1>
        <p className="verify-sub">
          {email ? t('verify.sentTo', { email }) : t('verify.missing')}
        </p>

        <div className="verify-card">
          <div
            className="otp-row"
            onPaste={(e) => {
              e.preventDefault()
              fillFrom(0, e.clipboardData.getData('text'))
            }}
          >
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { refs.current[i] = el }}
                className="otp-box"
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                aria-label={t('verify.digit', { n: i + 1 })}
                maxLength={1}
                value={d}
                disabled={ok}
                onChange={(e) => {
                  const v = e.target.value
                  if (v.length > 1) {
                    fillFrom(i, v)
                    return
                  }
                  const ch = v.replace(/\D/g, '').slice(-1)
                  const next = [...digits]
                  next[i] = ch
                  put(next, ch ? i + 1 : i)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace') {
                    e.preventDefault()
                    const next = [...digits]
                    if (next[i]) {
                      next[i] = ''
                      put(next, i)
                    } else {
                      next[Math.max(0, i - 1)] = ''
                      put(next, i - 1)
                    }
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault()
                    refs.current[Math.max(0, i - 1)]?.focus()
                  } else if (e.key === 'ArrowRight') {
                    e.preventDefault()
                    refs.current[Math.min(BOXES - 1, i + 1)]?.focus()
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    submit()
                  }
                }}
              />
            ))}
          </div>

          {err && <p className="verify-err">{err}</p>}

          <button
            type="button"
            className="verify-btn"
            disabled={!ready}
            onClick={() => submit()}
          >
            {ok ? t('verify.ok') : t('verify.btn')}
          </button>

          <p className="verify-help">
            {t('verify.noCode')}{' '}
            <button type="button" className="verify-resend" onClick={resend} disabled={wait > 0 || !email}>
              {wait > 0 ? t('verify.wait', { n: wait }) : t('verify.resend')}
            </button>
          </p>
        </div>

        {demoCode && (
          <p className="verify-demo">
            {t('verify.demo', { code: demoCode })}
          </p>
        )}

        <p className="verify-back">
          <Link to="/login">{t('signIn')}</Link>
        </p>
      </div>
    </div>
  )
}
