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
