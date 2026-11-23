import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './checkbox.css'
import './budget.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThemeProvider } from './context/ThemeContext'
import { I18nProvider } from './context/I18nContext'
import { AppProvider } from './context/AppContext'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { LicenseProvider } from './context/LicenseContext'
import { runNotesResetOnce } from './lib/notesReset'
import { initMysqlBridge, getAppBasePath } from './lib/mysqlBridge'
import { trustedRestore } from './lib/trustedSession'
import { runActivateAllAccountsOnce } from './lib/accountStatus'

// Global error handler — captures any uncaught errors and logs them visibly
window.addEventListener('error', (e) => {
  console.error('[GLOBAL ERROR]', e.error || e.message, e.filename, e.lineno, e.colno)
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('[UNHANDLED REJECTION]', e.reason)
})

async function bootstrap() {
  // Restore the trusted session token before NoSQL bootstrap and writes.
  await trustedRestore(getAppBasePath()).catch(() => {})
  await initMysqlBridge()
  // One-time browser/store migrations
  runNotesResetOnce()
  runActivateAllAccountsOnce()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <I18nProvider>
            <AppProvider>
              <AuthProvider>
                <ToastProvider>
                  <LicenseProvider>
                    <App />
                  </LicenseProvider>
                </ToastProvider>
              </AuthProvider>
            </AppProvider>
          </I18nProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}

void bootstrap()
