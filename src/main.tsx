console.log('URL:', import.meta.env.VITE_SUPABASE_URL)
import { PrefsApplier } from './components/PrefsApplier'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PrefsApplier />
      <App />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  </StrictMode>,
)