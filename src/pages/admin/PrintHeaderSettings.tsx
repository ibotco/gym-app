import { useState } from 'react'
import { Save, Undo2 } from 'lucide-react'
import { Button } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { PrintHeaderForm } from '../../components/PrintHeaderForm'
import { effectivePrintHeader } from '../../lib/printHeader'
import type { PrintHeaderSettings } from '../../types'

export function PrintHeaderSettings() {
  const { company, setCompany } = useApp()
  const { user } = useAuth()
  const toast = useToast()

  const [ph, setPh] = useState<PrintHeaderSettings>(() => effectivePrintHeader(company))
  const [err, setErr] = useState('')

  const save = () => {
    if (ph.headerType === 'image' && !ph.headerImage) { setErr('Upload a header image, or switch to Text Header.'); return }
    // Company info is synced from the company profile (single source of truth),
    // so only the header type, image and footer are persisted here.
    setCompany({
      ...company,
      printHeader: {
        headerType: ph.headerType,
        headerImage: ph.headerImage,
        companyName: '',
        companyAddress: '',
        companyPhone: '',
        companyEmail: '',
        companyWebsite: '',
        taxId: undefined,
        footerContent: ph.footerContent,
        updatedBy: user?.id,
        updatedAt: new Date().toISOString(),
      },
    })
    setErr('')
    toast.success('Print header settings saved')
  }

  const cancel = () => {
    setPh(effectivePrintHeader(company))
    setErr('')
    toast.info('Changes discarded')
  }

  return (
    <div className="card mt-4 p-5">
      <p className="font-semibold">Print header settings</p>
      <p className="mb-4 mt-1 text-sm text-mist">Configure the header and footer shown on every printed document (invoices, receipts, reports, certificates, purchase orders, statements).</p>

      <PrintHeaderForm value={ph} onChange={setPh} company={company} readOnlyText />

      {err && <p className="mt-3 text-sm text-ember">{err}</p>}

      <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="outline" onClick={cancel}><Undo2 className="size-4" /> Cancel</Button>
        <Button onClick={save}><Save className="size-4" /> Save settings</Button>
      </div>
    </div>
  )
}
