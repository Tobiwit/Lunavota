import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { HistoryIcon, MoonIcon, TimelineIcon, WishlistIcon } from './icons'

/**
 * Navigation. Bottom bar on phones, a quiet left rail from `md` upward.
 * The same four destinations either way - desktop expands the design, it does
 * not become a different product.
 */

const TABS = [
  { to: '/', label: 'Moon', Icon: MoonIcon, end: true },
  { to: '/timeline', label: 'Timeline', Icon: TimelineIcon, end: false },
  { to: '/wishlist', label: 'Wishlist', Icon: WishlistIcon, end: false },
  { to: '/history', label: 'History', Icon: HistoryIcon, end: false },
]

export function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{ paddingBottom: 'var(--sab)' }}
    >
      <div
        className="mx-auto flex max-w-[560px] items-stretch justify-around border-t border-[var(--hairline)] px-2 pt-1.5"
        style={{
          background: 'linear-gradient(180deg, rgba(9,13,24,0.82), rgba(6,8,15,0.97))',
          backdropFilter: 'blur(20px) saturate(120%)',
          WebkitBackdropFilter: 'blur(20px) saturate(120%)',
        }}
      >
        {TABS.map(({ to, label, Icon, end }) => {
          const active = end ? pathname === to : pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className="relative flex min-w-[64px] flex-1 flex-col items-center gap-1 rounded-xl px-2 pb-2 pt-2"
            >
              {active && (
                <motion.span
                  layoutId="nav-glow"
                  className="absolute inset-x-3 -top-[7px] h-[2px] rounded-full"
                  style={{ background: 'var(--frost)', boxShadow: '0 0 12px var(--frost)' }}
                  transition={{ type: 'spring', stiffness: 460, damping: 38 }}
                />
              )}
              <Icon size={22} active={active} className={active ? 'text-frost' : 'text-moon-dim'} />
              <span className={clsx('text-[10.5px] tracking-wide2', active ? 'text-moon' : 'text-moon-dim')}>
                {label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

export function SideNav() {
  const { pathname } = useLocation()
  return (
    <nav
      aria-label="Primary"
      className="fixed left-0 top-0 z-40 hidden h-full w-[212px] flex-col border-r border-[var(--hairline)] px-4 py-7 md:flex"
      style={{ background: 'linear-gradient(180deg, rgba(11,15,28,0.6), rgba(6,8,15,0.85))' }}
    >
      <div className="mb-9 px-2">
        <div className="font-display text-[21px] tracking-[0.14em] text-moon">LUNAVOTA</div>
        <div className="eyebrow mt-1">Wish planning</div>
      </div>

      <ul className="space-y-1">
        {TABS.map(({ to, label, Icon, end }) => {
          const active = end ? pathname === to : pathname.startsWith(to)
          return (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={clsx(
                  'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors',
                  active ? 'bg-[rgba(169,213,232,0.09)] text-moon' : 'text-moon-dim hover:text-moon-muted',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="rail-glow"
                    className="absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-full"
                    style={{ background: 'var(--frost)', boxShadow: '0 0 10px var(--frost)' }}
                    transition={{ type: 'spring', stiffness: 460, damping: 38 }}
                  />
                )}
                <Icon size={20} active={active} className={active ? 'text-frost' : undefined} />
                {label}
              </NavLink>
            </li>
          )
        })}
      </ul>

      <div className="mt-auto space-y-1">
        <NavLink
          to="/settings"
          className="block rounded-xl px-3 py-2 text-[13px] text-moon-dim transition-colors hover:text-moon-muted"
        >
          Settings
        </NavLink>
        <NavLink
          to="/admin"
          className="block rounded-xl px-3 py-2 text-[13px] text-moon-faint transition-colors hover:text-moon-dim"
        >
          Admin
        </NavLink>
      </div>
    </nav>
  )
}
