import React from 'react'
import ReactDOM from 'react-dom/client'
import { Router } from './Router.tsx'
import './index.css'
import './styles/pindou-theme.css'
import './styles/nookui-theme.css'

const root = document.getElementById('root')!
root.classList.add('nookui')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
)
