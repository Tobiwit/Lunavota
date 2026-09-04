import { useState } from 'react'
import { formatNumber } from '@/lib/format'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { AtmosphereBackground } from '@/components/atmosphere/AtmosphereBackground'
import { BackIcon } from '@/components/ui/icons'
import { VersionsPanel, IncomePanel } from './VersionsPanel'
import { CharactersPanel } from './CharactersPanel'
import { SourcesPanel, CalendarPanel } from './SourcesPanel'
import { useStore } from '@/store/useStore'
import { PRIMOS_PER_WISH } from '@/engine/wish'

/**
 * Admin.
 *
 * Shared game knowledge lives here so players never have to type in version
 * schedules or Primogem estimates themselves. Draft/published exists so
 * half-finished leak information does not reach anyone's forecast.
 */

const TABS = ['Versions', 'Characters', 'Calendar', 'Income', 'Sources'] as const
type Tab = (typeof TABS)[number]

export function AdminScreen() {
  const [tab, setTab] = useState<Tab>('Versions')
  const versions = useStore((s) => s.versions)
  const predictions = useStore((s) => s.predictions)
  const events = useStore((s) => s.calendarEvents)
  const publishAll = useStore((s) => s.publishAll)
  const resetCatalog = useStore((s) => s.resetCatalog)
  const incomeItems = useStore((s) => s.incomeItems)

  const drafts =
    versions.filter((v) => v.publishState === 'draft').length +
    predictions.filter((p) => p.publishState === 'draft').length +
    events.filter((e) => e.publishState === 'draft').length

  const liveVersion = versions.find((v) => v.status === 'live')
  const liveBaseline = liveVersion
    ? incomeItems
        .filter((i) => i.versionId === liveVersion.id && i.baselineIncluded)
        .reduce((s, i) => s + i.primogems + i.intertwinedFates * PRIMOS_PER_WISH, 0)
    : 0

  return (
    <>
      <AtmosphereBackground variant="admin" />
      <div className="md:pl-[212px]">
        <div className="mx-auto w-full max-w-[1080px] px-5 pb-16" style={{ paddingTop: 'calc(var(--sat) + 18px)' }}>
          <header className="mb-6">
            <Link
              to="/"
              className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-moon-dim underline-offset-4 hover:text-moon"
            >
              <BackIcon size={15} /> Back to the app
            </Link>

            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow mb-1.5">Catalogue</p>
                <h1 className="font-display text-[30px] leading-none text-moon">Admin</h1>
              </div>

              <div className="flex items-center gap-3">
                {drafts > 0 && (
                  <span className="text-[12px] text-star">
                    {drafts} unpublished {drafts === 1 ? 'change' : 'changes'}
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-primary !min-h-[38px] !px-4 !text-[13px]"
                  onClick={publishAll}
                  disabled={drafts === 0}
                >
                  Publish updates
                </button>
              </div>
            </div>

            {liveVersion && (
              <p className="mt-3 text-[12px] text-moon-dim">
                Live: <span className="text-moon">{liveVersion.name}</span> · content baseline{' '}
                <span className="num text-moon">{formatNumber(liveBaseline)}</span> Primogems ≈{' '}
                <span className="num text-moon">{(liveBaseline / PRIMOS_PER_WISH).toFixed(1)}</span> wishes
              </p>
            )}
          </header>

          <nav className="no-scrollbar -mx-5 mb-8 flex gap-1 overflow-x-auto border-b border-[var(--hairline)] px-5">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-current={tab === t ? 'page' : undefined}
                className={clsx(
                  'relative shrink-0 px-3.5 py-2.5 text-[13.5px] transition-colors',
                  tab === t ? 'text-moon' : 'text-moon-dim hover:text-moon-muted',
                )}
              >
                {t}
                {tab === t && (
                  <span
                    className="absolute inset-x-2 bottom-[-1px] h-[2px] rounded-full"
                    style={{ background: 'var(--frost)' }}
                  />
                )}
              </button>
            ))}
          </nav>

          {tab === 'Versions' && <VersionsPanel />}
          {tab === 'Characters' && <CharactersPanel />}
          {tab === 'Calendar' && <CalendarPanel />}
          {tab === 'Income' && <IncomePanel />}
          {tab === 'Sources' && <SourcesPanel />}

          <footer className="mt-16 border-t border-[var(--hairline)] pt-6">
            <p className="text-[11.5px] leading-relaxed text-moon-faint">
              This catalogue is stored locally alongside your own plan, and travels with your JSON backup. When
              Lunavota gains a server, the same shapes move behind the persistence adapter without touching the app.
            </p>
            <button
              type="button"
              className="mt-3 text-[12px] text-moon-faint underline-offset-4 hover:text-danger hover:underline"
              onClick={resetCatalog}
            >
              Reset catalogue to the shipped defaults
            </button>
          </footer>
        </div>
      </div>
    </>
  )
}
