import { useMemo, useState } from 'react'
import { AdminCard, AdminField, AdminSection, NumInput, PublishBadge, PUBLISH_OPTIONS, SelectInput, TextInput, Warning } from './adminUi'
import { useStore } from '@/store/useStore'
import { confidenceDescription, confidenceLabel } from '@/engine/predictions'
import { today } from '@/lib/date'
import type { BannerPhase, BannerPrediction, PredictionSource, PublishState } from '@/types'

/**
 * Banner predictions.
 *
 * Probabilities do not have to sum to 100% - real uncertainty often means the
 * honest answer is "or later". Every row carries its own confidence and source,
 * and the player-facing UI never shows one without the other.
 */

const SOURCES: PredictionSource[] = ['official', 'reliable-leak', 'speculation', 'user']

export function SourcesPanel() {
  const predictions = useStore((s) => s.predictions)
  const characters = useStore((s) => s.characters)
  const versions = useStore((s) => s.versions)
  const upsertPrediction = useStore((s) => s.upsertPrediction)
  const removePrediction = useStore((s) => s.removePrediction)

  const [characterId, setCharacterId] = useState<string>('')

  // Every character, not just unreleased ones: a rerun is a banner placement
  // like any other, and reruns are most of what people actually plan around.
  const characterOptions = useMemo(() => {
    const rank = (c: (typeof characters)[number]) => {
      if (predictions.some((p) => p.characterId === c.id)) return 0
      return c.releaseStatus === 'released' ? 2 : 1
    }
    return characters
      .slice()
      .sort((a, b) => rank(a) - rank(b) || a.displayName.localeCompare(b.displayName))
      .map((c) => ({
        value: c.id,
        label:
          predictions.some((p) => p.characterId === c.id)
            ? `${c.displayName} · scheduled`
            : c.releaseStatus === 'released'
              ? `${c.displayName} · rerun`
              : c.displayName,
      }))
  }, [characters, predictions])

  const selectedId = characterId || characterOptions[0]?.value || ''
  const mine = predictions.filter((p) => p.characterId === selectedId)
  const totalProbability = mine.reduce((s, p) => s + p.probability, 0)

  const addPrediction = () => {
    if (!selectedId) return
    const version = versions.find((v) => v.status !== 'past') ?? versions[0]
    if (!version) return
    upsertPrediction({
      id: `pred-${Date.now().toString(36)}`,
      characterId: selectedId,
      versionId: version.id,
      phase: 1,
      probability: 0.5,
      sourceType: 'speculation',
      lastUpdated: today(),
      publishState: 'draft',
    })
  }

  return (
    <AdminSection
      title="Banner timing"
      description="This is where you say when a character runs. Assign one or several possible appearances — including reruns of released characters — and the timeline places them at the most probable point, softening whatever is uncertain."
      action={
        <button type="button" className="btn btn-quiet !min-h-[38px] !px-4 !text-[13px]" onClick={addPrediction}>
          Add prediction
        </button>
      }
    >
      <div className="mb-4 max-w-[280px]">
        <AdminField label="Character">
          <SelectInput value={selectedId} onChange={setCharacterId} options={characterOptions} />
        </AdminField>
      </div>

      {totalProbability > 1.001 && (
        <div className="mb-4">
          <Warning>
            These probabilities total {Math.round(totalProbability * 100)}%. That is allowed, but it usually means one
            row is too confident.
          </Warning>
        </div>
      )}

      {mine.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-moon-dim">
          No predictions yet. Without one, this character sits under “Beyond the horizon” and is left out of the
          forecast — which is the honest default.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {mine.map((p) => (
            <li key={p.id}>
              <PredictionRow
                prediction={p}
                onChange={upsertPrediction}
                onRemove={() => removePrediction(p.id)}
                versions={versions.map((v) => ({ value: v.id, label: `${v.name} · ${v.number}` }))}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 rounded-lg border border-[var(--hairline)] bg-[rgba(8,12,22,0.5)] p-4">
        <p className="mb-2 text-[11px] uppercase tracking-wide2 text-moon-faint">How confidence is presented</p>
        <ul className="space-y-1.5 text-[12px]">
          {SOURCES.map((s) => (
            <li key={s} className="flex gap-3">
              <span className="w-[110px] shrink-0 text-moon">{confidenceLabel(s)}</span>
              <span className="text-moon-dim">{confidenceDescription(s)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11.5px] leading-relaxed text-moon-faint">
          Leaks are never rendered as announcements. There is no sensational leak surface anywhere in the app — a
          prediction appears as a version, a phase and a percentage, with the reasoning one tap away.
        </p>
      </div>
    </AdminSection>
  )
}

function PredictionRow({
  prediction, onChange, onRemove, versions,
}: {
  prediction: BannerPrediction
  onChange: (p: BannerPrediction) => void
  onRemove: () => void
  versions: { value: string; label: string }[]
}) {
  const set = (patch: Partial<BannerPrediction>) =>
    onChange({ ...prediction, ...patch, lastUpdated: today() })

  return (
    <AdminCard>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AdminField label="Version">
          <SelectInput value={prediction.versionId} onChange={(versionId) => set({ versionId })} options={versions} />
        </AdminField>
        <AdminField label="Phase">
          <SelectInput<string>
            value={String(prediction.phase)}
            onChange={(v) => set({ phase: (v === 'unknown' ? 'unknown' : Number(v)) as BannerPhase })}
            options={[
              { value: '1', label: 'Phase 1' },
              { value: '2', label: 'Phase 2' },
              { value: 'unknown', label: 'Unknown' },
            ]}
          />
        </AdminField>
        <AdminField label="Probability %">
          <NumInput
            value={Math.round(prediction.probability * 100)}
            min={0}
            max={100}
            step={5}
            onChange={(v) => set({ probability: Math.max(0, Math.min(1, v / 100)) })}
          />
        </AdminField>
        <AdminField label="Confidence">
          <SelectInput<PredictionSource>
            value={prediction.sourceType}
            onChange={(sourceType) => set({ sourceType })}
            options={SOURCES.map((s) => ({ value: s, label: confidenceLabel(s) }))}
          />
        </AdminField>
        <AdminField label="Source label">
          <TextInput
            value={prediction.sourceLabel ?? ''}
            onChange={(sourceLabel) => set({ sourceLabel: sourceLabel || undefined })}
            placeholder="Who said so"
          />
        </AdminField>
        <AdminField label="Source URL" wide>
          <TextInput
            value={prediction.sourceUrl ?? ''}
            onChange={(sourceUrl) => set({ sourceUrl: sourceUrl || undefined })}
            placeholder="https://…"
          />
        </AdminField>
        <AdminField label="Publish state">
          <SelectInput<PublishState>
            value={prediction.publishState}
            onChange={(publishState) => set({ publishState })}
            options={PUBLISH_OPTIONS}
          />
        </AdminField>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <PublishBadge state={prediction.publishState} />
          <span className="text-[11px] text-moon-faint">Updated {prediction.lastUpdated}</span>
        </span>
        <button type="button" className="text-[12px] text-moon-faint hover:text-danger" onClick={onRemove}>
          Remove
        </button>
      </div>

      {prediction.notes && <p className="mt-2 text-[11.5px] text-moon-faint">{prediction.notes}</p>}
    </AdminCard>
  )
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

export function CalendarPanel() {
  const events = useStore((s) => s.calendarEvents)
  const versions = useStore((s) => s.versions)
  const upsertCalendarEvent = useStore((s) => s.upsertCalendarEvent)
  const removeCalendarEvent = useStore((s) => s.removeCalendarEvent)

  const add = () => {
    upsertCalendarEvent({
      id: `event-${Date.now().toString(36)}`,
      type: 'event',
      date: today(),
      label: 'New event',
      income: { primogems: 0, intertwinedFates: 0 },
      completionAdjustable: true,
      publishState: 'draft',
    })
  }

  const sorted = [...events].sort((a, b) => (a.date < b.date ? -1 : 1))

  return (
    <AdminSection
      title="Calendar"
      description="One-off dated rewards: livestream codes, compensation mail, anniversary gifts. Version starts, phase changes and recurring resets are generated automatically and do not belong here."
      action={
        <button type="button" className="btn btn-quiet !min-h-[38px] !px-4 !text-[13px]" onClick={add}>
          Add event
        </button>
      }
    >
      {sorted.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-moon-dim">
          Nothing scheduled. Version income already covers ordinary content — use this for the unusual.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {sorted.map((ev) => (
            <li key={ev.id}>
              <AdminCard>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <AdminField label="Label" wide>
                    <TextInput value={ev.label} onChange={(label) => upsertCalendarEvent({ ...ev, label })} />
                  </AdminField>
                  <AdminField label="Date">
                    <TextInput
                      type="date"
                      value={ev.date}
                      onChange={(date) => upsertCalendarEvent({ ...ev, date })}
                    />
                  </AdminField>
                  <AdminField label="Until (optional)">
                    <TextInput
                      type="date"
                      value={ev.endDate ?? ''}
                      onChange={(endDate) => upsertCalendarEvent({ ...ev, endDate: endDate || undefined })}
                    />
                  </AdminField>
                  <AdminField label="Primogems">
                    <NumInput
                      value={ev.income?.primogems ?? 0}
                      step={10}
                      onChange={(primogems) =>
                        upsertCalendarEvent({ ...ev, income: { ...ev.income, primogems } })
                      }
                    />
                  </AdminField>
                  <AdminField label="Intertwined Fates">
                    <NumInput
                      value={ev.income?.intertwinedFates ?? 0}
                      onChange={(intertwinedFates) =>
                        upsertCalendarEvent({ ...ev, income: { ...ev.income, intertwinedFates } })
                      }
                    />
                  </AdminField>
                  <AdminField label="Version">
                    <SelectInput
                      value={ev.versionId ?? ''}
                      onChange={(versionId) => upsertCalendarEvent({ ...ev, versionId: versionId || undefined })}
                      options={[{ value: '', label: 'None' }, ...versions.map((v) => ({ value: v.id, label: v.name }))]}
                    />
                  </AdminField>
                  <AdminField label="Publish state">
                    <SelectInput<PublishState>
                      value={ev.publishState}
                      onChange={(publishState) => upsertCalendarEvent({ ...ev, publishState })}
                      options={PUBLISH_OPTIONS}
                    />
                  </AdminField>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-[12px] text-moon-dim">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-[var(--frost)]"
                      checked={ev.completionAdjustable ?? false}
                      onChange={(e) => upsertCalendarEvent({ ...ev, completionAdjustable: e.target.checked })}
                    />
                    Scales with the player's completion rate
                  </label>
                  <button
                    type="button"
                    className="text-[12px] text-moon-faint hover:text-danger"
                    onClick={() => removeCalendarEvent(ev.id)}
                  >
                    Remove
                  </button>
                </div>
              </AdminCard>
            </li>
          ))}
        </ul>
      )}
    </AdminSection>
  )
}
