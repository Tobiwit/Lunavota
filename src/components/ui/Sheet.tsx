import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'

/**
 * Bottom sheet. On mobile this replaces modals entirely: it is draggable,
 * safe-area aware, and never taller than the screen.
 */

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  eyebrow?: string
  children: ReactNode
  /** Sticky action row pinned above the home indicator. */
  footer?: ReactNode
  /** Fraction of the viewport the sheet is allowed to occupy. */
  maxHeight?: string
  labelledBy?: string
}

export function Sheet({ open, onClose, title, eyebrow, children, footer, maxHeight = '88dvh' }: Props) {
  const reduce = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)

  // Lock the page behind the sheet, and restore the exact scroll position after.
  useEffect(() => {
    if (!open) return
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-[rgba(4,6,12,0.62)] backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={clsx(
              'relative w-full max-w-[560px] outline-none',
              'rounded-t-sheet sm:rounded-sheet',
              'border border-[var(--hairline-strong)] border-b-0 sm:border-b',
              'shadow-lift',
            )}
            style={{
              maxHeight,
              background: 'linear-gradient(180deg, rgba(23,30,50,0.96) 0%, rgba(10,14,26,0.98) 100%)',
              backdropFilter: 'blur(24px)',
            }}
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 380, damping: 38, mass: 0.9 }}
            drag={reduce ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 700) onClose()
            }}
          >
            {/* Moonlight along the top edge. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-24 rounded-t-sheet"
              style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(169,213,232,0.16), transparent 70%)' }}
            />

            <div className="flex touch-none justify-center pb-1 pt-3">
              <div className="h-1 w-9 rounded-full bg-[rgba(169,213,232,0.32)]" />
            </div>

            {(title || eyebrow) && (
              <header className="relative px-5 pb-3 pt-1">
                {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
                {title && <h2 className="font-display text-[24px] leading-tight text-moon">{title}</h2>}
              </header>
            )}

            <div
              className="scroll-pane px-5 pb-5"
              style={{ maxHeight: `calc(${maxHeight} - ${footer ? '186px' : '110px'})` }}
            >
              {children}
            </div>

            {footer && (
              <div
                className="border-t border-[var(--hairline)] px-5 pt-3"
                style={{ paddingBottom: 'calc(12px + var(--sab))' }}
              >
                {footer}
              </div>
            )}

            {!footer && <div style={{ height: 'var(--sab)' }} />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
