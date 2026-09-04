import { useState } from 'react'
import { formatNumber } from '@/lib/format'
import { AdminCard, AdminField, AdminSection, NumInput, PublishBadge, PUBLISH_OPTIONS, SelectInput, TextInput, Warning } from './adminUi'
import { useStore } from '@/store/useStore'
import { buildBaselineIncome } from '@/data/seedVersions'
import { BASELINE_TOTAL_PRIMOS, VERSION_BASELINE } from '@/data/config'
import { addDays, formatDayYear, today } from '@/lib/date'
import { PRIMOS_PER_WISH } from '@/engine/wish'
import type { GameVersion, PublishState } from '@/types'

export function VersionsPanel() {
  const versions = useStore((s) => s.versions)
  const incomeItems = useStore((s) => s.incomeItems)
  const upsertVersion = useStore((s) => s.upsertVersion)
  const removeVersion = useStore((s) => s.removeVersion)
  const upsertIncomeItem = useStore((s) => s.upsertIncomeItem)

  const [editing, setEditing] = useState<string | null>(null)

  const createVersion = () => {
    const last = versions[versions.length - 1]
    const startDate = last ? addDays(last.endDate, 1) : today()
    const version: GameVersion = {
      id: `version-${Date.now().toString(36)}`,
      name: 'New version',
      number: '0.0',
      startDate,
      phase2Date: addDays(startDate, 21),
      endDate: addDays(startDate, 41),
      status: 'upcoming',
      publishState: 'draft',
    }
    upsertVersion(version)
    // A new version starts from the 25-wish content baseline, editable per row.
    for (const item of buildBaselineIncome(version)) upsertIncomeItem(item)
    setEditing(version.id)
  }

  return (
    <AdminSection
      title="Versions"
      description="Each version is the container for banners, income, events and resets. Every field is editable — the shipped dates are a scaffold, not confirmed information."
      action={
        <button type="button" className="btn btn-quiet !min-h-[38px] !px-4 !text-[13px]" onClick={createVersion}>
          Add version
        </button>
      }
    >
      <Warning>
        The seeded schedule assumes 42-day versions from a fixed anchor, named Luna I–VIII across 6.0–6.7 and
        Snezhnaya I onward from 7.0. Correct the names and dates here as HoYoverse confirms them; every forecast in
        the app recalculates immediately. Nothing you edit here is ever overwritten by the shipped defaults unless you
        reset the catalogue yourself.
      </Warning>

      <ul className="mt-4 space-y-2.5">
        {versions.map((v) => {
          const items = incomeItems.filter((i) => i.versionId === v.id)
          const baseline = items
            .filter((i) => i.baselineIncluded)
            .reduce((s, i) => s + i.primogems + i.intertwinedFates * PRIMOS_PER_WISH, 0)
          const gifts = items
            .filter((i) => i.category === 'gift')
            .reduce((s, i) => s + i.primogems + i.intertwinedFates * PRIMOS_PER_WISH, 0)
          const open = editing === v.id

          return (
            <li key={v.id}>
              <AdminCard>
                <button
                  type="button"
                  onClick={() => setEditing(open ? null : v.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 text-left"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2.5">
                      <span className="font-display text-[18px] text-moon">{v.name}</span>
                      <span className="num text-[12px] text-moon-dim">{v.number}</span>
                      {v.status === 'live' && (
                        <span className="rounded-full border border-[rgba(169,213,232,0.4)] px-2 py-0.5 text-[10px] uppercase tracking-wide2 text-frost">
                          Live
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-[11.5px] text-moon-dim">
                      {formatDayYear(v.startDate)} → {formatDayYear(v.endDate)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-right">
                      <span className="num block text-[14px] text-moon">
                        {(baseline / PRIMOS_PER_WISH).toFixed(1)}
                      </span>
                      <span className="block text-[10px] uppercase tracking-wide2 text-moon-faint">
                        baseline wishes
                      </span>
                    </span>
                    <PublishBadge state={v.publishState} />
                  </span>
                </button>

                {open && (
                  <div className="mt-4 border-t border-[var(--hairline)] pt-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <AdminField label="Display name">
                        <TextInput value={v.name} onChange={(name) => upsertVersion({ ...v, name })} />
                      </AdminField>
                      <AdminField label="Version number">
                        <TextInput value={v.number} onChange={(number) => upsertVersion({ ...v, number })} />
                      </AdminField>
                      <AdminField label="Start date">
                        <TextInput
                          type="date"
                          value={v.startDate}
                          onChange={(startDate) => upsertVersion({ ...v, startDate })}
                        />
                      </AdminField>
                      <AdminField label="Phase 2 start">
                        <TextInput
                          type="date"
                          value={v.phase2Date}
                          onChange={(phase2Date) => upsertVersion({ ...v, phase2Date })}
                        />
                      </AdminField>
                      <AdminField label="End date">
                        <TextInput
                          type="date"
                          value={v.endDate}
                          onChange={(endDate) => upsertVersion({ ...v, endDate })}
                        />
                      </AdminField>
                      <AdminField label="Publish state">
                        <SelectInput<PublishState>
                          value={v.publishState}
                          onChange={(publishState) => upsertVersion({ ...v, publishState })}
                          options={PUBLISH_OPTIONS}
                        />
                      </AdminField>
                      <AdminField label="Notes" wide>
                        <TextInput
                          value={v.notes ?? ''}
                          onChange={(notes) => upsertVersion({ ...v, notes: notes || undefined })}
                          placeholder="Anniversary, Lantern Rite, anything unusual…"
                        />
                      </AdminField>
                    </div>

                    <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[12px]">
                      <div>
                        <dt className="inline text-moon-dim">Content baseline </dt>
                        <dd className="num inline text-moon">
                          {formatNumber(baseline)} Primogems ≈ {(baseline / PRIMOS_PER_WISH).toFixed(1)} wishes
                        </dd>
                      </div>
                      {gifts > 0 && (
                        <div>
                          <dt className="inline text-moon-dim">Gifts on top </dt>
                          <dd className="num inline text-star">+{formatNumber(gifts)} Primogems</dd>
                        </div>
                      )}
                      <div>
                        <dt className="inline text-moon-dim">Default baseline </dt>
                        <dd className="num inline text-moon-faint">
                          {formatNumber(BASELINE_TOTAL_PRIMOS)} ≈ 25 wishes
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="button"
                        className="text-[12px] text-frost/80 underline-offset-4 hover:underline"
                        onClick={() => {
                          for (const item of buildBaselineIncome(v)) upsertIncomeItem(item)
                        }}
                      >
                        Reset to the {Object.keys(VERSION_BASELINE).length}-category baseline
                      </button>
                      <button
                        type="button"
                        className="text-[12px] text-moon-dim underline-offset-4 hover:text-danger hover:underline"
                        onClick={() => {
                          removeVersion(v.id)
                          setEditing(null)
                        }}
                      >
                        Delete version
                      </button>
                    </div>
                  </div>
                )}
              </AdminCard>
            </li>
          )
        })}
      </ul>
    </AdminSection>
  )
}

export function IncomePanel() {
  const versions = useStore((s) => s.versions)
  const incomeItems = useStore((s) => s.incomeItems)
  const upsertIncomeItem = useStore((s) => s.upsertIncomeItem)
  const removeIncomeItem = useStore((s) => s.removeIncomeItem)
  const recurring = useStore((s) => s.recurring)
  const setRecurring = useStore((s) => s.setRecurring)

  const upcoming = versions.filter((v) => v.status !== 'past')
  const [versionId, setVersionId] = useState(upcoming[0]?.id ?? versions[0]?.id ?? '')
  const version = versions.find((v) => v.id === versionId)
  const items = incomeItems.filter((i) => i.versionId === versionId)

  const totalPrimos = items.reduce((s, i) => s + i.primogems + i.intertwinedFates * PRIMOS_PER_WISH, 0)

  const addItem = () => {
    if (!version) return
    upsertIncomeItem({
      id: `income-${Date.now().toString(36)}`,
      versionId: version.id,
      category: 'events',
      label: 'New reward',
      primogems: 0,
      intertwinedFates: 0,
      availableDate: version.startDate,
      completionAdjustable: true,
      guaranteed: false,
      baselineIncluded: true,
    })
  }

  return (
    <>
      <AdminSection
        title="Version income"
        description="A version is never one number. Each row carries its own date so the forecast can answer “how many wishes will I have on the 17th?” rather than “how many are in this patch?”."
        action={
          <button type="button" className="btn btn-quiet !min-h-[38px] !px-4 !text-[13px]" onClick={addItem}>
            Add row
          </button>
        }
      >
        <div className="mb-4 max-w-[280px]">
          <AdminField label="Version">
            <SelectInput
              value={versionId}
              onChange={setVersionId}
              options={versions.map((v) => ({ value: v.id, label: `${v.name} · ${v.number}` }))}
            />
          </AdminField>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-[var(--hairline)] text-[10.5px] uppercase tracking-wide2 text-moon-faint">
                <th className="py-2 pr-3 font-normal">Label</th>
                <th className="py-2 pr-3 font-normal">Category</th>
                <th className="py-2 pr-3 text-right font-normal">Primogems</th>
                <th className="py-2 pr-3 text-right font-normal">Fates</th>
                <th className="py-2 pr-3 font-normal">Available</th>
                <th className="py-2 pr-3 font-normal">Until</th>
                <th className="py-2 pr-3 text-center font-normal">Scales</th>
                <th className="py-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-[rgba(169,213,232,0.07)]">
                  <td className="py-1.5 pr-3">
                    <TextInput value={item.label} onChange={(label) => upsertIncomeItem({ ...item, label })} />
                  </td>
                  <td className="py-1.5 pr-3">
                    <SelectInput
                      value={item.category}
                      onChange={(category) =>
                        upsertIncomeItem({
                          ...item,
                          category,
                          // Gifts sit on top of the baseline rather than inside it.
                          baselineIncluded: category !== 'gift',
                        })
                      }
                      options={[
                        { value: 'events', label: 'Events' },
                        { value: 'quests', label: 'Quests & story' },
                        { value: 'exploration', label: 'Exploration' },
                        { value: 'maintenance-codes', label: 'Maintenance & codes' },
                        { value: 'misc', label: 'Misc.' },
                        { value: 'gift', label: 'Gift (on top)' },
                      ]}
                    />
                  </td>
                  <td className="w-[110px] py-1.5 pr-3">
                    <NumInput
                      value={item.primogems}
                      step={10}
                      onChange={(primogems) => upsertIncomeItem({ ...item, primogems })}
                    />
                  </td>
                  <td className="w-[86px] py-1.5 pr-3">
                    <NumInput
                      value={item.intertwinedFates}
                      onChange={(intertwinedFates) => upsertIncomeItem({ ...item, intertwinedFates })}
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <TextInput
                      type="date"
                      value={item.availableDate ?? ''}
                      onChange={(availableDate) => upsertIncomeItem({ ...item, availableDate: availableDate || undefined })}
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <TextInput
                      type="date"
                      value={item.endDate ?? ''}
                      onChange={(endDate) => upsertIncomeItem({ ...item, endDate: endDate || undefined })}
                    />
                  </td>
                  <td className="py-1.5 pr-3 text-center">
                    <input
                      type="checkbox"
                      checked={item.completionAdjustable}
                      onChange={(e) => upsertIncomeItem({ ...item, completionAdjustable: e.target.checked })}
                      aria-label="Scales with completion"
                      className="h-4 w-4 accent-[var(--frost)]"
                    />
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      type="button"
                      className="text-[11.5px] text-moon-faint hover:text-danger"
                      onClick={() => removeIncomeItem(item.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="py-3 text-[11px] uppercase tracking-wide2 text-moon-faint">
                  Total
                </td>
                <td className="num py-3 pr-3 text-right text-moon">{formatNumber(totalPrimos)}</td>
                <td colSpan={5} className="num py-3 pl-3 text-moon-dim">
                  ≈ {(totalPrimos / PRIMOS_PER_WISH).toFixed(1)} wishes
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </AdminSection>

      <AdminSection
        title="Recurring income"
        description="Everything outside a version's content: dailies, subscriptions, endgame resets and the shop. Calculated independently so the 25-wish baseline stays clean."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <AdminField label="Daily commissions" hint="Primogems per day">
            <NumInput
              value={recurring.dailyCommissionPrimos}
              onChange={(dailyCommissionPrimos) => setRecurring({ dailyCommissionPrimos })}
            />
          </AdminField>
          <AdminField label="Welkin" hint="Primogems per day">
            <NumInput
              value={recurring.welkinPrimosPerDay}
              onChange={(welkinPrimosPerDay) => setRecurring({ welkinPrimosPerDay })}
            />
          </AdminField>
          <AdminField label="Battle Pass (paid)" hint="Primogems per cycle">
            <NumInput
              value={recurring.battlePass.paid.primogems}
              step={10}
              onChange={(primogems) =>
                setRecurring({
                  battlePass: { ...recurring.battlePass, paid: { ...recurring.battlePass.paid, primogems } },
                })
              }
            />
          </AdminField>
          <AdminField label="Battle Pass Fates" hint="Intertwined Fates per cycle">
            <NumInput
              value={recurring.battlePass.paid.intertwinedFates}
              onChange={(intertwinedFates) =>
                setRecurring({
                  battlePass: { ...recurring.battlePass, paid: { ...recurring.battlePass.paid, intertwinedFates } },
                })
              }
            />
          </AdminField>
          <AdminField label="Spiral Abyss" hint="Full clear, per reset">
            <NumInput
              value={recurring.spiralAbyss.fullClearPrimos}
              step={50}
              onChange={(fullClearPrimos) =>
                setRecurring({ spiralAbyss: { ...recurring.spiralAbyss, fullClearPrimos } })
              }
            />
          </AdminField>
          <AdminField label="Imaginarium Theater" hint="Full clear, per cycle">
            <NumInput
              value={recurring.imaginariumTheater.fullClearPrimos}
              step={50}
              onChange={(fullClearPrimos) =>
                setRecurring({ imaginariumTheater: { ...recurring.imaginariumTheater, fullClearPrimos } })
              }
            />
          </AdminField>
          <AdminField label="Stygian Onslaught" hint="Full clear, per cycle">
            <NumInput
              value={recurring.stygianOnslaught.fullClearPrimos}
              step={50}
              onChange={(fullClearPrimos) =>
                setRecurring({ stygianOnslaught: { ...recurring.stygianOnslaught, fullClearPrimos } })
              }
            />
          </AdminField>
          <AdminField label="Starglitter Fates" hint="Intertwined Fates per month">
            <NumInput
              value={recurring.starglitterFatesPerMonth}
              onChange={(starglitterFatesPerMonth) => setRecurring({ starglitterFatesPerMonth })}
            />
          </AdminField>
        </div>
      </AdminSection>
    </>
  )
}
