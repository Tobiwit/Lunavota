import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { useId, useState, type ReactNode } from 'react'

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; hint?: string }[]
  label?: string
  className?: string
  size?: 'sm' | 'md'
}

export function Segmented<T extends string>({
  value, onChange, options, label, className, size = 'md',
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={clsx(
        'flex gap-1 rounded-full border border-[var(--hairline)] bg-[rgba(8,12,22,0.55)] p-1',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              'relative flex-1 rounded-full text-center transition-colors duration-200',
              size === 'sm' ? 'px-2.5 py-1.5 text-[12px]' : 'px-3 py-2 text-[13px]',
              active ? 'text-moon' : 'text-moon-dim hover:text-moon-muted',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${label ?? 'x'}`}
                className="absolute inset-0 rounded-full border border-[rgba(169,213,232,0.4)] bg-[rgba(169,213,232,0.13)]"
                transition={{ type: 'spring', stiffness: 480, damping: 40 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Toggle                                                              */
/* ------------------------------------------------------------------ */

export function Toggle({
  checked, onChange, label, hint, id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
  id?: string
}) {
  const generated = useId()
  const inputId = id ?? generated
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <label htmlFor={inputId} className="min-w-0">
        <span className="block text-[14px] text-moon">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] leading-snug text-moon-dim">{hint}</span>}
      </label>
      <button
        id={inputId}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative h-[30px] w-[52px] shrink-0 rounded-full border transition-colors duration-200',
          checked
            ? 'border-[rgba(169,213,232,0.5)] bg-[rgba(169,213,232,0.22)]'
            : 'border-[var(--hairline)] bg-[rgba(8,12,22,0.7)]',
        )}
      >
        <motion.span
          className="absolute top-[3px] h-[22px] w-[22px] rounded-full"
          style={{
            background: checked ? 'var(--frost)' : 'var(--moon-faint)',
            boxShadow: checked ? '0 0 14px rgba(169,213,232,0.7)' : 'none',
          }}
          animate={{ left: checked ? 26 : 3 }}
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
        />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Number stepper                                                      */
/* ------------------------------------------------------------------ */

export function NumberField({
  value, onChange, label, min = 0, max = 999999, step = 1, suffix, hint,
}: {
  value: number
  onChange: (v: number) => void
  label: string
  min?: number
  max?: number
  step?: number
  suffix?: string
  hint?: string
}) {
  const id = useId()
  const clamp = (n: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min))
  return (
    <div>
      <label htmlFor={id} className="eyebrow mb-2 block">{label}</label>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          className="btn btn-quiet w-[46px] px-0 text-[18px]"
          onClick={() => onChange(clamp(value - step))}
        >
          −
        </button>
        <div className="relative flex-1">
          <input
            id={id}
            type="number"
            inputMode="numeric"
            className="field num text-center"
            value={Number.isFinite(value) ? value : 0}
            min={min}
            max={max}
            onChange={(e) => onChange(clamp(parseInt(e.target.value, 10)))}
          />
          {suffix && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-moon-dim">
              {suffix}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          className="btn btn-quiet w-[46px] px-0 text-[18px]"
          onClick={() => onChange(clamp(value + step))}
        >
          +
        </button>
      </div>
      {hint && <p className="mt-2 text-[12px] leading-snug text-moon-dim">{hint}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Slider                                                              */
/* ------------------------------------------------------------------ */

export function Slider({
  value, onChange, min = 0, max = 100, step = 1, label, format, marks,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  label: string
  format?: (v: number) => string
  marks?: { value: number; label: string }[]
}) {
  const id = useId()
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="eyebrow min-w-0">{label}</label>
        <span className="num shrink-0 whitespace-nowrap text-[15px] text-moon">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="lunar-range w-full"
        style={{ ['--pct' as string]: `${pct}%` }}
      />
      {marks && (
        <div className="mt-1.5 flex justify-between text-[11px] text-moon-faint">
          {marks.map((m) => <span key={m.value}>{m.label}</span>)}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Disclosure — the "Why?" affordance                                  */
/* ------------------------------------------------------------------ */

export function Why({ children, label = 'Why?' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[12px] text-frost/80 underline-offset-4 hover:underline"
      >
        {label}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-[10px]">
          ▾
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 0.8, 0.28, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl border border-[var(--hairline)] bg-[rgba(8,12,22,0.5)] p-3.5 text-[13px] leading-relaxed text-moon-muted">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Small display pieces                                                */
/* ------------------------------------------------------------------ */

export function Stat({
  value, label, tone = 'default', size = 'md',
}: {
  value: ReactNode
  label: string
  tone?: 'default' | 'frost' | 'dim' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
}) {
  const color = {
    default: 'text-moon',
    frost: 'text-frost',
    dim: 'text-moon-dim',
    danger: 'text-danger',
    success: 'text-success',
  }[tone]
  const sizing = { sm: 'text-[18px]', md: 'text-[26px]', lg: 'text-[38px]' }[size]
  return (
    <div>
      <div className={clsx('num font-display leading-none', sizing, color)}>{value}</div>
      <div className="eyebrow mt-1.5">{label}</div>
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="eyebrow">{children}</h2>
      {action}
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="panel px-6 py-10 text-center">
      <svg width="46" height="46" viewBox="0 0 46 46" className="mx-auto mb-4 opacity-60">
        <circle cx="23" cy="23" r="13" fill="none" stroke="var(--lunar-blue)" strokeWidth="1" opacity="0.7" />
        <circle cx="23" cy="23" r="19" fill="none" stroke="var(--lunar-blue)" strokeWidth="0.6" opacity="0.3" strokeDasharray="2 5" />
        <circle cx="29" cy="17" r="1.4" fill="var(--star-gold)" opacity="0.8" />
      </svg>
      <h3 className="font-display text-[19px] text-moon">{title}</h3>
      <p className="mx-auto mt-2 max-w-[34ch] text-[13px] leading-relaxed text-moon-dim">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
