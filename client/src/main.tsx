import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@design-systems/theme'
import { ColorScheme } from '@ids-tokens/enums'
import '@design-tokens/intuit/dist/web/css/foundations/light/tokens.css'
import '@ids-ts/menu/dist/main.css'
import '@ids-ts/dropdown-button/dist/main.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme="intuit" colorScheme={ColorScheme.LIGHT}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
