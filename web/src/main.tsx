import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// Monaspace Neon is bundled with the app; Mona Sans loads from Google Fonts in index.html.
import '@fontsource/monaspace-neon/400.css'
import '@fontsource/monaspace-neon/500.css'
import 'leaflet/dist/leaflet.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/routes'
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is shared across views, so switching tabs never triggers a new request (R1).
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
