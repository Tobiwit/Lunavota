import clsx from 'clsx'
import { useId, type ReactNode } from 'react'
import type { PublishState } from '@/types'

/**
 * Admin primitives.
 *
 * Deliberately plainer than the consumer app: information density and fast
 * editing matter more here than atmosphere. It still uses the lunar palette so
 * it does not feel like a different product.
 */

export function AdminSection({
  title, description, action, children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mb-9">
      <header className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-[19px] text-moon">{title}</h2>
          {description && <p className="mt-1 text-[12px] leading-relaxed text-moon-dim">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

export function AdminField({
  label, children, hint, wide,
}: {
  label: string
  children: ReactNode
  hint?: string
  wide?: boolean
}) {
  return (
    <label className={clsx('block', wide && 'sm:col-span-2')}>
      <span className="eyebrow mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-moon-faint">{hint}</span>}
    </label>
  )
}

export function TextInput({
  value, onChange, placeholder, type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      className="field !min-h-[40px] !text-[13.5px]"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function NumInput({
  value, onChange, step = 1, min, max,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className="field num !min-h-[40px] !text-[13.5px]"
      value={Number.isFinite(value) ? value : 0}
      step={step}
      min={min}
      max={max}
      onChange={(e) => {
        const n = Number(e.target.value)
        onChange(Number.isFinite(n) ? n : 0)
      }}
    />
  )
}

export function SelectInput<T extends string | number>({
  value, onChange, options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  const id = useId()
  return (
    <select
      id={id}
      className="field !min-h-[40px] !text-[13.5px] appearance-none pr-8"
      value={String(value)}
      onChange={(e) => {
        const raw = e.target.value
        const match = options.find((o) => String(o.value) === raw)
        if (match) onChange(match.value)
      }}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none' stroke='%238492a8' stroke-width='1.4'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)} className="bg-night-900">
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function PublishBadge({ state }: { state: PublishState }) {
  const tone = {
    draft: { color: 'var(--star-gold)', label: 'Draft' },
    published: { color: 'var(--success)', label: 'Published' },
    archived: { color: 'var(--moon-faint)', label: 'Archived' },
  }[state]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] uppercase tracking-wide2"
      style={{ borderColor: `${tone.color}55`, color: tone.color }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: tone.color }} />
      {tone.label}
    </span>
  )
}

export function AdminCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('rounded-xl border border-[var(--hairline)] bg-[rgba(11,15,28,0.6)] p-4', className)}>
      {children}
    </div>
  )
}

export function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-[rgba(217,196,141,0.3)] bg-[rgba(217,196,141,0.07)] px-3 py-2 text-[12px] leading-relaxed text-star">
      {children}
    </p>
  )
}

export const PUBLISH_OPTIONS = [
  { value: 'draft' as const, label: 'Draft' },
  { value: 'published' as const, label: 'Published' },
  { value: 'archived' as const, label: 'Archived' },
]
