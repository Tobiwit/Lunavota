import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { BottomNav, SideNav } from '@/components/ui/Navigation'
import { AtmosphereBackground } from '@/components/atmosphere/AtmosphereBackground'
import { MoonScreen } from '@/screens/MoonScreen'
import { TimelineScreen } from '@/screens/TimelineScreen'
import { WishlistScreen } from '@/screens/WishlistScreen'
import { HistoryScreen } from '@/screens/HistoryScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'
import { OnboardingScreen } from '@/screens/OnboardingScreen'

// Admin is a separate concern and a separate bundle; players never load it.
const AdminScreen = lazy(() =>
  import('@/screens/admin/AdminScreen').then((m) => ({ default: m.AdminScreen })),
)

export default function App() {
  const hydrated = useHydrated()
  const onboarded = useStore((s) => s.onboarded)
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  if (!hydrated) return <Boot />
  if (!onboarded && !isAdmin) return <OnboardingScreen />

  return (
    <>
      <SideNav />
        <Routes location={location} key={location.pathname.split('/')[1] || 'moon'}>
          <Route path="/" element={<MoonScreen />} />
          <Route path="/timeline" element={<TimelineScreen />} />
          <Route path="/wishlist" element={<WishlistScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={<Boot />}>
                <AdminScreen />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      {!isAdmin && <BottomNav />}
    </>
  )
}

/** Persistence is async, so nothing renders until the store has rehydrated. */
function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated())

  useEffect(() => {
    const unsubFinish = useStore.persist.onFinishHydration(() => setHydrated(true))
    if (useStore.persist.hasHydrated()) setHydrated(true)
    return unsubFinish
  }, [])

  return hydrated
}

function Boot() {
  return (
    <>
      <AtmosphereBackground variant="moon" />
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="text-center">
          <svg width="52" height="52" viewBox="0 0 52 52" className="mx-auto animate-[breathe_3.4s_ease-in-out_infinite]">
            <circle cx="26" cy="26" r="15" fill="none" stroke="var(--frost)" strokeOpacity="0.55" strokeWidth="1" />
            <circle
              cx="26" cy="26" r="22"
              fill="none" stroke="var(--frost)" strokeOpacity="0.2" strokeWidth="0.7"
              strokeDasharray="2 6"
            />
          </svg>
          <p className="eyebrow mt-5">Lunavota</p>
        </div>
      </div>
    </>
  )
}
