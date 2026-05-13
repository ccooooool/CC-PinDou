import React from 'react'
import ReactDOM from 'react-dom/client'
import { Router } from './Router.tsx'
import { Toaster } from './components/ui/toast'
import './styles/pindou-theme.css'
import './styles/nookui-theme.css'
import 'nes.css/css/nes.min.css'
import './index.css'

const root = document.getElementById('root')!
root.classList.add('nookui')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Router />
    <Toaster />
  </React.StrictMode>,
)
