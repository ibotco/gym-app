import net from 'node:net'
import tls from 'node:tls'
import type { Plugin } from 'vite'

type MailBody = {
  provider?: string
  to?: string
  name?: string
  code?: string
  subject?: string
  html?: string
  fromName?: string
  fromEmail?: string
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpPass?: string
  resendKey?: string
}

function readJson(req: { on: (e: string, fn: (c?: Buffer) => void) => void }): Promise<MailBody> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => { if (c) chunks.push(c) })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as MailBody)
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function json(res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (s: string) => void }, status: number, body: object) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

type NotifyBody = {
  channel?: string
  mode?: string
  to?: string
  message?: string
  phoneNumberId?: string
  token?: string
  webhookUrl?: string
  hubtelClientId?: string
  hubtelClientSecret?: string
  hubtelFrom?: string
}

type PaystackBody = {
  action?: string
  secretKey?: string
  email?: string
  amount?: number
  currency?: string
  reference?: string
  callbackUrl?: string
  metadata?: Record<string, unknown>
  channels?: string[]
  subaccount?: string
  splitCode?: string
  bearer?: string
  reason?: string
}

function mount(use: (fn: (req: { url?: string; method?: string }, res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (s: string) => void }, next: () => void) => void) => void) {
  use(async (req, res, next) => {
    if (req.url?.startsWith('/api/notify') && req.method === 'POST') {
      try {
        const body = await readJson(req as never) as NotifyBody
        const result = await deliverNotify(body)
        json(res, result.ok ? 200 : 400, result)
      } catch (e) {
        json(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Notify plugin failed' })
      }
      return
    }
    if (req.url?.startsWith('/api/paystack') && req.method === 'POST') {
      try {
        const body = await readJson(req as never) as PaystackBody
        const result = await deliverPaystack(body)
        json(res, result.ok ? 200 : 400, result)
      } catch (e) {
        json(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Paystack plugin failed' })
      }
      return
    }
    if (!req.url?.startsWith('/api/mail') || req.method !== 'POST') {
      next()
      return
    }
    try {
      const body = await readJson(req as never)
      const result = await deliver(body)
      json(res, result.ok ? 200 : 400, result)
    } catch (e) {
      json(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Mail plugin failed' })
    }
  })
}

async function deliverNotify(body: NotifyBody): Promise<{ ok: boolean; error?: string }> {
  const to = (body.to || '').replace(/\D/g, '')
  const message = (body.message || '').trim()
  if (!to) return { ok: false, error: 'Missing recipient number.' }
  if (!message) return { ok: false, error: 'Missing message.' }

  if (body.channel === 'whatsapp' && body.mode === 'cloud') {
    if (!body.token || !body.phoneNumberId) return { ok: false, error: 'WhatsApp Cloud API token or phone number ID is missing.' }
    const r = await fetch(`https://graph.facebook.com/v21.0/${body.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${body.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      }),
    })
    const data = await r.json().catch(() => ({})) as { error?: { message?: string } }
    if (!r.ok) return { ok: false, error: data.error?.message || `WhatsApp ${r.status}` }
    return { ok: true }
  }

  if ((body.channel === 'whatsapp' || body.channel === 'sms') && body.mode === 'webhook') {
    if (!body.webhookUrl) return { ok: false, error: 'Webhook URL is missing.' }
    const r = await fetch(body.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(body.token ? { Authorization: `Bearer ${body.token}` } : {}),
      },
      body: JSON.stringify({ to, message, channel: body.channel }),
    })
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      return { ok: false, error: t.slice(0, 180) || `Webhook ${r.status}` }
    }
    return { ok: true }
  }

  if (body.channel === 'sms' && body.mode === 'hubtel') {
    if (!body.hubtelClientId || !body.hubtelClientSecret) {
      return { ok: false, error: 'Hubtel client ID and secret are required.' }
    }
    const auth = Buffer.from(`${body.hubtelClientId}:${body.hubtelClientSecret}`).toString('base64')
    const r = await fetch('https://sms.hubtel.com/v1/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        From: body.hubtelFrom || 'FitPro',
        To: to,
        Content: message,
      }),
    })
    const data = await r.json().catch(() => ({})) as { status?: number; message?: string }
    if (!r.ok) return { ok: false, error: data.message || `Hubtel ${r.status}` }
    return { ok: true }
  }

  return { ok: false, error: 'Unknown notify channel or mode.' }
}

async function paystackApi(secret: string, path: string, init?: { method?: string; body?: unknown }) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  try {
    const r = await fetch(`https://api.paystack.co${path}`, {
      method: init?.method || 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: ctrl.signal,
    })
    const raw = await r.json().catch(() => ({})) as { status?: boolean; message?: string; data?: unknown }
    return {
      http: r.status,
      ok: r.ok && raw.status !== false,
      message: raw.message || '',
      data: raw.data,
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('Paystack timed out after 20s.')
    throw e
  } finally {
    clearTimeout(timer)
  }
}

function pesewasLabel(amount: unknown, currency = 'GHS') {
  const n = Number(amount)
  if (!Number.isFinite(n)) return ''
  return `${currency} ${(n / 100).toFixed(2)}`
}

async function deliverPaystack(body: PaystackBody): Promise<Record<string, unknown>> {
  const secret = (body.secretKey || '').trim()
  if (!secret) return { ok: false, error: 'Paystack secret key is missing.' }
  if (!/^sk_(test|live)_/i.test(secret)) return { ok: false, error: 'Secret key must start with sk_test_ or sk_live_.' }

  const action = (body.action || 'test').toLowerCase()

  if (action === 'test') {
    const r = await paystackApi(secret, '/balance')
    if (!r.ok) return { ok: false, error: r.message || `Paystack ${r.http}` }
    const rows = Array.isArray(r.data) ? r.data as { currency?: string; balance?: number }[] : []
    const balance = rows.map((b) => pesewasLabel(b.balance, b.currency || 'GHS')).filter(Boolean).join(' · ')
    return {
      ok: true,
      message: balance ? `Authentication Successful · ledger ${balance}` : 'Authentication Successful',
      balance: balance || undefined,
    }
  }

  if (action === 'initialize') {
    const email = (body.email || '').trim()
    const amount = Number(body.amount)
    if (!email || !email.includes('@')) return { ok: false, error: 'A valid customer email is required.' }
    if (!Number.isFinite(amount) || amount < 100) return { ok: false, error: 'Amount must be at least 100 pesewas (GHS 1.00).' }
    const payload: Record<string, unknown> = {
      email,
      amount,
      currency: (body.currency || 'GHS').toUpperCase(),
      reference: body.reference,
      callback_url: body.callbackUrl,
      metadata: body.metadata || {},
    }
    if (body.channels?.length) payload.channels = body.channels
    if (body.subaccount) payload.subaccount = body.subaccount
    if (body.splitCode) payload.split_code = body.splitCode
    if (body.bearer) payload.bearer = body.bearer
    const r = await paystackApi(secret, '/transaction/initialize', { method: 'POST', body: payload })
    if (!r.ok) return { ok: false, error: r.message || `Paystack ${r.http}` }
    const data = (r.data || {}) as { authorization_url?: string; access_code?: string; reference?: string }
    return {
      ok: true,
      message: r.message || 'Authorization URL created',
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code,
      reference: data.reference || body.reference,
    }
  }

  if (action === 'verify') {
    const reference = (body.reference || '').trim()
    if (!reference) return { ok: false, error: 'Missing Paystack reference.' }
    const r = await paystackApi(secret, `/transaction/verify/${encodeURIComponent(reference)}`)
    if (!r.ok) return { ok: false, error: r.message || `Paystack ${r.http}` }
    return { ok: true, message: r.message || 'Verification successful', data: r.data }
  }

  if (action === 'refund') {
    const reference = (body.reference || '').trim()
    if (!reference) return { ok: false, error: 'Missing Paystack reference to refund.' }
    const r = await paystackApi(secret, '/refund', {
      method: 'POST',
      body: { transaction: reference, merchant_note: body.reason || 'FitPro refund' },
    })
    if (!r.ok) return { ok: false, error: r.message || `Paystack ${r.http}` }
    return { ok: true, message: r.message || 'Refund queued', data: r.data }
  }

  return { ok: false, error: `Unknown Paystack action: ${action}` }
}

export function fitproMail(): Plugin {
  return {
    name: 'fitpro-mail',
    configureServer(server) {
      mount(server.middlewares.use.bind(server.middlewares))
    },
    configurePreviewServer(server) {
      mount(server.middlewares.use.bind(server.middlewares))
    },
  }
}

async function deliver(body: MailBody): Promise<{ ok: boolean; error?: string }> {
  const to = (body.to || '').trim()
  if (!to || !to.includes('@')) return { ok: false, error: 'Missing recipient email.' }

  if (body.provider === 'resend') {
    if (!body.resendKey) return { ok: false, error: 'Resend API key is missing.' }
    const from = body.fromEmail
      ? `${body.fromName || 'FitPro'} <${body.fromEmail}>`
      : 'FitPro <beth.t@example.com>'
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${body.resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: body.subject || 'Your FitPro verification code',
        html: body.html || `<p>Your code is <b>${body.code}</b></p>`,
      }),
    })
    const data = await r.json().catch(() => ({})) as { message?: string }
    if (!r.ok) return { ok: false, error: data.message || `Resend ${r.status}` }
    return { ok: true }
  }

  const host = body.smtpHost || 'smtp.gmail.com'
  const port = Number(body.smtpPort || 587)
  const user = body.smtpUser || ''
  const pass = (body.smtpPass || '').replace(/\s+/g, '')
  if (!user || !pass) return { ok: false, error: 'SMTP username or password is missing.' }

  try {
    await smtpSend({
      host,
      port,
      user,
      pass,
      fromName: body.fromName || 'FitPro',
      fromEmail: body.fromEmail || user,
      to,
      subject: body.subject || 'Your FitPro verification code',
      html: body.html || `<p>Your FitPro verification code is <b>${body.code}</b></p>`,
      text: `Your FitPro verification code is ${body.code}`,
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/535|534|authentication/i.test(msg)) {
      return { ok: false, error: 'Gmail rejected the password. Use a 16-character App Password, not your normal Gmail password.' }
    }
    return { ok: false, error: msg }
  }
}

function smtpSend(opts: {
  host: string
  port: number
  user: string
  pass: string
  fromName: string
  fromEmail: string
  to: string
  subject: string
  html: string
  text: string
}) {
  return new Promise<void>((resolve, reject) => {
    const implicitTls = opts.port === 465
    let sock: net.Socket | tls.TLSSocket = implicitTls
      ? tls.connect({ host: opts.host, port: opts.port, servername: opts.host })
      : net.connect({ host: opts.host, port: opts.port })

    let buf = ''
    let step = 0
    let done = false
    const timer = setTimeout(() => fail(new Error('Mail server timed out after 25s.')), 25000)

    function fail(err: Error) {
      if (done) return
      done = true
      clearTimeout(timer)
      try { sock.destroy() } catch { /* ignore */ }
      reject(err)
    }

    function succeed() {
      if (done) return
      done = true
      clearTimeout(timer)
      try { sock.end() } catch { /* ignore */ }
      resolve()
    }

    function write(line: string) {
      sock.write(line + '\r\n')
    }

    function onCode(code: number, text: string) {
      if (code >= 400) {
        fail(new Error(text || `SMTP ${code}`))
        return
      }
      if (step === 0) {
        step = 1
        write('EHLO fitpro.local')
        return
      }
      if (step === 1 && !implicitTls && opts.port !== 465) {
        step = 2
        write('STARTTLS')
        return
      }
      if (step === 2) {
        const plain = sock as net.Socket
        const secure = tls.connect({ socket: plain, servername: opts.host })
        sock = secure
        step = 3
        listen(secure)
        secure.once('secureConnect', () => write('EHLO fitpro.local'))
        return
      }
      if (step === 1 || step === 3) {
        step = 4
        write('AUTH LOGIN')
        return
      }
      if (step === 4) {
        step = 5
        write(Buffer.from(opts.user).toString('base64'))
        return
      }
      if (step === 5) {
        step = 6
        write(Buffer.from(opts.pass).toString('base64'))
        return
      }
      if (step === 6) {
        step = 7
        write(`MAIL FROM:<${opts.fromEmail}>`)
        return
      }
      if (step === 7) {
        step = 8
        write(`RCPT TO:<${opts.to}>`)
        return
      }
      if (step === 8) {
        step = 9
        write('DATA')
        return
      }
      if (step === 9) {
        step = 10
        const sub = /^[\x20-\x7E]*$/.test(opts.subject)
          ? opts.subject
          : `=?UTF-8?B?${Buffer.from(opts.subject).toString('base64')}?=`
        const payload = [
          `From: "${opts.fromName.replace(/"/g, '')}" <${opts.fromEmail}>`,
          `To: <${opts.to}>`,
          `Subject: ${sub}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=UTF-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          opts.html.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..'),
          '.',
        ].join('\r\n')
        sock.write(payload + '\r\n')
        return
      }
      if (step === 10) {
        write('QUIT')
        succeed()
      }
    }

    function listen(s: net.Socket | tls.TLSSocket) {
      s.setEncoding('utf8')
      s.on('data', (chunk: string) => {
        buf += chunk
        const parts = buf.split(/\r?\n/)
        buf = parts.pop() || ''
        for (const line of parts) {
          const m = /^(\d{3})([ -])(.*)$/.exec(line)
          if (!m) continue
          if (m[2] === '-') continue
          onCode(Number(m[1]), m[3] || line)
        }
      })
    }

    sock.setTimeout(25000)
    listen(sock)
    sock.on('error', fail)
    sock.on('timeout', () => fail(new Error('Mail server connection timed out.')))
  })
}
