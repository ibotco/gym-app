const PROMOTION_DOCUMENT_DB = 'fitpro_employee_promotion_documents_v1'
const STORE_NAME = 'documents'

interface StoredPromotionDocument {
  storageKey: string
  blob: Blob
  fileName: string
  mimeType: string
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser does not support local document storage.'))
      return
    }
    const request = indexedDB.open(PROMOTION_DOCUMENT_DB, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'storageKey' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Unable to open promotion document storage.'))
  })
}

export async function savePromotionDocument(storageKey: string, file: File): Promise<void> {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put({
        storageKey,
        blob: file,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
      } satisfies StoredPromotionDocument)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error || new Error('Unable to save promotion document.'))
      transaction.onabort = () => reject(transaction.error || new Error('Promotion document save was cancelled.'))
    })
  } finally {
    database.close()
  }
}

export async function getPromotionDocument(storageKey: string): Promise<StoredPromotionDocument | undefined> {
  const database = await openDatabase()
  try {
    return await new Promise<StoredPromotionDocument | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(storageKey)
      request.onsuccess = () => resolve(request.result as StoredPromotionDocument | undefined)
      request.onerror = () => reject(request.error || new Error('Unable to read promotion document.'))
    })
  } finally {
    database.close()
  }
}

export interface PromotionDocumentPreview {
  fileName: string
  mimeType: string
  sizeBytes: number
}

export interface PromotionDocumentBackup extends PromotionDocumentPreview {
  storageKey: string
  /** Base64-encoded attachment bytes, making the JSON backup self-contained. */
  dataBase64: string
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

/** Export full attachment content for a recoverable JSON backup. */
export async function exportPromotionDocuments(): Promise<PromotionDocumentBackup[]> {
  if (typeof indexedDB === 'undefined') return []
  const database = await openDatabase()
  try {
    const rows = await new Promise<StoredPromotionDocument[]>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
      request.onsuccess = () => resolve(request.result as StoredPromotionDocument[])
      request.onerror = () => reject(request.error || new Error('Unable to export promotion documents.'))
    })
    return await Promise.all(rows.map(async (document) => {
      const blob = document.blob
      if (!(blob instanceof Blob)) throw new Error(`Promotion document “${document.fileName}” is missing its file data.`)
      return {
        storageKey: document.storageKey,
        fileName: document.fileName,
        mimeType: document.mimeType || blob.type || 'application/octet-stream',
        sizeBytes: blob.size,
        dataBase64: encodeBase64(new Uint8Array(await blob.arrayBuffer())),
      }
    }))
  } finally {
    database.close()
  }
}

/** Metadata only: the file bytes stay private and are never rendered in the preview list. */
export async function listPromotionDocumentPreviews(): Promise<PromotionDocumentPreview[]> {
  let database: IDBDatabase
  try { database = await openDatabase() } catch { return [] }
  try {
    return await new Promise<PromotionDocumentPreview[]>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
      request.onsuccess = () => {
        const rows = (request.result as StoredPromotionDocument[]).map((document) => ({
          fileName: document.fileName,
          mimeType: document.mimeType,
          sizeBytes: document.blob?.size ?? 0,
        }))
        resolve(rows)
      }
      request.onerror = () => reject(request.error || new Error('Unable to list promotion documents.'))
    })
  } catch {
    return []
  } finally {
    database.close()
  }
}

/** Remove every stored promotion attachment when its parent collection is reset. */
export async function clearAllPromotionDocuments(): Promise<boolean> {
  let database: IDBDatabase
  try { database = await openDatabase() } catch { return typeof indexedDB === 'undefined' }
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).clear()
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error || new Error('Unable to clear promotion documents.'))
      transaction.onabort = () => reject(transaction.error || new Error('Promotion document clear was cancelled.'))
    })
    return true
  } catch {
    return false
  } finally {
    database.close()
  }
}

export async function deletePromotionDocument(storageKey: string): Promise<void> {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).delete(storageKey)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error || new Error('Unable to delete promotion document.'))
    })
  } finally {
    database.close()
  }
}
