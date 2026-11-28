import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { CommuteView } from '../features/commute/CommuteView'
import { LiveMapView } from '../features/map/LiveMapView'
import { AppShell } from './AppShell'
import { LiveDataProvider } from './LiveDataProvider'

// The chart library is large, so Analytics loads only when first opened.
// The map, which riders see first, doesn't wait for it.
const AnalyticsView = lazy(() =>
  import('../features/analytics/AnalyticsView').then((m) => ({ default: m.AnalyticsView })),
)

// One page, three views. Switching between them happens in the browser with no reload (R1).
export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <LiveDataProvider>
        <AppShell />
      </LiveDataProvider>
    ),
    children: [
      { index: true, element: <LiveMapView /> },
      {
        path: 'analytics',
        element: (
          <Suspense fallback={<p className="text-fg-muted p-8 text-xs">Loading analytics…</p>}>
            <AnalyticsView />
          </Suspense>
        ),
      },
      { path: 'commute', element: <CommuteView /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
