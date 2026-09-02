import { useState } from 'react'
import { KeyRound, RefreshCw, Check, Copy } from 'lucide-react'
import { Button, Modal } from './ui'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { generateUsername, hashPassword, takenUsernames } from '../lib/password'
import { issueInitialPassword, saveReveal, loadReveal, clearReveal } from '../lib/credentials'
import { uid } from '../lib/utils'

export interface PortalSubject {
  id: string
  name: string
  email: string
  phone: string
  companyId?: string
  branchId?: string
  userId?: string
}

export function PortalAccess({
  subject,
  role,
  entity,
  onLinked,
}: {
  subject: PortalSubject
  role: 'customer' | 'supplier'
  entity: 'Customer' | 'Supplier'
  onLinked: (userId: string) => void
}) {
  const app = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [creds, setCreds] = useState<{ username: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const existingUser = subject.userId ? app.users.find((u) => u.id === subject.userId) : null

  const issue = async (regenerate = false) => {
    const name = subject.name.trim() || entity
    const email = subject.email.trim()
    if (!email) { toast.error('Missing email', `Add an email to this ${entity.toLowerCase()} first.`); return }
    const taken = app.users.some((u) => u.email.toLowerCase() === email.toLowerCase() && u.id !== subject.userId)
    if (taken) { toast.error('Email in use', 'That email already belongs to another account.'); return }

    const issued = issueInitialPassword(app.credentialSettings.initialPasswordMode || 'auto', subject.phone, app.credentialSettings.policy)
    if (!issued.ok) { toast.error('Could not issue password', issued.error); return }

    const username = existingUser?.username || generateUsername(name, takenUsernames(app.users))
    const hashed = await hashPassword(issued.password)

    const userId = subject.userId || uid('u')
    app.upsertUser({
      id: userId,
      companyId: subject.companyId,
      branchId: subject.branchId,
      name,
      email,
      phone: subject.phone,
      role,
      status: 'active',
      password: hashed,
      username,
      emailVerified: true,
      mustChangePassword: true,
      createdAt: existingUser?.createdAt || new Date().toISOString().slice(0, 10),
    })
    onLinked(userId)
    saveReveal(userId, username, issued.password)
    app.log(user?.id || 'system', regenerate ? 'CREDENTIALS' : 'CREATE', entity, `${regenerate ? 'Regenerated' : 'Issued'} portal login for ${name} (${role})`)
    setCreds({ username, password: issued.password })
  }

  const regenerate = () => void issue(true)

  const copy = async () => {
    if (!creds) return
    try {
      await navigator.clipboard.writeText(`Username: ${creds.username}\nPassword: ${creds.password}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Could not copy', 'Select the text manually.')
    }
  }

  const openModal = () => {
    setCreds(null)
    setCopied(false)
    setOpen(true)
    if (!subject.userId) void issue(false)
  }

  const closeModal = () => {
    setOpen(false)
    setCreds(null)
  }

  return (
    <>
      <button
        type="button"
        className="rounded-lg p-2 text-mist hover:text-lime"
        title={`Portal login for ${subject.name}`}
        aria-label={`Portal login for ${subject.name}`}
        onClick={openModal}
      >
        <KeyRound className="size-4" />
      </button>

      <Modal open={open} onClose={closeModal} title={`${entity} portal login — ${subject.name}`}>
        <div className="space-y-3">
          {creds ? (
            <>
              <p className="text-sm text-mist">
                This {entity.toLowerCase()} can now sign in to their portal. Share these temporary details — they&apos;ll set a new password on first login.
              </p>
              <div className="space-y-2 rounded-xl border border-white/10 p-3 font-mono text-sm">
                <div className="flex justify-between"><span className="text-mist">Username</span><span className="font-semibold">{creds.username}</span></div>
                <div className="flex justify-between"><span className="text-mist">Password</span><span className="font-semibold">{creds.password}</span></div>
                <div className="flex justify-between"><span className="text-mist">Portal</span><span className="font-semibold">{role === 'customer' ? '/customer' : '/supplier'}</span></div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" variant="outline" onClick={copy}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy details'}</Button>
                <Button className="flex-1" variant="outline" onClick={regenerate}><RefreshCw className="size-4" /> Regenerate</Button>
              </div>
            </>
          ) : existingUser ? (
            <div className="space-y-3">
              <p className="text-sm text-mist">
                {existingUser.name} already has portal access ({existingUser.email}). You can regenerate their temporary password, or revoke access by removing the link.
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void issue(true)}><RefreshCw className="size-4" /> Regenerate password</Button>
                <Button className="flex-1" variant="outline" onClick={() => { onLinked(''); app.deleteUser(existingUser.id); clearReveal(existingUser.id); app.log(user?.id || 'system', 'DELETE', entity, `Revoked portal login for ${existingUser.name}`); toast.success('Portal access revoked'); closeModal() }}>Revoke access</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-mist">Preparing login…</p>
          )}
        </div>
      </Modal>
    </>
  )
}
