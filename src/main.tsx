import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import SectionFallback from './components/SectionFallback.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Last line of defence, for crashes outside the per-section boundaries in App. */}
    <ErrorBoundary
      name="app"
      fallback={(p) => (
        <main className="narrow">
          <SectionFallback {...p} title="Something went wrong">
            Your habits are saved in the database. Try again, or reload the page.
          </SectionFallback>
        </main>
      )}
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
