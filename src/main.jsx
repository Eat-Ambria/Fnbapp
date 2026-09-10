import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ErrorBoundary } from './components/SharedUI.jsx'

// The boundary sits OUTSIDE <App>, not just around the active screen. A throw
// in App's own render — state updaters, effects, the shell — used to escape
// every boundary and leave React rendering nothing at all, which showed as a
// blank page with no error to report. Now it always renders the error card.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
