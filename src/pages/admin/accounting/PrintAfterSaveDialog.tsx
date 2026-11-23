import { Printer } from 'lucide-react'
import { Button, Modal } from '../../../components/ui'

/** Print is optional and never performs the save a second time. */
export function PrintAfterSaveDialog({open,number,status,kind,ready,onClose,onPrint}:{open:boolean;number:string;status:string;kind:'income'|'expense';ready:boolean;onClose:()=>void;onPrint:()=>void}) {
 return <Modal open={open} onClose={onClose} title="Print voucher?">
  <div className="space-y-4"><p className="text-sm">Would you like to print the {kind === 'income' ? 'receipt voucher' : 'payment voucher'} for <strong>{number}</strong>?</p>
   {status !== 'posted' && <p className="text-sm text-amber-600">This voucher is a {status || 'draft'} and has not been posted. The printout will show its status.</p>}
   <p className="text-xs text-mist">Saving and database sync are separate; printing does not confirm a bank transfer or server sync.</p>
   {!ready && <p className="text-xs text-mist">Waiting for the saved record to appear…</p>}
   <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>No, close</Button><Button disabled={!ready} onClick={onPrint}><Printer className="size-4"/> Yes, print</Button></div>
  </div>
 </Modal>
}
