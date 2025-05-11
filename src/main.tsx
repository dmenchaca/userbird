import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PostHogProvider } from 'posthog-js/react'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from './components/theme-provider'

const options = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <PostHogProvider 
    apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
    options={options}
  >
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </PostHogProvider>
)