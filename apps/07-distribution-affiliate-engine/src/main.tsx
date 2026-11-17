import React from 'react'
import ReactDOM from 'react-dom/client'
import { AureliaAuthProvider, RequireSession } from '@aurelia/core/auth'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AureliaAuthProvider>
      <RequireSession appName="Distribution & Affiliate Engine">
        <App />
      </RequireSession>
    </AureliaAuthProvider>
  </React.StrictMode>,
)
