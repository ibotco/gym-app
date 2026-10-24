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
import { runActivateAllAccountsOnce } from './lib/accountStatus'

// Clear any sample Accounts Note data left in this browser before the app reads
// its stores. Runs once — afterwards the notes are whatever you enter yourself.
runNotesResetOnce()

// Every account in the Chart of Accounts is Active: the seeds ship that way, and
// this once-per-browser pass switches on any row an older store left inactive.
// It never runs again, so deactivating an account later sticks.
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
