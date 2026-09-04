import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import { AtmosphereBackground, type Atmosphere } from '@/components/atmosphere/AtmosphereBackground'
import { SettingsIcon } from './icons'

interface Props {
  atmosphere?: Atmosphere
  eyebrow?: string
  title?: ReactNode
  /** Rendered under the title, before the content. */
  lede?: ReactNode
  action?: ReactNode
  children: ReactNode
  /** Wide screens (roadmap, admin tables) get more room. */
  wide?: boolean
  showSettings?: boolean
}

export function Screen({
  atmosphere = 'moon', eyebrow, title, lede, action, children, wide, showSettings = true,
}: Props) {
  return (
    <>
      <AtmosphereBackground variant={atmosphere} />
      <div className="md:pl-[212px]">
        <main
          className={clsx(
            'rise mx-auto w-full px-5 pb-[104px] md:pb-16',
            wide ? 'max-w-[1080px]' : 'max-w-[560px] md:max-w-[720px]',
          )}
          style={{ paddingTop: 'calc(var(--sat) + 18px)' }}
        >
          {(title || eyebrow) && (
            <header className="mb-7 flex items-start justify-between gap-4">
              <div className="min-w-0">
                {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
                {title && (
                  <h1 className="text-balance font-display text-[30px] leading-[1.15] text-moon md:text-[36px]">
                    {title}
                  </h1>
                )}
                {lede && <div className="mt-2 text-[13px] leading-relaxed text-moon-dim">{lede}</div>}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {action}
                {showSettings && (
                  <Link
                    to="/settings"
                    aria-label="Settings"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--hairline)] text-moon-dim transition-colors hover:text-moon md:hidden"
                  >
                    <SettingsIcon size={18} />
                  </Link>
                )}
              </div>
            </header>
          )}

          {children}
        </main>
      </div>
    </>
  )
}
