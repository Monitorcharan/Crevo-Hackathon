import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './Portfolio.jsx'
import './style.css'
import './theme.css'
import { StudioMotionProvider } from './StudioMotion.jsx'
createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><StudioMotionProvider><App /></StudioMotionProvider></BrowserRouter></React.StrictMode>)

import './brand.css'

import './crevo-assistant-companion.css'

import './studio.css'
import './creator-evidence.css'
